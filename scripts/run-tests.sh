#!/usr/bin/env bash
# ScratchVerse verification: bundles the REAL src (JSX included) to CJS, then runs
# the assertion suite inside a jsdom + canvas-shimmed Node process.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist-test
cp tests/harness.cjs dist-test/harness.cjs
./node_modules/.bin/esbuild tests/run.cjs --bundle --platform=node --format=cjs \
  --external:react --external:react-dom --external:dexie \
  --loader:.jsx=jsx --jsx=automatic --jsx-import-source=react \
  --outfile=dist-test/run.cjs --log-level=warning
node --no-warnings dist-test/harness.cjs
