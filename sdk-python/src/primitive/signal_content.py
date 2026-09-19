"""Pure signal-content classification. No authentication, HTTP or task effects."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from .signals import _signal_text

if TYPE_CHECKING:
    from .interactions import InteractionResult


@dataclass(frozen=True)
class SignalContentPart:
    filename: str | None
    content_type: str | None


@dataclass(frozen=True)
class SignalContentInventory:
    """Complete means the full outer inventory, including offloaded parts."""

    status: Literal["complete", "unavailable"]
    parts: tuple[SignalContentPart, ...] | None = None


@dataclass(frozen=True)
class SignalContentBodies:
    status: Literal["complete", "unavailable"]
    text: str | None = None
    html: str | None = None


@dataclass(frozen=True)
class SignalContentInput:
    inventory: SignalContentInventory
    bodies: SignalContentBodies
    canonical_part_bytes: bytes | None


SignalContentReason = Literal[
    "inventory_unavailable",
    "no_canonical_part",
    "duplicate_canonical_parts",
    "additional_parts",
    "part_unavailable",
    "invalid_interaction",
    "unsupported_signal",
    "unsupported_content_type",
    "bodies_unavailable",
    "html_present",
    "text_mismatch",
    "informational_signal",
]


@dataclass(frozen=True)
class SignalContentResult:
    classification: Literal[
        "plain", "informational_only", "mixed_or_unsupported", "unavailable"
    ]
    reason: SignalContentReason
    interaction: InteractionResult | None = None


_ENVELOPE_KEYS = {
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
_ASCII_LOWER = str.maketrans("ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")


def _utc_expiry(value: object) -> bool:
    if not isinstance(value, str):
        return False
    match = re.fullmatch(
        r"([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]{1,9})?Z",
        value,
    )
    if match is None:
        return False
    year, month, day, hour, minute, second = map(int, match.groups())
    days = (
        31,
        29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    )
    return (
        year >= 1970
        and 1 <= month <= 12
        and 1 <= day <= days[month - 1]
        and hour < 24
        and minute < 60
        and second < 60
    )


def _fallback(result: InteractionResult) -> str | None:
    if result.status != "valid" or result.envelope is None:
        return None
    e = result.envelope
    protocol = e.get("protocol")
    iid, sid = e.get("interaction_id"), e.get("step_id")
    if (
        set(e) != _ENVELOPE_KEYS
        or e.get("protocol_version") != 1
        or protocol not in ("ack", "read", "working", "typing")
        or e.get("step") != protocol
        or e.get("prev_step_id") is not None
    ):
        return None
    if (
        not isinstance(iid, str)
        or not isinstance(sid, str)
        or iid.split("@")[0].lower() == sid.lower()
    ):
        return None
    if (
        (not _utc_expiry(e.get("expires_at")))
        if protocol in ("working", "typing")
        else e.get("expires_at") is not None
    ):
        return None
    p = e.get("payload")
    if not isinstance(p, dict):
        return None
    keys = (
        {"subject_message_id", "status"}
        if protocol == "ack"
        else {"subject_message_id"}
    )
    if not keys <= set(p) or not set(p) <= keys | (
        {"note"} if protocol == "ack" else set()
    ):
        return None
    target = p.get("subject_message_id")
    if (
        not isinstance(target, str)
        or len(target) > 998
        or not re.fullmatch(r"<[!-~]+@[!-~]+>", target)
        or "<" in target[1:-1]
        or ">" in target[1:-1]
        or target.count("@") != 1
    ):
        return None
    assert isinstance(protocol, str)
    if protocol != "ack":
        return _signal_text(protocol)
    status, note = p.get("status"), p.get("note")
    if status not in ("received", "will_process", "will_not_process"):
        return None
    if "note" in p and (
        not isinstance(note, str)
        or len(note.encode("utf-16-le")) > 4000
        or "\0" in note
    ):
        return None
    assert isinstance(status, str)
    assert note is None or isinstance(note, str)
    return _signal_text("ack", status, note)


def classify_signal_content(content: SignalContentInput) -> SignalContentResult:
    """Classify syntax/content only, preserving the existing parser's source."""
    from .interactions import parse_interaction_envelope

    if content.inventory.status != "complete" or content.inventory.parts is None:
        return SignalContentResult("unavailable", "inventory_unavailable")
    parts = content.inventory.parts
    canonical = [
        part
        for part in parts
        if part.filename is not None
        and part.filename.translate(_ASCII_LOWER) == "interaction.json"
    ]
    if not canonical:
        return SignalContentResult("plain", "no_canonical_part")
    if len(canonical) != 1:
        return SignalContentResult("mixed_or_unsupported", "duplicate_canonical_parts")
    interaction = (
        None
        if content.canonical_part_bytes is None
        else parse_interaction_envelope(content.canonical_part_bytes)
    )
    if len(parts) != 1:
        return SignalContentResult(
            "mixed_or_unsupported", "additional_parts", interaction
        )
    if interaction is None:
        return SignalContentResult("unavailable", "part_unavailable")
    if content.bodies.status != "complete":
        return SignalContentResult("unavailable", "bodies_unavailable", interaction)
    if interaction.status == "invalid":
        return SignalContentResult(
            "mixed_or_unsupported", "invalid_interaction", interaction
        )
    media = canonical[0].content_type
    if (
        media is None
        or media.split(";")[0].strip(" \t").translate(_ASCII_LOWER)
        != "application/json"
    ):
        return SignalContentResult(
            "mixed_or_unsupported", "unsupported_content_type", interaction
        )
    fallback = _fallback(interaction)
    if fallback is None:
        return SignalContentResult(
            "mixed_or_unsupported", "unsupported_signal", interaction
        )
    if content.bodies.html not in (None, ""):
        return SignalContentResult("mixed_or_unsupported", "html_present", interaction)
    actual = (content.bodies.text or "").replace("\r\n", "\n")
    expected = fallback.replace("\r\n", "\n")
    matches = actual in ("", "\n", expected, expected + "\n")
    return SignalContentResult(
        "informational_only" if matches else "mixed_or_unsupported",
        "informational_signal" if matches else "text_mismatch",
        interaction,
    )
