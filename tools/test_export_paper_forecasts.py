"""Offline forecast publication tests. No provider credentials, no network."""
import hashlib
import json
import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from tools.export_paper_forecasts import export, digest, ForecastExportError, CHAMPION


class PublisherTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.ledger = self.root / "ledger.sqlite3"
        self.manifest = self.root / "manifest.sqlite3"
        self.fixture_path = self.root / "fixtures.json"
        self.now = datetime(2026,11,13,14,tzinfo=timezone.utc)
        self.kickoff = "2026-11-16T13:00:00+00:00"
        self.frozen = "2026-11-13T13:00:00+00:00"
        self.observed = "2026-11-13T12:00:00+00:00"
        self.raw = self.root / "snapshot.json"
        self.raw.write_bytes(b'{"fixtures":"recorded before freeze"}')
        self.source_sha = hashlib.sha256(self.raw.read_bytes()).hexdigest()
        con = sqlite3.connect(self.manifest)
        con.execute("CREATE TABLE snapshots_v2 (snapshot_id TEXT PRIMARY KEY,endpoint TEXT,response_sha256 TEXT,observed_at_utc TEXT,raw_path TEXT,status TEXT)")
        con.execute("INSERT INTO snapshots_v2 VALUES (?,?,?,?,?,?)", (
            "fixture-snapshot-1", "fixtures", self.source_sha, self.observed, "snapshot.json", "captured"
        ))
        con.commit()
        con.close()
        con = sqlite3.connect(self.ledger)
        con.execute("CREATE TABLE forecasts (provider_fixture_id INTEGER NOT NULL, model_version TEXT NOT NULL, horizon TEXT NOT NULL,record_sha256 TEXT NOT NULL, record_json TEXT NOT NULL, frozen_at_utc TEXT NOT NULL, PRIMARY KEY(provider_fixture_id, model_version, horizon))")
        con.commit()
        con.close()
        self.fixture = {
            "schema":"bo-fixtures/v1", "source":"API_FOOTBALL_SILVER",
            "publication_state":"VERIFIED_SCHEDULE_SNAPSHOT",
            "snapshot_at_utc":"2026-11-13T12:30:00+00:00",
            "coverage":{"start_utc_date":"2026-11-13","end_exclusive_utc_date":"2026-12-04"},
            "fixtures":[{
                "id":"api-football:fixture:777", "league":"superlig",
                "kickoff_utc":self.kickoff, "home":"Home", "away":"Away", "status":"NS",
                "source_observed_at_utc":"2026-11-13T12:30:00+00:00"
            }]
        }
        self.fixture_path.write_text(json.dumps(self.fixture), encoding="utf-8")
        self.record = {
            "schema":"bo-api-football-frozen-forecast/2", "state":"PAPER_ONLY_NO_BET",
            "model_version":CHAMPION, "provider_fixture_id":777,
            "league":"api:203","home_team":"api-football:team:1",
            "away_team":"api-football:team:2","kickoff_utc":self.kickoff,
            "forecast_frozen_at_utc":self.frozen,
            "horizon":"EARLY_24_TO_168H", "hours_to_kickoff":72,
            "source_snapshot_id":"fixture-snapshot-1","source_sha256":self.source_sha,
            "training_rows":400, "base_training_sha256":"a"*64,
            "p_home":0.46,"p_draw":0.27,"p_away":0.27,
            "expected_home_goals":1.4,"expected_away_goals":0.9,
        }

    def tearDown(self):
        self.tmp.cleanup()

    def insert(self, record=None):
        x=dict(self.record if record is None else record)
        if "record_sha256" not in x:
            x["record_sha256"]=digest(x)
        con=sqlite3.connect(self.ledger)
        con.execute("INSERT INTO forecasts VALUES (?,?,?,?,?,?)", (
            x["provider_fixture_id"],x["model_version"],x["horizon"],
            x["record_sha256"],json.dumps(x),x["forecast_frozen_at_utc"]
        ))
        con.commit()
        con.close()

    def publish(self,existing=None,now=None):
        return export(ledger=self.ledger,manifest=self.manifest,
                      fixtures_path=self.fixture_path,existing_path=existing,
                      now=now or self.now)

    def test_one_verified_prospective_paper_forecast(self):
        self.insert()
        doc=self.publish()
        self.assertEqual(doc["publication_state"],"VERIFIED_PAPER_LEDGER_EXPORT")
        self.assertEqual(len(doc["forecasts"]),1)
        one=doc["forecasts"][0]
        self.assertEqual(one["fixture_id"],"api-football:fixture:777")
        self.assertEqual(one["p"],[.46,.27,.27])
        self.assertEqual(one["record_sha256"],digest(self.record))
        self.assertNotIn("home_team",one)
        self.assertNotIn("record_json",one)

    def test_no_records_is_explicit_empty(self):
        self.assertEqual(self.publish()["forecasts"],[])
        self.assertEqual(self.publish()["publication_state"],"NO_VERIFIED_FROZEN_FORECASTS")

    def test_tampered_ledger_digest_rejected(self):
        fake=dict(self.record, p_home=.99)
        fake["record_sha256"]=digest(self.record)
        self.insert(fake)
        with self.assertRaisesRegex(ForecastExportError,"digest"):
            self.publish()

    def test_raw_provider_bytes_must_match_manifest_sha(self):
        self.insert()
        self.raw.write_bytes(b"modified after freeze")
        with self.assertRaisesRegex(ForecastExportError,"SHA"):
            self.publish()

    def test_manifest_must_precede_freeze(self):
        self.insert()
        c=sqlite3.connect(self.manifest)
        c.execute("UPDATE snapshots_v2 SET observed_at_utc=?",("2026-11-13T13:30:00+00:00",))
        c.commit();c.close()
        with self.assertRaisesRegex(ForecastExportError,"before"):
            self.publish()

    def test_stale_fixture_cannot_publish(self):
        self.insert()
        self.fixture["snapshot_at_utc"]="2026-11-10T00:00:00+00:00"
        self.fixture_path.write_text(json.dumps(self.fixture),encoding="utf-8")
        with self.assertRaisesRegex(ForecastExportError,"too old"):
            self.publish()

    def test_future_or_post_kickoff_freeze_is_denied(self):
        x=dict(self.record, forecast_frozen_at_utc="2026-11-17T13:00:00+00:00")
        self.insert(x)
        with self.assertRaises(ForecastExportError):
            self.publish()

    def test_tampered_previously_published_percentage_rejected(self):
        self.insert()
        old=self.publish()
        old["forecasts"][0]["p"]=[0.90,0.05,0.05]
        file=self.root/"forged-public.json"
        file.write_text(json.dumps(old),encoding="utf-8")
        with self.assertRaisesRegex(ForecastExportError,"previous public record changed"):
            self.publish(existing=file)

    def test_previous_record_cannot_be_replaced_by_other_horizon(self):
        self.insert()
        old=self.publish()
        older_path=self.root/"predictions.json"
        older_path.write_text(json.dumps(old),encoding="utf-8")
        con=sqlite3.connect(self.ledger)
        x=dict(self.record,horizon="LATE_6_TO_24H",
               forecast_frozen_at_utc="2026-11-15T17:00:00+00:00",
               hours_to_kickoff=20)
        x["record_sha256"]=digest(x)
        con.execute("INSERT INTO forecasts VALUES (?,?,?,?,?,?)",(
            777,CHAMPION,x["horizon"],x["record_sha256"],
            json.dumps(x),x["forecast_frozen_at_utc"]))
        con.commit();con.close()
        # The second horizon has really occurred by this later export time.
        later=datetime(2026,11,15,20,tzinfo=timezone.utc)
        self.fixture["snapshot_at_utc"]="2026-11-15T19:00:00+00:00"
        self.fixture["fixtures"][0]["source_observed_at_utc"]="2026-11-15T19:00:00+00:00"
        self.fixture_path.write_text(json.dumps(self.fixture),encoding="utf-8")
        second=self.publish(existing=older_path,now=later)
        self.assertEqual(len(second["forecasts"]),1)
        self.assertEqual(second["forecasts"][0]["record_sha256"],old["forecasts"][0]["record_sha256"])


if __name__=="__main__":
    unittest.main()
