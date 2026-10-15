#!/usr/bin/env bash
# Links this repo's CLAUDE.md and skills into every Claude Code config dir.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dirs=("$HOME/.claude")
[[ -n "${CLAUDE_CONFIG_DIR:-}" && "$CLAUDE_CONFIG_DIR" != "$HOME/.claude" ]] && dirs+=("$CLAUDE_CONFIG_DIR")

link() {
  local src="$1" dest="$2"
  if [[ -e "$dest" && ! -L "$dest" ]]; then
    mv "$dest" "$dest.bak.$(date +%s)"
    echo "backed up $dest"
  fi
  ln -sfn "$src" "$dest"
  echo "linked $dest -> $src"
}

for dir in "${dirs[@]}"; do
  mkdir -p "$dir/skills"
  link "$repo/CLAUDE.md" "$dir/CLAUDE.md"
  for skill in "$repo"/skills/*/; do
    [[ -d "$skill" ]] || continue
    link "${skill%/}" "$dir/skills/$(basename "$skill")"
  done
done
