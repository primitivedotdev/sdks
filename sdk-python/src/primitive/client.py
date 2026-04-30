from __future__ import annotations

import re
from dataclasses import dataclass
from http import HTTPStatus
from typing import Any, cast

from .api import DEFAULT_BASE_URL, AuthenticatedClient
from .api.api.sending.send_email import (
    asyncio_detailed as send_email_async_detailed,
)
from .api.api.sending.send_email import sync_detailed as send_email_sync_detailed
from .api.models.error_response import ErrorResponse
from .api.models.send_email_response_200 import SendEmailResponse200
from .api.models.send_mail_input import SendMailInput as ApiSendMailInput
from .api.models.send_mail_result import SendMailResult as ApiSendMailResult
from .api.types import UNSET
from .received_email import ReceivedEmail, format_address

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
DISPLAY_EMAIL_REGEX = re.compile(r"^.+<[^\s@]+@[^\s@]+\.[^\s@]+>$")
MAX_FROM_HEADER_LENGTH = 998
MAX_TO_HEADER_LENGTH = 320


@dataclass(frozen=True)
class SendThread:
    in_reply_to: str | None = None
    references: list[str] | None = None


@dataclass(frozen=True)
class SendResult:
    id: str
    status: str
    accepted: list[str]
    rejected: list[str]
    client_idempotency_key: str
    request_id: str
    content_hash: str
    queue_id: str | None
    delivery_status: str | None = None
    smtp_response_code: int | None = None
    smtp_response_text: str | None = None


class PrimitiveAPIError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        code: str | None = None,
        payload: Any = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.payload = payload


def _validate_address_header(field: str, value: str) -> None:
    value_length = len(value.strip())
    max_length = MAX_FROM_HEADER_LENGTH if field == "from" else MAX_TO_HEADER_LENGTH
    if value_length < 3:
        raise TypeError(f"{field} must be at least 3 characters")
    if value_length > max_length:
        raise TypeError(f"{field} must be at most {max_length} characters")


def _validate_email_address(field: str, value: str) -> None:
    if not EMAIL_REGEX.fullmatch(value) and not DISPLAY_EMAIL_REGEX.fullmatch(value):
        raise TypeError(f"{field} must be a valid email address")


def _build_send_input(
    *,
    from_email: str,
    to: str,
    subject: str,
    body_text: str | None = None,
    body_html: str | None = None,
    thread: SendThread | None = None,
    wait: bool | None = None,
    wait_timeout_ms: int | None = None,
) -> ApiSendMailInput:
    _validate_address_header("from", from_email)
    _validate_address_header("to", to)
    _validate_email_address("to", to)

    if subject.strip() == "":
        raise TypeError("subject must be a non-empty string")

    if not body_text and not body_html:
        raise TypeError("one of body_text or body_html is required")

    if wait_timeout_ms is not None and not 1000 <= wait_timeout_ms <= 30000:
        raise TypeError("wait_timeout_ms must be between 1000 and 30000")

    payload: dict[str, Any] = {
        "from": from_email,
        "to": to,
        "subject": subject,
    }
    if body_text is not None:
        payload["body_text"] = body_text
    if body_html is not None:
        payload["body_html"] = body_html

    if thread is not None:
        if thread.in_reply_to:
            payload["in_reply_to"] = thread.in_reply_to
        if thread.references:
            payload["references"] = thread.references
    if wait is not None:
        payload["wait"] = wait
    if wait_timeout_ms is not None:
        payload["wait_timeout_ms"] = wait_timeout_ms

    return ApiSendMailInput.from_dict(payload)


def _raise_api_error(status_code: int, parsed: Any) -> None:
    if isinstance(parsed, ErrorResponse):
        raise PrimitiveAPIError(
            parsed.error.message,
            status_code=status_code,
            code=parsed.error.code.value,
            payload=parsed.to_dict(),
        )

    raise PrimitiveAPIError(
        "Primitive API request failed",
        status_code=status_code,
        payload=parsed,
    )


def _map_send_result(result: ApiSendMailResult) -> SendResult:
    queue_id: str | None = (
        None if result.queue_id is UNSET else cast(str, result.queue_id)
    )
    delivery_status: str | None = (
        None
        if result.delivery_status is UNSET
        else cast(Any, result.delivery_status).value
    )
    smtp_response_code: int | None = (
        None
        if result.smtp_response_code is UNSET
        else cast(int | None, result.smtp_response_code)
    )
    smtp_response_text: str | None = (
        None
        if result.smtp_response_text is UNSET
        else cast(str, result.smtp_response_text)
    )
    return SendResult(
        id=result.id,
        status=result.status.value,
        accepted=result.accepted,
        rejected=result.rejected,
        client_idempotency_key=result.client_idempotency_key,
        request_id=result.request_id,
        content_hash=result.content_hash,
        queue_id=queue_id,
        delivery_status=delivery_status,
        smtp_response_code=smtp_response_code,
        smtp_response_text=smtp_response_text,
    )


def _build_forward_text(email: ReceivedEmail, intro: str | None) -> str:
    parts = []
    if intro:
        parts.extend([intro.strip(), ""])

    parts.extend(
        [
            "---------- Forwarded message ----------",
            f"From: {format_address(email.sender)}",
            f"To: {email.raw.email.headers.to}",
            f"Subject: {email.subject or ''}",
        ]
    )

    if email.raw.email.headers.date:
        parts.append(f"Date: {email.raw.email.headers.date}")
    if email.thread.message_id:
        parts.append(f"Message-ID: {email.thread.message_id}")

    parts.extend(["", email.text or ""])
    return "\n".join(parts).rstrip()


