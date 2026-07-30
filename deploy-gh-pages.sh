#!/bin/bash
# deploy-gh-pages.sh — build, push to GitHub Pages, and VERIFY THE LIVE HASH.
#
#   https://enliven-empathy.github.io/wayfarer-zero/
#
# `npm run build` is not a deploy. It writes files to local disk and nothing
# serves them. This script is the deploy, and it does not exit 0 until the
# bundle hash actually being served matches the one just built.
#
# Steps:
#   1. npm run check  (typecheck + tests + build) — nothing ships red
#   2. stage dist/ into .deploy-staging/ (gitignored)
#   3. force-push that tree to the gh-pages branch
#   4. poll the live URL until it serves the new entry chunk, or fail

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
STAGING_DIR="$SCRIPT_DIR/.deploy-staging"
REMOTE_URL="https://github.com/Enliven-Empathy/wayfarer-zero.git"
LIVE_URL="https://enliven-empathy.github.io/wayfarer-zero/"
VERIFY_ATTEMPTS=20
VERIFY_INTERVAL=6

cd "$SCRIPT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  export PATH="/opt/homebrew/bin:$PATH"
fi

echo "[deploy] Running full check (typecheck + tests + build)..."
npm run check
echo

ENTRY="$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' "$DIST_DIR/index.html" | head -1)"
if [ -z "$ENTRY" ]; then
  echo "[deploy] FAILED: could not find an entry chunk in dist/index.html" >&2
  exit 1
fi
echo "[deploy] Built entry chunk: $ENTRY"
echo

echo "[deploy] Staging dist/ at $STAGING_DIR..."
rm -rf "$STAGING_DIR"
cp -R "$DIST_DIR" "$STAGING_DIR"
# Tell GitHub Pages not to run the built output through Jekyll, which would
# strip any file or directory beginning with an underscore.
touch "$STAGING_DIR/.nojekyll"
cd "$STAGING_DIR"

# Standalone repo for the staged build — fresh history every deploy, so the
# gh-pages branch never accumulates build artefacts.
git init -b deploy >/dev/null 2>&1
git add . >/dev/null
git -c "user.email=deploy@wayfarer-zero" -c "user.name=Wayfarer Deploy" \
  commit -m "deploy: $(date -u '+%Y-%m-%d %H:%M:%S')Z  $ENTRY" >/dev/null

echo "[deploy] Pushing to gh-pages..."
# Credential handling. This machine's global git credential.helper is Git
# Credential Manager, which opens a GUI dialog; in a non-interactive shell that
# dialog can never be answered and the push HANGS FOREVER rather than failing.
#
# `gh` is already authenticated with repo scope, so prefer its helper. The first
# empty `-c credential.helper=` is load-bearing: git *chains* helpers, so
# without an empty value to reset the list, GCM is still consulted first and
# still hangs.
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  GIT_TERMINAL_PROMPT=0 git \
    -c credential.helper= \
    -c credential.helper='!gh auth git-credential' \
    push "$REMOTE_URL" deploy:gh-pages --force
else
  git push "$REMOTE_URL" deploy:gh-pages --force
fi

cd "$SCRIPT_DIR"
echo

# ── Verify. Built is not deployed until the live URL says so. ───────────────
echo "[deploy] Verifying $LIVE_URL serves $ENTRY ..."
for attempt in $(seq 1 "$VERIFY_ATTEMPTS"); do
  LIVE_HTML="$(curl -fsSL --max-time 20 "$LIVE_URL" 2>/dev/null || true)"
  LIVE_ENTRY="$(printf '%s' "$LIVE_HTML" | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)"

  if [ "$LIVE_ENTRY" = "$ENTRY" ]; then
    echo "[deploy] VERIFIED after ${attempt} attempt(s)."
    echo "[deploy] Live:  $LIVE_URL"
    echo "[deploy] Entry: $ENTRY"
    printf '%s\n' "$ENTRY" > "$SCRIPT_DIR/.deploy-last-hash.txt"
    exit 0
  fi

  echo "[deploy]   attempt ${attempt}/${VERIFY_ATTEMPTS}: live=${LIVE_ENTRY:-<none>} expected=$ENTRY"
  sleep "$VERIFY_INTERVAL"
done

echo >&2
echo "[deploy] FAILED: $LIVE_URL is not serving $ENTRY after $((VERIFY_ATTEMPTS * VERIFY_INTERVAL))s." >&2
echo "[deploy] The push may have succeeded while Pages has not rebuilt. Do NOT" >&2
echo "[deploy] report this as shipped — re-run, or check the Pages build log." >&2
exit 1
