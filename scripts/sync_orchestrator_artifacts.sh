#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_ROOT="${1:-$HOME/.codex/skills}"
OUT_ROOT="$PROJECT_ROOT/docs/delivery-artifacts"

STAGES=(
  requirement-analysis
  prd-design
  system-architecture-design
  detailed-design
  data-model-design
  api-design
  frontend-backend-dev-standards
  implementation-and-delivery
  integration-and-joint-debug
  test-strategy-and-qa
  security-and-compliance-gate
  packaging-and-release
  post-release-operations
)

mkdir -p "$OUT_ROOT"
manifest_tmp="$OUT_ROOT/.manifest.tmp"
: > "$manifest_tmp"

echo "# Delivery Artifact Manifest" >> "$manifest_tmp"
echo "GeneratedAt: $(date '+%Y-%m-%d %H:%M:%S %z')" >> "$manifest_tmp"
echo "SourceSkillsRoot: $SKILLS_ROOT" >> "$manifest_tmp"
echo "" >> "$manifest_tmp"

for stage in "${STAGES[@]}"; do
  src="$SKILLS_ROOT/$stage/artifacts"
  dst="$OUT_ROOT/$stage"

  if [[ -d "$src" ]]; then
    mkdir -p "$dst"
    rsync -a --delete "$src/" "$dst/"
    count=$(find "$dst" -type f | wc -l | tr -d ' ')
    printf -- "- %s: %s files\n" "$stage" "$count" >> "$manifest_tmp"
  else
    printf -- "- %s: 0 files (source not found)\n" "$stage" >> "$manifest_tmp"
  fi
done

mv "$manifest_tmp" "$OUT_ROOT/manifest.md"
echo "Synced artifacts to: $OUT_ROOT"
