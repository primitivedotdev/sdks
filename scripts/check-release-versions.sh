#!/usr/bin/env bash
# Checks that the four published packages carry the same version:
#
#   sdk-node/package.json      @primitivedotdev/sdk
#   cli-node/package.json      primitive
#   sdk-python/pyproject.toml  primitivedotdev
#   sdk-go/VERSION             github.com/primitivedotdev/sdks/sdk-go/vN
#
# All four are generated from the one OpenAPI spec in openapi/, so they are
# released together under one version (see RELEASE.md). Bumping one without
# the others fails here. It also checks the two places that must follow the
# version: the primitivedotdev entry in sdk-python/uv.lock, and the major of
# the SDK_VERSION_RANGE and CLI_VERSION_RANGE that `primitive functions init`
# writes into scaffolded projects. Plain bash and awk, so it runs on any
# runner without a language toolchain.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)

# The top-level "version" key of a package.json. Only a key indented by two
# spaces is top level in these files, so nested "version" keys never match.
package_json_version() {
  awk -F'"' '/^  "version": "/ { print $4; exit }' "$1"
}

# The version key of the [project] table in a pyproject.toml.
pyproject_version() {
  awk -F'"' '
    /^\[/ { in_project = ($0 == "[project]") }
    in_project && /^version[[:space:]]*=/ { print $2; exit }
  ' "$1"
}

# The version of the [[package]] named primitivedotdev in a uv.lock.
uv_lock_version() {
  awk -F'"' '
    /^\[\[package\]\]/ { in_package = 0 }
    /^name = "primitivedotdev"$/ { in_package = 1; next }
    in_package && /^version = / { print $2; exit }
  ' "$1"
}

# The major of a range constant such as `const SDK_VERSION_RANGE = "^3.0.0";`.
range_major() {
  awk -F'"' -v name="$2" '
    $0 ~ "^const " name " = " { sub(/^[\^~]/, "", $2); split($2, part, "."); print part[1]; exit }
  ' "$1"
}

node_version=$(package_json_version "$root/sdk-node/package.json")
cli_version=$(package_json_version "$root/cli-node/package.json")
python_version=$(pyproject_version "$root/sdk-python/pyproject.toml")
go_version=$(tr -d '[:space:]' < "$root/sdk-go/VERSION")
lock_version=$(uv_lock_version "$root/sdk-python/uv.lock")
templates="$root/cli-node/src/oclif/function-templates.ts"
sdk_range_major=$(range_major "$templates" SDK_VERSION_RANGE)
cli_range_major=$(range_major "$templates" CLI_VERSION_RANGE)

printf '%-28s %s\n' \
  "sdk-node/package.json" "${node_version:-<missing>}" \
  "cli-node/package.json" "${cli_version:-<missing>}" \
  "sdk-python/pyproject.toml" "${python_version:-<missing>}" \
  "sdk-go/VERSION" "${go_version:-<missing>}" \
  "sdk-python/uv.lock" "${lock_version:-<missing>}" \
  "SDK_VERSION_RANGE major" "${sdk_range_major:-<missing>}" \
  "CLI_VERSION_RANGE major" "${cli_range_major:-<missing>}"

for version in "$node_version" "$cli_version" "$python_version" "$go_version" \
  "$lock_version" "$sdk_range_major" "$cli_range_major"; do
  if [ -z "$version" ]; then
    echo "Could not read every package version." >&2
    exit 1
  fi
done

# The version Python must carry for a given npm and Go version. PEP 440 has no
# free-form prerelease label, so X.Y.Z-preview.N is spelled X.Y.ZrcN there.
expected_python_version=$node_version
case "$node_version" in
  *-preview.*)
    expected_python_version="${node_version%%-preview.*}rc${node_version##*-preview.}"
    ;;
  *-*)
    echo "Prerelease version $node_version is not X.Y.Z-preview.N." >&2
    exit 1
    ;;
esac

if [ "$cli_version" != "$node_version" ] ||
  [ "$go_version" != "$node_version" ] ||
  [ "$python_version" != "$expected_python_version" ]; then
  echo "Package versions differ. Bump all four together (see RELEASE.md); Python $expected_python_version goes with $node_version." >&2
  exit 1
fi

if [ "$lock_version" != "$expected_python_version" ]; then
  echo "sdk-python/uv.lock has primitivedotdev $lock_version; run uv lock in sdk-python." >&2
  exit 1
fi

major=${node_version%%.*}
if [ "$sdk_range_major" != "$major" ] || [ "$cli_range_major" != "$major" ]; then
  echo "SDK_VERSION_RANGE and CLI_VERSION_RANGE in cli-node/src/oclif/function-templates.ts must be on major $major." >&2
  exit 1
fi

echo "All packages are at version $node_version."
