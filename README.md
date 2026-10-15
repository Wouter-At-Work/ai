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

| Skill | Source |
| --- | --- |
| `visual-review` | Mine. Merged in from the `bb-review` repo with its history. See its README. |
| `i-have-adhd` | Third-party (MIT) |
| `fluid-functionalism` | Third-party ([fluidfunctionalism.com](https://fluidfunctionalism.com)) |
| `design-taste-frontend`, `brandkit`, `gpt-taste`, `high-end-visual-design`, `minimalist-ui`, `industrial-brutalist-ui`, `redesign-existing-projects`, `stitch-design-taste`, `image-to-code`, `imagegen-frontend-web`, `imagegen-frontend-mobile`, `full-output-enforcement` | Third-party. `design-taste-frontend` comes from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill); the others were installed in the same batch, so probably the same pack (not confirmed) |

The third-party skills are copied in as-is so one clone gets everything. To update one,
copy the new version over its folder and commit.

`omarchy` and `diagnose-crash` aren't here because Omarchy ships them with the system.

### visual-review setup on a new machine

- Needs `bun` and `git`. `install.sh` installs its dependencies.
- PR reviews need `~/.config/visual-review/.env` (see `.env.example`). Local reviews work without it.
- The Exposure font is licensed, so it's gitignored. Copy `exposure-*.woff2` into
  `skills/visual-review/src/fonts/` by hand.
