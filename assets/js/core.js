/* =========================================================
   BO Football Intelligence — Çekirdek
   util: yardımcılar · ui: ortak bileşenler · shell: kabuk
   ========================================================= */
window.BO = window.BO || {};

(function () {
  /* ---------------- Yardımcılar ---------------- */
  const util = {};

  util.esc = function (s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  /* Olasılıkları her zaman tam sayı ve toplam 100 yapar (en büyük kalan yöntemi) */
  util.norm = function (p) {
    const sum = p.reduce((a, b) => a + b, 0) || 1;
    const raw = p.map((v) => (v / sum) * 100);
    const out = raw.map(Math.floor);
    let rest = 100 - out.reduce((a, b) => a + b, 0);
    raw
      .map((v, i) => ({ i, r: v - Math.floor(v) }))
      .sort((a, b) => b.r - a.r)
      .forEach((o) => {
        if (rest > 0) { out[o.i] += 1; rest -= 1; }
      });
    return out;
  };

  /* Türkçe duyarlı arama normalizasyonu: "besiktas" → Beşiktaş */
  util.fold = function (s) {
    return String(s)
      .toLocaleLowerCase("tr-TR")
      .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/i̇/g, "i")
      .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  /* Sayıya Türkçe iyelik + bulunma eki: 39 → "39’unda", 2 → "2’sinde", 40 → "40’ında" */
  util.locSuffix = function (n) {
    const last = n % 10, tens = Math.floor((n % 100) / 10) * 10;
    const ONES = { 1: "inde", 2: "sinde", 3: "ünde", 4: "ünde", 5: "inde", 6: "sında", 7: "sinde", 8: "inde", 9: "unda" };
    const TENS = { 10: "unda", 20: "sinde", 30: "unda", 40: "ında", 50: "sinde", 60: "ında", 70: "inde", 80: "inde", 90: "ında" };
    let s;
    if (last) s = ONES[last];
    else if (tens) s = TENS[tens];
    else s = n % 1000 === 0 && n ? "inde" : n ? "ünde" : "ında"; // bin / yüz / sıfır
    return n + "’" + s;
  };

  util.team = (id) => BO.TEAMS[id] || { name: id, short: "?", c1: "#334", c2: "#667", pat: "plain" };
  util.league = (id) => BO.LEAGUES.find((l) => l.id === id) || { id, short: id, name: id, code: "?", color: "#334" };
  util.match = (id) => BO.MATCHES.find((m) => m.id === id);

  util.dateFor = function (offset) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  };
  util.dayName = function (offset) {
    if (offset === 0) return "Bugün";
    if (offset === 1) return "Yarın";
    const s = util.dateFor(offset).toLocaleDateString("tr-TR", { weekday: "long" });
    return s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1);
  };
  util.dayShort = (offset) => util.dateFor(offset).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  util.dayLong = (offset) => util.dateFor(offset).toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });
  util.isoLong = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  util.isoShort = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

  util.params = () => new URLSearchParams(location.search);
  util.setParams = function (obj) {
    const q = util.params();
    Object.keys(obj).forEach((k) => {
      const v = obj[k];
      if (v === null || v === undefined || v === "" || v === "all" || v === 0) q.delete(k);
      else q.set(k, v);
    });
    const s = q.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : ""));
  };

  util.argmax = (p) => p.indexOf(Math.max.apply(null, p));
  util.outcomeOfScore = (sc) => (sc[0] > sc[1] ? 0 : sc[0] === sc[1] ? 1 : 2);
  util.outcomeLabel = function (i, m) {
    if (i === 1) return "Beraberlik";
    return util.team(i === 0 ? m.home : m.away).name + " kazanır";
  };

  /* --------------------------------------------------------
     Değerlendirme: olasılıktan otomatik, ölçülü dil.
     Favori asla "kazanacak" diye sunulmaz.
     -------------------------------------------------------- */
  util.verdict = function (m) {
    const p = util.norm(m.p);
    const home = util.team(m.home).name;
    const away = util.team(m.away).name;
    const gap = Math.abs(p[0] - p[2]);
    const favIdx = p[0] >= p[2] ? 0 : 2;
    const fav = favIdx === 0 ? home : away;
    const favP = p[favIdx];
    let text, level;
    if (gap < 6 || p[1] >= Math.max(p[0], p[2])) {
      text = "Dengeli karşılaşma";
      level = "even";
    } else if (gap < 12) {
      text = fav + " hafif önde görünüyor";
      level = "slight";
    } else if (gap < 25) {
      text = fav + " daha avantajlı görünüyor";
      level = "clear";
    } else {
      text = fav + " belirgin şekilde avantajlı görünüyor";
      level = "strong";
    }
    const caution =
      level === "even"
        ? "İki takımın kazanma ihtimali birbirine çok yakın; her üç sonuç da mümkün."
        : "Bu kesin bir sonuç değil: diğer iki sonucun toplam ihtimali %" + (100 - favP) + ".";
    return { text, level, even: level === "even", favIdx: level === "even" ? -1 : favIdx, caution, p };
  };

  BO.util = util;
})();

