from __future__ import annotations

from dataclasses import dataclass
from email.utils import getaddresses
from typing import Any, cast

from .types import EmailAnalysis, EmailAuth, EmailReceivedEvent, WebhookAttachment
from .webhook import handle_webhook


@dataclass(frozen=True)
class ReceivedEmailAddress:
    address: str
    name: str | None = None


@dataclass(frozen=True)
class ReceivedEmailThread:
    message_id: str | None
    in_reply_to: list[str]
    references: list[str]


@dataclass(frozen=True)
class ReceivedEmail:
    id: str
    event_id: str
    received_at: str
    sender: ReceivedEmailAddress
    reply_target: ReceivedEmailAddress
    received_by: str
    received_by_all: list[str]
    subject: str | None
    reply_subject: str
    forward_subject: str
    text: str | None
    thread: ReceivedEmailThread
    attachments: list[WebhookAttachment]
    auth: EmailAuth
    analysis: EmailAnalysis
    raw: EmailReceivedEvent


def receive(
    *,
    body: str | bytes | bytearray | memoryview,
    headers: dict[str, object],
    secret: str,
    tolerance_seconds: int | None = None,
) -> ReceivedEmail:
    return normalize_received_email(
        handle_webhook(
            body=body,
            headers=headers,
            secret=secret,
            tolerance_seconds=tolerance_seconds,
        )
    )


def normalize_received_email(event: EmailReceivedEvent) -> ReceivedEmail:
    if not event.email.smtp.rcpt_to:
        raise ValueError("email.smtp.rcpt_to must contain at least one recipient")

    sender = _parse_address(event.email.headers.from_) or ReceivedEmailAddress(
        address=event.email.smtp.mail_from.strip().lower(),
        name=None,
    )
    reply_target = (
        _coerce_address(event.email.parsed.reply_to[0])
        if event.email.parsed.reply_to
        else sender
    )
    subject = event.email.headers.subject
    message_id = event.email.headers.message_id
    references = list(event.email.parsed.references or [])

    return ReceivedEmail(
        id=event.email.id,
        event_id=event.id,
        received_at=str(event.email.received_at),
        sender=sender,
        reply_target=reply_target,
        received_by=event.email.smtp.rcpt_to[0],
        received_by_all=list(event.email.smtp.rcpt_to),
        subject=subject,
        reply_subject=build_reply_subject(subject),
        forward_subject=build_forward_subject(subject),
        text=event.email.parsed.body_text,
        thread=ReceivedEmailThread(
            message_id=message_id,
            in_reply_to=list(event.email.parsed.in_reply_to or []),
            references=references,
        ),
        attachments=list(event.email.parsed.attachments or []),
        auth=event.email.auth,
        analysis=event.email.analysis,
        raw=event,
    )


def build_reply_subject(subject: str | None) -> str:
    trimmed = (subject or "").strip()
    if trimmed == "":
        return "Re:"
    return trimmed if trimmed.lower().startswith("re:") else f"Re: {trimmed}"


def build_forward_subject(subject: str | None) -> str:
    trimmed = (subject or "").strip()
    if trimmed == "":
        return "Fwd:"
    lowered = trimmed.lower()
    return trimmed if lowered.startswith(("fwd:", "fw:")) else f"Fwd: {trimmed}"


def format_address(address: ReceivedEmailAddress) -> str:
    return f"{address.name} <{address.address}>" if address.name else address.address


def _parse_address(value: str) -> ReceivedEmailAddress | None:
    addresses = getaddresses([value])
    if not addresses:
        return None

    name, address = addresses[0]
    if address == "":
        return None

    return ReceivedEmailAddress(address=address.strip().lower(), name=name or None)


def _coerce_address(address: Any) -> ReceivedEmailAddress:
    return ReceivedEmailAddress(
        address=str(cast(Any, address).address).strip().lower(),
        name=cast(Any, address).name or None,
    )
