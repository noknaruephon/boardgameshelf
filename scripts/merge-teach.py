#!/usr/bin/env python3
"""Merge docs/teach/teach.json into games.json.

For each game whose bggId appears in teach.json, insert its `teach` object
directly after `caption`, preserving every other key in place. The diff to
games.json must be additive.

    python3 scripts/merge-teach.py               # skips confidence: low
    python3 scripts/merge-teach.py --include-low # merges them too
    python3 scripts/merge-teach.py --force       # overwrite reviewed: true

`confidence` lives in teach.json only and is never copied across.

Exits non-zero if any resulting `beats` array is not exactly the five keys
hook/win/turn/gotcha/first in that order, if a strip has other than three
frames, or if a caption exceeds its word budget (12 per beat, 6 per frame).
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMES = ROOT / 'games.json'
TEACH = ROOT / 'docs' / 'teach' / 'teach.json'

BEAT_KEYS = ['hook', 'win', 'turn', 'gotcha', 'first']
BEAT_WORDS = 12
FRAME_WORDS = 6


def words(s):
    return len(str(s).split())


def validate(game):
    """Return a list of problems with game['teach'], empty when it is sound."""
    t = game.get('teach')
    if t is None:
        return []
    title = game.get('title', game.get('bggId', '?'))
    problems = []
    beats = t.get('beats')
    if not isinstance(beats, list) or [b.get('key') for b in beats] != BEAT_KEYS:
        problems.append(f'{title}: beats must be exactly {BEAT_KEYS}')
        return problems
    for b in beats:
        if words(b.get('caption', '')) > BEAT_WORDS:
            problems.append(f'{title}: "{b["key"]}" caption is {words(b["caption"])} words (max {BEAT_WORDS})')
        if b.get('scene') == 'strip':
            steps = b.get('steps')
            if not isinstance(steps, list) or len(steps) != 3:
                problems.append(f'{title}: strip must have exactly three frames')
                continue
            for i, s in enumerate(steps, 1):
                if words(s.get('caption', '')) > FRAME_WORDS:
                    problems.append(f'{title}: frame {i} caption is {words(s["caption"])} words (max {FRAME_WORDS})')
    return problems


def with_teach(game, teach):
    """Rebuild the game dict with `teach` placed right after `caption`."""
    out = {}
    placed = False
    for k, v in game.items():
        if k == 'teach':
            continue
        out[k] = v
        if k == 'caption':
            out['teach'] = teach
            placed = True
    if not placed:
        out['teach'] = teach
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--include-low', action='store_true', help='also merge entries with confidence: low')
    ap.add_argument('--force', action='store_true', help='overwrite a teach whose reviewed is true')
    args = ap.parse_args()

    teach = json.loads(TEACH.read_text(encoding='utf-8'))
    games = json.loads(GAMES.read_text(encoding='utf-8'))

    merged, skipped_low, kept_reviewed, missing = [], [], [], []
    result = []
    for g in games:
        entry = teach.get(str(g.get('bggId')))
        if entry is None:
            missing.append(g.get('title'))
            result.append(g)
            continue
        if entry.get('confidence') == 'low' and not args.include_low:
            skipped_low.append(g.get('title'))
            result.append(g)
            continue
        existing = g.get('teach')
        if isinstance(existing, dict) and existing.get('reviewed') is True and not args.force:
            kept_reviewed.append(g.get('title'))
            result.append(g)
            continue
        result.append(with_teach(g, entry['teach']))
        merged.append(g.get('title'))

    problems = [p for g in result for p in validate(g)]
    if problems:
        print('games.json NOT written — fix these first:', file=sys.stderr)
        for p in problems:
            print('  ' + p, file=sys.stderr)
        return 1

    with GAMES.open('w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
        f.write('\n')

    print(f'merged {len(merged)} · skipped {len(skipped_low)} low-confidence · '
          f'kept {len(kept_reviewed)} reviewed · {len(missing)} not in teach.json')
    if skipped_low:
        print('skipped (confidence: low):')
        for t in skipped_low:
            print('  ' + t)
    if kept_reviewed:
        print('kept (reviewed: true, pass --force to overwrite):')
        for t in kept_reviewed:
            print('  ' + t)
    if missing:
        print('not in teach.json:')
        for t in missing:
            print('  ' + t)
    return 0


if __name__ == '__main__':
    sys.exit(main())
