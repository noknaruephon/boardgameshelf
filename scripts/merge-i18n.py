#!/usr/bin/env python3
"""Merge the Thai curation batches (docs/i18n/batch-*.json) into games.json.

    python3 scripts/merge-i18n.py               # skips confidence: low
    python3 scripts/merge-i18n.py --include-low # merges them too
    python3 scripts/merge-i18n.py --force       # overwrite existing _th values

Each batch entry: { bggId, blurb_th, caption_th, captions_th?, frames_th?,
confidence, note }. Fields land next to their English siblings —
`blurb_th` after `blurb`, `caption_th` after `caption` (or after
`caption_override` when present), `captions_th` / `frames_th` inside `teach`
after `beats` — so the games.json diff is additive. `confidence` and `note`
stay in the batch files and are never copied across.

Exits non-zero when a `captions_th` does not have one caption per beat, a
`frames_th` does not match the strip's frames, or a bggId is unknown.
Round-trip: indent=2, ensure_ascii=False, trailing newline (same as
scripts/merge-teach.py).
"""
import argparse
import glob
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMES = ROOT / 'games.json'
BATCHES = sorted(glob.glob(str(ROOT / 'docs' / 'i18n' / 'batch-*.json')), key=lambda p: int(Path(p).stem.split('-')[1]))


def insert_after(d, anchor_keys, key, value):
    """Rebuild dict `d` with `key` placed after the last present anchor key (or at the end)."""
    anchor = next((k for k in reversed(anchor_keys) if k in d), None)
    out = {}
    for k, v in d.items():
        if k == key:
            continue
        out[k] = v
        if k == anchor:
            out[key] = value
    if key not in out:
        out[key] = value
    return out


def filled(v):
    return isinstance(v, str) and v.strip() != ''


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('files', nargs='*', default=BATCHES, help='batch files (default: docs/i18n/batch-*.json)')
    ap.add_argument('--include-low', action='store_true')
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()

    entries = {}
    for f in args.files:
        for e in json.loads(Path(f).read_text(encoding='utf-8')):
            entries[str(e['bggId'])] = e

    games = json.loads(GAMES.read_text(encoding='utf-8'))
    by_id = {str(g.get('bggId')) for g in games}
    unknown = [i for i in entries if i not in by_id]
    if unknown:
        print(f'unknown bggIds in batches: {", ".join(unknown)}', file=sys.stderr)
        return 1

    problems, merged, skipped_low, kept = [], [], [], []
    result = []
    for g in games:
        e = entries.get(str(g.get('bggId')))
        if e is None:
            result.append(g)
            continue
        if e.get('confidence') == 'low' and not args.include_low:
            skipped_low.append(g.get('title'))
            result.append(g)
            continue
        title = g.get('title', g.get('bggId'))
        if filled(e.get('blurb_th')):
            if filled(g.get('blurb_th')) and not args.force:
                kept.append(f'{title}: blurb_th')
            else:
                g = insert_after(g, ['blurb'], 'blurb_th', e['blurb_th'].strip())
        if filled(e.get('caption_th')):
            if filled(g.get('caption_th')) and not args.force:
                kept.append(f'{title}: caption_th')
            else:
                g = insert_after(g, ['caption', 'caption_override'], 'caption_th', e['caption_th'].strip())
        teach = g.get('teach')
        if isinstance(teach, dict) and isinstance(teach.get('beats'), list) and e.get('captions_th') is not None:
            caps = e['captions_th']
            if not (isinstance(caps, list) and len(caps) == len(teach['beats']) and all(filled(c) for c in caps)):
                problems.append(f'{title}: captions_th must be {len(teach["beats"])} non-empty strings')
            else:
                strip = next((b for b in teach['beats'] if b.get('scene') == 'strip'), None)
                frames = e.get('frames_th')
                if strip is not None:
                    n = len(strip.get('steps', []))
                    if not (isinstance(frames, list) and len(frames) == n and all(filled(c) for c in frames)):
                        problems.append(f'{title}: frames_th must be {n} non-empty strings')
                        result.append(g)
                        continue
                if isinstance(teach.get('captions_th'), list) and not args.force:
                    kept.append(f'{title}: captions_th')
                else:
                    teach = insert_after(teach, ['beats'], 'captions_th', [c.strip() for c in caps])
                    if strip is not None:
                        teach = insert_after(teach, ['captions_th'], 'frames_th', [c.strip() for c in frames])
                    g = {**g, 'teach': teach}
        result.append(g)
        merged.append(title)

    if problems:
        print('games.json NOT written — fix these first:', file=sys.stderr)
        for p in problems:
            print('  ' + p, file=sys.stderr)
        return 1

    with GAMES.open('w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
        f.write('\n')

    print(f'merged {len(merged)} · skipped {len(skipped_low)} low-confidence · kept {len(kept)} existing')
    for t in skipped_low:
        print('  skipped (low): ' + t)
    for t in kept:
        print('  kept (pass --force to overwrite): ' + t)
    return 0


if __name__ == '__main__':
    sys.exit(main())
