#!/usr/bin/env python3
"""Enrich games.json with BGG mechanics and categories.

Fetches `boardgamemechanic` and `boardgamecategory` link data from the
BoardGameGeek XML API2 for every game in games.json and writes them back
as `mechanics` and `categories` string arrays (inserted after `weightScore`
for stable diffs).

Idempotent: games that already have BOTH fields are skipped, so this can be
re-run after adding new games to the collection and it will only fetch the
missing ones. Use --force to refetch everything.

Zero dependencies — Python 3.8+ stdlib only.

Usage:
    python3 scripts/sync-bgg-taxonomy.py            # enrich games missing data
    python3 scripts/sync-bgg-taxonomy.py --force    # refetch all games
    python3 scripts/sync-bgg-taxonomy.py --dry-run  # fetch + report, no write
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

BGG_ENDPOINT = "https://boardgamegeek.com/xmlapi2/thing?id={ids}"
BATCH_SIZE = 20          # BGG handles up to ~20 ids per request comfortably
REQUEST_GAP_S = 2.0      # be polite; BGG throttles aggressive clients
MAX_RETRIES = 5          # for 202 (queued) / 429 (rate limited) responses
USER_AGENT = "BoardgameShelf/1.0 (taxonomy sync; github.com/noknaruephon/boardgameshelf)"

GAMES_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "games.json")


def fetch_batch(ids):
    """Fetch one batch of thing ids. Returns {bggId: {"mechanics": [...], "categories": [...]}}."""
    url = BGG_ENDPOINT.format(ids=",".join(ids))
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                status = resp.status
                body = resp.read()
        except urllib.error.HTTPError as e:
            status, body = e.code, b""
        except urllib.error.URLError as e:
            print(f"  network error ({e.reason}), retry {attempt}/{MAX_RETRIES}", file=sys.stderr)
            time.sleep(REQUEST_GAP_S * attempt)
            continue

        if status == 200 and body:
            return parse_batch(body)
        if status == 202:
            # BGG queued the request; result will be ready shortly
            print(f"  BGG queued batch (202), retry {attempt}/{MAX_RETRIES}", file=sys.stderr)
            time.sleep(REQUEST_GAP_S * attempt)
            continue
        if status == 429:
            wait = REQUEST_GAP_S * (2 ** attempt)
            print(f"  rate limited (429), backing off {wait:.0f}s", file=sys.stderr)
            time.sleep(wait)
            continue
        print(f"  unexpected HTTP {status}, retry {attempt}/{MAX_RETRIES}", file=sys.stderr)
        time.sleep(REQUEST_GAP_S * attempt)

    raise RuntimeError(f"batch failed after {MAX_RETRIES} retries: ids={ids[:3]}…")


def parse_batch(xml_bytes):
    """Parse a /thing response into {bggId: {mechanics, categories}}."""
    out = {}
    root = ET.fromstring(xml_bytes)
    for item in root.findall("item"):
        bgg_id = item.get("id")
        mechanics, categories = [], []
        for link in item.findall("link"):
            kind, value = link.get("type"), link.get("value")
            if kind == "boardgamemechanic" and value:
                mechanics.append(value)
            elif kind == "boardgamecategory" and value:
                categories.append(value)
        out[bgg_id] = {"mechanics": mechanics, "categories": categories}
    return out


def insert_after(game, anchor_key, new_pairs):
    """Return a new dict with new_pairs inserted right after anchor_key.

    Keeps key order stable so the JSON diff stays minimal. If the anchor is
    missing, the new keys are appended at the end.
    """
    rebuilt = {}
    inserted = False
    for k, v in game.items():
        # if refetching (--force), drop stale copies so they re-insert at the anchor
        if k in new_pairs:
            continue
        rebuilt[k] = v
        if k == anchor_key:
            rebuilt.update(new_pairs)
            inserted = True
    if not inserted:
        rebuilt.update(new_pairs)
    return rebuilt


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="refetch all games, not just missing ones")
    ap.add_argument("--dry-run", action="store_true", help="fetch and report, but do not write games.json")
    ap.add_argument("--file", default=GAMES_JSON, help="path to games.json")
    args = ap.parse_args()

    with open(args.file, encoding="utf-8") as f:
        games = json.load(f)

    if args.force:
        todo = list(games)
    else:
        todo = [g for g in games if "mechanics" not in g or "categories" not in g]

    print(f"{len(games)} games in collection · {len(todo)} to fetch")
    if not todo:
        print("Nothing to do — every game already has mechanics and categories.")
        return

    id_to_taxonomy = {}
    ids = [g["bggId"] for g in todo]
    batches = [ids[i:i + BATCH_SIZE] for i in range(0, len(ids), BATCH_SIZE)]
    for n, batch in enumerate(batches, 1):
        print(f"batch {n}/{len(batches)} ({len(batch)} ids)…")
        id_to_taxonomy.update(fetch_batch(batch))
        if n < len(batches):
            time.sleep(REQUEST_GAP_S)

    empty = []
    updated = 0
    for i, g in enumerate(games):
        tax = id_to_taxonomy.get(g["bggId"])
        if tax is None:
            continue
        games[i] = insert_after(
            g, "weightScore",
            {"mechanics": tax["mechanics"], "categories": tax["categories"]},
        )
        updated += 1
        if not tax["mechanics"] and not tax["categories"]:
            empty.append(f'{g["title"]} (id {g["bggId"]})')

    print(f"updated {updated} games")
    if empty:
        print("WARNING — no taxonomy returned for (check these ids on BGG):", file=sys.stderr)
        for line in empty:
            print(f"  · {line}", file=sys.stderr)

    if args.dry_run:
        sample = next((g for g in games if g.get("mechanics")), None)
        if sample:
            print(f'\ndry run sample — {sample["title"]}:')
            print("  mechanics:", ", ".join(sample["mechanics"]) or "—")
            print("  categories:", ", ".join(sample["categories"]) or "—")
        print("\ndry run: games.json NOT written")
        return

    # atomic write, preserving the file's exact formatting conventions
    tmp = args.file + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(games, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, args.file)
    print(f"wrote {args.file}")

    sys.exit(1 if empty else 0)


if __name__ == "__main__":
    main()
