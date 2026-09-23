#!/usr/bin/env bash
# Run on macOS only — builds a real .dmg via electron-builder + hdiutil.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac dmg --arm64 --x64
ls -lah release/*.dmg
