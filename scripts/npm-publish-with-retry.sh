#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: npm-publish-with-retry.sh --package <name> --version <version> --directory <path>

Publishes an npm package with provenance and treats the operation as successful
only after the requested package version is visible in the registry.

Environment overrides:
  NPM_PUBLISH_ATTEMPTS                     default: 3
  NPM_PUBLISH_RETRY_DELAY_SECONDS          default: 10
  NPM_PUBLISH_VISIBILITY_TIMEOUT_SECONDS   default: 180
  NPM_PUBLISH_VISIBILITY_INTERVAL_SECONDS  default: 5
USAGE
}

package_name=
package_version=
package_directory=

while [[ $# -gt 0 ]]; do
  case "$1" in
    --package)
      package_name="${2:-}"
      shift 2
      ;;
    --version)
      package_version="${2:-}"
      shift 2
      ;;
    --directory)
      package_directory="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$package_name" || -z "$package_version" || -z "$package_directory" ]]; then
  usage
  exit 2
fi

if [[ ! -d "$package_directory" ]]; then
  echo "Package directory does not exist: $package_directory" >&2
  exit 2
fi

publish_attempts="${NPM_PUBLISH_ATTEMPTS:-3}"
retry_delay_seconds="${NPM_PUBLISH_RETRY_DELAY_SECONDS:-10}"
visibility_timeout_seconds="${NPM_PUBLISH_VISIBILITY_TIMEOUT_SECONDS:-180}"
visibility_interval_seconds="${NPM_PUBLISH_VISIBILITY_INTERVAL_SECONDS:-5}"

if ! [[ "$publish_attempts" =~ ^[1-9][0-9]*$ ]]; then
  echo "NPM_PUBLISH_ATTEMPTS must be a positive integer." >&2
  exit 2
fi

npm_version_exists() {
  npm view "${package_name}@${package_version}" version >/dev/null 2>&1
}

wait_for_npm_version() {
  local timeout_seconds="$1"
  local deadline=$((SECONDS + timeout_seconds))

  while true; do
    if npm_version_exists; then
      echo "${package_name}@${package_version} is visible on npm."
      return 0
    fi

    if (( SECONDS >= deadline )); then
      return 1
    fi

    sleep "$visibility_interval_seconds"
  done
}

is_retryable_publish_error() {
  local log_file="$1"

  grep -Eiq \
    'TLOG_CREATE_ENTRY_ERROR|E5[0-9][0-9]|Bad Gateway|Gateway Timeout|Service Unavailable|Internal Server Error|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENOTFOUND|fetch failed|socket hang up|network timeout|network socket disconnected' \
    "$log_file"
}

if npm_version_exists; then
  echo "${package_name}@${package_version} is already published; skipping npm publish."
  exit 0
fi

attempt=1
while (( attempt <= publish_attempts )); do
  log_file="$(mktemp)"
  echo "Publishing ${package_name}@${package_version} from ${package_directory} (attempt ${attempt}/${publish_attempts})..."

  set +e
  (cd "$package_directory" && npm publish --access public --provenance) 2>&1 | tee "$log_file"
  publish_status=${PIPESTATUS[0]}
  set -e

  if (( publish_status == 0 )); then
    rm -f "$log_file"

    if wait_for_npm_version "$visibility_timeout_seconds"; then
      exit 0
    fi

    echo "npm publish exited successfully, but ${package_name}@${package_version} was not visible after ${visibility_timeout_seconds}s." >&2
    exit 1
  fi

  if wait_for_npm_version 30; then
    rm -f "$log_file"
    echo "npm publish exited non-zero, but ${package_name}@${package_version} is visible; treating publish as successful."
    exit 0
  fi

  if (( attempt < publish_attempts )) && is_retryable_publish_error "$log_file"; then
    rm -f "$log_file"
    sleep_seconds=$((retry_delay_seconds * attempt))
    echo "Retryable npm publish failure detected; retrying in ${sleep_seconds}s..." >&2
    sleep "$sleep_seconds"
    attempt=$((attempt + 1))
    continue
  fi

  rm -f "$log_file"
  echo "npm publish failed after ${attempt} attempt(s) for ${package_name}@${package_version}." >&2
  exit "$publish_status"
done
