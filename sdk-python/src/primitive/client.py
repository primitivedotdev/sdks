from __future__ import annotations

import json
import re
from dataclasses import dataclass
from http import HTTPStatus
from typing import Any, cast
from uuid import UUID

from .api import DEFAULT_BASE_URL, AuthenticatedClient
from .api.api.sending.reply_to_email import (
    asyncio_detailed as reply_to_email_async_detailed,
)
from .api.api.sending.reply_to_email import (
    sync_detailed as reply_to_email_sync_detailed,
)
from .api.api.sending.send_email import (
    asyncio_detailed as send_email_async_detailed,
)
from .api.api.sending.send_email import sync_detailed as send_email_sync_detailed
from .api.models.error_response import ErrorResponse
from .api.models.reply_input import ReplyInput as ApiReplyInput
from .api.models.reply_to_email_response_200 import ReplyToEmailResponse200
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


def _build_reply_input(
    *,
    body_text: str | None,
    body_html: str | None,
    from_email: str | None,
    wait: bool | None,
) -> ApiReplyInput:
    """Build the small ReplyInput body the server's reply endpoint expects.

    Recipients, subject, and threading headers are derived server-side
    from the inbound row, so this body is intentionally tiny.
    """
    return ApiReplyInput(
        body_text=body_text if body_text is not None else UNSET,
        body_html=body_html if body_html is not None else UNSET,
        from_=from_email if from_email is not None else UNSET,
        wait=wait if wait is not None else UNSET,
    )


def _unwrap_reply_response(response: Any) -> SendResult:
    """Map a reply_to_email response into the public SendResult shape.

    Reply responses share the SendMailResult envelope with send_email,
    so the success path delegates to _map_send_result for a single
    source of truth on field-name normalization.
    """
    if response.status_code == HTTPStatus.OK and isinstance(
        response.parsed,
        ReplyToEmailResponse200,
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
    text: str | dict[str, str | bool],
) -> tuple[str | None, str | None, str | None, bool | None]:
    """Normalize a reply input into ``(body_text, body_html, from, wait)``.

    The high-level ``reply()`` accepts either a bare string (treated as
    text) or a dict with ``text`` / ``html`` / ``from`` / ``wait``.
    ``subject`` is intentionally not accepted; a custom subject silently
    breaks Gmail's threading because Gmail's Conversation View needs a
    normalized-subject match in addition to References.
    """
    payload = {"text": text} if isinstance(text, str) else text
    # Reject subject before the empty-body check so a caller passing
    # ONLY a subject (e.g. `client.reply(email, {"subject": "X"})`)
    # gets the informative subject-rejection message instead of the
    # generic "reply requires text or html".
    if "subject" in payload:
        raise ValueError(
            "subject overrides are not supported on reply: a custom subject "
            "breaks Gmail's threading. Use client.send() if you need full control.",
        )
    body_text = payload.get("text")
    body_html = payload.get("html")
    if not body_text and not body_html:
        raise ValueError("reply requires text or html")
    raw_from = payload.get("from")
    raw_wait = payload.get("wait")
    return (
        body_text if isinstance(body_text, str) else None,
        body_html if isinstance(body_html, str) else None,
        raw_from if isinstance(raw_from, str) else None,
        raw_wait if isinstance(raw_wait, bool) else None,
    )


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
        text: str | dict[str, str | bool],
        *,
        from_email: str | None = None,
    ) -> SendResult:
        """Reply to an inbound email.

        Calls ``POST /emails/{id}/reply`` on the server. Recipients,
        subject (``Re: <parent>``), and threading headers are derived
        server-side from the inbound row. ``text`` can be a bare
        string or a dict with ``text`` / ``html`` / ``from`` / ``wait``.
        ``from_email`` is a kwarg shorthand for the same override.
        ``subject`` is intentionally not accepted because Gmail's
        threading needs a normalized-subject match in addition to
        References.
        """
        body_text, body_html, dict_from, wait = _resolve_reply_payload(text)
        return self._do_reply(
            email_id=email.id,
            body_text=body_text,
            body_html=body_html,
            from_email=from_email or dict_from,
            wait=wait,
        )

    async def areply(
        self,
        email: ReceivedEmail,
        text: str | dict[str, str | bool],
        *,
        from_email: str | None = None,
    ) -> SendResult:
        """Async version of :meth:`reply`."""
        body_text, body_html, dict_from, wait = _resolve_reply_payload(text)
        return await self._ado_reply(
            email_id=email.id,
            body_text=body_text,
            body_html=body_html,
            from_email=from_email or dict_from,
            wait=wait,
        )

    def _do_reply(
        self,
        *,
        email_id: str,
        body_text: str | None,
        body_html: str | None,
        from_email: str | None,
        wait: bool | None,
    ) -> SendResult:
        response = reply_to_email_sync_detailed(
            id=UUID(email_id),
            client=self.api_client,
            body=_build_reply_input(
                body_text=body_text,
                body_html=body_html,
                from_email=from_email,
                wait=wait,
            ),
        )
        return _unwrap_reply_response(response)

    async def _ado_reply(
        self,
        *,
        email_id: str,
        body_text: str | None,
        body_html: str | None,
        from_email: str | None,
        wait: bool | None,
    ) -> SendResult:
        response = await reply_to_email_async_detailed(
            id=UUID(email_id),
            client=self.api_client,
            body=_build_reply_input(
                body_text=body_text,
                body_html=body_html,
                from_email=from_email,
                wait=wait,
            ),
        )
        return _unwrap_reply_response(response)

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
