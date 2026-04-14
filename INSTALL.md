# Installing ditto

```bash
curl -fsSL https://raw.githubusercontent.com/cc13engineering-sketch/ditto/main/install.sh | bash
```

Re-run the same command to update.

## What it does

- Clones (or `git pull --ff-only`s) `~/.ditto`.
- Mirrors `~/.ditto/skill/` to `~/.claude/skills/ditto/` so Claude Code auto-loads the skill.
- Appends `~/.ditto/bin` to your `PATH` via your shell rc (`~/.zshrc`, `~/.bashrc`/`~/.bash_profile`, `~/.config/fish/config.fish`, or `~/.profile`). Idempotent — re-running won't duplicate the line.
- Respects `DITTO_HOME` if you set it; otherwise installs to `~/.ditto`.
- Ships a pre-built `staged/prompts-2.1.104.json` so fresh installs can `ditto apply smart` without running the skill first.

## Prerequisites

- [**Bun**](https://bun.sh) ≥ 1.1 — ditto's runtime. The installer aborts if `bun` isn't on `PATH`.
- **git** — to clone/pull the repo.
- **rsync** — ships with macOS; `apt install rsync` on Debian/Ubuntu.
- **Node.js + npm** — only needed at runtime for `ditto check` / `ditto apply` (they shell out to `node cli.js --version` and `npm install -g @anthropic-ai/claude-code`). Ships with Claude Code.

## Manual install

If you'd rather not `curl | bash`:

```bash
git clone https://github.com/cc13engineering-sketch/ditto.git ~/.ditto
mkdir -p ~/.claude/skills
rsync -a --delete ~/.ditto/skill/ ~/.claude/skills/ditto/
echo '
# ditto
export PATH="$HOME/.ditto/bin:$PATH"' >> ~/.zshrc
exec $SHELL
```

Swap `~/.zshrc` for your shell's rc if you're not on zsh.

## Verify

```bash
ditto check          # confirms installed Claude Code matches a tweakcc prompt catalog
ditto list           # should show the shipped 'smart' variant
ditto apply smart    # apply it (reversible via 'ditto reinstall')
```

## Updating

Re-run the one-liner:

```bash
curl -fsSL https://raw.githubusercontent.com/cc13engineering-sketch/ditto/main/install.sh | bash
```

It detects the existing clone, `git pull --ff-only`s, re-syncs the skill, and leaves PATH alone.

## Uninstall

```bash
rm -rf ~/.ditto ~/.claude/skills/ditto
```

Then delete the `# ditto` block from your shell rc (`~/.zshrc`, `~/.bashrc`, `~/.bash_profile`, `~/.config/fish/config.fish`, or `~/.profile`).

If you applied a variant, run `ditto reinstall` **before** uninstalling to restore a pristine `cli.js` — or just reinstall Claude Code afterwards (`npm install -g @anthropic-ai/claude-code`).

## Troubleshooting

**`bun: command not found`** during install — install Bun from [bun.sh](https://bun.sh) (one-liner: `curl -fsSL https://bun.sh/install | bash`), then re-run the ditto installer. The installer deliberately won't auto-install Bun for you.

**`ditto: command not found` after install** — your shell hasn't re-read its rc. Run `exec $SHELL` or open a new terminal. Confirm the `# ditto` block was appended to the expected rc file (see the install output for the path).

**`git pull --ff-only` failed** — you have local commits or uncommitted changes in `~/.ditto`. Either `git -C ~/.ditto stash`, commit, or `git -C ~/.ditto reset --hard origin/main` (destructive — only if you have no local work to keep), then re-run the installer.
