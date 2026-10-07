#!/usr/bin/env bash
# Checks that the Go module path in sdk-go/go.mod matches the major version
# in sdk-go/VERSION. Go requires a /vN suffix on the module path for major
# versions 2 and above, and none for 0 or 1; a tag whose major does not match
# the module path is rejected by the Go module proxy.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
version=$(tr -d '[:space:]' < "$root/sdk-go/VERSION")
module=$(awk '$1 == "module" { print $2; exit }' "$root/sdk-go/go.mod")
base="github.com/primitivedotdev/sdks/sdk-go"

if ! printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+'; then
  echo "sdk-go/VERSION is '$version', not a release version; skipping module path check."
  exit 0
fi

major=${version%%.*}
if [ "$major" -ge 2 ]; then
  expected="$base/v$major"
else
  expected="$base"
fi

if [ "$module" != "$expected" ]; then
  echo "sdk-go/go.mod declares module $module, but sdk-go/VERSION $version needs $expected" >&2
  exit 1
fi
echo "Go module path $module matches VERSION $version."
