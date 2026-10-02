"""Scheduled messages to agents: ``schedule.tick/1`` and ``schedule.stop/1``.

Each scheduled message carries a ``schedule.tick/1`` interaction part. When the
schedule allows it, the agent stops the schedule through
``POST /v1/emails/{id}/schedule-stop``, and the server replies in the thread
with a ``schedule.stop/1`` interaction for the owner. These helpers only parse
and build data; they make no requests. A parsed interaction is still untrusted
until the carrying email authenticates as the expected sender.
"""

import re
from dataclasses import dataclass
from typing import Literal

from .interactions import parse_interaction_envelope

SCHEDULE_TICK_PROTOCOL = "schedule.tick"
SCHEDULE_STOP_PROTOCOL = "schedule.stop"
SCHEDULE_PROTOCOL_VERSION = 1
SCHEDULE_TICK_STEP = "tick"
SCHEDULE_STOP_STEP = "stop"
SCHEDULE_TICK_KIND = "schedule.tick/1"
SCHEDULE_STOP_KIND = "schedule.stop/1"
# Longest stop reason, in UTF-16 code units (astral characters count twice).
SCHEDULE_STOP_REASON_MAX = 280
SCHEDULE_INTERVAL_MIN_MINUTES = 5
SCHEDULE_INTERVAL_MAX_MINUTES = 10_080
SCHEDULE_IDLE_MAX_MINUTES = 10_080
_SAFE_INTEGER = 9_007_199_254_740_991
_UUID = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")


@dataclass(frozen=True)
class ScheduleTick:
    """The ``schedule.tick/1`` payload, in its wire field names."""

    schedule_id: str
    sequence: int
    interval_minutes: int
    idle_minutes: int | None
    agent_can_stop: bool


@dataclass(frozen=True)
class ScheduleTickResult:
    status: Literal["valid", "other", "invalid"]
    tick: ScheduleTick | None = None
    reason: Literal["invalid_envelope", "invalid_step", "invalid_payload"] | None = None


@dataclass(frozen=True)
class ScheduleStop:
    """The ``schedule.stop/1`` payload. ``reason`` is agent-written and untrusted."""

    reason: str | None


@dataclass(frozen=True)
class ScheduleStopResult:
    status: Literal["valid", "other", "invalid"]
    stop: ScheduleStop | None = None
    reason: Literal["invalid_envelope", "invalid_step", "invalid_payload"] | None = None


def interaction_kind(envelope: dict[str, object]) -> str:
    """``protocol/protocol_version``, e.g. ``schedule.tick/1``."""
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


def read_schedule_tick(envelope: dict[str, object]) -> ScheduleTickResult:
    """Read the tick payload from an envelope that already passed envelope validation."""
    if not _is_protocol(envelope, SCHEDULE_TICK_PROTOCOL):
        return ScheduleTickResult("other")
    if envelope.get("step") != SCHEDULE_TICK_STEP:
        return ScheduleTickResult("invalid", reason="invalid_step")
    invalid = ScheduleTickResult("invalid", reason="invalid_payload")
    payload = envelope.get("payload")
    if not isinstance(payload, dict):
        return invalid
    schedule_id = payload.get("schedule_id")
    sequence = _integer_in(payload.get("sequence"), 1, _SAFE_INTEGER)
    interval = _integer_in(
        payload.get("interval_minutes"), SCHEDULE_INTERVAL_MIN_MINUTES, SCHEDULE_INTERVAL_MAX_MINUTES
    )
    idle_raw = payload.get("idle_minutes", ...)
    idle = None if idle_raw is None else _integer_in(idle_raw, 1, SCHEDULE_IDLE_MAX_MINUTES)
    can_stop = payload.get("agent_can_stop")
    if (
        not isinstance(schedule_id, str)
        or not _UUID.fullmatch(schedule_id)
        or sequence is None
        or interval is None
        or (idle_raw is not None and idle is None)
        or not isinstance(can_stop, bool)
    ):
        return invalid
    return ScheduleTickResult(
        "valid",
        tick=ScheduleTick(schedule_id.lower(), sequence, interval, idle, can_stop),
    )


def parse_schedule_tick(source: str | bytes) -> ScheduleTickResult:
    """Parse ``interaction.json`` bytes and read a ``schedule.tick/1`` payload."""
    parsed = parse_interaction_envelope(source)
    if parsed.status != "valid" or parsed.envelope is None:
        return ScheduleTickResult("invalid", reason="invalid_envelope")
    return read_schedule_tick(parsed.envelope)


def _utf16_length(value: str) -> int:
    return sum(2 if ord(char) > 0xFFFF else 1 for char in value)


def read_schedule_stop(envelope: dict[str, object]) -> ScheduleStopResult:
    """Read the stop payload from an envelope that already passed envelope validation."""
    if not _is_protocol(envelope, SCHEDULE_STOP_PROTOCOL):
        return ScheduleStopResult("other")
    if envelope.get("step") != SCHEDULE_STOP_STEP:
        return ScheduleStopResult("invalid", reason="invalid_step")
    invalid = ScheduleStopResult("invalid", reason="invalid_payload")
    payload = envelope.get("payload")
    if not isinstance(payload, dict):
        return invalid
    reason = payload.get("reason")
    if reason is None:
        return ScheduleStopResult("valid", stop=ScheduleStop(None))
    if not isinstance(reason, str) or reason == "" or _utf16_length(reason) > SCHEDULE_STOP_REASON_MAX:
        return invalid
    return ScheduleStopResult("valid", stop=ScheduleStop(reason))


def parse_schedule_stop(source: str | bytes) -> ScheduleStopResult:
    """Parse ``interaction.json`` bytes and read a ``schedule.stop/1`` payload."""
    parsed = parse_interaction_envelope(source)
    if parsed.status != "valid" or parsed.envelope is None:
        return ScheduleStopResult("invalid", reason="invalid_envelope")
    return read_schedule_stop(parsed.envelope)


def normalize_schedule_stop_reason(reason: str | None) -> str | None:
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
    if _utf16_length(trimmed) > SCHEDULE_STOP_REASON_MAX:
        raise ValueError(f"reason must be at most {SCHEDULE_STOP_REASON_MAX} characters")
    return trimmed


def build_schedule_stop_body(reason: str | None = None) -> dict[str, str]:
    """Request body for ``POST /v1/emails/{id}/schedule-stop``."""
    normalized = normalize_schedule_stop_reason(reason)
    return {} if normalized is None else {"reason": normalized}


def schedule_stop_command(email_id: str) -> str:
    """The CLI command that stops the schedule behind a scheduled message."""
    if not isinstance(email_id, str) or not _UUID.fullmatch(email_id):
        raise ValueError("email_id must be an email UUID")
    return f"primitive schedule stop --id {email_id.lower()}"
