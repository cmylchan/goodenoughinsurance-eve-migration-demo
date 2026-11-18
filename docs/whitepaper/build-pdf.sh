#!/usr/bin/env bash
# Renders Vercel-SA-ClientArtifact.pdf and one PNG per page from index.html with headless Chrome.
set -euo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
URL="file://$PWD/index.html"
PAGES=$(grep -c 'class="page' index.html)

"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=15000 \
  --print-to-pdf="$PWD/Vercel-SA-ClientArtifact.pdf" "$URL" 2>/dev/null

mkdir -p pages
for i in $(seq 1 "$PAGES"); do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size=816,1056 --virtual-time-budget=15000 \
    --screenshot="$PWD/pages/page-$(printf %02d "$i").png" "$URL?page=$i" 2>/dev/null
done

swift set-metadata.swift "$PWD/Vercel-SA-ClientArtifact.pdf"
echo "Vercel-SA-ClientArtifact.pdf and $PAGES pages in pages/"
