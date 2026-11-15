/* Güven seviyesi: en olası sonucun olasılığına göre sabit eşikler.
   Eşikler 2025-26 replay verisinden (seçim penceresi) belirlendi ve sonradan
   değiştirilmedi: Yüksek ≥ %60, Orta %45–60, Düşük < %45.
   Geçmiş isabet oranı sitedeki doğrulanmış geçmiş kayıtlardan (data/history.json)
   hesaplanır. Bu bir bilgi etiketidir; bahis/kupon önerisi değildir. */
window.BO = window.BO || {};
BO.confidence = (function () {
  "use strict";
  const LEVELS = [
    { id: "high", label: "Yüksek güven", min: 0.60 },
    { id: "mid", label: "Orta güven", min: 0.45 },
    { id: "low", label: "Düşük güven", min: 0 },
  ];
  function level(p) {
    const top = Math.max(...p);
    return LEVELS.find(l => top >= l.min - 1e-12);
  }
  // rows: BO.history.parse(...).rows → { p, ok }
  function stats(rows) {
    const out = {};
    LEVELS.forEach(l => { out[l.id] = { n: 0, correct: 0 }; });
    rows.forEach(r => { const s = out[level(r.p).id]; s.n++; if (r.ok) s.correct++; });
    return out;
  }
  const rateText = s => s && s.n ? (s.correct / s.n * 100).toFixed(1).replace(".", ",") : null;
  // Kısa etiket metni: "Yüksek güven · geçmişte %71,6"
  function text(p, st) {
    const l = level(p), r = st ? rateText(st[l.id]) : null;
    return l.label + (r ? " · geçmişte %" + r : "");
  }
  function badge(p, st, esc) {
    const l = level(p), r = st ? st[l.id] : null;
    const title = r && r.n
      ? "Bu seviyedeki " + r.n + " geçmiş test maçının " + r.correct + " tanesinde en olası sonuç gerçekleşti. Bahis önerisi değildir."
      : "En olası sonucun olasılığına göre güven seviyesi. Bahis önerisi değildir.";
    return '<span class="conf conf--' + l.id + '" title="' + esc(title) + '">' + esc(text(p, st)) + '</span>';
  }
  return { LEVELS, level, stats, rateText, text, badge };
})();
