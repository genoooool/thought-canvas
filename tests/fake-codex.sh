#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cmd="${1:-}"

if [[ "$cmd" == "--version" ]]; then
  echo "codex-cli 0.test"
  exit 0
fi

if [[ "$cmd" == "app-server" ]]; then
  exec node "$ROOT/tests/fake-codex-app-server.mjs"
fi

echo "Unsupported fake codex command: $*" >&2
exit 2
