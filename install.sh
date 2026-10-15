#!/usr/bin/env bash
# Links this repo's CLAUDE.md and skills into every Claude Code config dir and ~/.agents/skills.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
backup="$HOME/.ai-backup/$(date +%Y%m%d-%H%M%S)"
dirs=("$HOME/.claude")
[[ -n "${CLAUDE_CONFIG_DIR:-}" && "$CLAUDE_CONFIG_DIR" != "$HOME/.claude" ]] && dirs+=("$CLAUDE_CONFIG_DIR")

link() {
  local src="$1" dest="$2"
  if [[ -e "$dest" && ! -L "$dest" ]]; then
    # Back up outside the skills dir so the old copy isn't loaded as a duplicate skill
    mkdir -p "$backup${dest%/*}"
    mv "$dest" "$backup$dest"
    echo "backed up $dest to $backup$dest"
  fi
  ln -sfn "$src" "$dest"
  echo "linked $dest -> $src"
}

link_skills() {
  local dir="$1"
  mkdir -p "$dir"
  for skill in "$repo"/skills/*/; do
    [[ -d "$skill" ]] || continue
    link "${skill%/}" "$dir/$(basename "$skill")"
  done
}

for dir in "${dirs[@]}"; do
  link "$repo/CLAUDE.md" "$dir/CLAUDE.md"
  link_skills "$dir/skills"
done

# Shared skills dir read by other agents (Codex, skills CLI)
link_skills "$HOME/.agents/skills"

# visual-review is a Bun app; install its dependencies
if command -v bun >/dev/null; then
  (cd "$repo/skills/visual-review" && bun install --frozen-lockfile >/dev/null)
fi
