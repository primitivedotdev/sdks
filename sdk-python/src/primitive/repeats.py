"""Repeating sends: ``repeat.tick/1`` and ``repeat.stop/1``.

A send or reply with ``repeat`` goes out now and then again every few minutes in
the same thread. Each message carries a ``repeat.tick/1`` interaction part. When
the repeat allows it, the recipient stops it through
``POST /v1/emails/{id}/repeat-stop``, and the server replies in the thread with a
``repeat.stop/1`` part for the sender. These helpers only parse and build data;
they make no requests. A parsed part is not proof that Primitive sent the
message: use the server-verified ``repeat`` marker on the email for that.
"""

import re
from dataclasses import dataclass
from typing import Literal

from .interactions import parse_interaction_envelope

REPEAT_TICK_PROTOCOL = "repeat.tick"
REPEAT_STOP_PROTOCOL = "repeat.stop"
REPEAT_PROTOCOL_VERSION = 1
REPEAT_TICK_STEP = "tick"
REPEAT_STOP_STEP = "stop"
REPEAT_TICK_KIND = "repeat.tick/1"
REPEAT_STOP_KIND = "repeat.stop/1"
# Longest stop reason, in UTF-16 code units (astral characters count twice).
REPEAT_STOP_REASON_MAX = 280
REPEAT_EVERY_MIN_MINUTES = 1
REPEAT_EVERY_MAX_MINUTES = 10_080
REPEAT_IDLE_MAX_MINUTES = 10_080
_SAFE_INTEGER = 9_007_199_254_740_991
_UUID = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")


@dataclass(frozen=True)
class RepeatTick:
    """The ``repeat.tick/1`` payload, in its wire field names."""

    repeat_id: str
    sequence: int
    every_minutes: int
    only_if_recipient_idle_minutes: int | None
    stoppable_by_recipient: bool


@dataclass(frozen=True)
class RepeatTickResult:
    status: Literal["valid", "other", "invalid"]
    tick: RepeatTick | None = None
    reason: Literal["invalid_envelope", "invalid_step", "invalid_payload"] | None = None


@dataclass(frozen=True)
class RepeatStop:
    """The ``repeat.stop/1`` payload. ``reason`` is recipient-written and untrusted."""

    reason: str | None


@dataclass(frozen=True)
class RepeatStopResult:
    status: Literal["valid", "other", "invalid"]
    stop: RepeatStop | None = None
    reason: Literal["invalid_envelope", "invalid_step", "invalid_payload"] | None = None


def interaction_kind(envelope: dict[str, object]) -> str:
    """``protocol/protocol_version``, e.g. ``repeat.tick/1``."""
    version = envelope["protocol_version"]
    if isinstance(version, float) and version.is_integer():
        version = int(version)
    return f"{envelope['protocol']}/{version}"


def _integer_in(value: object, low: int, high: int) -> int | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if isinstance(value, float) and not value.is_integer():
        return None
    number = int(value)
    return number if low <= number <= high else None


def _is_protocol(envelope: dict[str, object], protocol: str) -> bool:
    version = envelope.get("protocol_version")
    return envelope.get("protocol") == protocol and not isinstance(version, bool) and version == 1


def read_repeat_tick(envelope: dict[str, object]) -> RepeatTickResult:
    """Read the tick payload from an envelope that already passed envelope validation."""
    if not _is_protocol(envelope, REPEAT_TICK_PROTOCOL):
        return RepeatTickResult("other")
    if envelope.get("step") != REPEAT_TICK_STEP:
        return RepeatTickResult("invalid", reason="invalid_step")
    invalid = RepeatTickResult("invalid", reason="invalid_payload")
    payload = envelope.get("payload")
    if not isinstance(payload, dict):
        return invalid
    repeat_id = payload.get("repeat_id")
    sequence = _integer_in(payload.get("sequence"), 1, _SAFE_INTEGER)
    interval = _integer_in(
        payload.get("every_minutes"), REPEAT_EVERY_MIN_MINUTES, REPEAT_EVERY_MAX_MINUTES
    )
    idle_raw = payload.get("only_if_recipient_idle_minutes", ...)
    idle = None if idle_raw is None else _integer_in(idle_raw, 1, REPEAT_IDLE_MAX_MINUTES)
    can_stop = payload.get("stoppable_by_recipient")
    if (
        not isinstance(repeat_id, str)
        or not _UUID.fullmatch(repeat_id)
        or sequence is None
        or interval is None
        or (idle_raw is not None and idle is None)
        or not isinstance(can_stop, bool)
    ):
        return invalid
    return RepeatTickResult(
        "valid",
        tick=RepeatTick(repeat_id.lower(), sequence, interval, idle, can_stop),
    )


