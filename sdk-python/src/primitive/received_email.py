from __future__ import annotations

import re
from dataclasses import dataclass
from email.utils import getaddresses
from typing import Any, cast

from .types import EmailAnalysis, EmailAuth, EmailReceivedEvent, WebhookAttachment
from .webhook import handle_webhook

_REPLY_PREFIX_RE = re.compile(r"^re\s*:", re.IGNORECASE)
_FORWARD_PREFIX_RE = re.compile(r"^(fwd?|fw)\s*:", re.IGNORECASE)
# Conservative addr-spec check: local-part @ domain . tld with no whitespace,
# brackets, or `@` inside any of the parts. Matches the validator/isEmail
# behaviour the Node SDK uses (require_tld) so the three SDKs agree on what a
# parseable header address looks like.
_HEADER_ADDR_RE = re.compile(r"^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$")
_MAX_HEADER_BYTES = 998


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

    sender = parse_header_address(
        event.email.headers.from_
    ) or ReceivedEmailAddress(
        address=event.email.smtp.mail_from.strip().lower(),
        name=None,
    )
    reply_target = sender
    if event.email.parsed.reply_to:
        coerced = _coerce_address(event.email.parsed.reply_to[0])
        if coerced is not None:
            reply_target = coerced
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
    return trimmed if _REPLY_PREFIX_RE.match(trimmed) else f"Re: {trimmed}"


def build_forward_subject(subject: str | None) -> str:
    trimmed = (subject or "").strip()
    if trimmed == "":
        return "Fwd:"
    return trimmed if _FORWARD_PREFIX_RE.match(trimmed) else f"Fwd: {trimmed}"


def format_address(address: ReceivedEmailAddress) -> str:
    return f"{address.name} <{address.address}>" if address.name else address.address


def parse_header_address(value: str | None) -> ReceivedEmailAddress | None:
    """Parse a single RFC 5322 header address (From, Sender, Reply-To).

    Lenient about quirky headers (unquoted commas in display names, missing
    closing angle brackets) but strict about the resulting address: the
    extracted addr-spec must look like a real email or this returns None and
    the normalizer falls back to the SMTP envelope sender.
    """
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    if len(trimmed.encode("utf-8")) > _MAX_HEADER_BYTES:
        return None

    for name, address in getaddresses([trimmed]):
        if not address:
            continue
        candidate = address.strip()
        if _HEADER_ADDR_RE.fullmatch(candidate):
            return ReceivedEmailAddress(
                address=candidate.lower(),
                name=(name.strip() or None) if name else None,
            )
    return None


# Backwards-compatible alias for the prior internal name.
_parse_address = parse_header_address


def _coerce_address(address: Any) -> ReceivedEmailAddress | None:
    raw = cast(Any, address).address
    if not isinstance(raw, str):
        return None
    candidate = raw.strip()
    if not _HEADER_ADDR_RE.fullmatch(candidate):
        return None
    name = cast(Any, address).name
    return ReceivedEmailAddress(
        address=candidate.lower(),
        name=(name.strip() or None) if isinstance(name, str) and name else None,
    )
