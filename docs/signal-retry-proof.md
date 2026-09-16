# Optional signal crash and retry proof

Run `make signal-retry-smoke` from the repository root. It builds and installs the
Node tarball and Python wheel in a temporary directory and compiles an external
Go consumer against an archived source module. Requires Node/npm/pnpm, Python
3.12+, uv and Go 1.25+. Package installation can access package registries; all
email API traffic goes exclusively to a loopback HTTP test server. No real email
is sent.

The existing Shared CI job runs this packaged smoke test before the bounded
parser differential battery and fault calibration. Changes to either harness or
the interaction/signal runtime files trigger the job.

The harness runs 15 scenarios across the three SDKs:

- ACK, Read and Working: prepare once, fsync the prepared record, then dispatch
  through the generated ordinary send client in a new process. The local server
  commits acceptance to SQLite without returning any response bytes. Kill the
  caller, restart the server from SQLite, and retry twice from fresh processes.
- After each uncertain first acceptance, switch account scope and verify rejection
  before any HTTP request.
- Working: refuse at the original absolute expiry before any attempt, after an
  uncertain acceptance without retrying first, and after a confirmed replay.
  Expiry preserves the key for reconciliation; it does not mean a prior attempt
  failed and never renews the original expiry.

Assertions cover identical serialized HTTP bodies and idempotency keys across
retries, unchanged original attachment bytes, sender/recipient, parent and
References headers, one logical accepted row, stable replay response IDs and an
unchanged durable prepared record. These are independent caller processes, not
in-process transport mocks. Preparation is completed before dispatch; this is a
process-crash test, not a disk power-loss or filesystem corruption test.

The output directory contains the package artifacts, their SHA-256 hashes,
prepared records, per-scenario SQLite request/acceptance evidence, and
`summary.json`. Paths are printed at startup and completion. To select a new
output directory after building, run
`python3 scripts/smoke-signal-retry.py --output /path/to/new-directory`.

The server deliberately models deduplication locally. This proves packaged
callers preserve the information a deduplicating service needs. It does **not**
prove deployed API idempotency, authentication, server canonical hashing,
delivery, MIME generation, receiver interpretation, or exactly-once mail
delivery. A real product test is a separate requirement. The harness does not
change the SDK's caller-owned persistence/retry policy or add automatic sends.
