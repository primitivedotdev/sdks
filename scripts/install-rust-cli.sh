#!/usr/bin/env bash
set -euo pipefail

repo="${PRIMITIVE_RUST_CLI_REPO:-primitivedotdev/sdks}"
version="${PRIMITIVE_RUST_CLI_VERSION:-}"
target="${PRIMITIVE_RUST_CLI_TARGET:-}"
install_dir="${PRIMITIVE_RUST_CLI_INSTALL_DIR:-}"
base_url="${PRIMITIVE_RUST_CLI_BASE_URL:-}"
dry_run=0

usage() {
  cat <<'USAGE'
Install the Primitive Rust CLI from a macOS or Linux GitHub release archive.
Use install-rust-cli.ps1 for Windows archives.

Usage:
  install-rust-cli.sh --version <version> [options]

Options:
  --version <version>       Rust CLI version, for example 0.1.0 or v0.1.0.
  --target <target>         Release target. Defaults to detected OS/arch.
                            Supported targets: linux-x64, linux-arm64,
                            macos-x64, macos-arm64.
  --install-dir <path>      Directory for primitive and prim.
                            Defaults to $HOME/.local/bin.
  --repo <owner/name>       GitHub repository. Defaults to primitivedotdev/sdks.
  --base-url <url>          Archive directory URL. Defaults to the GitHub
                            cli-rust-v<version> release URL.
  --dry-run                 Print the resolved install plan without installing.
  -h, --help                Print this help.

Environment variables mirror the long flags:
  PRIMITIVE_RUST_CLI_VERSION
  PRIMITIVE_RUST_CLI_TARGET
  PRIMITIVE_RUST_CLI_INSTALL_DIR
  PRIMITIVE_RUST_CLI_REPO
  PRIMITIVE_RUST_CLI_BASE_URL
USAGE
}

die() {
  printf 'install-rust-cli: %s\n' "$*" >&2
  exit 1
}

need_command() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      [ "$#" -ge 2 ] || die "--version requires a value"
      version="$2"
      shift 2
      ;;
    --target)
      [ "$#" -ge 2 ] || die "--target requires a value"
      target="$2"
      shift 2
      ;;
    --install-dir)
      [ "$#" -ge 2 ] || die "--install-dir requires a value"
      install_dir="$2"
      shift 2
      ;;
    --repo)
      [ "$#" -ge 2 ] || die "--repo requires a value"
      repo="$2"
      shift 2
      ;;
    --base-url)
      [ "$#" -ge 2 ] || die "--base-url requires a value"
      base_url="$2"
      shift 2
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unexpected argument: $1"
      ;;
  esac
done

detect_target() {
  local os arch
  case "$(uname -s)" in
    Darwin) os="macos" ;;
    Linux) os="linux" ;;
    *) die "unsupported OS: $(uname -s). Pass --target to override." ;;
  esac

  case "$(uname -m)" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) die "unsupported architecture: $(uname -m). Pass --target to override." ;;
  esac

  printf '%s-%s\n' "$os" "$arch"
}

if [ -z "$version" ]; then
  die "--version is required"
fi
version="${version#v}"

case "$version" in
  "") die "invalid version: $version" ;;
esac
if ! printf '%s\n' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'; then
  die "invalid version: $version"
fi

if [ -z "$target" ]; then
  target="$(detect_target)"
fi

case "$target" in
  linux-x64|linux-arm64|macos-x64|macos-arm64) ;;
  *) die "unsupported target: $target" ;;
esac

archive="primitive-rust-cli-v${version}-${target}.tar.gz"
checksum="${archive}.sha256"
if [ -z "$base_url" ]; then
  base_url="https://github.com/${repo}/releases/download/cli-rust-v${version}"
fi
if [ -z "$install_dir" ]; then
  if [ -z "${HOME:-}" ]; then
    die "--install-dir is required when HOME is unset"
  fi
  install_dir="$HOME/.local/bin"
fi
base_url="${base_url%/}"
archive_url="${base_url}/${archive}"
checksum_url="${base_url}/${checksum}"

if [ "$dry_run" -eq 1 ]; then
  printf 'version=%s\n' "$version"
  printf 'target=%s\n' "$target"
  printf 'archive_url=%s\n' "$archive_url"
  printf 'checksum_url=%s\n' "$checksum_url"
  printf 'install_dir=%s\n' "$install_dir"
  exit 0
fi

need_command curl
need_command install
need_command tar

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

curl -fsSL "$archive_url" -o "$tmp_dir/$archive"
curl -fsSL "$checksum_url" -o "$tmp_dir/$checksum"

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$tmp_dir" && sha256sum -c "$checksum")
elif command -v shasum >/dev/null 2>&1; then
  (cd "$tmp_dir" && shasum -a 256 -c "$checksum")
else
  die "missing sha256sum or shasum for checksum verification"
fi

tar -tzf "$tmp_dir/$archive" > "$tmp_dir/archive-members.txt"
member_count="$(wc -l < "$tmp_dir/archive-members.txt" | tr -d ' ')"
[ "$member_count" = "4" ] || die "archive must contain exactly primitive, prim, README.md, and LICENSE"
grep -qx 'primitive' "$tmp_dir/archive-members.txt" || die "archive did not contain primitive"
grep -qx 'prim' "$tmp_dir/archive-members.txt" || die "archive did not contain prim"
grep -qx 'README.md' "$tmp_dir/archive-members.txt" || die "archive did not contain README.md"
grep -qx 'LICENSE' "$tmp_dir/archive-members.txt" || die "archive did not contain LICENSE"
if grep -Eq '(^/|(^|/)\.\.(/|$)|/$)' "$tmp_dir/archive-members.txt"; then
  die "archive contains an unsafe member path"
fi
tar -tvf "$tmp_dir/$archive" > "$tmp_dir/archive-table.txt"
if ! awk '{ if (substr($1, 1, 1) != "-") exit 1 }' "$tmp_dir/archive-table.txt"; then
  die "archive contains a non-regular file"
fi

tar -C "$tmp_dir" -xzf "$tmp_dir/$archive"
[ -f "$tmp_dir/primitive" ] || die "archive did not contain primitive"
[ -f "$tmp_dir/prim" ] || die "archive did not contain prim"

mkdir -p "$install_dir"
install -m 0755 "$tmp_dir/primitive" "$install_dir/primitive"
install -m 0755 "$tmp_dir/prim" "$install_dir/prim"

printf 'Installed primitive and prim to %s\n' "$install_dir"
case ":${PATH:-}:" in
  *":$install_dir:"*) ;;
  *)
    printf 'Add %s to PATH or run %s/primitive directly.\n' "$install_dir" "$install_dir"
    ;;
esac
