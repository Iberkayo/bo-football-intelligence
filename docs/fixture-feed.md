# BO-BET — Source-verified fixture feed v1

Status: **staged**; no live API calls or paper forecasts. Main-page demo fixture cards are replaced with a feed consumer on this PR branch. It shows real fixtures **only after a verified source refresh has produced `data/fixtures.json`**.

## Public JSON contract

`data/fixtures.json`: `bo-fixtures/v1`

- `source=API_FOOTBALL_SILVER`
- `publication_state`: `AWAITING_VERIFIED_REFRESH` (no fixtures), `VERIFIED_SCHEDULE_SNAPSHOT` (captured within 36 hours), or `ARCHIVED_SNAPSHOT_NOT_LIVE` (stale)
- `snapshot_at_utc`: real captured source timestamp, not page-generation time
- `coverage.start_utc_date/end_exclusive_utc_date`
- `fixtures[]`: canonical fixture ID, league, UTC kickoff, two real team names, provider `NS` status, original source observed time

**No** model predictions, arbitrary sample percentages, API keys, raw provider bytes, odds, results, private SQLite or forecast ledger in this file.

The website:
- Uses Europe/Istanbul dates and times, displays a 21-day strip, all six league filters, team search and card/list switch.
- Doesn't link real fixtures to the existing sample-only match detail page.
- Marks sources older than 36 hours as potentially stale; never says “live” merely because a page renders.
- Shows “Tahmin bekleniyor” rather than making up 1X2 probabilities.
- If the JSON is malformed or missing, shows a closed/error state and no fake fixture fallback.

## Refresh locally after verified source collection

Use **the restored/verified private Silver path on your PC**, not the old 9 Nov archive; the command below is illustrative:

```powershell
cd "C:\Users\iberkayo\Desktop\sites\bo-football-intelligence"
python tools/export_fixtures_sqlite.py `
  --silver "C:\BO-Football-Staging\api-football-20261114\canonical\api-football-silver.sqlite3" `
  --from-date 2026-11-14 `
  --days 21 `
  --output data/fixtures.json

node tools/fixture-feed-test.js
python -m unittest discover -s tools -p "test_export_fixtures.py" -v
python -m http.server 8000
```

**Warning:** The staging path must be replaced with the **actual** verified Silver path; the sample is not an assertion that the file exists. The exporter performs **no API call** and refuses to produce a “verified” JSON if source observations are more than 36 hours old. It reads SQLite with `mode=ro` and writes derived public fixture fields only. Do not use `--allow-archived` for normal publication. This switch exists only for explicitly labeled archival preview.

The already scheduled Nov 14 manual refresh reminder does **not** itself run a refresh, forecast freeze, publish job or model training. Only after local source validation should the new JSON be reviewed and committed.

## Later: prospective forecasts and automation

Add a separate `bo-predictions/v1` file only from append-only, **pre-kickoff frozen** Ridge records with model version, snapshot SHA and actual freeze time. Opportunity C remains shadow.

GitHub Actions can validate and publish the website; however, a fully unattended daily refresh needs a permitted, secure source/runner able to capture verified API snapshots and persist the private ledger. This initial PR does **not** claim that those private sources are currently available in GitHub runners.

### Usage rights

API-Football supports use in apps/websites but says users must verify any required league/third-party publication rights. Confirm applicability before exposing source-provided data broadly; this importer avoids logos and raw API responses.