(function () {
  const u = BO.util;
  const ui = {};

  ui.leagueMark = function (leagueId) {
    const l = u.league(leagueId);
    return '<span class="league-mark" style="--lg:' + l.color + '" aria-hidden="true">' + l.code + "</span>";
  };

  /* ---------- Olasılık çubuğu ---------- */
  ui.prob = function (m, opts) {
    opts = opts || {};
    const p = u.norm(opts.p || m.p);
    const top = u.argmax(p);
    const labels = opts.short
      ? ["Ev sahibi", "Beraberlik", "Deplasman"]
      : [u.team(m.home).name + " kazanır", "Beraberlik", u.team(m.away).name + " kazanır"];
    const aria = labels[0] + " yüzde " + p[0] + ", beraberlik yüzde " + p[1] + ", " + labels[2] + " yüzde " + p[2];
    const val = (i, cls) =>
      '<div class="prob__val prob__val--' + cls + (i === top ? " is-top" : "") + '">' +
      '<span class="prob__pct"><small>%</small>' + p[i] + "</span>" +
      '<span class="prob__lbl">' + u.esc(labels[i]) + "</span></div>";
    return (
      '<div class="prob' + (opts.lg ? " prob--lg" : "") + '">' +
      '<div class="prob__bar" role="img" aria-label="' + u.esc(aria) + '">' +
      '<span class="prob__seg prob__seg--home" style="width:' + p[0] + '%"></span>' +
      '<span class="prob__seg prob__seg--draw" style="width:' + p[1] + '%"></span>' +
      '<span class="prob__seg prob__seg--away" style="width:' + p[2] + '%"></span></div>' +
      '<div class="prob__values">' + val(0, "home") + val(1, "draw") + val(2, "away") + "</div></div>"
    );
  };

  ui.verdictLine = function (m) {
    const v = u.verdict(m);
    return '<span class="verdict-line' + (v.even ? " is-even" : "") + '">' + BO.icon(v.even ? "scale" : "trend") + "<span>" + u.esc(v.text) + "</span></span>";
  };

  ui.detailHref = (m) => "mac.html?id=" + encodeURIComponent(m.id);

  BO.ui = ui;
})();

(function () {
  const u = BO.util, ui = BO.ui;

  /* ---------- Maç kartı ---------- */
  ui.matchCard = function (m, i) {
    const h = u.team(m.home), a = u.team(m.away), l = u.league(m.league);
    const label = h.name + " – " + a.name + ", " + l.short + ", " + u.dayName(m.day) + " " + m.time + ". Maç detayını aç";
    return (
      '<a class="match-card reveal" style="animation-delay:' + Math.min(i || 0, 10) * 40 + 'ms" href="' + ui.detailHref(m) + '" aria-label="' + u.esc(label) + '">' +
      '<div class="match-card__top"><span class="match-card__league">' + ui.leagueMark(m.league) + "<span>" + u.esc(l.short) + "</span></span>" +
      '<span class="tag tag--sample">Örnek gösterim</span></div>' +
      '<div class="match-card__teams">' +
      '<div class="mc-team">' + '<span class="mc-team__name">' + u.esc(h.name) + "</span></div>" +
      '<div class="mc-center"><span class="mc-center__time">' + m.time + '</span><span class="mc-center__day">' + u.dayName(m.day) + "</span></div>" +
      '<div class="mc-team">' + '<span class="mc-team__name">' + u.esc(a.name) + "</span></div></div>" +
      ui.prob(m, { short: true }) +
      '<div class="match-card__foot">' + ui.verdictLine(m) + '<span class="match-card__go" aria-hidden="true">' + BO.icon("arrowR") + "</span></div>" +
      "</a>"
    );
  };

  /* ---------- Kompakt satır ---------- */
  ui.matchRow = function (m) {
    const h = u.team(m.home), a = u.team(m.away);
    return (
      '<a class="match-row" href="' + ui.detailHref(m) + '" aria-label="' + u.esc(h.name + " – " + a.name + ", " + m.time + ". Maç detayını aç") + '">' +
      '<span class="match-row__time">' + m.time + "</span>" +
      '<span class="match-row__teams">' +
      '<span class="match-row__team">' + "<span>" + u.esc(h.name) + "</span></span>" +
      '<span class="match-row__team">' + "<span>" + u.esc(a.name) + "</span></span></span>" +
      ui.prob(m, { short: true }) +
      '<span class="match-row__go" aria-hidden="true">' + BO.icon("chevR") + "</span></a>"
    );
  };

  /* ---------- Boş durum görseli ---------- */
  ui.emptyArt = function () {
    return (
      '<svg class="empty__art" viewBox="0 0 80 80" aria-hidden="true">' +
      '<rect x="6" y="14" width="68" height="52" rx="10" fill="var(--surface)" stroke="rgba(148,163,184,.3)" stroke-dasharray="4 4"/>' +
      '<path d="M40 14v52" stroke="rgba(148,163,184,.2)"/><circle cx="40" cy="40" r="10" fill="none" stroke="rgba(148,163,184,.25)"/>' +
      '<circle cx="58" cy="24" r="12" fill="var(--surface-2)" stroke="rgba(198,244,50,.5)" stroke-width="1.5"/>' +
      '<circle cx="56.5" cy="22.5" r="4.5" fill="none" stroke="var(--brand)" stroke-width="2"/>' +
      '<path d="m60 26 3 3" stroke="var(--brand)" stroke-width="2" stroke-linecap="round"/></svg>'
    );
  };

  /* ---------- Halka grafik ---------- */
  ui.ring = function (pct) {
    const r = 26, c = 2 * Math.PI * r;
    return (
      '<svg class="track-card__ring" viewBox="0 0 64 64" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="' + r + '" fill="none" stroke="var(--surface-3)" stroke-width="7"/>' +
      '<circle cx="32" cy="32" r="' + r + '" fill="none" stroke="var(--brand)" stroke-width="7" stroke-linecap="round" ' +
      'stroke-dasharray="' + ((c * pct) / 100).toFixed(2) + " " + c.toFixed(2) + '" transform="rotate(-90 32 32)"/>' +
      '<text x="32" y="36.5" text-anchor="middle" font-family="Manrope,Inter,sans-serif" font-weight="800" font-size="13" fill="var(--text)">%' + Math.round(pct) + "</text></svg>"
    );
  };
})();

