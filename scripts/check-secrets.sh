#!/usr/bin/env bash
#
# Blocks a commit that would publish something private.
#
# This repo is open source but is driven by a real Meta ad account, so there are
# two distinct things to keep out of it:
#
#   1. Credential-shaped strings — API keys and access tokens.
#   2. The operator's own identifiers — ad account id, Page id, landing URL.
#      These are not "secret" in the credential sense, which is exactly why they
#      leak: nobody thinks twice about pasting an account id into a README.
#
# The second check reads the values out of your local .env and looks for them in
# the staged diff. That means it protects *your* specific private values without
# this script ever having to contain them.
#
# Install:  bash scripts/check-secrets.sh --install
# Run:      bash scripts/check-secrets.sh

set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

if [ "${1:-}" = "--install" ]; then
  hook="$(git rev-parse --git-path hooks)/pre-commit"
  mkdir -p "$(dirname "$hook")"
  printf '#!/usr/bin/env bash\nexec bash scripts/check-secrets.sh\n' > "$hook"
  chmod +x "$hook"
  echo "Installed pre-commit hook at $hook"
  exit 0
fi

fail=0
note() { echo "  BLOCKED: $1"; fail=1; }

# Only inspect what is actually about to be committed.
staged="$(git diff --cached --name-only --diff-filter=ACM)"
[ -z "$staged" ] && exit 0

# --- 1. credential shapes -------------------------------------------------
# Lengths are deliberate: real keys are long, and the README's "sk-ant-..."
# placeholder must not trip the guard every time someone edits the docs.
patterns=(
  'sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{40,}'
  'AIza[0-9A-Za-z_-]{35}'
  'EAA[A-Za-z0-9]{60,}'
  'sk-[A-Za-z0-9]{32,}'
  'gh[pousr]_[A-Za-z0-9]{36}'
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
)
for f in $staged; do
  [ -f "$f" ] || continue
  case "$f" in scripts/check-secrets.sh) continue ;; esac
  for p in "${patterns[@]}"; do
    # -e matters: one pattern begins with "-" and grep would read it as a flag.
    if git show ":$f" 2>/dev/null | grep -qE -e "$p"; then
      note "$f contains something shaped like a live credential (/$p/)"
    fi
  done
done

# --- 2. the operator's own private values ---------------------------------
# Anything set in .env that is long enough to be identifying. Generic config
# values (auto, true, a model name) are skipped so the guard stays quiet.
if [ -f .env ]; then
  while IFS= read -r line; do
    case "$line" in ''|'#'*) continue ;; esac
    key="${line%%=*}"
    val="${line#*=}"
    val="${val%\"}"; val="${val#\"}"
    val="${val%\'}"; val="${val#\'}"
    [ ${#val} -lt 8 ] && continue
    case "$val" in
      auto|true|false|procedural|gemini-*|claude-*|gpt-*|low|medium|high) continue ;;
    esac
    for f in $staged; do
      [ -f "$f" ] || continue
      case "$f" in .env.example|scripts/check-secrets.sh) continue ;; esac
      if git show ":$f" 2>/dev/null | grep -qF -- "$val"; then
        note "$f contains the value of $key from your .env"
      fi
    done
  done < .env
fi

# --- 3. files that must never be tracked ----------------------------------
for f in $staged; do
  case "$f" in
    .env|.env.local|.env.*.local)
      note "$f is an environment file and must never be committed" ;;
    data/state.json)
      note "data/state.json holds real campaign ids and spend" ;;
    public/generated/*)
      note "$f is generated ad creative for a real account" ;;
  esac
done

if [ "$fail" -ne 0 ]; then
  cat <<'EOF'

Commit blocked by scripts/check-secrets.sh.

Move the value into .env (which is gitignored) and reference it via
process.env, or use a placeholder in documentation. To override a false
positive for one commit: git commit --no-verify
EOF
  exit 1
fi
exit 0
