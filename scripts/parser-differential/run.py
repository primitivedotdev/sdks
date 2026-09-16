"""Seeded, bounded differential probe. No network or SDK effects are exercised."""

import argparse
import collections
import copy
import hashlib
import json
import os
import random
import signal
import subprocess
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = {
    "interaction_version": 1,
    "interaction_id": "11111111-1111-4111-8111-111111111111@agent.example",
    "protocol": "future.protocol",
    "protocol_version": 1,
    "step": "offer",
    "step_id": "22222222-2222-4222-8222-222222222222",
    "prev_step_id": None,
    "expires_at": None,
    "payload": {"message": "Hello"},
}


def dumps(value):
    return json.dumps(value, ensure_ascii=True, separators=(",", ":"))


def corpus(seed, count):
    rng = random.Random(seed)
    rows = []

    def wire(category, source, expect=None, text=False):
        raw = source.encode("utf8") if isinstance(source, str) else source
        row = {
            "category": category,
            "mode": "text" if text else "bytes",
            "hex": raw.hex(),
        }
        if expect:
            row["expect"] = expect
        rows.append(row)

    def decoded(category, value, special=None):
        row = {"category": category, "mode": "decoded", "value": value}
        if special:
            row["special"] = special
        rows.append(row)

    # Isolate every required field and Unicode class, including non-ECMAScript spaces.
    scalars = [
        None,
        True,
        False,
        0,
        1,
        2,
        -1,
        1.5,
        9007199254740991,
        9007199254740992,
        "",
        [],
        {},
        ["x"],
    ]
    points = list(range(33)) + [
        0x7F,
        0x85,
        0xA0,
        0x1680,
        *range(0x2000, 0x200C),
        0x2028,
        0x2029,
        0x202F,
        0x205F,
        0x3000,
        0xFEFF,
        0xFFFE,
        0xFFFF,
        0x10000,
        0x1F642,
        0x10FFFF,
    ]
    strings = [chr(p) for p in points] + ["x", "@", "é", "__proto__", "constructor"]
    for key, base_value in BASE.items():
        for v in scalars + strings:
            obj = {**BASE, key: v}
            wire("field-types-unicode", dumps(obj))
            decoded("decoded-fields", obj)
        for suffix in ["\n", "\r", "\r\n", "\u2028", "\u2029", " ", "\x00"]:
            if isinstance(base_value, str):
                obj = {**BASE, key: base_value + suffix}
                wire("field-terminal-controls", dumps(obj))
                decoded("decoded-terminal-controls", obj)
        obj = dict(BASE)
        del obj[key]
        wire("missing-fields", dumps(obj))
        decoded("decoded-missing", obj)
    for key in BASE:
        encoded = dumps(key)
        escaped = '"' + "".join(f"\\u{ord(c):04x}" for c in key) + '"'
        for alias in (encoded, escaped):
            wire(
                "duplicate-decoded-keys",
                dumps(BASE)[:-1] + "," + alias + ":null}",
                "invalid",
            )
    tokens = [
        "0",
        "-0",
        "0.0",
        "-0.0",
        "-0e999",
        "1",
        "1.0",
        "1e0",
        "1e-324",
        "5e-324",
        "2.2250738585072014e-308",
        "1.7976931348623157e308",
        "1e309",
        "-1e309",
        "9007199254740991",
        "9007199254740992",
        "9007199254740993",
        "9007199254740991.1",
        "0.99999999999999999",
        "1e-9999",
        "NaN",
        "Infinity",
        "-Infinity",
        "+1",
        ".1",
        "1.",
        "00",
        "01",
        "0x01",
        "1_0",
        "1e",
        "1e+",
        "--1",
    ]
    tokens += ["1" + ("0" * n) for n in [126, 127, 128, 1000, 65536]]
    tokens += ["0." + ("0" * n) + "1" for n in [123, 124, 125, 126, 127, 1000]]
    for _ in range(count // 8):
        tokens.append(
            rng.choice(["", "-"])
            + str(rng.randrange(10**16))
            + rng.choice(["", "." + str(rng.randrange(10**18))])
            + rng.choice(["", "e" + str(rng.randrange(-1100, 1100))])
        )
    for token in tokens:
        for key in ["payload", "interaction_version", "protocol_version"]:
            obj = dict(BASE)
            obj[key] = "NUMBER_TOKEN"
            wire("numeric-tokens", dumps(obj).replace('"NUMBER_TOKEN"', token))
    for depth in [0, 1, 2, 60, 61, 62, 63, 64, 65, 66, 100, 1000, 20000]:
        for pair in [("[]", "[", "]"), ("{}", '{"x":', "}")]:
            wire(
                "depth-boundaries",
                dumps(BASE).replace(
                    '{"message":"Hello"}', pair[1] * depth + "null" + pair[2] * depth
                ),
            )
        if depth < 100:
            payload = None
            for _ in range(depth):
                payload = [payload]
            decoded("decoded-depth", {**BASE, "payload": payload})
    for n in [
        0,
        1,
        127,
        128,
        255,
        256,
        65000,
        65200,
        65500,
        65535,
        65536,
        65537,
        70000,
    ]:
        for char in ["a", "é", "🙂"]:
            obj = {**BASE, "payload": char * n}
            wire(
                "size-boundaries",
                json.dumps(obj, ensure_ascii=False, separators=(",", ":")),
            )
            decoded("decoded-budget", obj)
    source = dumps(BASE).encode()
    for n in [65535, 65536, 65537, 100000]:
        wire(
            "padded-byte-limit",
            source + b" " * (n - len(source)),
            "valid" if n <= 65536 else "invalid",
        )
    for n in [0, 1, 32768, 65535, 65536, 65537, 70000]:
        decoded("decoded-width", {**BASE, "payload": [None] * n})
    for spec in [
        "cycle",
        "alias",
        "dag",
        "nan",
        "infinity",
        "negative-infinity",
        "negative-zero",
        "surrogate",
        "surrogate-key",
        "host-object",
        "bytes",
        "function",
        "bigint",
    ]:
        decoded("decoded-host-values", copy.deepcopy(BASE), spec)
    malformed = [
        b"\x80",
        b"\xc0\x80",
        b"\xc1\xbf",
        b"\xc2",
        b"\xed\xa0\x80",
        b"\xf0\x80\x80\x80",
        b"\xf4\x90\x80\x80",
        b"\xf5\x80\x80\x80",
        b"\xff",
        b"\xfe",
        b"\xef\xbb\xbf",
    ]
    for b in malformed:
        wire("invalid-utf8-bom", b + source, "invalid")
        wire(
            "invalid-utf8-bom",
            source.replace(b"Hello", b),
            "invalid" if b != b"\xef\xbb\xbf" else "valid",
        )
    escapes = [
        "\\ud800",
        "\\udfff",
        "\\ud800\\udfff",
        "\\ud800x",
        "\\ud800\\ud800",
        "\\u0000",
        "\\u2028",
        "\\u2029",
        "\\uFEFF",
        "\\v",
        "\\x00",
        "\\uZZZZ",
        "\\u000",
        '\\"',
        "\\\\",
    ]
    for esc in escapes:
        wire("escaped-unicode", source.replace(b"Hello", esc.encode()))
        wire("escaped-unicode", source.replace(b"message", esc.encode()))
    for code in range(256):
        wire("utf8-single-byte-exhaustive", source.replace(b"Hello", bytes([code])))
    for point in [0x7F, 0x80, 0x7FF, 0x800, 0xD7FF, 0xE000, 0xFFFF, 0x10000, 0x10FFFF]:
        encoded = chr(point).encode("utf8")
        wire("utf8-codepoint-boundaries", source.replace(b"Hello", encoded), "valid")
        for n in range(1, len(encoded)):
            wire(
                "utf8-codepoint-boundaries",
                source.replace(b"Hello", encoded[:n]),
                "invalid",
            )
    for hi in [0xD7FF, 0xD800, 0xDBFF, 0xDC00, 0xDFFF, 0xE000]:
        for lo in [0xD7FF, 0xD800, 0xDBFF, 0xDC00, 0xDFFF, 0xE000]:
            escaped = f"\\u{hi:04x}\\u{lo:04x}".encode()
            wire("surrogate-pair-matrix", source.replace(b"Hello", escaped))
    for char in strings:
        wire("json-outer-whitespace", char.encode() + source + char.encode())
    for n in [1000, 10000, 65536, 70000]:
        decoded(
            "decoded-key-count", {**BASE, "payload": {str(i): None for i in range(n)}}
        )
    for text in [
        '{"x":1,"\\u0078":2}',
        '{"__proto__":1,"__proto__":2}',
        '{"x":{"x":1},"x":2}',
        '[{"x":1,"x":2}]',
    ]:
        wire(
            "nested-duplicates",
            dumps(BASE).replace('{"message":"Hello"}', text),
            "invalid",
        )

    # Generate payload trees independently from the existing selected fixtures.
    def value(depth=0):
        if depth > 4 or rng.randrange(3) == 0:
            return rng.choice(
                [
                    None,
                    True,
                    False,
                    rng.randrange(-(10**12), 10**12),
                    rng.uniform(-1e6, 1e6),
                    rng.choice(strings),
                    "x" * rng.randrange(100),
                ]
            )
        if rng.randrange(2):
            return [value(depth + 1) for _ in range(rng.randrange(5))]
        return {
            rng.choice(strings) + str(i): value(depth + 1)
            for i in range(rng.randrange(5))
        }

    for i in range(count):
        obj = {**BASE, "payload": value()}
        if i % 5 == 0:
            obj["extension"] = value()
        if i % 7 == 0:
            obj["interaction_version"] = rng.choice([1, 2, 3, 42])
        text = dumps(obj)
        if i % 3 == 0:
            wire("generated-json", text, text=(i % 2 == 0))
            decoded("decoded-generated", obj)
        else:
            raw = bytearray(text.encode())
            for _ in range(rng.randrange(1, 5)):
                at = rng.randrange(len(raw) + 1)
                op = rng.randrange(4)
                if op == 0:
                    raw[at:at] = bytes([rng.randrange(256)])
                elif op == 1:
                    del raw[at : at + 1]
                elif op == 2 and at < len(raw):
                    raw[at] = rng.randrange(256)
                else:
                    raw[at:at] = rng.choice(
                        [b" ", b"\n", b'"', b"\\u", b"null", b"[]", b"{}", b"\x00"]
                    )
            wire("byte-mutations", bytes(raw))
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--seed", type=lambda v: int(v, 0), default=0x20260916)
    ap.add_argument("--cases", type=int, default=12000)
    ap.add_argument(
        "--node-module", type=Path, default=ROOT / "sdk-node/dist/interactions/index.js"
    )
    ap.add_argument(
        "--node", default="node", help="Node executable (for runtime-matrix probes)"
    )
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--replay", type=Path)
    args = ap.parse_args()
    if not 0 <= args.cases <= 50000:
        ap.error("--cases must be between 0 and 50000")
    if args.replay and args.replay.stat().st_size > 128 * 1024 * 1024:
        ap.error("replay input exceeds 128 MiB")
    rows = (
        json.loads(args.replay.read_text())
        if args.replay
        else corpus(args.seed, args.cases)
    )
    if len(rows) > 100000:
        ap.error("input exceeds 100000 cases")
    data = "".join(dumps(row) + "\n" for row in rows).encode()
    here = ROOT / "scripts/parser-differential"
    outputs = {}
    elapsed = {}
    peak_rss = {}
    with tempfile.TemporaryDirectory(prefix="parser-differential-") as temp:
        binary = Path(temp) / "go-runner"
        subprocess.run(
            ["go", "build", "-o", str(binary), str(here / "go.go")],
            cwd=ROOT / "sdk-go",
            check=True,
            timeout=90,
        )
        runners = {
            "node": [
                args.node,
                str(here / "node.mjs"),
                str(args.node_module.resolve()),
            ],
            "python": [
                "uv",
                "run",
                "--project",
                str(ROOT / "sdk-python"),
                "python",
                str(here / "python.py"),
            ],
            "go": [str(binary)],
        }
        for lang, cmd in runners.items():
            start = time.monotonic()
            process = subprocess.Popen(
                ["python3", str(here / "measure.py"), *cmd],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=ROOT,
                start_new_session=True,
            )
            try:
                stdout, stderr = process.communicate(data, timeout=90)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
                raise
            if process.returncode:
                raise RuntimeError(
                    f"{lang} exited {process.returncode}: {stderr.decode(errors='replace')}"
                )
            metric = json.loads(stderr.decode().split("RUNNER_METRICS ")[-1])
            peak_rss[lang] = metric["peak_rss_bytes"]
            elapsed[lang] = round(time.monotonic() - start, 3)
            parsed = [json.loads(line) for line in stdout.splitlines()]
            if len(parsed) != len(rows):
                raise RuntimeError(
                    f"{lang}: lost output rows {len(parsed)} != {len(rows)}"
                )
            outputs[lang] = parsed
    mismatches = []
    failures = []
    for i, row in enumerate(rows):
        result = {lang: items[i] for lang, items in outputs.items()}
        if any(v != result["node"] for v in result.values()):
            mismatches.append({"index": i, "case": row, "results": result})
        if any(
            "crash" in r
            or r.get("source") is not True
            or r.get("snapshot", True) is not True
            or (row.get("expect") and r.get("status") != row["expect"])
            for r in result.values()
        ):
            failures.append({"index": i, "case": row, "results": result})
    args.output.mkdir(parents=True, exist_ok=True)
    for name, items in [("mismatches", mismatches), ("invariant-failures", failures)]:
        (args.output / f"{name}.json").write_text(
            json.dumps(items, indent=2, ensure_ascii=True) + "\n"
        )
        (args.output / f"{name}-replay.json").write_text(
            json.dumps([v["case"] for v in items], ensure_ascii=True) + "\n"
        )
    report = {
        "source_revision": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip(),
        "node_module_sha256": hashlib.sha256(args.node_module.read_bytes()).hexdigest(),
        "runtimes": {
            "node": subprocess.check_output(
                [args.node, "--version"], text=True
            ).strip(),
            "python": subprocess.check_output(
                [
                    "uv",
                    "run",
                    "--project",
                    str(ROOT / "sdk-python"),
                    "python",
                    "--version",
                ],
                text=True,
            ).strip(),
            "go": subprocess.check_output(["go", "version"], text=True).strip(),
        },
        "seed": args.seed,
        "random_iterations": args.cases,
        "cases": len(rows),
        "corpus_sha256": hashlib.sha256(data).hexdigest(),
        "categories": dict(collections.Counter(r["category"] for r in rows)),
        "status_counts": {
            lang: dict(collections.Counter(v.get("status", "crash") for v in result))
            for lang, result in outputs.items()
        },
        "seconds": elapsed,
        "peak_rss_bytes": peak_rss,
        "mismatches": len(mismatches),
        "invariant_failures": len(failures),
        "timeout_seconds_per_runner": 90,
    }
    (args.output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return 1 if mismatches or failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
