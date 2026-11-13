#!/usr/bin/env python3
"""Read-only API-Football Silver schedule exporter for BO public site.

No HTTP, API key, predictions, odds or ledger interaction. Writes a minimal
source-time-stamped schedule JSON, never a raw provider database.
"""
from __future__ import annotations
import argparse
import json
import os
import sqlite3
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

LEAGUES = {203:"superlig",39:"premier",140:"laliga",135:"seriea",78:"bundesliga",61:"ligue1"}
ALLOWED_SOURCE_AGE_HOURS = 36


class ExportError(ValueError):
    pass


def utc(value):
    if not isinstance(value, str):
        raise ExportError("Missing timestamp")
    try:
        dt = datetime.fromisoformat(value.replace("Z","+00:00"))
    except ValueError as exc:
        raise ExportError("Invalid timestamp") from exc
    if dt.utcoffset() != timedelta(0):
        raise ExportError("Expected explicit UTC timestamp")
    return dt.astimezone(timezone.utc)


def export(silver: Path, *, from_day: date, days: int = 21,
           now: datetime | None = None, allow_archived: bool = False):
    if not 1 <= days <= 42:
        raise ExportError("days must be 1–42")
    if not silver.is_file():
        raise ExportError("Private Silver SQLite does not exist")
    now = now or datetime.now(timezone.utc)
    if now.utcoffset() != timedelta(0):
        raise ExportError("now must be UTC")
    until = from_day + timedelta(days=days)
    conn = sqlite3.connect(f"file:{silver.resolve().as_posix()}?mode=ro",uri=True)
    try:
        rows = conn.execute("""
            SELECT f.canonical_fixture_id,f.league_id,f.kickoff_utc,
                h.provider_name,a.provider_name,f.fixture_status,
                f.observed_at_utc,f.source_sha256
            FROM fixtures AS f
            JOIN teams AS h ON h.canonical_team_id=f.home_team_id
            JOIN teams AS a ON a.canonical_team_id=f.away_team_id
            WHERE f.fixture_status='NS'
                AND substr(f.kickoff_utc,1,10)>=?
                AND substr(f.kickoff_utc,1,10)<?
                AND f.league_id IN (203,39,140,135,78,61)
            ORDER BY f.kickoff_utc,f.canonical_fixture_id
        """,(from_day.isoformat(),until.isoformat())).fetchall()
        # A refresh may contain zero upcoming matches during an international break.
        latest = conn.execute("""
            SELECT MAX(observed_at_utc) FROM fixtures
            WHERE league_id IN (203,39,140,135,78,61)
              AND observed_at_utc IS NOT NULL
        """).fetchone()[0]
    finally:
        conn.close()
    if not latest:
        raise ExportError("No source snapshot timestamp in Silver")
    latest_dt = utc(latest)
    age_hours = (now-latest_dt).total_seconds()/3600
    if age_hours < 0:
        raise ExportError("Snapshot is in the future")
    if age_hours > ALLOWED_SOURCE_AGE_HOURS and not allow_archived:
        raise ExportError(f"Stale Silver ({age_hours:.1f}h): refresh before publishing")
    state = ("ARCHIVED_SNAPSHOT_NOT_LIVE" if age_hours > ALLOWED_SOURCE_AGE_HOURS
             else "VERIFIED_SCHEDULE_SNAPSHOT")
    fixtures, ids = [], set()
    for fid, league, kickoff, home, away, status, observed, sha in rows:
        if fid in ids or not isinstance(fid,str) or not fid.startswith("api-football:fixture:"):
            raise ExportError("Duplicate/invalid fixture ID")
        ids.add(fid)
        k,o=utc(kickoff),utc(observed)
        if o > latest_dt or o >= k or o > now:
            raise ExportError("Invalid source/kickoff time ordering")
        if league not in LEAGUES or status!="NS" or not home or not away:
            raise ExportError("Invalid league/fixture/team")
        if not isinstance(sha,str) or len(sha)!=64 or any(x not in "0123456789abcdef" for x in sha.lower()):
            raise ExportError("Missing provider snapshot SHA-256")
        fixtures.append({
            "id":fid,"league":LEAGUES[league],"kickoff_utc":kickoff,
            "home":home,"away":away,"status":status,"source_observed_at_utc":observed,
        })
    return {
        "schema":"bo-fixtures/v1","source":"API_FOOTBALL_SILVER",
        "publication_state":state,"snapshot_at_utc":latest,
        "coverage":{"start_utc_date":from_day.isoformat(),"end_exclusive_utc_date":until.isoformat()},
        "fixtures":fixtures
    }


def main():
    p=argparse.ArgumentParser(description="Offline verified fixture export from private Silver to website JSON")
    p.add_argument("--silver",type=Path,required=True)
    p.add_argument("--from-date",type=date.fromisoformat,required=True)
    p.add_argument("--days",type=int,default=21)
    p.add_argument("--output",type=Path,default=Path("data/fixtures.json"))
    p.add_argument("--allow-archived",action="store_true",help="Explicitly mark stale snapshot; never claim live")
    args=p.parse_args()
    result=export(args.silver,from_day=args.from_date,days=args.days,allow_archived=args.allow_archived)
    target=args.output.resolve()
    if target == args.silver.resolve():
        raise ExportError("Will not overwrite Silver input")
    target.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w",encoding="utf-8",newline="\n",dir=target.parent,delete=False) as fp:
        temp=Path(fp.name)
        json.dump(result,fp,ensure_ascii=False,indent=2)
        fp.write("\n")
    os.replace(temp,target)
    print(json.dumps({"status":result["publication_state"],"fixture_count":len(result["fixtures"]),
                      "snapshot_at_utc":result["snapshot_at_utc"],"output":str(target)},ensure_ascii=False))


if __name__=="__main__":
    main()
