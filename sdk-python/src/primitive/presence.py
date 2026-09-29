"""Pure presence controls. Parsing/preparation establish neither identity nor freshness."""

import base64
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Literal, cast

if TYPE_CHECKING:
    from .interactions import InteractionResult

PRESENCE_PROTOCOL = "primitive.presence"
PRESENCE_VERSION = 1
PRESENCE_TTL_MS = 600_000
MAX_PRESENCE_ENVELOPE_BYTES = 4096
MAX_PRESENCE_DECODED_BYTES = 8192
MAX_PRESENCE_RENDERED_BYTES = 16384
PRESENCE_PROBE_TEXT = "This email checks whether your receiver is available."
PRESENCE_ALIVE_TEXT = "This receiver answered the presence check."
PRESENCE_PROBE_SUBJECT = "Receiver presence check"
PRESENCE_ALIVE_SUBJECT = "Re: Receiver presence check"
_UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
_NONCE = re.compile(r"(?:[0-9a-f]{32}|[0-9a-f]{64})")
_LABEL = r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
_HOST = re.compile(rf"{_LABEL}(?:\.{_LABEL})+")
_ATOM = r"[a-z0-9!#$%&'*+/=?^_`{|}~-]+"
_MAILBOX = re.compile(rf"{_ATOM}(?:\.{_ATOM})*@{_LABEL}(?:\.{_LABEL})+")
_KEYS = {
    "interaction_version",
    "interaction_id",
    "protocol",
    "protocol_version",
    "step",
    "step_id",
    "prev_step_id",
    "expires_at",
    "payload",
}


@dataclass(frozen=True)
class PresenceProbeInput:
    account_scope: str
    from_email: str
    to: str


@dataclass(frozen=True)
class PresenceAliveInput(PresenceProbeInput):
    probe: dict[str, object]
    message_id: str | None
    references: tuple[str, ...]


@dataclass(frozen=True)
class PreparedPresence:
    account_scope: str
    prepared_at_ms: int
    expires_at_ms: int
    idempotency_key: str
    request_json: str


@dataclass(frozen=True)
class PresencePreparation:
    status: Literal["waiting_on_parent", "prepared"]
    prepared: PreparedPresence | None = None


def _check(value: bool, message: str) -> None:
    if not value:
        raise ValueError(message)


def _clock(value: int) -> int:
    _check(type(value) is int and 0 <= value <= 253402300799999, "invalid clock")
    return value


def _timestamp(value: object) -> int | None:
    if not isinstance(value, str) or not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z", value, flags=re.ASCII
    ):
        return None
    try:
        date = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ").replace(
            tzinfo=timezone.utc
        )
        delta = date - datetime(1970, 1, 1, tzinfo=timezone.utc)
        millis = (
            delta.days * 86400000 + delta.seconds * 1000 + delta.microseconds // 1000
        )
        return millis if 0 <= millis <= 253402300799999 else None
    except ValueError:
        return None