/* ---------------- Kabuk ---------------- */
(function () {
  const NAV = [
    { id: "maclar", label: "Maçlar", href: "index.html", icon: "ball" },
    { id: "gecmis", label: "Geçmiş Tahminler", short: "Geçmiş", href: "gecmis-tahminler.html", icon: "history" },
    { id: "hakkinda", label: "BO Hakkında", short: "Hakkında", href: "hakkinda.html", icon: "info" },
  ];

  function logo() {
    return (
      '<a class="logo" href="index.html" aria-label="BO Football Intelligence — BO-BET ana sayfa">' + BO.logoMark() +
      '<span class="logo__text"><span class="logo__name">BO<b>-BET</b></span><span class="logo__sub">Football Intelligence</span></span></a>'
    );
  }

  function header(page) {
    const links = NAV.map(
      (n) => '<a class="main-nav__link" href="' + n.href + '"' + (page === n.id ? ' aria-current="page"' : "") + ">" + n.label + "</a>"
    ).join("");
    return (
      '<div class="container site-header__inner">' + logo() +
      '<nav class="main-nav" aria-label="Ana menü">' + links + "</nav>" +
      '<div class="header-right">' +
      '<div class="product-switch" aria-label="BO ürün ailesi">' +
      '<span class="product-switch__item is-current">BO-BET</span>' +
      '<span class="product-switch__item is-soon" title="Yakında">Scout <small>yakında</small></span>' +
      '<span class="product-switch__item is-soon" title="Yakında">Stories <small>yakında</small></span>' +
      '</div><button class="theme-toggle" type="button" aria-label="Açık temaya geç" title="Açık temaya geç"></button></div></div>'
    );
  }

  function bottomNav(page) {
    return NAV.map(
      (n) =>
        '<a class="bottom-nav__link" href="' + n.href + '"' + (page === n.id ? ' aria-current="page"' : "") + ">" +
        BO.icon(n.icon) + "<span>" + (n.short || n.label) + "</span></a>"
    ).join("");
  }

  function footer() {
    return (
      '<div class="container"><div class="site-footer__grid">' +
      '<div class="site-footer__about">' + logo() +
      "<p>BO Football Intelligence, futbol karşılaşmalarını istatistiksel modeller ve yapay zekâ ile analiz eder. Gösterilen yüzdeler olasılıktır; kesin sonuç değildir.</p></div>" +
      '<div class="site-footer__col"><h4>BO-BET</h4>' + NAV.map((n) => '<a href="' + n.href + '">' + n.label + "</a>").join("") + "</div>" +
      '<div class="site-footer__col"><h4>Ürün ailesi</h4><span>BO-BET</span><span class="muted">BO-Scout · yakında</span><span class="muted">BO-Stories · yakında</span></div>' +
      '<div class="site-footer__col"><h4>Prototip</h4><a href="prototip.html">Tüm ekranlar</a><span class="muted">Örnek verilerle hazırlanmıştır</span></div>' +
      "</div>" +
      '<div class="site-footer__legal"><span>© 2026 BO Football Intelligence</span>' +
      "<span>Ana sayfa doğrulanmış kaynakları ve dondurulmuş PAPER tahminlerini gösterir; prototip ekranları örnek veridir. Kesin sonuç veya bahis önerisi değildir.</span></div></div>"
    );
  }

  BO.shell = function () {
    const page = document.body.dataset.page;
    const h = document.getElementById("site-header");
    const b = document.getElementById("bottom-nav");
    const f = document.getElementById("site-footer");
    if (h) {
      h.innerHTML = header(page);
      if (BO.theme && BO.theme.bind) BO.theme.bind();
    }
    if (b) b.innerHTML = bottomNav(page);
    if (f) f.innerHTML = footer();
    // Prototip içinde (iframe) gömülüyken üst menü bağlantıları aynı çerçevede kalır.
  };
})();
