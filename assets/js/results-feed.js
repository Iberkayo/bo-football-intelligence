/* Settled Ridge PAPER forecasts (data/results.json): frozen before kickoff, scored afterwards. Fail-closed. */
window.BO = window.BO || {};
BO.resultsFeed = (function () {
  "use strict";
  const CHAMPION = "ridge_poisson_api_silver_v1";
  const OUT = ["1", "X", "2"];
  const LEAGUES = new Set(["superlig","premier","laliga","seriea","bundesliga","ligue1","eredivisie","primeira","championship","jupiler"]);
  const t = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(v) ? Date.parse(v) : NaN;
  function assert(ok, message) { if (!ok) throw new Error("Sonuç kaydı doğrulanamadı: " + message); }
  const istanbulDay = ms => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });

  function parse(doc) {
    assert(doc && doc.schema === "bo-results/v1" && doc.model_version === CHAMPION &&
      doc.data_status === "PROSPECTIVE_FROZEN_BEFORE_KICKOFF" &&
      ["VERIFIED_PAPER_SETTLEMENT", "NO_SETTLED_FORECASTS"].includes(doc.publication_state), "şema");
    assert(Array.isArray(doc.results) && doc.results.length <= 20000, "kayıt sınırı");
    assert((doc.publication_state === "NO_SETTLED_FORECASTS") === (doc.results.length === 0), "durum");
    const seen = new Set();
    const rows = doc.results.map(r => {
      assert(r && /^api-football:fixture:\d+$/.test(r.fixture_id) && !seen.has(r.fixture_id), "kimlik");
      seen.add(r.fixture_id);
      assert(LEAGUES.has(r.league) && typeof r.home === "string" && r.home && typeof r.away === "string" && r.away, "lig/takım");
      const kickoff = t(r.kickoff_utc), frozen = t(r.frozen_at_utc), observed = t(r.score_observed_at_utc);
      assert(Number.isFinite(kickoff) && Number.isFinite(frozen) && Number.isFinite(observed) &&
        frozen < kickoff && observed > kickoff, "zaman sırası");
      assert(Array.isArray(r.p) && r.p.length === 3 && r.p.every(x => typeof x === "number" && x >= 0 && x <= 1) &&
        Math.abs(r.p.reduce((a, b) => a + b, 0) - 1) <= 1e-7, "olasılık");
      assert(Array.isArray(r.score) && r.score.length === 2 && r.score.every(x => Number.isInteger(x) && x >= 0), "skor");
      const pick = r.p.indexOf(Math.max(...r.p));
      const actual = r.score[0] > r.score[1] ? 0 : r.score[0] === r.score[1] ? 1 : 2;
      assert(OUT[pick] === r.pick && OUT[actual] === r.actual && r.hit === (pick === actual), "sonuç hesabı");
      return { league: r.league, date: istanbulDay(kickoff), kickoff_utc: r.kickoff_utc, home: r.home, away: r.away,
        score: r.score, p: r.p, pick, actual, ok: pick === actual, frozen_at_utc: r.frozen_at_utc, horizon: r.horizon };
    });
    assert(doc.summary && doc.summary.total === rows.length && doc.summary.hits === rows.filter(r => r.ok).length, "özet");
    return { rows, total: rows.length, correct: doc.summary.hits };
  }
  return { parse };
})();
