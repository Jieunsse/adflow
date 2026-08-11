#!/usr/bin/env bash
# Spring 이 떠 있어야 한다. 스펙을 스냅샷으로 떠서 TS 타입을 생성한다.
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if ! curl -sSf "$API_URL/v3/api-docs" -o "$HERE/openapi.json"; then
  echo "Spring 이 $API_URL 에서 응답하지 않아요. cd apps/api && ./gradlew bootRun 으로 먼저 띄워주세요." >&2
  exit 1
fi

mkdir -p "$HERE/types"
pnpm --dir "$HERE" exec openapi-typescript "$HERE/openapi.json" -o "$HERE/types/api.d.ts"
echo "생성 완료 — $HERE/types/api.d.ts"
