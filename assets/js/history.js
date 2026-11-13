/* BO Football Intelligence — doğrulanmış, yalnızca retrospektif geçmiş veri sözleşmesi */
window.BO = window.BO || {};
BO.history = (function () {
  const OUTCOMES = ["1", "X", "2"];
  const STATUS = "RETROSPECTIVE_REPLAY_NOT_PROSPECTIVE";
  const STATES = ["PAPER_ONLY_NO_BET"];
  function ensure(ok, reason) { if (!ok) throw new Error("Geçmiş veri doğrulanamadı: " + reason); }
  function pick(p) { return OUTCOMES[p.indexOf(Math.max(...p))]; }
  function validateProbabilities(p) {
    ensure(Array.isArray(p) && p.length === 3 &&
      p.every(v => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1) &&
      Math.abs(p.reduce((a,b) => a+b, 0) - 1) < 1e-7, "olasılıklar");
  }
  function parse(doc) {
    ensure(doc && doc.schema === "bo-history/v1", "şema");
    ensure(doc.data_status === STATUS && STATES.includes(doc.publication_state), "veri durumu");
    ensure(doc.period && doc.period.timezone === "Europe/Istanbul" &&
      /^\d{4}-\d{2}-\d{2}$/.test(doc.period.start) &&
      /^\d{4}-\d{2}-\d{2}$/.test(doc.period.end) &&
      doc.period.start <= doc.period.end, "dönem");
    ensure(doc.source && /^[a-f0-9]{64}$/.test(doc.source.sha256), "kaynak izi");
    ensure(doc.models && typeof doc.models.primary === "string" && typeof doc.models.secondary === "string", "modeller");
    ensure(Array.isArray(doc.matches) && doc.matches.length > 0, "maç listesi");
    const seen = new Set();
    const rows = doc.matches.map(m => {
      ensure(typeof m.id === "string" && m.id.startsWith("api-football:fixture:") &&
        !seen.has(m.id), "maç kimliği");
      seen.add(m.id);
      ensure(BO.LEAGUES.some(l => l.id === m.league), "lig");
      ensure(typeof m.home === "string" && m.home.trim() &&
        typeof m.away === "string" && m.away.trim(), "takımlar");
      ensure(typeof m.kickoff_tr === "string" && typeof m.kickoff_utc === "string" &&
        !Number.isNaN(Date.parse(m.kickoff_tr)) && !Number.isNaN(Date.parse(m.kickoff_utc)) &&
        m.kickoff_tr.slice(0, 10) === m.date &&
        m.date >= doc.period.start && m.date <= doc.period.end, "maç zamanı");
      ensure(Array.isArray(m.score) && m.score.length === 2 &&
        m.score.every(n => Number.isInteger(n) && n >= 0), "skor");
      const actual = m.score[0] > m.score[1] ? "1" : m.score[0] === m.score[1] ? "X" : "2";
      ensure(actual === m.actual, "gerçek sonuç");
      for (const key of ["ridge", "opportunity_c"]) {
        ensure(m[key] && OUTCOMES.includes(m[key].pick), "model kaydı");
        validateProbabilities(m[key].p);
        ensure(pick(m[key].p) === m[key].pick, "model seçimi");
      }
      return {
        id: m.id, league: m.league, home: m.home, away: m.away,
        date: m.date, kickoff_utc: m.kickoff_utc, kickoff_tr: m.kickoff_tr,
        score: m.score, actual: OUTCOMES.indexOf(actual),
        p: m.ridge.p, alt: m.opportunity_c.p,
        pick: OUTCOMES.indexOf(m.ridge.pick),
        altPick: OUTCOMES.indexOf(m.opportunity_c.pick),
        ok: m.ridge.pick === actual,
        altOk: m.opportunity_c.pick === actual
      };
    }).sort((a,b) => b.kickoff_utc.localeCompare(a.kickoff_utc) || a.id.localeCompare(b.id));
    const count = key => rows.filter(m => m[key]).length;
    const total = rows.length, ridge = count("ok"), alt = count("altOk");
    ensure(doc.summary && doc.summary.total === total &&
      doc.summary.ridge_correct === ridge && doc.summary.ridge_wrong === total-ridge &&
      doc.summary.opportunity_c_correct === alt && doc.summary.opportunity_c_wrong === total-alt,
      "özet ve maç kayıtları uyuşmuyor");
    return {
      rows, total, correct: ridge, wrong: total-ridge,
      alternativeCorrect: alt, alternativeWrong: total-alt,
      accuracyText: (ridge / total * 100).toFixed(1).replace(".", ","),
      period: doc.period, source: doc.source,
      data_status: doc.data_status
    };
  }
  return { parse };
})();
