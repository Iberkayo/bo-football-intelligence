/* BO-BET — maç öncesi dondurulmuş Ridge PAPER tahminlerinin gerçek sonuçları (data/results.json) */
(function () {
  const u = BO.util, ui = BO.ui;
  const list = document.getElementById("live-list"), tag = document.getElementById("live-tag");
  const pct = n => (n * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  const EARLY_N = 300;  // bu sayının altında isabet oranı yorumlanmaz

  function rowHTML(r) {
    const h = u.team(r.home), a = u.team(r.away);
    const pickText = r.pick === 1 ? "Beraberlik" : (r.pick === 0 ? h.name : a.name) + " galibiyeti";
    const split = "1 %" + pct(r.p[0]) + " · X %" + pct(r.p[1]) + " · 2 %" + pct(r.p[2]);
    const frozen = new Date(r.frozen_at_utc).toLocaleString("tr-TR",
      { timeZone: "Europe/Istanbul", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return '<article class="past-row" aria-label="' + u.esc(h.name + ' ' + r.score[0] + ', ' + a.name + ' ' +
      r.score[1] + '. ' + (r.ok ? 'Doğru seçim' : 'Yanlış seçim')) + '">' +
      '<div class="past-row__match"><span class="past-row__meta">' + ui.leagueMark(r.league) +
      u.esc(u.league(r.league).short) + ' · ' + u.isoShort(r.date) + '</span>' +
      '<span class="past-row__teams"><span>' + u.esc(h.name) + '</span><span class="sep">–</span><span>' +
      u.esc(a.name) + '</span></span></div>' +
      '<div class="past-row__score"><span class="score">' + r.score[0] + ' – ' + r.score[1] + '</span></div>' +
      '<div class="past-row__pick"><span class="cell-label">En olası sonuç</span>' +
      '<div class="past-pick__main"><span class="past-pick__name">' + u.esc(pickText) + ' <b>%' + pct(r.p[r.pick]) +
      '</b></span>' + BO.confidence.badge(r.p, null, u.esc) + '</div>' +
      '<span class="past-pick__prob">' + u.esc(split) + ' · kayıt ' + u.esc(frozen) + '</span></div>' +
      '<div class="past-row__actual"><span class="cell-label">Gerçekleşen</span><span class="outcome"><i class="' +
      ["h", "d", "a"][r.actual] + '"></i><span>' + u.esc(u.outcomeLabel(r.actual, r)) + '</span></span></div>' +
      '<div class="past-row__badge"><span class="result-badge result-badge--' + (r.ok ? 'ok' : 'no') + '">' +
      BO.icon(r.ok ? 'check' : 'x') + (r.ok ? 'Doğru' : 'Yanlış') + '</span></div></article>';
  }

  async function start() {
    try {
      const response = await fetch("data/results.json", { cache: "no-cache" });
      if (response.status === 404) {
        tag.textContent = "Henüz sonuç yok";
        list.innerHTML = '<div class="empty"><p>Maç öncesi kaydedilen tahminlerin ilk sonuçları maçlar bittikten sonra burada görünecek.</p></div>';
        return;
      }
      if (!response.ok) throw new Error("Sonuç verisi HTTP " + response.status);
      const data = BO.resultsFeed.parse(await response.json());
      if (!data.total) {
        tag.textContent = "Henüz sonuç yok";
        list.innerHTML = '<div class="empty"><p>Henüz sonuçlanmış maç yok.</p></div>';
        return;
      }
      const rows = data.rows.slice().sort((x, y) => y.kickoff_utc.localeCompare(x.kickoff_utc));
      tag.textContent = data.total + " maç · " + data.correct + " doğru";
      list.innerHTML = '<div class="past-head" aria-hidden="true"><span>Maç</span><span>Skor</span>' +
        '<span>Maç öncesi tahmin</span><span>Gerçekleşen</span><span>Sonuç</span></div>' +
        rows.map(rowHTML).join('') +
        '<div class="past-foot"><span>' + data.total + ' maç · ' + data.correct + ' doğru, ' +
        (data.total - data.correct) + ' yanlış</span><span>' +
        (data.total < EARLY_N ? 'Örneklem küçük: isabet oranını yorumlamak için erken' : 'Maç öncesi kayıt · sonradan değiştirilmedi') +
        '</span></div>';
    } catch (err) {
      console.error("BO sonuç verisi hatası:", err);
      tag.textContent = "Veri doğrulanamadı";
      list.innerHTML = '<div class="notice notice--warn"><strong>Sonuç verisi doğrulanamadı.</strong> ' +
        'Yanlış veya eksik veriyi göstermek yerine kayıtları geçici olarak gizledik.</div>';
    }
  }
  list.innerHTML = '<div class="empty"><p>Sonuçlar yükleniyor…</p></div>';
  start();
})();
