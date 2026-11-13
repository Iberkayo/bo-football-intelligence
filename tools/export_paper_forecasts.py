#!/usr/bin/env python3
"""Read-only export of pre-kickoff Ridge PAPER forecasts to public JSON.

This does NOT create predictions, fetch source data, or write to a private ledger.
Every emitted record must have a valid append-only ledger digest and a captured,
raw-byte SHA-verified source fixture snapshot older than the recorded freeze.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sqlite3
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

CHAMPION = "ridge_poisson_api_silver_v1"
PUBLIC_STATUS = "PAPER_ONLY_NO_BET"
SNAPSHOT_AGE_HOURS = 36
LEAGUES = {"superlig", "premier", "laliga", "seriea", "bundesliga", "ligue1"}


class ForecastExportError(ValueError):
    pass


def require(ok, message):
    if not ok:
        raise ForecastExportError(message)


def utc(value):
    require(isinstance(value, str), "missing UTC time")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ForecastExportError("invalid UTC time") from exc
    require(result.tzinfo is not None and result.utcoffset() == timedelta(0), "non-UTC time")
    return result.astimezone(timezone.utc)


def digest(record):
    return hashlib.sha256(
        json.dumps(record, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _hex(value):
    return isinstance(value, str) and len(value) == 64 and all(c in "0123456789abcdef" for c in value)


def _readonly(path):
    require(Path(path).is_file(), f"missing private input: {path}")
    return sqlite3.connect(f"file:{Path(path).resolve().as_posix()}?mode=ro", uri=True)


def _read_fixtures(path, now):
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    require(doc.get("schema") == "bo-fixtures/v1" and
            doc.get("publication_state") == "VERIFIED_SCHEDULE_SNAPSHOT" and
            doc.get("source") == "API_FOOTBALL_SILVER", "need verified fixture snapshot")
    snapshot = utc(doc.get("snapshot_at_utc"))
    require(timedelta(0) <= now - snapshot <= timedelta(hours=SNAPSHOT_AGE_HOURS),
            "fixture snapshot too old or future-dated")
    mapping = {}
    for item in doc["fixtures"]:
        fixture_id = item["id"]
        require(fixture_id.startswith("api-football:fixture:") and
                fixture_id[len("api-football:fixture:"):].isdigit() and
                fixture_id not in mapping, "invalid or duplicate fixture")
        kickoff = utc(item["kickoff_utc"])
        observed = utc(item["source_observed_at_utc"])
        require(item["status"] == "NS" and item["league"] in LEAGUES,
                "non-NS or unknown league")
        require(observed <= snapshot and observed < kickoff and observed <= now,
                "fixture observation not before kickoff and snapshot")
        require(now - observed <= timedelta(hours=SNAPSHOT_AGE_HOURS),
                "individual fixture source is stale")
        mapping[int(fixture_id.split(":")[-1])] = item
    return doc["snapshot_at_utc"], mapping


def _source_proof(conn, root, record, frozen):
    snapshot_id = record.get("source_snapshot_id")
    sha = record.get("source_sha256")
    require(isinstance(snapshot_id, str) and snapshot_id and _hex(sha),
            "forecast source ID/SHA missing")
    row = conn.execute(
        "SELECT endpoint,response_sha256,observed_at_utc,raw_path,status "
        "FROM snapshots_v2 WHERE snapshot_id=?", (snapshot_id,)
    ).fetchone()
    require(row is not None, "source manifest proof missing")
    endpoint, manifest_sha, observed, raw_path, status = row
    require(endpoint == "fixtures" and status == "captured" and manifest_sha == sha,
            "source snapshot mismatch")
    require(utc(observed) < frozen, "source was not observed before forecast freeze")
    source = (root / str(raw_path)).resolve()
    require(root in source.parents and source.is_file(), "snapshot raw path missing or unsafe")
    require(hashlib.sha256(source.read_bytes()).hexdigest() == sha,
            "source raw SHA verification failed")


def _public_record(item, *, fixture, horizon, now):
    require(item.get("schema") == "bo-api-football-frozen-forecast/2" and
            item.get("state") == PUBLIC_STATUS and
            item.get("model_version") == CHAMPION, "not verified champion PAPER record")
    fixture_id = int(fixture["id"].split(":")[-1])
    require(type(item.get("provider_fixture_id")) is int and
            item["provider_fixture_id"] == fixture_id, "wrong fixture identity")
    frozen = utc(item["forecast_frozen_at_utc"])
    kickoff = utc(item["kickoff_utc"])
    require(item["kickoff_utc"] == fixture["kickoff_utc"], "fixture time changed after freeze")
    require(frozen <= now and frozen < kickoff, "freeze time is in future or after kickoff")
    hours = (kickoff - frozen).total_seconds() / 3600
    require(6 <= hours <= 168 and abs(hours - item["hours_to_kickoff"]) <= 0.005,
            "forecast outside 6–168h pre-kickoff horizon")
    expected_horizon = "LATE_6_TO_24H" if hours < 24 else "EARLY_24_TO_168H"
    require(horizon == expected_horizon and item.get("horizon") == horizon,
            "invalid pre-kickoff horizon")
    require(item.get("league") == "api:" +
            str({"superlig":203,"premier":39,"laliga":140,"seriea":135,
                 "bundesliga":78,"ligue1":61}[fixture["league"]]), "league mismatch")
    require(_hex(item.get("base_training_sha256")) and
            type(item.get("training_rows")) is int and item["training_rows"] > 0,
            "base training provenance missing")
    p = [item.get("p_home"), item.get("p_draw"), item.get("p_away")]
    require(all(type(v) in (int, float) and math.isfinite(v) and 0 <= v <= 1 for v in p)
            and abs(math.fsum(p) - 1) <= 1e-7, "invalid 1X2")
    xg = [item.get("expected_home_goals"), item.get("expected_away_goals")]
    require(all(type(v) in (int, float) and math.isfinite(v) and 0 < v <= 7 for v in xg),
            "invalid model goal expectation")
    return {
        "fixture_id": fixture["id"], "model_version": CHAMPION,
        "horizon": horizon, "frozen_at_utc": item["forecast_frozen_at_utc"],
        "kickoff_utc": item["kickoff_utc"], "record_sha256": item["record_sha256"],
        "source_snapshot_id": item["source_snapshot_id"], "source_sha256": item["source_sha256"],
        "base_training_sha256": item["base_training_sha256"],
        "training_rows": item["training_rows"], "p": p, "expected_goals": xg,
    }, frozen


def export(*, ledger: Path, manifest: Path, fixtures_path: Path,
           existing_path: Path | None = None, now: datetime | None = None):
    now = now or datetime.now(timezone.utc)
    require(now.utcoffset() == timedelta(0), "run with UTC now")
    snapshot, fixtures = _read_fixtures(fixtures_path, now)
    previous = []
    if existing_path and Path(existing_path).is_file():
        old = json.loads(Path(existing_path).read_text(encoding="utf-8"))
        require(old.get("schema") == "bo-predictions/v1" and
                old.get("publication_state") in ("NO_VERIFIED_FROZEN_FORECASTS",
                                                  "VERIFIED_PAPER_LEDGER_EXPORT"),
                "invalid previous public ledger")
        previous = old["forecasts"]
    seen = {}
    for item in previous:
        fixture_id = item["fixture_id"]
        require(fixture_id not in seen and _hex(item.get("record_sha256")),
                "duplicate/corrupt previously published forecast")
        seen[fixture_id] = item

    conn = _readonly(ledger)
    proof = _readonly(manifest)
    manifest_root = Path(manifest).resolve().parent
    candidates = {}
    try:
        rows = conn.execute(
            "SELECT provider_fixture_id,model_version,horizon,record_sha256,record_json,frozen_at_utc "
            "FROM forecasts WHERE model_version=? ORDER BY provider_fixture_id,frozen_at_utc",
            (CHAMPION,)
        )
        for fid, model, horizon, sha, payload, ledger_time in rows:
            fixture = fixtures.get(fid)
            if fixture is None or utc(fixture["kickoff_utc"]) <= now:
                continue
            record = json.loads(payload)
            require(_hex(sha) and record.get("record_sha256") == sha,
                    "ledger and JSON record SHA mismatch")
            bare = {k: v for k, v in record.items() if k != "record_sha256"}
            require(digest(bare) == sha, "ledger forecast record digest failed")
            require(utc(ledger_time) == utc(record.get("forecast_frozen_at_utc")),
                    "ledger/record frozen timestamps disagree")
            published, frozen = _public_record(record, fixture=fixture,
                                               horizon=horizon, now=now)
            _source_proof(proof, manifest_root, record, frozen)
            if published["fixture_id"] in seen:
                require(seen[published["fixture_id"]]["kickoff_utc"] == published["kickoff_utc"],
                        "previous publication kickoff changed")
                # New horizon cannot replace an already published prediction.
                continue
            key = published["fixture_id"]
            if key not in candidates or frozen < candidates[key][0]:
                candidates[key] = (frozen, published)
    finally:
        conn.close()
        proof.close()
    combined = previous + [x[1] for _, x in sorted(candidates.items())]
    require(len({r["fixture_id"] for r in combined}) == len(combined), "duplicate output")
    combined.sort(key=lambda x: (x["kickoff_utc"], x["fixture_id"]))
    return {
        "schema": "bo-predictions/v1",
        "publication_state": "VERIFIED_PAPER_LEDGER_EXPORT" if combined
                             else "NO_VERIFIED_FROZEN_FORECASTS",
        "source": "BO_BET_APPEND_ONLY_LEDGER",
        "model_version": CHAMPION, "fixtures_snapshot_at_utc": snapshot,
        "exported_at_utc": now.isoformat(),
        "forecasts": combined,
    }


def main():
    p = argparse.ArgumentParser(description="Export verified immutable Ridge PAPER forecasts")
    p.add_argument("--ledger", type=Path, required=True)
    p.add_argument("--manifest", type=Path, required=True)
    p.add_argument("--fixtures", type=Path, default=Path("data/fixtures.json"))
    p.add_argument("--output", type=Path, default=Path("data/predictions.json"))
    args = p.parse_args()
    target = args.output.resolve()
    require(target not in (args.ledger.resolve(), args.manifest.resolve()),
            "refusing to overwrite private input")
    result = export(ledger=args.ledger, manifest=args.manifest,
                    fixtures_path=args.fixtures, existing_path=target)
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n",
                                     dir=target.parent, delete=False) as fp:
        temporary = Path(fp.name)
        json.dump(result, fp, ensure_ascii=False, indent=2)
        fp.write("\n")
    os.replace(temporary, target)
    print(json.dumps({"state": result["publication_state"],
                      "published_records": len(result["forecasts"]), "output": str(target)},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
