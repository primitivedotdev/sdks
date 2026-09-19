"""Explicit optional email signals; no automatic emission or persistence."""

import base64
import json
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Generic, Literal, TypeVar


@dataclass(frozen=True)
class SignalParent:
    account_scope: str
    from_email: str
    to: str
    message_id: str | None
    subject: str | None
    references: tuple[str, ...]


@dataclass(frozen=True)
class SignalInput:
    parent: SignalParent
    kind: Literal["ack", "read", "working", "typing"]
    status: Literal["received", "will_process", "will_not_process"] | None = None
    note: str | None = None
    expires_at_ms: int | None = None


@dataclass(frozen=True)
class PreparedSignal:
    """Persist all fields before dispatch. request_json fixes the send body."""

    account_scope: str
    prepared_at_ms: int
    expires_at_ms: int | None
    idempotency_key: str
    request_json: str


@dataclass(frozen=True)
class SignalPreparation:
    status: Literal["waiting_on_parent", "prepared"]
    prepared: PreparedSignal | None = None


@dataclass(frozen=True)
class ExpiredSignal:
    """Local refusal only. Reconcile the saved key if any attempt may have run."""

    idempotency_key: str
    status: Literal["expired"] = "expired"


_UUID = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)
_ATOM = r"[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+"
_LABEL = r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
_MAILBOX = re.compile(rf"{_ATOM}(?:\.{_ATOM})*@{_LABEL}(?:\.{_LABEL})*")
_BODIES = {
    "received": "Received your message.",
    "will_process": "I intend to process your message.",
    "will_not_process": "I will not process your message.",
}


def _check(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def _header(value: str, limit: int) -> None:
    _check(
        not re.search(r"[\x00-\x1f\x7f]", value)
        and len(value.encode("utf-8")) <= limit,
        "invalid header",
    )


def _wire_id(value: str) -> str:
    value = value.strip(" ")
    if value.startswith("<") and value.endswith(">"):
        value = value[1:-1]
    _check(
        bool(re.fullmatch(r"[!-~]+@[!-~]+", value))
        and not re.search(r"[<>]", value)
        and value.count("@") == 1
        and len(value) <= 996,
        "invalid Message-ID",
    )
    return f"<{value}>"


def _json(value: object) -> str:
    return (
        json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def _milliseconds(value: int) -> None:
    _check(
        type(value) is int and 0 <= value <= 253402300799999, "invalid clock or expiry"
    )


def prepare_signal_email(
    signal: SignalInput, *, uuid: Callable[[], str], now: Callable[[], int]
) -> SignalPreparation:
    parent = signal.parent
    if parent.message_id is None or parent.message_id == "":
        return SignalPreparation("waiting_on_parent")
    target = _wire_id(parent.message_id)
    for address in (parent.from_email, parent.to):
        _header(address, 320)
        _check(bool(_MAILBOX.fullmatch(address)), "use one bare mailbox per address")
    subject = parent.subject or ""
    _header(subject, 998)
    _header(parent.account_scope, 256)
    _check(bool(parent.account_scope), "account_scope is required")
    _check(len(parent.references) <= 1000, "too many references")
    references = [
        ref for value in parent.references if (ref := _wire_id(value)) != target
    ]
    references.append(target)
    length = sum(len(ref) + 1 for ref in references) - 1
    start = 0
    while len(references) - start > 100 or length > 8192:
        length -= len(references[start]) + 1
        start += 1
    references = references[start:]
    observed = now()
    _milliseconds(observed)
    expires = None
    payload = {"subject_message_id": target}
    if signal.kind == "ack":
        _check(signal.status in _BODIES, "invalid ACK status")
        assert signal.status is not None
        payload["status"] = signal.status
        if signal.note is not None:
            _check(
                len(signal.note.encode("utf-16-le")) <= 4000
                and "\0" not in signal.note,
                "note exceeds 2000 UTF-16 units",
            )
            payload["note"] = signal.note
    elif signal.kind != "read":
        _check(signal.kind in ("working", "typing"), "invalid signal kind")
        _check(signal.expires_at_ms is not None, f"{signal.kind} expiry is required")
        assert signal.expires_at_ms is not None
        _milliseconds(signal.expires_at_ms)
        _check(
            0 < signal.expires_at_ms - observed <= 60000,
            f"{signal.kind} expiry must be within 60 seconds",
        )
        expires = signal.expires_at_ms
    interaction, step = uuid().lower(), uuid().lower()
    _check(
        bool(_UUID.fullmatch(interaction))
        and bool(_UUID.fullmatch(step))
        and interaction != step,
        "two distinct UUIDs are required",
    )
    envelope = {
        "interaction_version": 1,
        "interaction_id": f"{interaction}@{parent.to.split('@')[1]}",
        "protocol": signal.kind,
        "protocol_version": 1,
        "step": signal.kind,
        "step_id": step,
        "prev_step_id": None,
        "expires_at": None
        if expires is None
        else datetime.fromtimestamp(expires // 1000, timezone.utc)
        .replace(microsecond=expires % 1000 * 1000)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z"),
        "payload": payload,
    }
    encoded = _json(envelope).encode("utf-8")
    _check(len(encoded) <= 65536, "signal exceeds 64 KiB")
    body = {
        "from": parent.to,
        "to": parent.from_email,
        "subject": subject or "Re: Your message",
        "body_text": _signal_text(signal.kind, signal.status, signal.note),
        "in_reply_to": target,
        "references": references,
        "attachments": [
            {
                "filename": "interaction.json",
                "content_type": "application/json",
                "content_base64": base64.b64encode(encoded).decode("ascii"),
            }
        ],
    }
    return SignalPreparation(
        "prepared",
        PreparedSignal(
            parent.account_scope, observed, expires, f"signal-{step}", _json(body)
        ),
    )


T = TypeVar("T")


@dataclass(frozen=True)
class SignalResponse(Generic[T]):
    result: T
    status: Literal["response"] = "response"


async def send_prepared_signal(
    send_mail: Callable[[dict[str, object], str], Awaitable[T]],
    prepared: PreparedSignal,
    *,
    account_scope: str,
    now: Callable[[], int],
) -> SignalResponse[T] | ExpiredSignal:
    """Check scope and expiry when awaited, then make one ordinary send attempt.

    A fresh request copy protects subsequent retries. Exceptions propagate.
    """
    _check(
        bool(account_scope) and account_scope == prepared.account_scope,
        "account scope mismatch",
    )
    observed = now()
    _milliseconds(observed)
    if prepared.expires_at_ms is not None and observed >= prepared.expires_at_ms:
        return ExpiredSignal(prepared.idempotency_key)
    return SignalResponse(
        await send_mail(json.loads(prepared.request_json), prepared.idempotency_key)
    )


def _signal_text(kind: str, status: str | None = None, note: str | None = None) -> str:
    if kind == "read":
        return "I read your message."
    if kind == "working":
        return "I am working on your message."
    if kind == "typing":
        return "I am composing a reply to your message."
    text = _BODIES.get(status or "", "")
    return text if note is None else text + "\n\n" + note
