from __future__ import annotations

import json
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
    # True when the response replays a previously-recorded send keyed
    # by ``client_idempotency_key`` (same key, same canonical payload).
    # False on a fresh send and on gate-denied responses.
    idempotent_replay: bool = False
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
        gates: list[dict[str, Any]] | None = None,
        request_id: str | None = None,
        retry_after: int | None = None,
        details: dict[str, Any] | None = None,
        payload: Any = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.gates = gates
        self.request_id = request_id
        self.retry_after = retry_after
        self.details = details
        self.payload = payload


def _validate_address_header(field: str, value: str) -> None:
    value_length = len(value.strip())
    max_length = MAX_FROM_HEADER_LENGTH if field == "from" else MAX_TO_HEADER_LENGTH
    if value_length < 3:
        raise ValueError(f"{field} must be at least 3 characters")
    if value_length > max_length:
        raise ValueError(f"{field} must be at most {max_length} characters")


def _validate_email_address(field: str, value: str) -> None:
    if not EMAIL_REGEX.fullmatch(value) and not DISPLAY_EMAIL_REGEX.fullmatch(value):
        raise ValueError(f"{field} must be a valid email address")


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
        raise ValueError("subject must be a non-empty string")

    if not body_text and not body_html:
        raise ValueError("one of body_text or body_html is required")

    if wait_timeout_ms is not None and not 1000 <= wait_timeout_ms <= 30000:
        raise ValueError("wait_timeout_ms must be between 1000 and 30000")

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


def _coerce_error_payload(content: Any) -> dict[str, Any] | None:
    """Best-effort fallback for response shapes the generated client did not parse.

    The generated SDK only typed the status codes declared in the OpenAPI spec.
    Anything else (today, the most common one is 429) lands here as raw bytes
    and would otherwise raise an opaque "Primitive API request failed".
    """
    if content is None:
        return None
    raw = bytes(content) if not isinstance(content, (str, bytes)) else content
    if isinstance(raw, str):
        raw = raw.encode("utf-8", errors="replace")
    if not raw:
        return None
    try:
        decoded = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        return None
    return decoded if isinstance(decoded, dict) else None


def _retry_after_from_headers(headers: Any) -> int | None:
    if headers is None:
        return None
    try:
        raw = headers.get("retry-after") or headers.get("Retry-After")
    except AttributeError:
        return None
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _raise_api_error(response: Any) -> None:
    status_code = int(response.status_code)
    parsed = response.parsed
    retry_after = _retry_after_from_headers(getattr(response, "headers", None))

    if isinstance(parsed, ErrorResponse):
        gates = (
            [gate.to_dict() for gate in parsed.error.gates]
            if parsed.error.gates is not UNSET and parsed.error.gates
            else None
        )
        request_id = (
            cast(str, parsed.error.request_id)
            if parsed.error.request_id is not UNSET
            else None
        )
        details = (
            cast(Any, parsed.error.details).to_dict()
            if parsed.error.details is not UNSET
            else None
        )
        raise PrimitiveAPIError(
            parsed.error.message,
            status_code=status_code,
            code=parsed.error.code.value,
            gates=gates,
            request_id=request_id,
            retry_after=retry_after,
            details=details,
            payload=parsed.to_dict(),
        )

    fallback = _coerce_error_payload(getattr(response, "content", None))
    if fallback is not None and isinstance(fallback.get("error"), dict):
        err = fallback["error"]
        raise PrimitiveAPIError(
            str(err.get("message") or "Primitive API request failed"),
            status_code=status_code,
            code=err.get("code"),
            gates=err.get("gates"),
            request_id=err.get("request_id"),
            retry_after=retry_after,
            details=err.get("details"),
            payload=fallback,
        )

    raise PrimitiveAPIError(
        "Primitive API request failed",
        status_code=status_code,
        retry_after=retry_after,
        payload=fallback if fallback is not None else parsed,
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
        idempotent_replay=result.idempotent_replay,
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


def _resolve_reply_payload(
    text: str | dict[str, str],
) -> tuple[str, str | None, str | None]:
    payload = {"text": text} if isinstance(text, str) else text
    body_text = payload.get("text")
    if not body_text:
        raise ValueError("reply text must be a non-empty string")
    return body_text, payload.get("subject"), payload.get("from")


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

        _raise_api_error(response)
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

        _raise_api_error(response)
        raise AssertionError("unreachable")

    def reply(
        self,
        email: ReceivedEmail,
        text: str | dict[str, str],
        *,
        from_email: str | None = None,
    ) -> SendResult:
        body_text, subject, dict_from = _resolve_reply_payload(text)

        return self.send(
            from_email=from_email or dict_from or email.received_by,
            to=email.reply_target.address,
            subject=subject or email.reply_subject,
            body_text=body_text,
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
        self,
        email: ReceivedEmail,
        text: str | dict[str, str],
        *,
        from_email: str | None = None,
    ) -> SendResult:
        body_text, subject, dict_from = _resolve_reply_payload(text)

        return await self.asend(
            from_email=from_email or dict_from or email.received_by,
            to=email.reply_target.address,
            subject=subject or email.reply_subject,
            body_text=body_text,
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
