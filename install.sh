#!/usr/bin/env bash
#
# ditto installer — one-liner via:
#   curl -fsSL https://raw.githubusercontent.com/cc13engineering-sketch/ditto/main/install.sh | bash
#
# Clones (or updates) ~/.ditto, mirrors the companion skill to
# ~/.claude/skills/ditto, and appends ~/.ditto/bin to PATH via the
# user's shell rc. Safe to re-run — serves as both install and update.

set -euo pipefail

DITTO_HOME="${DITTO_HOME:-$HOME/.ditto}"
CLAUDE_SKILLS_DIR="$HOME/.claude/skills"
SKILL_DEST="$CLAUDE_SKILLS_DIR/ditto"
REPO_URL="https://github.com/cc13engineering-sketch/ditto.git"
MARKER="# ditto"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ----- 1. Banner -----
bold "ditto installer"
info "repo:  $DITTO_HOME"
info "skill: $SKILL_DEST"
echo

# ----- 2-4. Prereqs -----
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is required. $2"; }
need git   "Install git from https://git-scm.com, then re-run."
need bun   "Install Bun from https://bun.sh, then re-run this installer."
need rsync "Install rsync (ships with macOS; 'apt install rsync' on Debian/Ubuntu), then re-run."
ok "prereqs: git, bun, rsync"

# ----- 5. Clone or update -----
if [ -d "$DITTO_HOME/.git" ]; then
  info "updating $DITTO_HOME ..."
  if ! git -C "$DITTO_HOME" pull --ff-only; then
    die "git pull --ff-only failed in $DITTO_HOME. Resolve local changes (commit/stash/reset) and re-run."
  fi
  ok "repo updated"
elif [ -e "$DITTO_HOME" ]; then
  die "$DITTO_HOME exists but is not a git clone. Move it aside or 'rm -rf $DITTO_HOME', then re-run."
else
  info "cloning $REPO_URL -> $DITTO_HOME ..."
  git clone "$REPO_URL" "$DITTO_HOME"
  ok "repo cloned"
fi

# ----- 6. Sync skill -----
mkdir -p "$CLAUDE_SKILLS_DIR"
rsync -a --delete "$DITTO_HOME/skill/" "$SKILL_DEST/"
ok "skill synced -> $SKILL_DEST"

# ----- 7. PATH setup -----
shell_name="${SHELL##*/}"
case "$shell_name" in
  zsh)  rc_file="$HOME/.zshrc" ;;
  bash)
    if [ "$(uname -s)" = "Darwin" ] && [ -f "$HOME/.bash_profile" ]; then
      rc_file="$HOME/.bash_profile"
    else
      rc_file="$HOME/.bashrc"
    fi ;;
  fish) rc_file="$HOME/.config/fish/config.fish" ;;
  *)    rc_file="$HOME/.profile" ;;
esac

mkdir -p "$(dirname "$rc_file")"
[ -e "$rc_file" ] || touch "$rc_file"

if grep -qxF "$MARKER" "$rc_file" 2>/dev/null; then
  ok "PATH already set in $rc_file"
else
  {
    printf '\n%s\n' "$MARKER"
    if [ "$shell_name" = "fish" ]; then
      if [ "$DITTO_HOME" != "$HOME/.ditto" ]; then
        printf 'set -gx DITTO_HOME %s\n' "$DITTO_HOME"
      fi
      printf 'fish_add_path %s/bin\n' "$DITTO_HOME"
    else
      if [ "$DITTO_HOME" != "$HOME/.ditto" ]; then
        printf 'export DITTO_HOME="%s"\n' "$DITTO_HOME"
        # shellcheck disable=SC2016  # literal $PATH, expanded at shell startup
        printf 'export PATH="%s/bin:$PATH"\n' "$DITTO_HOME"
      else
        # shellcheck disable=SC2016  # literal $HOME/$PATH, expanded at shell startup
        printf 'export PATH="$HOME/.ditto/bin:$PATH"\n'
      fi
    fi
  } >> "$rc_file"
  ok "PATH added to $rc_file"
fi

# ----- 8. Summary -----
echo
bold "Done."
info "✓ ditto installed to $DITTO_HOME"
info "✓ skill synced to $SKILL_DEST"
info "✓ $DITTO_HOME/bin added to PATH in $rc_file"
echo
info "Open a new shell (or run 'exec \$SHELL'), then:"
info "  ditto check"
