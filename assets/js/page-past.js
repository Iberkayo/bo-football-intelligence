/* BO-BET — gerçek 63 maçlık, kaynak izi bulunan retrospektif geçmiş */
(function () {
  BO.shell();
  const u = BO.util, ui = BO.ui;
  const $ = (id) => document.getElementById(id);
  const record = $("record"), list = $("past-list"), tag = $("past-data-tag");
  const dateSel = $("past-date"), resSel = $("past-result"), chips = $("past-chips");

  function errorState() {
    tag.textContent = "Veri yüklenemedi";
    record.innerHTML = '<div class="notice notice--warn"><strong>Geçmiş maç verisi doğrulanamadı.</strong> ' +
      'Yanlış veya eksik veriyi göstermek yerine kayıtları geçici olarak gizledik.</div>';
    list.innerHTML = '<div class="empty"><h3>Maç listesi şu anda açılamıyor</h3>' +
      '<p>Lütfen sayfayı yenileyin. Bu prototipi bilgisayarınızda açıyorsanız bir yerel HTTP sunucusu kullanın.</p></div>';
  }

  function renderRecord(dataset, rows) {
    const range = "2–8 Kasım 2026";
    record.innerHTML =
      '<div class="record-main reveal">' +
      '<span class="record-main__label">Geçmiş maç testi · ' + range + '</span>' +
      '<div class="record-main__big"><strong><small>%</small>' + dataset.accuracyText + '</strong></div>' +
      '<p class="record-main__sentence">Geçmişe dönük testte <b>' + dataset.total +
      ' maçın ' + u.locSuffix(dataset.correct) + '</b> en olası görülen sonuç gerçekleşti.</p>' +
      '<div class="record-main__strip" role="img" aria-label="' + dataset.total + ' maçtan ' +
      dataset.correct + ' doğru, ' + dataset.wrong + ' yanlış seçim">' +
      rows.map(r => '<i class="' + (r.ok ? 'ok' : 'no') + '" aria-hidden="true"></i>').join('') + '</div>' +
      '<div class="record-main__legend"><span><i style="background:var(--ok)"></i>Doğru seçim</span>' +
      '<span><i style="background:var(--surface-3)"></i>Yanlış seçim</span>' +
      '<span>Her kutu bir gerçek maçın test sonucunu temsil eder</span></div></div>' +
      '<div class="record-side">' +
      '<div class="kpi"><span class="kpi__icon kpi__icon--n">' + BO.icon("calendar") + '</span><div><strong>' +
      dataset.total + '</strong><span>Değerlendirilen maç</span></div></div>' +
      '<div class="kpi"><span class="kpi__icon kpi__icon--ok">' + BO.icon("check") + '</span><div><strong>' +
      dataset.correct + '</strong><span>Doğru seçim</span></div></div>' +
      '<div class="kpi"><span class="kpi__icon kpi__icon--no">' + BO.icon("x") + '</span><div><strong>' +
      dataset.wrong + '</strong><span>Yanlış seçim</span></div></div></div>';
  }

  const outcome = (i, r) =>
    '<span class="outcome"><i class="' + ["h", "d", "a"][i] + '"></i><span>' +
    u.esc(u.outcomeLabel(i, r)) + '</span></span>';

  function rowHTML(r) {
    const h = u.team(r.home), a = u.team(r.away);
    return '<article class="past-row" aria-label="' +
      u.esc(h.name + ' ' + r.score[0] + ', ' + a.name + ' ' + r.score[1] +
      '. ' + (r.ok ? 'Doğru seçim' : 'Yanlış seçim')) + '">' +
      '<div class="past-row__match"><span class="past-row__meta">' +
      ui.leagueMark(r.league) + u.esc(u.league(r.league).short) + ' · ' + u.isoShort(r.date) +
      '</span><span class="past-row__teams"><span>' + u.esc(h.name) +
      '</span><span class="sep">–</span><span>' + u.esc(a.name) + '</span></span></div>' +
      '<div class="past-row__score"><span class="score">' + r.score[0] + ' – ' + r.score[1] + '</span></div>' +
      '<div class="past-row__pick"><span class="cell-label">BO’nun seçimi</span>' +
      outcome(r.pick, r) + '</div>' +
      '<div class="past-row__actual"><span class="cell-label">Gerçekleşen</span>' +
      outcome(r.actual, r) + '</div>' +
      '<div class="past-row__badge"><span class="result-badge result-badge--' +
      (r.ok ? 'ok' : 'no') + '">' + BO.icon(r.ok ? 'check' : 'x') +
      (r.ok ? 'Doğru' : 'Yanlış') + '</span></div></article>';
  }

  async function start() {
    try {
      const response = await fetch("data/history.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("Geçmiş veri HTTP " + response.status);
      const dataset = BO.history.parse(await response.json());
      const rows = dataset.rows;
      const state = { league: "all", date: "all", result: "all" };
      const dates = Array.from(new Set(rows.map(r => r.date))).sort().reverse();
      dateSel.innerHTML = '<option value="all">Tüm tarihler</option>' +
        dates.map(d => '<option value="' + d + '">' + u.isoLong(d) + '</option>').join('');
      tag.textContent = dataset.total + " doğrulanmış test kaydı";
      renderRecord(dataset, rows);

      function renderChips() {
        chips.innerHTML =
          '<button class="chip chip--plain" type="button" data-league="all" aria-pressed="' +
          (state.league === "all") + '">Tüm ligler</button>' +
          BO.LEAGUES.map(l => '<button class="chip" type="button" data-league="' + l.id +
          '" aria-pressed="' + (state.league === l.id) + '">' +
          ui.leagueMark(l.id) + u.esc(l.short) + '</button>').join('');
      }

      function renderList() {
        const filtered = rows.filter(r =>
          (state.league === "all" || r.league === state.league) &&
          (state.date === "all" || r.date === state.date) &&
          (state.result === "all" || (state.result === "ok") === r.ok)
        );
        if (!filtered.length) {
          list.innerHTML = '<div class="empty" style="border:0;border-radius:0">' +
            ui.emptyArt() + '<h3>Bu filtrelerle kayıt bulunamadı</h3>' +
            '<p>Farklı bir lig veya tarih seçmeyi deneyin.</p>' +
            '<div class="empty__actions"><button class="btn btn--ghost" type="button" data-act="reset">' +
            'Filtreleri temizle</button></div></div>';
          return;
        }
        const correct = filtered.filter(r => r.ok).length;
        list.innerHTML = '<div class="past-head" aria-hidden="true"><span>Maç</span>' +
          '<span>Skor</span><span>BO’nun en olası gördüğü</span><span>Gerçekleşen</span>' +
          '<span>Sonuç</span></div>' +
          filtered.map(rowHTML).join('') +
          '<div class="past-foot"><span>' + filtered.length + ' gerçek test kaydı · ' +
          correct + ' doğru, ' + (filtered.length-correct) + ' yanlış</span>' +
          '<span>Retrospektif replay · Canlı tahmin kaydı değildir</span></div>';
      }

      chips.addEventListener("click", event => {
        const button = event.target.closest(".chip"); if (!button) return;
        state.league = button.dataset.league; renderChips(); renderList();
      });
      dateSel.addEventListener("change", () => { state.date = dateSel.value; renderList(); });
      resSel.addEventListener("change", () => { state.result = resSel.value; renderList(); });
      list.addEventListener("click", event => {
        if (!event.target.closest('[data-act="reset"]')) return;
        state.league = state.date = state.result = "all";
        dateSel.value = resSel.value = "all";
        renderChips(); renderList();
      });
      renderChips();
      renderList();
    } catch (err) {
      console.error("BO geçmiş veri yükleme hatası:", err);
      errorState();
    }
  }

  record.innerHTML = '<div class="notice">Geçmiş maç verileri doğrulanıyor…</div>';
  list.innerHTML = '<div class="empty"><p>Maçlar yükleniyor…</p></div>';
  start();
})();
