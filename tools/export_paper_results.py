#!/usr/bin/env python3
"""Read-only settlement of published Ridge PAPER forecasts for the public site.

Input forecasts come only from the already-verified public data/predictions.json
(frozen before kickoff, checked against the append-only ledger by
export_paper_forecasts.py). Final scores come from the private Silver, read-only.
Output is append-only: a settled result is never changed or dropped. No odds.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

CHAMPION = "ridge_poisson_api_silver_v1"
LEAGUES = {203: "superlig", 39: "premier", 140: "laliga", 135: "seriea", 78: "bundesliga",
           61: "ligue1", 88: "eredivisie", 94: "primeira", 40: "championship", 144: "jupiler"}
SOURCE_AGE_HOURS = 36
OUTCOMES = ("1", "X", "2")


class ResultExportError(ValueError):
    pass


def require(ok, message):
    if not ok:
        raise ResultExportError(message)


def utc(value):
    require(isinstance(value, str), "missing UTC time")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ResultExportError("invalid UTC time") from exc
    require(result.tzinfo is not None and result.utcoffset() == timedelta(0), "non-UTC time")
    return result.astimezone(timezone.utc)


def _hex(value):
    return isinstance(value, str) and len(value) == 64 and all(c in "0123456789abcdef" for c in value)


def _outcome(home, away):
    return "1" if home > away else "X" if home == away else "2"


def _pick(p):
    return OUTCOMES[max(range(3), key=p.__getitem__)]


def export(*, predictions: Path, silver: Path, existing_path: Path | None = None,
           now: datetime | None = None):
    now = now or datetime.now(timezone.utc)
    require(now.utcoffset() == timedelta(0), "run with UTC now")
    doc = json.loads(Path(predictions).read_text(encoding="utf-8"))
    require(doc.get("schema") == "bo-predictions/v1" and doc.get("model_version") == CHAMPION and
            doc.get("source") == "BO_BET_APPEND_ONLY_LEDGER", "need verified public forecast feed")
    forecasts = {f["fixture_id"]: f for f in doc.get("forecasts", [])}
    require(len(forecasts) == len(doc.get("forecasts", [])), "duplicate published forecast")

    previous = {}
    if existing_path and Path(existing_path).is_file():
        old = json.loads(Path(existing_path).read_text(encoding="utf-8"))
        require(old.get("schema") == "bo-results/v1" and old.get("model_version") == CHAMPION,
                "invalid previous results file")
        for r in old["results"]:
            f = forecasts.get(r["fixture_id"])
            # A settled row must still point at the identical published (ledger-verified) forecast.
            require(r["fixture_id"] not in previous and f is not None and
                    r["record_sha256"] == f["record_sha256"] and r["p"] == f["p"] and
                    r["kickoff_utc"] == f["kickoff_utc"] and r["frozen_at_utc"] == f["frozen_at_utc"],
                    "previous result does not match its published forecast")
            previous[r["fixture_id"]] = r

    require(Path(silver).is_file(), "missing private Silver")
    conn = sqlite3.connect(f"file:{Path(silver).resolve().as_posix()}?mode=ro", uri=True)
    try:
        league_sql = ",".join(str(int(k)) for k in LEAGUES)
        latest = conn.execute(f"SELECT MAX(observed_at_utc) FROM fixtures WHERE league_id IN ({league_sql})").fetchone()[0]
        rows = {row[0]: row for row in conn.execute(f"""
            SELECT f.canonical_fixture_id, f.league_id, f.kickoff_utc, f.fixture_status,
                   f.home_goals, f.away_goals, f.observed_at_utc, f.source_sha256,
                   h.provider_name, a.provider_name
            FROM fixtures AS f
            JOIN teams AS h ON h.canonical_team_id = f.home_team_id
            JOIN teams AS a ON a.canonical_team_id = f.away_team_id
            WHERE f.league_id IN ({league_sql})""")}
    finally:
        conn.close()
    require(latest is not None and timedelta(0) <= now - utc(latest) <= timedelta(hours=SOURCE_AGE_HOURS),
            "Silver too old or future-dated")

    counts = {"settled_new": 0, "pending": 0, "rescheduled": 0, "missing_in_silver": 0}
    results = list(previous.values())
    for fid, f in forecasts.items():
        kickoff = utc(f["kickoff_utc"])
        row = rows.get(fid)
        if fid in previous:
            if row and row[3] == "FT":
                require([row[4], row[5]] == previous[fid]["score"], "settled score changed in source")
            continue
        if kickoff > now:
            continue
        if row is None:
            counts["missing_in_silver"] += 1
            continue
        _, league, s_kickoff, status, hg, ag, observed, sha, home, away = row
        if utc(s_kickoff) != kickoff:
            counts["rescheduled"] += 1  # forecast was for another kickoff time; never settle it
            continue
        if status != "FT":
            counts["pending"] += 1
            continue
        require(type(hg) is int and type(ag) is int and hg >= 0 and ag >= 0, "invalid final score")
        require(utc(observed) > kickoff and _hex(sha) and league in LEAGUES and home and away,
                "score source not observed after kickoff")
        actual = _outcome(hg, ag)
        results.append({
            "fixture_id": fid, "league": LEAGUES[league], "home": home, "away": away,
            "kickoff_utc": f["kickoff_utc"], "frozen_at_utc": f["frozen_at_utc"], "horizon": f["horizon"],
            "record_sha256": f["record_sha256"], "p": f["p"], "pick": _pick(f["p"]),
            "score": [hg, ag], "actual": actual, "hit": _pick(f["p"]) == actual,
            "score_observed_at_utc": observed, "score_source_sha256": sha,
        })
        counts["settled_new"] += 1
    results.sort(key=lambda r: (r["kickoff_utc"], r["fixture_id"]))
    return {
        "schema": "bo-results/v1",
        "data_status": "PROSPECTIVE_FROZEN_BEFORE_KICKOFF",
        "publication_state": "VERIFIED_PAPER_SETTLEMENT" if results else "NO_SETTLED_FORECASTS",
        "model_version": CHAMPION,
        "source": "PUBLISHED_PREDICTIONS_PLUS_SILVER_FINAL_SCORES",
        "exported_at_utc": now.isoformat(),
        "summary": {"total": len(results), "hits": sum(r["hit"] for r in results)},
        "results": results,
    }, counts


def main():
    p = argparse.ArgumentParser(description="Settle published Ridge PAPER forecasts for the site")
    p.add_argument("--predictions", type=Path, default=Path("data/predictions.json"))
    p.add_argument("--silver", type=Path, required=True)
    p.add_argument("--output", type=Path, default=Path("data/results.json"))
    args = p.parse_args()
    target = args.output.resolve()
    require(target not in (args.silver.resolve(), args.predictions.resolve()), "refusing to overwrite input")
    result, counts = export(predictions=args.predictions, silver=args.silver, existing_path=target)
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n",
                                     dir=target.parent, delete=False) as fp:
        temporary = Path(fp.name)
        json.dump(result, fp, ensure_ascii=False, indent=2)
        fp.write("\n")
    os.replace(temporary, target)
    print(json.dumps({"state": result["publication_state"], **result["summary"], **counts,
                      "output": str(target)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
