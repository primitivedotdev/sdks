"""Bounded interaction parsing and explicit signal helpers. Parsing has no effects."""

import json
import math
import re
from dataclasses import dataclass
from typing import Literal, cast

from .signals import (
    ExpiredSignal as ExpiredSignal,
)
from .signals import (
    PreparedSignal as PreparedSignal,
)
from .signals import (
    SignalInput as SignalInput,
)
from .signals import (
    SignalParent as SignalParent,
)
from .signals import (
    SignalPreparation as SignalPreparation,
)
from .signals import (
    SignalResponse as SignalResponse,
)
from .signals import (
    prepare_signal_email as prepare_signal_email,
)
from .signals import (
    send_prepared_signal as send_prepared_signal,
)

MAX_INTERACTION_BYTES = 65_536
MAX_INTERACTION_DEPTH = 64
_SPACE = "\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
_SAFE_INTEGER = 9_007_199_254_740_991
_UUID = r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"


@dataclass(frozen=True)
class InteractionResult:
    status: Literal["valid", "unsupported", "invalid"]
    envelope: dict[str, object] | None = None
    version: int | None = None
    reason: str | None = None
    # Set only by the source parser on valid/unsupported input.
    text: str | None = None
    source_bytes: bytes | None = None


def _number(token: str) -> float:
    value = float(token)
    if len(token) > 128 or not math.isfinite(value) or (value.is_integer() and abs(value) > _SAFE_INTEGER):
        raise ValueError("unsafe number")
    return value


def _pairs(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate key")
        result[key] = value
    return result


def _depth(text: str) -> None:
    depth = 0
    quoted = escaped = False
    for char in text:
        if quoted:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quoted = False
        elif char == '"':
            quoted = True
        elif char in "[{":
            depth += 1
            if depth > MAX_INTERACTION_DEPTH:
                raise ValueError("too deep")
        elif char in "]}":
            depth -= 1


def _snapshot(value: object, depth: int, budget: list[int], seen: set[int]) -> object:
    budget[0] -= 1
    if budget[0] < 0:
        raise ValueError("too large")
    if value is None or type(value) is bool:
        return value
    if type(value) is str:
        value = cast(str, value)
        if len(value) > budget[0]:
            raise ValueError("too large")
        budget[0] -= len(value.encode("utf-8", errors="strict"))
        if budget[0] < 0:
            raise ValueError("too large")
        return value
    if type(value) in (float, int):
        return _number(str(value))
    if type(value) not in (dict, list) or depth >= MAX_INTERACTION_DEPTH or id(value) in seen:
        raise ValueError("not JSON data")
    seen.add(id(value))
    if type(value) is list:
        items = cast(list[object], value)
        if len(items) > budget[0]:
            raise ValueError("too large")
        result: object = [_snapshot(item, depth + 1, budget, seen) for item in items]
    else:
        obj = cast(dict[object, object], value)
        if len(obj) > budget[0]:
            raise ValueError("too large")
        copy: dict[str, object] = {}
        for key, item in obj.items():
            if type(key) is not str:
                raise ValueError("not a string key")
            _snapshot(key, depth + 1, budget, seen)
            copy[key] = _snapshot(item, depth + 1, budget, seen)
        result = copy
    seen.remove(id(value))
    return result


def _envelope(value: object) -> InteractionResult:
    invalid = InteractionResult("invalid", reason="invalid_envelope")
    if not isinstance(value, dict):
        return invalid
    obj = cast(dict[str, object], value)
    version = obj.get("interaction_version")
    if type(version) not in (int, float) or not float(cast(float, version)).is_integer() or cast(float, version) < 1:
        return invalid
    if version != 1:
        return InteractionResult("unsupported", version=int(cast(float, version)))
    iid, protocol, pv = obj.get("interaction_id"), obj.get("protocol"), obj.get("protocol_version")
    step, sid, prev = obj.get("step"), obj.get("step_id"), obj.get("prev_step_id")
    if (not isinstance(iid, str) or not re.fullmatch(_UUID + "@[^" + re.escape(_SPACE) + "@]+", iid)
        or not isinstance(protocol, str) or not protocol.strip(_SPACE)
        or type(pv) not in (int, float) or not float(cast(float, pv)).is_integer() or cast(float, pv) < 1
        or not isinstance(step, str) or not step.strip(_SPACE)
        or not isinstance(sid, str) or not re.fullmatch(_UUID, sid)
        or "prev_step_id" not in obj or not (prev is None or isinstance(prev, str) and re.fullmatch(_UUID, prev))
        or "expires_at" not in obj or not (obj["expires_at"] is None or isinstance(obj["expires_at"], str))
        or "payload" not in obj):
        return invalid
    return InteractionResult("valid", envelope=obj)


def parse_interaction_envelope(source: str | bytes) -> InteractionResult:
    """Parse strict UTF-8 JSON up to 64 KiB; keep exact source on success."""
    try:
        if type(source) not in (str, bytes):
            return InteractionResult("invalid", reason="invalid_input")
        if len(source) > MAX_INTERACTION_BYTES:
            return InteractionResult("invalid", reason="too_large")
        text = source.decode("utf-8", errors="strict") if isinstance(source, bytes) else source
        if len(text.encode("utf-8", errors="strict")) > MAX_INTERACTION_BYTES:
            return InteractionResult("invalid", reason="too_large")
        _depth(text)
        value: object = json.loads(text, object_pairs_hook=_pairs, parse_int=_number, parse_float=_number, parse_constant=_number)
        _snapshot(value, 0, [MAX_INTERACTION_BYTES], set())
        result = _envelope(value)
        if result.status == "invalid":
            return result
        return InteractionResult(result.status, envelope=result.envelope, version=result.version,
                                 text=text, source_bytes=source if isinstance(source, bytes) else None)
    except (ValueError, TypeError, OverflowError, RecursionError):
        return InteractionResult("invalid", reason="invalid_json")


def validate_interaction_envelope(value: object) -> InteractionResult:
    """Validate decoded JSON data; original bytes and duplicate keys are unknowable."""
    try:
        snapshot = _snapshot(value, 0, [MAX_INTERACTION_BYTES], set())
        return _envelope(snapshot)
    except (ValueError, TypeError, OverflowError, RecursionError):
        return InteractionResult("invalid", reason="invalid_input")
