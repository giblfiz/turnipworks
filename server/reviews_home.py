#!/usr/bin/env python3
"""Where the live review data lives (2026-10-12): Harry's ratings, bench records, house look and sent presets.

The write-back server (server/ratings_server.py) and every script that reads those records ask reviews_dir():
  1. $TW_REVIEWS_DIR when it is set (a relative path is taken from the repo root, so TW_REVIEWS_DIR=reviews names the
     in-repo folder: a throwaway server for a test, or a look at the committed snapshot);
  2. /var/lib/tw-ratings when that folder exists (the build box: the live home, outside every git checkout);
  3. the in-repo reviews/ otherwise (a fresh clone on another machine: the last committed snapshot).
The in-repo reviews/ is only a SNAPSHOT, written by tools/snapshot_reviews.sh and by nothing else.

  python3 server/reviews_home.py      print the folder (for shell scripts)
"""
import os
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LIVE_HOME = Path("/var/lib/tw-ratings")
SNAPSHOT = REPO / "reviews"


def reviews_dir():
    env = os.environ.get("TW_REVIEWS_DIR")
    if env:
        p = Path(env)
        return p if p.is_absolute() else REPO / p
    return LIVE_HOME if LIVE_HOME.is_dir() else SNAPSHOT


if __name__ == "__main__":
    print(reviews_dir())