class PrimitiveClient:
    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        **client_kwargs: Any,
    ) -> None:
        self.api_client = AuthenticatedClient(
            base_url=base_url,
            token=api_key,
            **client_kwargs,
        )

    def send(
        self,
        *,
        from_email: str,
        to: str,
        subject: str,
        body_text: str | None = None,
        body_html: str | None = None,
        thread: SendThread | None = None,
        wait: bool | None = None,
        wait_timeout_ms: int | None = None,
        idempotency_key: str | None = None,
    ) -> SendResult:
        response = send_email_sync_detailed(
            client=self.api_client,
            **({"idempotency_key": idempotency_key} if idempotency_key else {}),
            body=_build_send_input(
                from_email=from_email,
                to=to,
                subject=subject,
                body_text=body_text,
                body_html=body_html,
                thread=thread,
                wait=wait,
                wait_timeout_ms=wait_timeout_ms,
            ),
        )

        if response.status_code == HTTPStatus.OK and isinstance(
            response.parsed,
            SendEmailResponse200,
        ):
            if response.parsed.data is UNSET:
                raise PrimitiveAPIError(
                    "Primitive API returned no send result",
                    status_code=int(response.status_code),
                    payload=response.content,
                )
            return _map_send_result(cast(ApiSendMailResult, response.parsed.data))

        _raise_api_error(int(response.status_code), response.parsed)
        raise AssertionError("unreachable")

    async def asend(
        self,
        *,
        from_email: str,
        to: str,
        subject: str,
        body_text: str | None = None,
        body_html: str | None = None,
        thread: SendThread | None = None,
        wait: bool | None = None,
        wait_timeout_ms: int | None = None,
        idempotency_key: str | None = None,
    ) -> SendResult:
        response = await send_email_async_detailed(
            client=self.api_client,
            **({"idempotency_key": idempotency_key} if idempotency_key else {}),
            body=_build_send_input(
                from_email=from_email,
                to=to,
                subject=subject,
                body_text=body_text,
                body_html=body_html,
                thread=thread,
                wait=wait,
                wait_timeout_ms=wait_timeout_ms,
            ),
        )

        if response.status_code == HTTPStatus.OK and isinstance(
            response.parsed,
            SendEmailResponse200,
        ):
            if response.parsed.data is UNSET:
                raise PrimitiveAPIError(
                    "Primitive API returned no send result",
                    status_code=int(response.status_code),
                    payload=response.content,
                )
            return _map_send_result(cast(ApiSendMailResult, response.parsed.data))

        _raise_api_error(int(response.status_code), response.parsed)
        raise AssertionError("unreachable")

    def reply(self, email: ReceivedEmail, text: str | dict[str, str]) -> SendResult:
        if isinstance(text, str):
            payload = {"text": text}
        else:
            payload = text

        return self.send(
            from_email=email.received_by,
            to=email.reply_target.address,
            subject=payload.get("subject") or email.reply_subject,
            body_text=payload["text"],
            thread=SendThread(
                in_reply_to=email.thread.message_id,
                references=(
                    [*email.thread.references, email.thread.message_id]
                    if email.thread.message_id is not None
                    else list(email.thread.references)
                ),
            ),
        )

    async def areply(
        self, email: ReceivedEmail, text: str | dict[str, str]
    ) -> SendResult:
        if isinstance(text, str):
            payload = {"text": text}
        else:
            payload = text

        return await self.asend(
            from_email=email.received_by,
            to=email.reply_target.address,
            subject=payload.get("subject") or email.reply_subject,
            body_text=payload["text"],
            thread=SendThread(
                in_reply_to=email.thread.message_id,
                references=(
                    [*email.thread.references, email.thread.message_id]
                    if email.thread.message_id is not None
                    else list(email.thread.references)
                ),
            ),
        )

    def forward(
        self,
        email: ReceivedEmail,
        *,
        to: str,
        body_text: str | None = None,
        subject: str | None = None,
        from_email: str | None = None,
    ) -> SendResult:
        return self.send(
            from_email=from_email or email.received_by,
            to=to,
            subject=subject or email.forward_subject,
            body_text=_build_forward_text(email, body_text),
        )

    async def aforward(
        self,
        email: ReceivedEmail,
        *,
        to: str,
        body_text: str | None = None,
        subject: str | None = None,
        from_email: str | None = None,
    ) -> SendResult:
        return await self.asend(
            from_email=from_email or email.received_by,
            to=to,
            subject=subject or email.forward_subject,
            body_text=_build_forward_text(email, body_text),
        )


def create_client(
    api_key: str,
    *,
    base_url: str = DEFAULT_BASE_URL,
    **client_kwargs: Any,
) -> PrimitiveClient:
    return PrimitiveClient(api_key, base_url=base_url, **client_kwargs)


def client(
    api_key: str,
    *,
    base_url: str = DEFAULT_BASE_URL,
    **client_kwargs: Any,
) -> PrimitiveClient:
    return PrimitiveClient(api_key, base_url=base_url, **client_kwargs)


__all__ = [
    "PrimitiveAPIError",
    "PrimitiveClient",
    "SendResult",
    "SendThread",
    "client",
    "create_client",
]
