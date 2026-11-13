/* Published Ridge PAPER forecasts — immutable, pre-kickoff, no model execution. */
window.BO = window.BO || {};
BO.predictionFeed = (function () {
  "use strict";
  const CHAMPION = "ridge_poisson_api_silver_v1";
  const STATUS = new Set(["NO_VERIFIED_FROZEN_FORECASTS","VERIFIED_PAPER_LEDGER_EXPORT"]);
  const isoUtc = value => typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(value) &&
    Number.isFinite(Date.parse(value)) ? Date.parse(value) : NaN;
  const hex = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  function assert(ok, message) {
    if (!ok) throw new Error("Tahmin kaydı doğrulanamadı: " + message);
  }
  function parse(doc, fixtures) {
    assert(doc && doc.schema === "bo-predictions/v1" &&
      doc.source === "BO_BET_APPEND_ONLY_LEDGER" &&
      doc.model_version === CHAMPION && STATUS.has(doc.publication_state), "şema/kaynak");
    assert(Array.isArray(doc.forecasts) && doc.forecasts.length <= 20000, "kayıt sınırı");
    if (doc.publication_state === "NO_VERIFIED_FROZEN_FORECASTS") {
      assert(doc.forecasts.length === 0, "bekleme durumu");
      return { byFixture: new Map(), total: 0, state: doc.publication_state };
    }
    const created=isoUtc(doc.exported_at_utc), snapshot=isoUtc(doc.fixtures_snapshot_at_utc);
    const feedStamp=isoUtc(fixtures.snapshot_at_utc);
    assert(Number.isFinite(created) && Number.isFinite(snapshot) &&
      Number.isFinite(feedStamp) && snapshot <= feedStamp &&
      snapshot <= created && created <= Date.now() + 300000, "yayın zamanı");
    const current = new Map(fixtures.fixtures.map(f => [f.id, f]));
    const seen=new Set(), matched=new Map();
    for (const p of doc.forecasts) {
      assert(p && /^api-football:fixture:\d+$/.test(p.fixture_id) &&
        !seen.has(p.fixture_id) && p.model_version === CHAMPION &&
        ["EARLY_24_TO_168H","LATE_6_TO_24H"].includes(p.horizon), "kimlik/model");
      seen.add(p.fixture_id);
      const kickoff=isoUtc(p.kickoff_utc), frozen=isoUtc(p.frozen_at_utc);
      const hours=(kickoff-frozen)/3600000;
      assert(Number.isFinite(kickoff) && Number.isFinite(frozen) &&
        6 <= hours && hours <= 168 &&
        (hours < 24 ? p.horizon === "LATE_6_TO_24H" : p.horizon === "EARLY_24_TO_168H") &&
        frozen <= created, "maç öncesi dondurma");
      assert(hex(p.record_sha256) && hex(p.source_sha256) &&
        hex(p.base_training_sha256) && typeof p.source_snapshot_id === "string" &&
        p.source_snapshot_id.length > 0 &&
        Number.isInteger(p.training_rows) && p.training_rows > 0, "kaynak/model izi");
      assert(Array.isArray(p.p) && p.p.length === 3 &&
        p.p.every(x => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1) &&
        Math.abs(p.p.reduce((a,b)=>a+b,0)-1) <= 1e-7, "1X2");
      assert(Array.isArray(p.expected_goals) && p.expected_goals.length === 2 &&
        p.expected_goals.every(x => typeof x === "number" && Number.isFinite(x) && x > 0 && x <= 7),
        "beklenen gol");
      const fixture=current.get(p.fixture_id);
      // Retain older immutable records without showing them on the current fixture page.
      if (fixture && isoUtc(fixture.kickoff_utc) === kickoff) {
        matched.set(p.fixture_id, {
          p: p.p, model: p.model_version, frozen_at_utc: p.frozen_at_utc,
          record_sha256: p.record_sha256, horizon: p.horizon,
          expected_goals: p.expected_goals,
        });
      }
    }
    return { byFixture: matched, total: doc.forecasts.length, state: doc.publication_state };
  }
  return { parse };
})();
