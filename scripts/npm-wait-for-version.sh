#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: npm-wait-for-version.sh <package> <version> [timeout-seconds] [interval-seconds]
USAGE
}

if [[ "${1:-}" = "-h" || "${1:-}" = "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 2 || $# -gt 4 ]]; then
  usage
  exit 2
fi

package_name="$1"
package_version="$2"
timeout_seconds="${3:-900}"
interval_seconds="${4:-10}"
deadline=$((SECONDS + timeout_seconds))

echo "Waiting for ${package_name}@${package_version} to be visible on npm..."

while true; do
  if npm view "${package_name}@${package_version}" version >/dev/null 2>&1; then
    echo "${package_name}@${package_version} is visible on npm."
    exit 0
  fi

  if (( SECONDS >= deadline )); then
    echo "Timed out waiting for ${package_name}@${package_version} after ${timeout_seconds}s." >&2
    exit 1
  fi

  sleep "$interval_seconds"
done
