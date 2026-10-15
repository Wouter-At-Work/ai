# ai

My personal Claude Code setup: global `CLAUDE.md` and skills.

## Install

```bash
git clone <this repo> ~/ai
~/ai/install.sh
```

`install.sh` symlinks `CLAUDE.md` and each folder in `skills/` into `~/.claude` (and
`$CLAUDE_CONFIG_DIR` if set). Any existing file or folder that isn't a symlink is moved to `~/.ai-backup/<timestamp>/` first.
Edits in the repo apply right away, so on another machine you only need `git pull`.
Run `install.sh` again after adding a new skill.

## Skills

Only my own skills live here. Third-party skills are installed separately and aren't tracked.

- `visual-review`: merged in from the old `bb-review` repo, with its history. See its README.

### visual-review setup on a new machine

- Needs `bun` and `git`. `install.sh` installs its dependencies.
- PR reviews need `~/.config/visual-review/.env` (see `.env.example`). Local reviews work without it.
- The Exposure font is licensed, so it's gitignored. Copy `exposure-*.woff2` into
  `skills/visual-review/src/fonts/` by hand.