def parse_repeat_tick(source: str | bytes) -> RepeatTickResult:
    """Parse ``interaction.json`` bytes and read a ``repeat.tick/1`` payload."""
    parsed = parse_interaction_envelope(source)
    if parsed.status != "valid" or parsed.envelope is None:
        return RepeatTickResult("invalid", reason="invalid_envelope")
    return read_repeat_tick(parsed.envelope)


def _utf16_length(value: str) -> int:
    return sum(2 if ord(char) > 0xFFFF else 1 for char in value)


def read_repeat_stop(envelope: dict[str, object]) -> RepeatStopResult:
    """Read the stop payload from an envelope that already passed envelope validation."""
    if not _is_protocol(envelope, REPEAT_STOP_PROTOCOL):
        return RepeatStopResult("other")
    if envelope.get("step") != REPEAT_STOP_STEP:
        return RepeatStopResult("invalid", reason="invalid_step")
    invalid = RepeatStopResult("invalid", reason="invalid_payload")
    payload = envelope.get("payload")
    if not isinstance(payload, dict):
        return invalid
    reason = payload.get("reason")
    if reason is None:
        return RepeatStopResult("valid", stop=RepeatStop(None))
    if not isinstance(reason, str) or reason == "" or _utf16_length(reason) > REPEAT_STOP_REASON_MAX:
        return invalid
    return RepeatStopResult("valid", stop=RepeatStop(reason))


def parse_repeat_stop(source: str | bytes) -> RepeatStopResult:
    """Parse ``interaction.json`` bytes and read a ``repeat.stop/1`` payload."""
    parsed = parse_interaction_envelope(source)
    if parsed.status != "valid" or parsed.envelope is None:
        return RepeatStopResult("invalid", reason="invalid_envelope")
    return read_repeat_stop(parsed.envelope)


def normalize_repeat_stop_reason(reason: str | None) -> str | None:
    """Trim ASCII whitespace; blank means no reason. Raises ValueError on invalid text."""
    if reason is None:
        return None
    if not isinstance(reason, str):
        raise TypeError("reason must be a string")
    trimmed = reason.strip(" \t\r\n")
    if trimmed == "":
        return None
    for char in trimmed:
        code = ord(char)
        if code < 0x20 or code == 0x7F:
            raise ValueError("reason must be one line without control characters")
        if 0xD800 <= code <= 0xDFFF:
            raise ValueError("reason must be valid Unicode text")
    if _utf16_length(trimmed) > REPEAT_STOP_REASON_MAX:
        raise ValueError(f"reason must be at most {REPEAT_STOP_REASON_MAX} characters")
    return trimmed


def build_repeat_stop_body(reason: str | None = None) -> dict[str, str]:
    """Request body for ``POST /v1/emails/{id}/repeat-stop``."""
    normalized = normalize_repeat_stop_reason(reason)
    return {} if normalized is None else {"reason": normalized}


def repeat_stop_command(email_id: str) -> str:
    """The CLI command that stops the repeat behind a received message."""
    if not isinstance(email_id, str) or not _UUID.fullmatch(email_id):
        raise ValueError("email_id must be an email UUID")
    return f"primitive repeat stop --id {email_id.lower()}"
