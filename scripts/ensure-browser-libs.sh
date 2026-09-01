#!/usr/bin/env bash
# Chromium headless shell needs a few system .so files + an emoji font that this sandbox
# lacks. Private copies live in .browser-libs/ (extracted from Debian packages, never
# installed system-wide). `source` this file to export the env vars.
cd "$(dirname "$0")/.."
B="$PWD/.browser-libs"
if [ -d "$B" ]; then
  export LD_LIBRARY_PATH="$B:${LD_LIBRARY_PATH:-}"
  export FONTCONFIG_PATH="$B"
  export FONTCONFIG_FILE="$B/fonts.conf"
  fc-cache -f "$B/fonts" >/dev/null 2>&1 || true
fi
