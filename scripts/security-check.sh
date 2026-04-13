#!/usr/bin/env bash
set -euo pipefail

failed=0

echo "=== pnpm audit ==="
if ! pnpm audit --prod; then
  failed=1
fi

echo ""
echo "=== CodeQL ==="
db_dir="$(mktemp -d)"
trap 'rm -rf "$db_dir"' EXIT

codeql database create "$db_dir/db" --language=javascript --source-root=. --overwrite
codeql database analyze "$db_dir/db" --format=sarif-latest --output=results.sarif

findings=$(jq '[.runs[].results[]] | length' results.sarif)
echo "CodeQL findings: $findings"

if [ "$findings" -gt 0 ]; then
  jq '.runs[].results[] | {rule: .ruleId, message: .message.text, location: .locations[0].physicalLocation.artifactLocation.uri}' results.sarif
  failed=1
fi

exit $failed
