"""Offline, in-memory SQLite fixture exporter tests; no network or provider keys."""
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
import sqlite3
import tempfile
import unittest
from tools.export_fixtures_sqlite import ExportError, export


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.path=Path(self.temp.name)/"silver.sqlite3"
        c=sqlite3.connect(self.path)
        c.execute("CREATE TABLE teams (canonical_team_id TEXT PRIMARY KEY,provider_name TEXT NOT NULL)")
        c.execute("CREATE TABLE fixtures (canonical_fixture_id TEXT PRIMARY KEY,league_id INTEGER,kickoff_utc TEXT,home_team_id TEXT,away_team_id TEXT,fixture_status TEXT,observed_at_utc TEXT,source_sha256 TEXT)")
        c.executemany("INSERT INTO teams VALUES (?,?)",[
            ("api-football:team:1","Home A"),("api-football:team:2","Away B")
        ])
        c.execute("INSERT INTO fixtures VALUES (?,?,?,?,?,?,?,?)",(
            "api-football:fixture:100",203,"2026-11-21T13:00:00+00:00",
            "api-football:team:1","api-football:team:2","NS",
            "2026-11-13T09:30:00+00:00","a"*64
        ))
        c.commit();c.close()

    def tearDown(self):
        self.temp.cleanup()

    def test_fresh_and_no_predictions(self):
        doc=export(self.path,from_day=date(2026,11,13),now=datetime(2026,11,13,10,tzinfo=timezone.utc))
        self.assertEqual(doc["publication_state"],"VERIFIED_SCHEDULE_SNAPSHOT")
        self.assertEqual(len(doc["fixtures"]),1)
        self.assertEqual(doc["fixtures"][0]["home"],"Home A")
        self.assertNotIn("p",doc["fixtures"][0])

    def test_stale_is_fail_closed_until_explicit_allow(self):
        with self.assertRaisesRegex(ExportError,"Stale"):
            export(self.path,from_day=date(2026,11,13),now=datetime(2026,11,17,10,tzinfo=timezone.utc))
        doc=export(self.path,from_day=date(2026,11,13),now=datetime(2026,11,17,10,tzinfo=timezone.utc),allow_archived=True)
        self.assertEqual(doc["publication_state"],"ARCHIVED_SNAPSHOT_NOT_LIVE")

    def test_new_unrelated_snapshot_does_not_launder_old_fixture(self):
        # A new observation elsewhere cannot refresh an older fixture.
        c=sqlite3.connect(self.path)
        c.execute("INSERT INTO fixtures VALUES (?,?,?,?,?,?,?,?)",(
            "api-football:fixture:101",203,"2026-11-30T13:00:00+00:00",
            "api-football:team:1","api-football:team:2","NS",
            "2026-11-17T09:30:00+00:00","b"*64))
        c.commit();c.close()
        with self.assertRaisesRegex(ExportError,"Stale fixture"):
            export(self.path,from_day=date(2026,11,13),now=datetime(2026,11,17,10,tzinfo=timezone.utc))

    def test_no_matches_still_has_verified_snapshot(self):
        doc=export(self.path,from_day=date(2026,11,22),now=datetime(2026,11,13,10,tzinfo=timezone.utc))
        self.assertEqual(doc["fixtures"],[])
        self.assertTrue(doc["snapshot_at_utc"])

    def test_invalid_provider_snapshot_denied(self):
        c=sqlite3.connect(self.path)
        c.execute("UPDATE fixtures SET observed_at_utc='2026-11-22T00:00:00+00:00'")
        c.commit();c.close()
        with self.assertRaises(ExportError):
            export(self.path,from_day=date(2026,11,13),now=datetime(2026,11,13,10,tzinfo=timezone.utc))


if __name__=="__main__":
    unittest.main()
