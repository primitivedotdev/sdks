# Interaction parser differential battery

This is a deterministic, bounded test harness for the public source parser and
decoded-value validator in JavaScript, Python, and Go. It does not send email,
contact the API, classify sender authority, or execute interaction steps.

The existing Shared CI job runs 1,000 seeded random iterations (`--seed 1000`)
plus the fixed boundary corpus and five-fault calibration after building the
SDK. Changes to these harnesses or the interaction/signal runtime files trigger
that job. The larger recorded battery below remains locally reproducible.

## Recorded result

The SDK code at `ecac78da160999429530ef8763d46f9e5405672d` passed six runs on
2026-09-16: **259,362 case executions**, covering **145,191 distinct input/mode
pairs** and **778,086 language evaluations**. There were **zero differential
mismatches, crashes, source-preservation failures, or snapshot failures**. No
production parser change was made.

Four seeds ran on Node 26.3.0; two were repeated on Node 22.23.2 and 24.21.0.
Python was 3.12.5 and Go was 1.25.5 on macOS arm64. The JavaScript entry point
was extracted from a locally built SDK tarball, not imported from TypeScript.
Each run contained 43,227 cases. Seeds, category counts, status distributions,
corpus hashes, packed-module hash, elapsed times, and peak resident memory are
recorded in [evidence.json](evidence.json).

The slowest parser runner completed a 43,227-case batch in 2.28 seconds. Maximum
observed runner RSS was 150 MiB for Node, 109 MiB for Python, and 30 MiB for Go.
These are process measurements, not per-case allocation limits; compiler and
controller memory are excluded.

## What is compared

The runners compare status, error reason, unsupported version, and every returned
envelope field. Values are tagged by type; numbers use exact binary64 bits so
rounding differences and the sign of zero cannot disappear through JSON output.
Object key order is ignored. Accepted source must retain its exact text/bytes;
mutable byte input is overwritten after parsing to check defensive ownership.
Decoded results must not claim original source and must remain unchanged after
mutating nested caller-owned data.

The generator combines field/type matrices, Unicode and whitespace boundaries,
missing fields, duplicate decoded keys, number grammar and magnitude boundaries,
UTF-8 truncations and invalid byte sequences, all 256 single-byte values in a
string position, surrogate pairs, nested duplicate keys, depth/size boundaries,
and random payload trees plus seeded byte mutations. Decoded probes include
wide maps/arrays, shared aliases, cycles, an exponentially shared graph, nonfinite
numbers, invalid Unicode, unsupported host values, and work-budget boundaries.
It is independent of the existing hand-selected shared fixtures.

## Reproduce

Requirements: Node 22+, Python 3.10+, `uv`, Go, `pnpm`, and a POSIX host supporting
`fork`/`wait4`. From the SDK repository root:

```sh
pnpm install --frozen-lockfile
make node-build
python3 scripts/parser-differential/run.py --cases 24000 --seed 0x20260916 --output /tmp/parser-differential-result
python3 scripts/parser-differential/selftest.py
```

To exercise the packed artifact as in this audit:

```sh
task_pack=$(mktemp -d)
pnpm --dir sdk-node pack --pack-destination "$task_pack"
tar -xzf "$task_pack"/primitivedotdev-sdk-*.tgz -C "$task_pack"
python3 scripts/parser-differential/run.py --cases 24000 --seed 0x20260916 --node-module "$task_pack/package/dist/interactions/index.js" --output /tmp/parser-differential-packed
```

Repeat with seeds `0x1`, `0xdeadbeef`, and `0x5eed1234`. `--node` selects another
Node executable for runtime-matrix checks. The default is the current `node`.
Each corpus hash should match the corresponding evidence entry when generated
with the recorded Python version and parameters. Timing and memory are expected
to vary by host.

Any disagreement writes `mismatches.json` and `mismatches-replay.json`. Source,
copy, crash, and explicit expected-status failures also write the corresponding
`invariant-failures` files. A failing run exits nonzero. Replay the reduced input
list with `--replay PATH`; it uses the same public SDK entry points. Reports
contain synthetic inputs only and do not include credentials or machine paths.

The self-test injects five intentional faults: changed negative zero, borrowed
source bytes, a thrown exception, a caller-aliased JavaScript snapshot, and a
Go snapshot that copies only the outer slice of a nested array. All five must
trigger mismatches; the latter four must also trigger invariant failures. The
Go-specific probe uses `[[1]]`, mutates the inner slice, and requires only Go's
snapshot check to fail. The wrappers exist only in a temporary directory and
never modify the SDK. This calibration passed in the recorded audit.

## Bounds and limits

Random iterations are capped at 50,000. Each runner and the Go build have a
90-second wall deadline; timeout kills the runner process group. Go input lines
are bounded to 4 MiB. The generator's largest source is intentionally above the
64 KiB parser limit, and depth probes reach 20,000 containers to test early
rejection. Peak RSS is observed using `wait4`, not constrained by an address-space
limit that would distort runtime behavior.

This is grammar/byte mutation testing, not coverage-guided fuzzing or a proof of
correctness. Agreement can miss a defect shared by all three implementations.
Python/Go versions beyond those recorded were not exercised by this battery.
Decoded comparison covers common JSON values and selected equivalent invalid
host values; arbitrary proxies, custom runtime hooks, and every host-language
object type are outside this differential model. No browser engine, network,
MIME parser, authentication, signal classifier, or application consumer is tested
here. The report does not establish authority or protocol semantics.
