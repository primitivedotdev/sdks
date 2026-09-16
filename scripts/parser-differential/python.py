import hashlib
import json
import logging
import struct
import sys

from primitive.interactions import (
    parse_interaction_envelope,
    validate_interaction_envelope,
)


def canonical(value):
    if value is None:
        return ["null"]
    if isinstance(value, bool):
        return ["boolean", value]
    if isinstance(value, (int, float)):
        return ["number", struct.pack(">d", value).hex()]
    if isinstance(value, str):
        return ["string", value]
    if isinstance(value, list):
        return ["array", list(map(canonical, value))]
    return ["object", {key: canonical(item) for key, item in value.items()}]


def special(base, spec):
    if spec == "cycle":
        base["payload"] = base
    elif spec == "alias":
        shared = {"n": 1}
        base["payload"] = [shared, shared]
    elif spec == "dag":
        shared = {"n": 1}
        for _ in range(20):
            shared = {"a": shared, "b": shared}
        base["payload"] = shared
    elif spec == "host-object":

        class Custom:
            pass

        base["payload"] = Custom()
    elif spec == "bytes":
        base["payload"] = b"x"
    elif spec == "function":
        base["payload"] = lambda: 1
    elif spec == "bigint":
        base["payload"] = 9007199254740993
    elif spec in ("nan", "infinity", "negative-infinity"):
        base["payload"] = {
            "nan": float("nan"),
            "infinity": float("inf"),
            "negative-infinity": -float("inf"),
        }[spec]
    elif spec == "negative-zero":
        base["payload"] = -0.0
    elif spec == "surrogate":
        base["payload"] = "\ud800"
    elif spec == "surrogate-key":
        base["payload"] = {"\ud800": 1}
    return base


for line in sys.stdin:
    try:
        case = json.loads(line, parse_int=float, parse_float=float)
        raw = bytes.fromhex(case.get("hex", ""))
        value = special(case.get("value"), case.get("special"))
        result = (
            validate_interaction_envelope(value)
            if case["mode"] == "decoded"
            else parse_interaction_envelope(
                raw.decode("utf8") if case["mode"] == "text" else raw
            )
        )
        out = {"status": result.status}
        if result.reason:
            out["reason"] = result.reason
        if result.status == "valid":
            out["envelope"] = canonical(result.envelope)
        if result.status == "unsupported":
            out["version"] = canonical(result.version)
        if case["mode"] == "decoded":
            out["source"] = result.text is None and result.source_bytes is None
            if result.status == "valid":
                before = canonical(result.envelope)
                target = value["payload"]
                if (
                    isinstance(target, list)
                    and target
                    and isinstance(target[0], (dict, list))
                ):
                    target = target[0]
                if isinstance(target, dict):
                    target["changed"] = True
                elif isinstance(target, list):
                    target.append("changed")
                else:
                    value["payload"] = {"changed": True}
                out["snapshot"] = before == canonical(result.envelope)
        elif result.status == "invalid":
            out["source"] = result.text is None and result.source_bytes is None
        else:
            out["source"] = result.text.encode("utf8") == raw and (
                case["mode"] == "text" or result.source_bytes == raw
            )
            out["sourceHash"] = hashlib.sha256(result.text.encode("utf8")).hexdigest()
        print(json.dumps(out, ensure_ascii=True, allow_nan=False))
    except Exception as error:
        logging.getLogger(__name__).exception("Parser runner crashed")
        print(json.dumps({"crash": str(error)}))
