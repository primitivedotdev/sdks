#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: cli-mirror-publish.sh <mirror-package-name> <version>

Publishes the cli-node artifact a second time under an unscoped mirror name
(for example `primitivecli`). The scoped `@primitivedotdev/cli` package remains
the source of truth: this packs the real CLI to capture its exact published
file set, rewrites only the package.json "name", and republishes it verbatim so
the two packages always ship identical contents at the same version.

The publish itself is delegated to npm-publish-with-retry.sh, which is a no-op
when the requested mirror version is already on npm.
USAGE
}

mirror_name="${1:-}"
version="${2:-}"

if [[ -z "$mirror_name" || -z "$version" ]]; then
  usage
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$script_dir/.." && pwd)"
src="$root/cli-node"

if [[ ! -d "$src" ]]; then
  echo "cli-node directory not found at $src" >&2
  exit 2
fi

staging="$(mktemp -d)"
cleanup() { rm -rf "$staging"; }
trap cleanup EXIT

# Pack the real CLI to capture the exact published file set (runs the package's
# prepack build), then explode the tarball into a staging directory. The pack
# runs the build script, whose log goes to stdout, so redirect it to stderr and
# locate the produced tarball by globbing rather than parsing stdout.
( cd "$src" && npm pack --pack-destination "$staging" ) >&2

shopt -s nullglob
tarballs=("$staging"/*.tgz)
shopt -u nullglob

if [[ ${#tarballs[@]} -ne 1 ]]; then
  echo "Expected exactly one packed tarball in $staging, found ${#tarballs[@]}" >&2
  exit 1
fi

tar -xzf "${tarballs[0]}" -C "$staging"
pkg_dir="$staging/package"

if [[ ! -f "$pkg_dir/package.json" ]]; then
  echo "Packed tarball did not contain a package.json" >&2
  exit 1
fi

# Rewrite only the package name; everything else (version, bin, files, deps,
# oclif config) is carried over from the scoped package verbatim.
MIRROR_NAME="$mirror_name" node -e '
const fs = require("fs");
const file = process.argv[1];
const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
pkg.name = process.env.MIRROR_NAME;
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
' "$pkg_dir/package.json"

"$root/scripts/npm-publish-with-retry.sh" \
  --package "$mirror_name" \
  --version "$version" \
  --directory "$pkg_dir"
