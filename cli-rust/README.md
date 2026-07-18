# primitive-rust

`cli-rust/` is the Rust port of the Primitive CLI. It is checked for command
surface and behavior parity with the supported Node-distributed CLI. The GitHub
release archive installs the user-facing `primitive` and `prim` commands.

The source checkout also keeps the explicit `primitive-rust` binary name so
local builds can be distinguished from the Node-distributed CLI.

## Local Install

From the repository root:

```bash
cargo install --path cli-rust --bin primitive-rust --locked
primitive-rust --help
```

For an all-bin release-name local install:

```bash
cargo install --path cli-rust --locked
primitive --version
prim --version
```

Uninstall the local source install with:

```bash
cargo uninstall primitive-rust
```

## Authentication

`primitive` uses the same config directory and credential file shapes as the
Node CLI. Use the same environment variables for non-interactive use:

```bash
PRIMITIVE_API_KEY=prim_... primitive whoami
PRIMITIVE_API_KEY=prim_... primitive send --to alice@example.com --body "Hello"
```

## Checks

The root Makefile owns the Rust CLI verification path:

```bash
make rust-cli-check
make rust-cli-package
make rust-cli-smoke
make rust-cli-release-smoke
make rust-cli-archive-smoke
make rust-cli-windows-archive-smoke
make rust-cli-install-smoke
make cli-archive-parity
make cli-parity
```

`make cli-parity` runs the generated command-surface check, a black-box help
sweep for every Node-accepted command spelling, and request/response fixture
parity through the exact command shapes users type.

`make rust-cli-archive-smoke` packages the optimized binary as extracted
`primitive` and `prim` commands, checks that `README.md` and `LICENSE` are
present, checks for unexpected native OpenSSL/libz linkage where the platform
tooling is available, and smoke-tests that archive from an isolated temporary
working directory.
On Linux, release-platform CI builds the public `linux-x64` and `linux-arm64`
archives from `x86_64-unknown-linux-musl` and `aarch64-unknown-linux-musl`
Rust targets and runs a static-link portability check against those binaries.

Build a local release archive in `cli-rust/dist/` with:

```bash
make rust-cli-dist
```

The release workflow uploads that archive plus its `.sha256` checksum to the
`cli-rust-vX.Y.Z` GitHub release. It builds Linux x64, Linux arm64,
macOS x64, macOS arm64, and Windows x64 archives. Unix archives are `.tar.gz`;
Windows archives are `.zip` files containing `primitive.exe` and `prim.exe`.
Every archive also includes a top-level `LICENSE` and concise `README.md`
install note. Linux archives are musl-linked and do not require glibc.
Before publishing, the release workflow extracts the packaged Linux x64 archive
and runs authenticated live smoke through that exact `primitive` binary. That
gate requires the `PRIMITIVE_API_KEY` repository secret and stays read-only.

Install an uploaded macOS or Linux archive with the checked-in installer:

```bash
curl -fsSL https://raw.githubusercontent.com/primitivedotdev/sdks/main/scripts/install-rust-cli.sh | bash -s -- --version 0.1.0
```

Install a Windows archive from PowerShell:

```powershell
iwr https://raw.githubusercontent.com/primitivedotdev/sdks/main/scripts/install-rust-cli.ps1 -OutFile install-rust-cli.ps1
.\install-rust-cli.ps1 -Version 0.1.0
```

The installers detect the local platform, verify the `.sha256` checksum, and
install `primitive`/`prim` into `$HOME/.local/bin` by default. On Windows they
install `primitive.exe` and `prim.exe`; Windows ARM64 hosts use the Windows x64
archive until a native ARM64 release artifact exists. Re-run the installer with
a newer version to update. If the install directory is not on `PATH`, the
installer prints the exact directory to add or the full command path to run.
Remove those installed files to uninstall.

## Live Smoke

The live smoke script always starts with local no-key checks for version, help,
completion, manifest, describe, and config behavior. If `PRIMITIVE_API_KEY` is
missing, those checks run and the script exits `2` before any authenticated
request.

For a local no-auth success exit, run `make rust-cli-live-smoke-no-key`.
The harness uses an isolated temp config directory and removes it by default.
Do not pass `--keep-tmp` with a real key unless you plan to delete the kept
directory after debugging. The default authenticated suite does not pass the
live key through child process arguments.

Read-only live smoke requires an API key:

```bash
PRIMITIVE_API_KEY=prim_... make rust-cli-live-smoke
```

Opt into mutating product-path checks only with a disposable key:

```bash
PRIMITIVE_API_KEY=prim_... RUST_CLI_LIVE_SMOKE_ARGS=--include-mutating make rust-cli-live-smoke
```

The mutating suite writes and deletes a temporary memory key and uploads then
downloads small and zero-byte encrypted payloads.

Opt into the `--api-key` flag case only on a trusted local machine:

```bash
PRIMITIVE_API_KEY=prim_... RUST_CLI_LIVE_SMOKE_ARGS=--include-secret-argv make rust-cli-live-smoke
```

Opt into a real send-path smoke only with disposable test addresses:

```bash
PRIMITIVE_API_KEY=prim_... \
PRIMITIVE_RUST_LIVE_SEND_FROM=agent@example.com \
PRIMITIVE_RUST_LIVE_SEND_TO=smoke@example.net \
RUST_CLI_LIVE_SMOKE_ARGS=--include-email-e2e \
make rust-cli-live-smoke
```

The email E2E suite uses the real `primitive send --wait` product path. It does
not synthesize inbound mail or use raw SMTP injection.
