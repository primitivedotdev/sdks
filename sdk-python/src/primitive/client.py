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
from .api.models.send_input import SendInput as ApiSendInput
from .api.models.send_result import SendResult as ApiSendResult
from .api.types import UNSET
from .received_email import ReceivedEmail, format_address

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@dataclass(frozen=True)
class SendThread:
    in_reply_to: str | None = None
    references: list[str] | None = None


@dataclass(frozen=True)
class SendResult:
    id: Any
    status: Any
    smtp_code: int | None
    smtp_message: str | None
    remote_host: str | None
    service_message_id: str | None


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


def _validate_email_address(field: str, value: str) -> None:
    if not EMAIL_REGEX.fullmatch(value):
        raise TypeError(f"{field} must be a valid email address")


def _build_send_input(
    *,
    from_email: str,
    to: str,
    subject: str,
    text: str,
    thread: SendThread | None = None,
) -> ApiSendInput:
    _validate_email_address("from", from_email)
    _validate_email_address("to", to)

    if subject.strip() == "":
        raise TypeError("subject must be a non-empty string")

    if text == "":
        raise TypeError("text must be a non-empty string")

    payload: dict[str, Any] = {
        "from": from_email,
        "to": to,
        "subject": subject,
        "text": text,
    }

    if thread is not None:
        if thread.in_reply_to:
            payload["in_reply_to"] = thread.in_reply_to
        if thread.references:
            payload["references"] = thread.references

    return ApiSendInput.from_dict(payload)


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


def _map_send_result(result: ApiSendResult) -> SendResult:
    return SendResult(
        id=result.id,
        status=result.status,
        smtp_code=result.smtp_code,
        smtp_message=result.smtp_message,
        remote_host=result.remote_host,
        service_message_id=result.service_message_id,
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
        text: str,
        thread: SendThread | None = None,
    ) -> SendResult:
        response = send_email_sync_detailed(
            client=self.api_client,
            body=_build_send_input(
                from_email=from_email,
                to=to,
                subject=subject,
                text=text,
                thread=thread,
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
            return _map_send_result(cast(ApiSendResult, response.parsed.data))

        _raise_api_error(int(response.status_code), response.parsed)
        raise AssertionError("unreachable")

    async def asend(
        self,
        *,
        from_email: str,
        to: str,
        subject: str,
        text: str,
        thread: SendThread | None = None,
    ) -> SendResult:
        response = await send_email_async_detailed(
            client=self.api_client,
            body=_build_send_input(
                from_email=from_email,
                to=to,
                subject=subject,
                text=text,
                thread=thread,
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
            return _map_send_result(cast(ApiSendResult, response.parsed.data))

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
            text=payload["text"],
            thread=SendThread(
                in_reply_to=email.thread.message_id,
                references=(
                    [*email.thread.references, email.thread.message_id]
                    if email.thread.message_id is not None
                    else list(email.thread.references)
                ),
            ),
        )

    async def areply(self, email: ReceivedEmail, text: str | dict[str, str]) -> SendResult:
        if isinstance(text, str):
            payload = {"text": text}
        else:
            payload = text

        return await self.asend(
            from_email=email.received_by,
            to=email.reply_target.address,
            subject=payload.get("subject") or email.reply_subject,
            text=payload["text"],
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
        text: str | None = None,
        subject: str | None = None,
        from_email: str | None = None,
    ) -> SendResult:
        return self.send(
            from_email=from_email or email.received_by,
            to=to,
            subject=subject or email.forward_subject,
            text=_build_forward_text(email, text),
        )

    async def aforward(
        self,
        email: ReceivedEmail,
        *,
        to: str,
        text: str | None = None,
        subject: str | None = None,
        from_email: str | None = None,
    ) -> SendResult:
        return await self.asend(
            from_email=from_email or email.received_by,
            to=to,
            subject=subject or email.forward_subject,
            text=_build_forward_text(email, text),
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
