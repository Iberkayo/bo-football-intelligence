/* BO Football Intelligence — fikstür verisi doğrulama sözleşmesi.
   Skor / olasılık / model iddiası bu akışta YOKTUR. */
window.BO = window.BO || {};
BO.fixtureFeed = (function () {
  "use strict";
  const allowed = new Set(["superlig","premier","laliga","seriea","bundesliga","ligue1"]);
  const states = new Set(["ARCHIVED_SNAPSHOT_NOT_LIVE","VERIFIED_SCHEDULE_SNAPSHOT","AWAITING_VERIFIED_REFRESH"]);
  const validDate = x => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x + "T00:00:00Z"));
  const utcMillis = x => {
    if (typeof x !== "string" || !/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:\+00:00|Z)$/.test(x)) return NaN;
    return Date.parse(x);
  };
  function assert(ok, why) { if (!ok) throw Error("Fikstür doğrulanamadı: " + why); }
  function dateInTR(value) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"
    }).formatToParts(new Date(value));
    const get = t => parts.find(p=>p.type===t).value;
    return get("year") + "-" + get("month") + "-" + get("day");
  }
  const timeInTR = value => new Date(value).toLocaleTimeString("tr-TR", {
    timeZone: "Europe/Istanbul",hour: "2-digit",minute: "2-digit",hour12:false
  });
  function parse(doc) {
    assert(doc && doc.schema === "bo-fixtures/v1", "şema");
    assert(doc.source === "API_FOOTBALL_SILVER" && states.has(doc.publication_state), "kaynak/durum");
    assert(Array.isArray(doc.fixtures), "liste");
    if (doc.publication_state === "AWAITING_VERIFIED_REFRESH") {
      assert(doc.fixtures.length === 0 && doc.snapshot_at_utc === null, "bekleme durumu");
      return { ...doc, fixtures: [] };
    }
    const captured = utcMillis(doc.snapshot_at_utc);
    assert(Number.isFinite(captured), "kaynak zamanı");
    assert(doc.coverage && validDate(doc.coverage.start_utc_date) &&
      validDate(doc.coverage.end_exclusive_utc_date) &&
      doc.coverage.start_utc_date < doc.coverage.end_exclusive_utc_date, "kapsam");
    const seen = new Set();
    const fixtures = doc.fixtures.map(m => {
      assert(m && typeof m.id === "string" &&
        /^api-football:fixture:\d+$/.test(m.id) && !seen.has(m.id), "maç kimliği");
      seen.add(m.id);
      const kickoff = utcMillis(m.kickoff_utc), observed = utcMillis(m.source_observed_at_utc);
      assert(Number.isFinite(kickoff) && Number.isFinite(observed) &&
        observed <= captured && observed < kickoff, "maç / kaynak zamanı");
      assert(m.kickoff_utc.slice(0,10) >= doc.coverage.start_utc_date &&
        m.kickoff_utc.slice(0,10) < doc.coverage.end_exclusive_utc_date, "kapsam dışı");
      assert(m.status === "NS" && allowed.has(m.league), "maç durumu/lig");
      assert(typeof m.home === "string" && m.home.trim() &&
        typeof m.away === "string" && m.away.trim(), "takım adları");
      assert(!("p" in m) && !("prediction" in m) && !("alt" in m), "fikstürde tahmin olmaz");
      return {id:m.id,league:m.league,kickoff_utc:m.kickoff_utc,
        home:m.home,away:m.away,status:m.status,source_observed_at_utc:m.source_observed_at_utc,
        dateTR:dateInTR(m.kickoff_utc),timeTR:timeInTR(m.kickoff_utc)};
    });
    return {...doc,fixtures:fixtures.sort((a,b)=>a.kickoff_utc.localeCompare(b.kickoff_utc)||a.id.localeCompare(b.id))};
  }
  return {parse,dateInTR,timeInTR};
})();
