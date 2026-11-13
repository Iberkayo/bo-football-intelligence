#!/usr/bin/env python3
"""Export derived-only, immutable-intent retrospective 1X2 rows for the BO website.

No network calls. No re-training. The original CSV remains private and unchanged.
"""
import argparse
import csv
import hashlib
import json
import math
from datetime import datetime
from pathlib import Path

LEAGUES = {
    "api:203": "superlig", "api:39": "premier", "api:140": "laliga",
    "api:135": "seriea", "api:78": "bundesliga", "api:61": "ligue1",
}
OUTCOMES = ("1", "X", "2")
STATUS = "RETROSPECTIVE_REPLAY_NOT_PROSPECTIVE"
PERIOD = {"start": "2026-11-02", "end": "2026-11-08", "timezone": "Europe/Istanbul"}
EXPECTED_SHA256 = "f9e675ecf2cb66d675d8dc21d3d95177d54c51191052f875e4343d4c0aed140d"
EXPECTED_COUNTS = (63, 39, 37)


def fail(message):
    raise ValueError("History import rejected: " + message)


def probabilities(row, prefix):
    values = [float(row[prefix + "_p_" + k]) for k in ("1", "x", "2")]
    if not all(math.isfinite(v) and 0 <= v <= 1 for v in values):
        fail("invalid probabilities")
    if abs(sum(values) - 1) > 1e-7:
        fail("probabilities do not sum to one")
    return values


def make_document(csv_path: Path):
    raw = csv_path.read_bytes()
    sha256 = hashlib.sha256(raw).hexdigest()
    if sha256 != EXPECTED_SHA256:
        fail("source SHA256 differs from approved research CSV")
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
    matches = []
    ids = set()
    for row in rows:
        try:
            fixture_id = row["match_id"]
            league = LEAGUES[row["league"]]
            if not fixture_id.startswith("api-football:fixture:") or fixture_id in ids:
                fail("duplicate/invalid fixture ID")
            ids.add(fixture_id)
            if row["replay_status"] != STATUS:
                fail("not a retrospective-only row")
            kickoff_utc = datetime.fromisoformat(row["kickoff_utc"])
            kickoff_tr = datetime.fromisoformat(row["kickoff_tr"])
            if kickoff_utc.tzinfo is None or kickoff_tr.tzinfo is None:
                fail("timezone missing")
            if kickoff_utc != kickoff_tr:
                fail("UTC and Türkiye kickoff differ")
            day = row["kickoff_tr"][:10]
            if not PERIOD["start"] <= day <= PERIOD["end"]:
                fail("match outside Türkiye local date range")
            home_goals, away_goals = int(row["home_goals"]), int(row["away_goals"])
            if min(home_goals, away_goals) < 0:
                fail("negative score")
            actual = "1" if home_goals > away_goals else "2" if home_goals < away_goals else "X"
            if actual != row["actual_1x2"]:
                fail("inconsistent FT score")
            models = {}
            for prefix in ("ridge", "opportunity_c"):
                p = probabilities(row, prefix)
                choice = OUTCOMES[p.index(max(p))]
                if choice != row[prefix + "_top_pick"]:
                    fail("inconsistent top pick")
                models[prefix] = {"p": p, "pick": choice}
            if not row["home_team"].strip() or not row["away_team"].strip():
                fail("missing team")
            matches.append({
                "id": fixture_id, "league": league,
                "kickoff_utc": row["kickoff_utc"], "kickoff_tr": row["kickoff_tr"],
                "date": day, "home": row["home_team"], "away": row["away_team"],
                "score": [home_goals, away_goals], "actual": actual,
                "ridge": models["ridge"], "opportunity_c": models["opportunity_c"],
            })
        except (KeyError, TypeError, ValueError) as exc:
            fail(f"bad CSV row: {exc}")
    matches.sort(key=lambda m: (m["kickoff_utc"], m["id"]))
    n = len(matches)
    ridge_correct = sum(m["ridge"]["pick"] == m["actual"] for m in matches)
    c_correct = sum(m["opportunity_c"]["pick"] == m["actual"] for m in matches)
    if (n, ridge_correct, c_correct) != EXPECTED_COUNTS:
        fail("expected 63/39/37 summary does not match")
    return {
        "schema": "bo-history/v1",
        "dataset_id": "ridge-opportunity-c-2026-11-02-to-08",
        "data_status": STATUS, "publication_state": "PAPER_ONLY_NO_BET",
        "period": PERIOD,
        "source": {"filename": csv_path.name, "sha256": sha256},
        "models": {"primary": "ridge_poisson", "secondary": "bo_opportunity_combined_v1"},
        "summary": {
            "total": n, "ridge_correct": ridge_correct, "ridge_wrong": n-ridge_correct,
            "opportunity_c_correct": c_correct, "opportunity_c_wrong": n-c_correct,
        },
        "matches": matches,
    }


def main():
    parser = argparse.ArgumentParser(description="Generate website history.json from approved 63-match CSV")
    parser.add_argument("csv", type=Path, help="Private local retrospective CSV")
    parser.add_argument("--output", type=Path, default=Path("data/history.json"))
    args = parser.parse_args()
    doc = make_document(args.csv)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {args.output}: {doc['summary']} (PAPER_ONLY)")


if __name__ == "__main__":
    main()