def _date(value: int) -> str:
    return (
        datetime.fromtimestamp(value // 1000, timezone.utc)
        .replace(microsecond=value % 1000 * 1000)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _mailbox(value: object) -> bool:
    return (
        isinstance(value, str)
        and len(value) <= 320
        and bool(_MAILBOX.fullmatch(value))
        and len(value.split("@")[1]) <= 253
    )


def _shape(value: object) -> dict[str, object] | None:
    from .interactions import validate_interaction_envelope

    result = validate_interaction_envelope(value)
    e = result.envelope
    if (
        result.status != "valid"
        or e is None
        or set(e) != _KEYS
        or e["protocol"] != PRESENCE_PROTOCOL
        or e["protocol_version"] != 1
    ):
        return None
    iid, sid, prev, step = (
        e["interaction_id"],
        e["step_id"],
        e["prev_step_id"],
        e["step"],
    )
    if not isinstance(iid, str) or not isinstance(sid, str):
        return None
    parts = iid.split("@")
    if (
        len(parts) != 2
        or not _UUID.fullmatch(parts[0])
        or not _HOST.fullmatch(parts[1])
        or len(parts[1]) > 253
        or not _UUID.fullmatch(sid)
        or parts[0] == sid
    ):
        return None
    if step not in ("probe", "alive"):
        return None
    if (
        step == "probe"
        and prev is not None
        or step == "alive"
        and (
            not isinstance(prev, str)
            or not _UUID.fullmatch(prev)
            or prev in (sid, parts[0])
        )
    ):
        return None
    p = e["payload"]
    if not isinstance(p, dict):
        return None
    payload = cast(dict[str, object], p)
    nonce = payload.get("nonce")
    if (
        set(payload) != {"nonce", "issued_at", "address"}
        or not isinstance(nonce, str)
        or not _NONCE.fullmatch(nonce)
        or not _mailbox(payload.get("address"))
    ):
        return None
    issued, expires = _timestamp(payload["issued_at"]), _timestamp(e["expires_at"])
    return (
        e
        if issued is not None
        and expires is not None
        and expires - issued == PRESENCE_TTL_MS
        else None
    )


def parse_presence_envelope(source: str | bytes) -> "InteractionResult":
    """Strict syntax only. Expired authentic controls retain their valid shape."""
    from .interactions import InteractionResult, parse_interaction_envelope

    if type(source) not in (str, bytes):
        return InteractionResult("invalid", reason="invalid_input")
    try:
        if (
            len(source) > MAX_PRESENCE_ENVELOPE_BYTES
            or isinstance(source, str)
            and len(source.encode("utf-8")) > MAX_PRESENCE_ENVELOPE_BYTES
        ):
            return InteractionResult("invalid", reason="too_large")
    except UnicodeError:
        return InteractionResult("invalid", reason="invalid_json")
    parsed = parse_interaction_envelope(source)
    if parsed.status != "valid":
        return parsed
    e = parsed.envelope
    if (
        e is not None
        and e["protocol"] == PRESENCE_PROTOCOL
        and e["protocol_version"] != 1
    ):
        return InteractionResult(
            "unsupported",
            version=int(cast(float, e["protocol_version"])),
            text=parsed.text,
            source_bytes=parsed.source_bytes,
        )
    envelope = _shape(e)
    return (
        InteractionResult(
            "valid",
            envelope=envelope,
            text=parsed.text,
            source_bytes=parsed.source_bytes,
        )
        if envelope is not None
        else InteractionResult("invalid", reason="invalid_presence")
    )


def _context(value: PresenceProbeInput) -> tuple[str, str]:
    _check(
        isinstance(value.account_scope, str)
        and 0 < len(value.account_scope) <= 256
        and bool(re.fullmatch(r"[\x20-\x7e]+", value.account_scope)),
        "invalid account scope",
    )
    _check(
        isinstance(value.from_email, str) and isinstance(value.to, str),
        "invalid mailbox",
    )
    _check(
        value.from_email.isascii() and value.to.isascii(),
        "use one bare ASCII mailbox per address",
    )
    sender, recipient = value.from_email.lower(), value.to.lower()
    _check(
        _mailbox(sender) and _mailbox(recipient),
        "use one bare ASCII mailbox per address",
    )
    return sender, recipient


def _uuid(callback: Callable[[], str]) -> str:
    value = callback().lower()
    _check(bool(_UUID.fullmatch(value)), "invalid UUID")
    return value


def _message_id(value: str) -> str:
    _check(isinstance(value, str) and len(value) <= 1024, "invalid Message-ID")
    value = value.strip(" ")
    if value.startswith("<") and value.endswith(">"):
        value = value[1:-1]
    _check(
        len(value) <= 996
        and bool(re.fullmatch(r"[!-~]+@[!-~]+", value))
        and not re.search(r"[<>]", value)
        and value.count("@") == 1,
        "invalid Message-ID",
    )
    return f"<{value}>"


def _prepare(
    value: PresenceProbeInput,
    e: dict[str, object],
    observed: int,
    threading: dict[str, object] | None = None,
) -> PresencePreparation:
    from .signals import _json

    sender, recipient = _context(value)
    payload = cast(dict[str, object], e["payload"])
    canonical = {
        key: e[key]
        for key in (
            "interaction_version",
            "interaction_id",
            "protocol",
            "protocol_version",
            "step",
            "step_id",
            "prev_step_id",
            "expires_at",
        )
    }
    canonical["interaction_version"] = 1
    canonical["protocol_version"] = 1
    canonical["payload"] = {
        key: payload[key] for key in ("nonce", "issued_at", "address")
    }
    encoded = _json(canonical).encode("utf-8")
    text = PRESENCE_PROBE_TEXT if e["step"] == "probe" else PRESENCE_ALIVE_TEXT
    _check(
        len(encoded) <= MAX_PRESENCE_ENVELOPE_BYTES
        and len(encoded) + len(text) <= MAX_PRESENCE_DECODED_BYTES,
        "presence content too large",
    )
    attachment = base64.b64encode(encoded).decode("ascii")
    budget = (
        4096
        + len(sender)
        + len(recipient)
        + len(attachment)
        + ((len(attachment) + 75) // 76) * 2
        + len(text)
    )
    if threading is not None:
        budget += len(cast(str, threading["in_reply_to"])) + len(
            " ".join(cast(list[str], threading["references"]))
        )
    _check(budget <= MAX_PRESENCE_RENDERED_BYTES, "presence carrier too large")
    body: dict[str, object] = {
        "from": sender,
        "to": recipient,
        "subject": PRESENCE_PROBE_SUBJECT
        if e["step"] == "probe"
        else PRESENCE_ALIVE_SUBJECT,
        "body_text": text,
    }
    body.update(threading or {})
    body["attachments"] = [
        {
            "filename": "interaction.json",
            "content_type": "application/json",
            "content_base64": attachment,
        }
    ]
    expiry = _timestamp(e["expires_at"])
    assert expiry is not None
    return PresencePreparation(
        "prepared",
        PreparedPresence(
            value.account_scope,
            observed,
            expiry,
            f"presence-{e['step_id']}",
            _json(body),
        ),
    )


def prepare_presence_probe_email(
    value: PresenceProbeInput,
    *,
    uuid: Callable[[], str],
    nonce: Callable[[], str],
    now: Callable[[], int],
) -> PresencePreparation:
    sender, recipient = _context(value)
    observed = _clock(now())
    _clock(observed + PRESENCE_TTL_MS)
    interaction, step, random = _uuid(uuid), _uuid(uuid), nonce()
    _check(interaction != step, "distinct UUIDs are required")
    _check(
        isinstance(random, str) and bool(_NONCE.fullmatch(random)),
        "nonce must be 128 or 256 bits of lowercase hex",
    )
    e: dict[str, object] = {
        "interaction_version": 1,
        "interaction_id": f"{interaction}@{sender.split('@')[1]}",
        "protocol": PRESENCE_PROTOCOL,
        "protocol_version": 1,
        "step": "probe",
        "step_id": step,
        "prev_step_id": None,
        "expires_at": _date(observed + PRESENCE_TTL_MS),
        "payload": {
            "nonce": random,
            "issued_at": _date(observed),
            "address": recipient,
        },
    }
    return _prepare(value, e, observed)


def prepare_presence_alive_email(
    value: PresenceAliveInput, *, uuid: Callable[[], str], now: Callable[[], int]
) -> PresencePreparation:
    """Caller verifies origin, exact bytes, binding and server freshness first."""
    if value.message_id is None or value.message_id == "":
        return PresencePreparation("waiting_on_parent")
    target, (sender, _) = _message_id(value.message_id), _context(value)
    probe = _shape(value.probe)
    _check(probe is not None and probe["step"] == "probe", "a valid probe is required")
    assert probe is not None
    payload = cast(dict[str, object], probe["payload"])
    _check(sender == payload["address"], "probe recipient mismatch")
    _check(len(value.references) <= 1000, "too many references")
    references = [
        ref for item in value.references if (ref := _message_id(item)) != target
    ] + [target]
    while len(references) > 100 or len(" ".join(references)) > 8192:
        references = references[1:]
    observed, step = _clock(now()), _uuid(uuid)
    _check(
        step
        not in (probe["step_id"], cast(str, probe["interaction_id"]).split("@")[0]),
        "distinct UUIDs are required",
    )
    e = {
        **probe,
        "step": "alive",
        "step_id": step,
        "prev_step_id": probe["step_id"],
        "payload": dict(payload),
    }
    return _prepare(
        value, e, observed, {"in_reply_to": target, "references": references}
    )
