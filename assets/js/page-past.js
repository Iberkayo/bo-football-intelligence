/* =========================================================
   Sayfa: Geçmiş Tahminler
   Özet kartları  → GERÇEK araştırma sonuçları (BO.BACKTEST)
   Maç listesi    → ÖRNEK kayıtlar (BO.PAST_SAMPLES)
   ========================================================= */
(function () {
  BO.shell();
  const u = BO.util, ui = BO.ui;
  const bt = BO.BACKTEST;
  const $ = (id) => document.getElementById(id);

  /* ---------- Özet ---------- */
  // 63 kutucuk yalnızca oranı görselleştirir; maçların gerçek sırası değildir.
  const strip = [];
  for (let i = 0; i < bt.total; i++) strip.push(i < bt.correct ? "ok" : "no");
  $("record").innerHTML =
    '<div class="record-main reveal">' +
    '<span class="record-main__label">Doğru sonuç oranı · ' + bt.range + "</span>" +
    '<div class="record-main__big"><strong><small>%</small>' + bt.accuracyText + "</strong></div>" +
    '<p class="record-main__sentence">Test edilen <b>' + bt.total + " maçın " + u.locSuffix(bt.correct) + "</b> en olası gördüğümüz sonuç gerçekleşti.</p>" +
    '<div class="record-main__strip" role="img" aria-label="' + bt.total + " maçtan " + bt.correct + " doğru, " + bt.wrong + ' yanlış seçim">' +
    strip.map((c, i) => '<i class="' + c + '" style="animation-delay:' + i * 8 + 'ms"></i>').join("") + "</div>" +
    '<div class="record-main__legend"><span><i style="background:var(--ok)"></i>Doğru seçim</span><span><i style="background:var(--surface-3)"></i>Yanlış seçim</span>' +
    "<span>Her kutu bir maçı temsil eder</span></div></div>" +
    '<div class="record-side">' +
    '<div class="kpi"><span class="kpi__icon kpi__icon--n">' + BO.icon("calendar") + "</span><div><strong>" + bt.total + "</strong><span>Değerlendirilen maç</span></div></div>" +
    '<div class="kpi"><span class="kpi__icon kpi__icon--ok">' + BO.icon("check") + "</span><div><strong>" + bt.correct + "</strong><span>Doğru seçim</span></div></div>" +
    '<div class="kpi"><span class="kpi__icon kpi__icon--no">' + BO.icon("x") + "</span><div><strong>" + bt.wrong + "</strong><span>Yanlış seçim</span></div></div>" +
    "</div>";

  /* ---------- Liste ---------- */
  const state = { league: "all", date: "all", result: "all" };
  const rows = BO.PAST_SAMPLES.map((r) => {
    const pick = u.argmax(u.norm(r.p));
    const actual = u.outcomeOfScore(r.score);
    return Object.assign({}, r, { pick, actual, ok: pick === actual });
  });
  const dates = Array.from(new Set(rows.map((r) => r.date))).sort().reverse();

  const dateSel = $("past-date"), resSel = $("past-result"), chips = $("past-chips"), list = $("past-list");
  dateSel.innerHTML = '<option value="all">Tüm tarihler</option>' + dates.map((d) => '<option value="' + d + '">' + u.isoLong(d) + "</option>").join("");

  function renderChips() {
    chips.innerHTML =
      '<button class="chip chip--plain" type="button" data-league="all" aria-pressed="' + (state.league === "all") + '">Tüm ligler</button>' +
      BO.LEAGUES.map(
        (l) => '<button class="chip" type="button" data-league="' + l.id + '" aria-pressed="' + (state.league === l.id) + '">' + ui.leagueMark(l.id) + u.esc(l.short) + "</button>"
      ).join("");
  }

  const outcome = (i, r) =>
    '<span class="outcome"><i class="' + ["h", "d", "a"][i] + '"></i><span>' + u.esc(u.outcomeLabel(i, r)) + "</span></span>";

  function rowHTML(r) {
    const h = u.team(r.home), a = u.team(r.away);
    return (
      '<article class="past-row" aria-label="' + u.esc(h.name + " " + r.score[0] + ", " + a.name + " " + r.score[1] + ". " + (r.ok ? "Doğru seçim" : "Yanlış seçim")) + '">' +
      '<div class="past-row__match"><span class="past-row__meta">' + ui.leagueMark(r.league) + u.esc(u.league(r.league).short) + " · " + u.isoShort(r.date) + "</span>" +
      '<span class="past-row__teams">' + "<span>" + u.esc(h.name) + '</span><span class="sep">–</span><span>' + u.esc(a.name) + "</span>" + "</span></div>" +
      '<div class="past-row__score"><span class="score">' + r.score[0] + " – " + r.score[1] + "</span></div>" +
      '<div class="past-row__pick"><span class="cell-label">BO’nun seçimi</span>' + outcome(r.pick, r) + "</div>" +
      '<div class="past-row__actual"><span class="cell-label">Gerçekleşen</span>' + outcome(r.actual, r) + "</div>" +
      '<div class="past-row__badge"><span class="result-badge result-badge--' + (r.ok ? "ok" : "no") + '">' + BO.icon(r.ok ? "check" : "x") + (r.ok ? "Doğru" : "Yanlış") + "</span></div>" +
      "</article>"
    );
  }

  function renderList() {
    const f = rows.filter(
      (r) =>
        (state.league === "all" || r.league === state.league) &&
        (state.date === "all" || r.date === state.date) &&
        (state.result === "all" || (state.result === "ok") === r.ok)
    );
    if (!f.length) {
      list.innerHTML =
        '<div class="empty" style="border:0;border-radius:0">' + ui.emptyArt() +
        "<h3>Bu filtrelerle kayıt bulunamadı</h3><p>Farklı bir lig veya tarih seçmeyi deneyin.</p>" +
        '<div class="empty__actions"><button class="btn btn--ghost" type="button" data-act="reset">Filtreleri temizle</button></div></div>';
      return;
    }
    const okN = f.filter((r) => r.ok).length;
    list.innerHTML =
      '<div class="past-head" aria-hidden="true"><span>Maç</span><span>Skor</span><span>BO’nun en olası gördüğü</span><span>Gerçekleşen</span><span>Sonuç</span></div>' +
      f.map(rowHTML).join("") +
      '<div class="past-foot"><span>' + f.length + " örnek kayıt · " + okN + " doğru, " + (f.length - okN) + " yanlış</span>" +
      "<span>Liste örnek kayıtlardan oluşur; yukarıdaki özet gerçek 63 maçlık testi yansıtır.</span></div>";
  }

  chips.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    state.league = b.dataset.league; renderChips(); renderList();
  });
  dateSel.addEventListener("change", () => { state.date = dateSel.value; renderList(); });
  resSel.addEventListener("change", () => { state.result = resSel.value; renderList(); });
  list.addEventListener("click", (e) => {
    if (!e.target.closest('[data-act="reset"]')) return;
    state.league = state.date = state.result = "all";
    dateSel.value = resSel.value = "all";
    renderChips(); renderList();
  });

  renderChips();
  renderList();
})();
