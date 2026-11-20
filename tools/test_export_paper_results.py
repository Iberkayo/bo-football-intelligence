"""Offline settlement-export tests with synthetic Silver. No network, no private data."""
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from tools.export_paper_results import CHAMPION, ResultExportError, export

SHA = "a" * 64
NOW = datetime(2026, 11, 21, 12, tzinfo=timezone.utc)


def forecast(n, kickoff, p=(0.5, 0.3, 0.2)):
    return {"fixture_id": f"api-football:fixture:{n}", "model_version": CHAMPION, "horizon": "EARLY_24_TO_168H",
            "kickoff_utc": kickoff, "frozen_at_utc": "2026-11-18T05:00:00+00:00", "record_sha256": f"{n:064d}",
            "p": list(p), "expected_goals": [1.4, 1.0]}


class ResultExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.preds, self.silver, self.out = root / "predictions.json", root / "silver.sqlite3", root / "results.json"
        self.forecasts = [
            forecast(1, "2026-11-20T19:30:00+00:00"),                     # FT 2-1 -> hit
            forecast(2, "2026-11-20T20:00:00+00:00", (0.2, 0.3, 0.5)),    # FT 1-1 -> miss
            forecast(3, "2026-11-21T11:00:00+00:00"),                     # live, not FT -> pending
            forecast(4, "2026-11-20T18:00:00+00:00"),                     # rescheduled in Silver
            forecast(5, "2026-11-23T18:00:00+00:00"),                     # future
        ]
        self.write_preds()
        with closing(sqlite3.connect(self.silver)) as c:
            c.execute("create table teams (canonical_team_id, provider_name)")
            c.executemany("insert into teams values (?,?)", [("h", "Home FC"), ("a", "Away FC")])
            c.execute("""create table fixtures (canonical_fixture_id, league_id, kickoff_utc, fixture_status,
                         home_team_id, away_team_id, home_goals, away_goals, observed_at_utc, source_sha256)""")
            c.executemany("insert into fixtures values (?,?,?,?,?,?,?,?,?,?)", [
                ("api-football:fixture:1", 78, "2026-11-20T19:30:00+00:00", "FT", "h", "a", 2, 1, "2026-11-21T09:00:00+00:00", SHA),
                ("api-football:fixture:2", 39, "2026-11-20T20:00:00+00:00", "FT", "h", "a", 1, 1, "2026-11-21T09:00:00+00:00", SHA),
                ("api-football:fixture:3", 39, "2026-11-21T11:00:00+00:00", "1H", "h", "a", 0, 0, "2026-11-21T11:30:00+00:00", SHA),
                ("api-football:fixture:4", 39, "2026-11-27T18:00:00+00:00", "NS", "h", "a", None, None, "2026-11-21T09:00:00+00:00", SHA),
                ("api-football:fixture:5", 39, "2026-11-23T18:00:00+00:00", "NS", "h", "a", None, None, "2026-11-21T09:00:00+00:00", SHA),
            ])
            c.commit()

    def tearDown(self):
        self.tmp.cleanup()

    def write_preds(self):
        self.preds.write_text(json.dumps({"schema": "bo-predictions/v1", "model_version": CHAMPION,
                                          "source": "BO_BET_APPEND_ONLY_LEDGER", "forecasts": self.forecasts}),
                              encoding="utf-8")

    def run_export(self):
        doc, counts = export(predictions=self.preds, silver=self.silver, existing_path=self.out, now=NOW)
        self.out.write_text(json.dumps(doc), encoding="utf-8")
        return doc, counts

    def test_settles_only_final_unmoved_fixtures(self):
        doc, counts = self.run_export()
        self.assertEqual([r["fixture_id"][-1] for r in doc["results"]], ["1", "2"])
        self.assertEqual([(r["pick"], r["actual"], r["hit"]) for r in doc["results"]], [("1", "1", True), ("2", "X", False)])
        self.assertEqual(doc["summary"], {"total": 2, "hits": 1})
        self.assertEqual((counts["pending"], counts["rescheduled"]), (1, 1))
        self.assertEqual(doc["results"][0]["home"], "Home FC")

    def test_append_only_and_tamper_checks(self):
        self.run_export()
        doc, counts = self.run_export()  # idempotent: nothing new, nothing dropped
        self.assertEqual((doc["summary"]["total"], counts["settled_new"]), (2, 0))
        self.forecasts[0]["p"] = [0.6, 0.2, 0.2]  # published forecast altered after settlement
        self.write_preds()
        with self.assertRaises(ResultExportError):
            self.run_export()

    def test_score_change_in_source_fails_closed(self):
        self.run_export()
        with closing(sqlite3.connect(self.silver)) as c:
            c.execute("update fixtures set home_goals=3 where canonical_fixture_id='api-football:fixture:1'")
            c.commit()
        with self.assertRaises(ResultExportError):
            self.run_export()

    def test_stale_silver_refused(self):
        with self.assertRaises(ResultExportError):
            export(predictions=self.preds, silver=self.silver, now=datetime(2026, 11, 25, tzinfo=timezone.utc))


if __name__ == "__main__":
    unittest.main()
