# ai

My personal Claude Code setup: global `CLAUDE.md` and skills.

## Install

```bash
git clone <this repo> ~/ai
~/ai/install.sh
```

`install.sh` symlinks `CLAUDE.md` and each folder in `skills/` into `~/.claude` (and
`$CLAUDE_CONFIG_DIR` if set). Any existing non-symlinked file is moved to `*.bak.<timestamp>`.
Edits in the repo apply right away, so on another machine you only need `git pull`.
Run `install.sh` again after adding a new skill.
