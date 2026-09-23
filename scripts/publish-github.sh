#!/usr/bin/env bash
# Publish source + release assets to https://github.com/afselk/kpacuvoe
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${GITHUB_TOKEN:-${GH_TOKEN:-}}" ]]; then
  echo "Set GITHUB_TOKEN (classic PAT with repo scope) and re-run."
  exit 1
fi

TOKEN="${GITHUB_TOKEN:-$GH_TOKEN}"
export GH_TOKEN="$TOKEN"

REPO="afselk/kpacuvoe"
REMOTE="https://x-access-token:${TOKEN}@github.com/${REPO}.git"

# Ensure repo exists
if ! gh repo view "$REPO" >/dev/null 2>&1; then
  gh repo create "$REPO" --public --description "Mac menu-bar app: auto-frame screenshots in a watched folder" || true
fi

git remote remove github 2>/dev/null || true
git remote add github "$REMOTE"
git push -u github main --force

# Prefer existing built zips; build if missing
if [[ ! -f release/kpacuvoe-1.0.0-arm64-mac.zip ]]; then
  npm ci
  npm run build
  CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac zip --arm64 --x64 || true
fi

ASSETS=()
[[ -f release/kpacuvoe-1.0.0-arm64-mac.zip ]] && ASSETS+=(release/kpacuvoe-1.0.0-arm64-mac.zip)
[[ -f release/kpacuvoe-1.0.0-mac.zip ]] && ASSETS+=(release/kpacuvoe-1.0.0-mac.zip)
for dmg in release/kpacuvoe-*.dmg; do
  [[ -f "$dmg" ]] && ASSETS+=("$dmg")
done

if [[ ${#ASSETS[@]} -eq 0 ]]; then
  echo "No release assets in release/ — push code only."
  exit 0
fi

NOTES=$(cat <<'EOF'
## kpacuvoe v1.0.0

Меню-бар для Mac: выбираешь папку — скрины обрамляются сами (30px radius / padding / shadow blur, непрозрачный фон).

### Установка
1. Скачай zip под свой чип (arm64 = Apple Silicon)
2. Распакуй → перетащи `kpacuvoe.app` в Applications
3. ПКМ → Open → иконка в строке меню → Выбрать папку…
EOF
)

if gh release view v1.0.0 --repo "$REPO" >/dev/null 2>&1; then
  gh release upload v1.0.0 "${ASSETS[@]}" --repo "$REPO" --clobber
else
  gh release create v1.0.0 "${ASSETS[@]}" --repo "$REPO" --title "v1.0.0" --notes "$NOTES"
fi

echo "Done: https://github.com/${REPO}"
echo "Assets: https://github.com/${REPO}/releases/latest"
