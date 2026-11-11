/* =========================================================
   Sayfa: Maç detayı  →  mac.html?id=m01
   ========================================================= */
(function () {
  BO.shell();
  const u = BO.util, ui = BO.ui;
  const root = document.getElementById("detail-root");
  const m = u.match(u.params().get("id")) || BO.MATCHES[0];
  const h = u.team(m.home), a = u.team(m.away), l = u.league(m.league);
  const v = u.verdict(m);
  const p = v.p;

  document.title = h.name + " – " + a.name + " · BO-BET";

  /* ---------- Üst bölüm ---------- */
  const hero =
    '<nav class="breadcrumb" aria-label="Konum">' +
    '<a href="index.html?gun=' + m.day + '">' + BO.icon("arrowL") + "Maçlar</a><span aria-hidden=\"true\">/</span>" +
    "<span>" + u.esc(l.short) + '</span><span aria-hidden="true">/</span><span aria-current="page">' + u.esc(h.name + " – " + a.name) + "</span></nav>" +
    '<section class="match-hero reveal" style="--hc-soft:' + h.c1 + "40;--ac-soft:" + a.c1 + '33" aria-labelledby="match-title">' +
    '<div class="match-hero__meta">' + ui.leagueMark(m.league) + "<span>" + u.esc(l.name) + '</span><span class="dot"></span>' +
    "<span>" + u.dayLong(m.day) + '</span><span class="dot"></span><span>' + u.esc(m.venue) + "</span>" +
    '<span class="tag tag--sample">Örnek gösterim</span></div>' +
    '<h1 class="sr-only" id="match-title">' + u.esc(h.name + " – " + a.name) + " maç analizi</h1>" +
    '<div class="match-hero__teams">' +
    '<div class="hero-team">' + ui.crest(m.home, "xl") + '<span class="hero-team__name">' + u.esc(h.name) + '</span><span class="hero-team__role">Ev sahibi</span></div>' +
    '<div class="hero-center"><span class="hero-center__time">' + m.time + '</span><span class="hero-center__label">Maç başlangıcı</span></div>' +
    '<div class="hero-team">' + ui.crest(m.away, "xl") + '<span class="hero-team__name">' + u.esc(a.name) + '</span><span class="hero-team__role">Deplasman</span></div>' +
    "</div>" +
    '<div class="match-hero__prob">' + ui.prob(m, { lg: true }) + "</div>" +
    '<div class="match-hero__verdict"><span class="verdict-pill' + (v.even ? " is-even" : "") + '">' + BO.icon(v.even ? "scale" : "trend") + u.esc(v.text) + "</span></div>" +
    '<p class="match-hero__sub">' + u.esc(v.caution) + "</p>" +
    "</section>";

  /* ---------- 100 maç görseli ---------- */
  const dots = [];
  [["h", p[0]], ["d", p[1]], ["a", p[2]]].forEach(([c, n]) => { for (let i = 0; i < n; i++) dots.push(c); });
  const hundred =
    '<section class="panel" aria-labelledby="h100">' +
    '<div class="panel__head"><div><h2 id="h100">Bu maç 100 kez oynansaydı</h2>' +
    "<p>Yüzdeleri somutlaştırmanın kolay yolu: her nokta bir maç.</p></div></div>" +
    '<div class="hundred" role="img" aria-label="' + u.esc("100 maçta: " + h.name + " kazanır " + p[0] + ", beraberlik " + p[1] + ", " + a.name + " kazanır " + p[2]) + '">' +
    dots.map((c, i) => '<i class="' + c + '" style="animation-delay:' + i * 6 + 'ms"></i>').join("") + "</div>" +
    '<div class="hundred-legend">' +
    '<span><i style="background:var(--home)"></i>' + u.esc(h.name) + " kazanır <b>" + p[0] + "</b></span>" +
    '<span><i style="background:var(--draw)"></i>Beraberlik <b>' + p[1] + "</b></span>" +
    '<span><i style="background:var(--away)"></i>' + u.esc(a.name) + " kazanır <b>" + p[2] + "</b></span></div>" +
    '<p class="hundred-note">' +
    (v.even
      ? "Noktalar birbirine çok yakın dağılıyor: bu maçta hiçbir sonuç açık ara önde değil."
      : "Öne çıkan " + u.esc(u.team(v.favIdx === 0 ? m.home : m.away).name) + " bile 100 maçın " + u.locSuffix(100 - p[v.favIdx]) + " kazanamıyor. Futbolda sürpriz her zaman mümkündür.") +
    "</p>" +
    "</section>";

  /* ---------- Taslak analiz alanları (gerçek veri YOK) ---------- */
  const bar = (lw, label, rw) =>
    '<div class="vs-bar"><span class="vs-bar__track vs-bar__track--l"><i style="width:' + lw + '%"></i></span><span>' + label +
    '</span><span class="vs-bar__track vs-bar__track--r"><i style="width:' + rw + '%"></i></span></div>';
  const draftViz = {
    form: () =>
      [h.name, a.name].map((n) => '<div class="form-row"><span>' + u.esc(n) + '</span><span class="form-dots">' + "<i></i>".repeat(5) + "</span></div>").join(""),
    venue: () => bar(60, "İç saha · Dış saha", 45),
    power: () => bar(55, "Hücum", 50) + bar(48, "Savunma", 58),
    xg: () =>
      '<div class="xg"><span class="xg__col"><span class="xg__bar" style="height:44px"></span>' + u.esc(h.short) + "</span>" +
      '<span class="xg__col"><span class="xg__bar" style="height:32px"></span>' + u.esc(a.short) + "</span></div>",
    gap: () => bar(50, "Genel güç", 50),
  };
  const drafts =
    '<section class="panel" aria-labelledby="hdraft">' +
    '<div class="panel__head"><div><h2 id="hdraft">Maçın genel görünümü</h2>' +
    "<p>Takımları sade göstergelerle karşılaştıracağımız alanlar. Bu bölümler henüz gerçek veriye bağlı değil.</p></div>" +
    '<span class="tag tag--draft">' + BO.icon("lock") + "Taslak</span></div>" +
    '<div class="draft-grid">' +
    BO.DRAFT_MODULES.map(
      (d) =>
        '<article class="draft' + (d.wide ? " draft--wide" : "") + '">' +
        '<div class="draft__head"><h3>' + BO.icon(d.icon) + u.esc(d.title) + '</h3><span class="tag tag--draft">Yakında</span></div>' +
        '<p class="draft__desc">' + u.esc(d.desc) + "</p>" +
        '<div class="draft__viz" aria-hidden="true">' + draftViz[d.id]() + "</div></article>"
    ).join("") +
    "</div></section>";

  /* ---------- BO bu tahmini nasıl yapıyor? ---------- */
  const how =
    '<details class="disclosure">' +
    '<summary><span class="disclosure__icon">' + BO.icon("info") + "</span>" +
    '<span class="disclosure__title"><strong>BO bu tahmini nasıl yapıyor?</strong><span>Kısa ve sade bir açıklama</span></span>' + BO.icon("chevD", "disclosure__chev") + "</summary>" +
    '<div class="disclosure__body">' +
    "<p>BO, takımların geçmiş performanslarını ve maç istatistiklerini değerlendirerek olası sonuçları hesaplar. Tahminler kesin sonuç değildir.</p>" +
    '<div class="how-steps">' +
    '<div class="how-step"><span class="how-step__n">1</span><h4>Geçmiş maçlar</h4><p>Takımların daha önce oynadığı maçların sonuçları ve istatistikleri bir araya getirilir.</p></div>' +
    '<div class="how-step"><span class="how-step__n">2</span><h4>Olasılık hesabı</h4><p>Bu bilgilerden üç sonucun her biri için bir ihtimal hesaplanır.</p></div>' +
    '<div class="how-step"><span class="how-step__n">3</span><h4>Sade sunum</h4><p>Sonuç, toplamı %100 olan üç yüzde ve kısa bir değerlendirme olarak gösterilir.</p></div>' +
    "</div>" +
    '<div class="notice" style="margin-top:16px">' + BO.icon("alert") +
    "<div>Bu sayfadaki yüzdeler <strong>örnek gösterimdir</strong>. Sakatlık, kadro ya da hava durumu gibi bilgilerin bu hesaba katıldığını iddia etmiyoruz.</div></div>" +
    "</div></details>";

  /* ---------- Farklı hesaplama yöntemleri (başlangıçta kapalı) ---------- */
  const alt = u.norm(m.alt || m.p);
  const altM = Object.assign({}, m, { p: alt });
  const diff = Math.max.apply(null, p.map((x, i) => Math.abs(x - alt[i])));
  const sameTop = u.argmax(p) === u.argmax(alt);
  const methods =
    '<details class="disclosure">' +
    '<summary><span class="disclosure__icon">' + BO.icon("layers") + "</span>" +
    '<span class="disclosure__title"><strong>Farklı hesaplama yöntemleri ne düşünüyor?</strong><span>İsteğe bağlı · ileri düzey</span></span>' + BO.icon("chevD", "disclosure__chev") + "</summary>" +
    '<div class="disclosure__body">' +
    "<p>Aynı karşılaşmayı iki farklı yöntemle hesapladık. İki sonucun birbirine yakın olması, tahminin daha tutarlı olduğunu gösterir.</p>" +
    '<div class="method-grid">' +
    '<div class="method"><div class="method__head"><strong>Ana yöntem</strong><span class="tag tag--brand">Sayfada gösterilen</span></div>' +
    '<p class="method__desc">Takımların gol atma ve gol yeme eğilimlerinden skor ihtimallerini hesaplar.</p>' + ui.prob(m, { short: true }) + "</div>" +
    '<div class="method"><div class="method__head"><strong>Alternatif yöntem</strong><span class="tag">Karşılaştırma</span></div>' +
    '<p class="method__desc">Maçlarda yakalanan fırsatları temel alan farklı bir yaklaşım.</p>' + ui.prob(altM, { short: true }) + "</div>" +
    "</div>" +
    '<p class="method-diff">' +
    (diff <= 3
      ? "İki yöntem neredeyse aynı sonuca varıyor; en büyük fark " + diff + " puan."
      : sameTop
      ? "İki yöntem de aynı sonucu en olası görüyor; yüzdeler arasında en fazla " + diff + " puan fark var."
      : "İki yöntem farklı sonuçları öne çıkarıyor. Bu da maçın belirsiz olduğunu gösteriyor.") +
    "</p>" +
    '<details class="tech-names"><summary>' + BO.icon("chevR") + "Teknik adlar</summary>" +
    "<ul><li>Ana yöntem: <code>Ridge Poisson</code></li><li>Alternatif yöntem: <code>Opportunity C</code></li></ul></details>" +
    "</div></details>";

  /* ---------- Yan panel ---------- */
  const bt = BO.BACKTEST;
  const side =
    '<aside class="detail-side" aria-label="Maç bilgileri">' +
    '<div class="side-card"><h3>Maç bilgileri</h3><ul class="facts" style="margin-top:8px">' +
    "<li><span>Lig</span><span>" + u.esc(l.name) + "</span></li>" +
    "<li><span>Tarih</span><span>" + u.dayLong(m.day) + "</span></li>" +
    "<li><span>Saat</span><span>" + m.time + "</span></li>" +
    "<li><span>Stadyum</span><span>" + u.esc(m.venue) + "</span></li>" +
    '<li><span>Veri durumu</span><span><span class="tag tag--sample">Örnek gösterim</span></span></li></ul></div>' +
    '<div class="side-card"><h3>BO geçmişte nasıl sonuç aldı?</h3>' +
    '<div class="side-stat"><strong>' + bt.correct + "/" + bt.total + "</strong><span>maçta en olası sonuç gerçekleşti</span></div>" +
    "<p>" + bt.range + " tarihli maçlarla yapılan geçmiş test. Canlı tahmin performansı değildir.</p>" +
    '<a class="link-arrow" href="gecmis-tahminler.html">Geçmiş testleri incele' + BO.icon("arrowR") + "</a></div>" +
    '<a class="btn btn--ghost" href="index.html?gun=' + m.day + '">' + BO.icon("arrowL") + "Diğer maçlara dön</a>" +
    "</aside>";

  root.innerHTML =
    hero +
    '<div class="detail-grid"><div class="detail-main">' + hundred + drafts +
    "<div>" + how + methods + "</div></div>" + side + "</div>";
})();
