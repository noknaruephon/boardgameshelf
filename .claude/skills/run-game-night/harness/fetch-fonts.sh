#!/usr/bin/env bash
# Downloads the Google Fonts CSS night-host.html links (Fraunces, Inter, IBM Plex Mono)
# and its woff2 files into ./fonts, rewriting the CSS to local paths that setup.mjs serves.
# curl goes through the session proxy; the browser cannot reach fonts.gstatic.com itself.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p fonts && cd fonts
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
CSS_URL="$(grep -o 'https://fonts.googleapis.com/css2[^"]*' ../../../../../night-host.html | head -1 | sed 's/&amp;/\&/g')"
curl -sS -A "$UA" "$CSS_URL" -o fonts.css
: > map.txt
i=0
grep -o 'https://fonts.gstatic.com/[^)]*' fonts.css | sort -u | while read -r u; do
  i=$((i+1)); f="f$i.woff2"
  curl -sS -A "$UA" "$u" -o "$f"
  echo "$u $f" >> map.txt
done
python3 - <<'PY'
css = open('fonts.css').read()
for line in open('map.txt'):
    u, f = line.split()
    css = css.replace(u, 'http://127.0.0.1:8123/__fonts/' + f)
open('fonts.local.css', 'w').write(css)
print('fonts ready:', sum(1 for _ in open('map.txt')), 'files')
PY
