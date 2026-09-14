#!/usr/bin/env python3
"""Report how far the Thai content pass has got in games.json. Read-only.

    python3 scripts/i18n-status.py            # counts + bggIds missing anything
    python3 scripts/i18n-status.py --quiet    # counts only

Counts games carrying `blurb_th`, `caption_th`, and a complete Thai Teach set
(`teach.captions_th`, five strings, plus `teach.frames_th`, three strings,
when the turn beat is a strip — see js/curation.js), then lists the bggIds
that still miss any of them. A game with no `teach` at all is not counted as
missing Thai Teach captions: there is nothing to translate.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMES = ROOT / 'games.json'


def filled(v):
    return isinstance(v, str) and v.strip() != ''


def complete(arr, n):
    return isinstance(arr, list) and len(arr) == n and all(filled(s) for s in arr)


def teach_th_status(teach):
    """None when the game has no Teach block, else True/False for a complete Thai set."""
    if not isinstance(teach, dict) or not isinstance(teach.get('beats'), list):
        return None
    beats = teach['beats']
    if not complete(teach.get('captions_th'), len(beats)):
        return False
    strip = next((b for b in beats if isinstance(b, dict) and b.get('scene') == 'strip'), None)
    if strip is not None:
        steps = strip.get('steps') if isinstance(strip.get('steps'), list) else []
        if not complete(teach.get('frames_th'), len(steps)):
            return False
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--quiet', action='store_true', help='counts only, no bggId list')
    args = ap.parse_args()

    games = json.loads(GAMES.read_text(encoding='utf-8'))
    total = len(games)
    with_teach = 0
    n_blurb = n_caption = n_teach = 0
    missing = []
    for g in games:
        has_blurb = filled(g.get('blurb_th'))
        has_caption = filled(g.get('caption_th'))
        teach = teach_th_status(g.get('teach'))
        n_blurb += has_blurb
        n_caption += has_caption
        if teach is not None:
            with_teach += 1
            n_teach += teach
        gaps = []
        if not has_blurb:
            gaps.append('blurb_th')
        if not has_caption:
            gaps.append('caption_th')
        if teach is False:
            gaps.append('captions_th')
        if gaps:
            missing.append((str(g.get('bggId')), g.get('title', ''), gaps))

    print(f'blurb_th     {n_blurb} / {total}')
    print(f'caption_th   {n_caption} / {total}')
    print(f'captions_th  {n_teach} / {with_teach}  (games with a Teach block)')
    print(f'complete     {total - len(missing)} / {total}')
    if missing and not args.quiet:
        print()
        print('missing:')
        for bgg_id, title, gaps in missing:
            print(f'  {bgg_id:>8}  {title}  — {", ".join(gaps)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
