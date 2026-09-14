#!/usr/bin/env python3
"""Dump the English curated strings that need Thai, one JSON file per batch of 20.

    python3 scripts/i18n-extract.py <out-dir>

Read-only on games.json. Each entry: bggId, title, blurb, caption, and for
games with a Teach block the five beat captions and (when the turn beat is a
strip) the three frame captions. Input for the content pass; the results go
in docs/i18n/batch-N.json and are merged by scripts/merge-i18n.py.
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
games = json.loads((ROOT / 'games.json').read_text(encoding='utf-8'))
out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
BATCH = 20
for b in range(0, len(games), BATCH):
    rows = []
    for g in games[b:b + BATCH]:
        row = {'bggId': str(g['bggId']), 'title': g.get('title'), 'blurb': g.get('blurb'), 'caption': g.get('caption'), 'caption_override': g.get('caption_override')}
        t = g.get('teach')
        if isinstance(t, dict) and isinstance(t.get('beats'), list):
            row['captions'] = [x.get('caption') for x in t['beats']]
            strip = next((x for x in t['beats'] if x.get('scene') == 'strip'), None)
            if strip: row['frames'] = [s.get('caption') for s in strip.get('steps', [])]
        rows.append(row)
    (out / f'batch-{b // BATCH + 1}.json').write_text(json.dumps(rows, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(f'{len(games)} games → {(len(games) + BATCH - 1) // BATCH} batches in {out}')
