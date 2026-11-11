/* =========================================================
   Sayfa: Maçlar (ana sayfa)
   Durum URL'de tutulur → ?gun=1&lig=premier&ara=arsenal&gorunum=list
   ========================================================= */
(function () {
  BO.shell();
  const u = BO.util, ui = BO.ui;
  const DAYS = [0, 1, 2, 3, 4, 5, 6];

  const q = u.params();
  const state = {
    day: Math.min(6, Math.max(0, parseInt(q.get("gun") || "0", 10) || 0)),
    league: BO.LEAGUES.some((l) => l.id === q.get("lig")) ? q.get("lig") : "all",
    query: q.get("ara") || "",
    view: q.get("gorunum") === "list" ? "list" : "cards",
  };

  const $ = (id) => document.getElementById(id);
  const strip = $("date-strip"), chips = $("league-chips"), input = $("team-search"), clear = $("search-clear");
  const groups = $("match-groups"), featuredSlot = $("featured-slot"), count = $("results-count"), title = $("results-title");

  clear.innerHTML = BO.icon("close");
  input.value = state.query;

  /* Geçmiş test özeti kartı (gerçek veriler) */
  const bt = BO.BACKTEST;
  $("track-card").innerHTML =
    '<div class="track-card__top"><span class="track-card__label">Geçmiş maç testi</span><span class="tag">Retrospektif</span></div>' +
    '<div class="track-card__body">' + ui.ring((bt.correct / bt.total) * 100) +
    '<p class="track-card__text">Test edilen <strong>' + bt.total + " maçın " + u.locSuffix(bt.correct) + "</strong> en olası gördüğümüz sonuç gerçekleşti.</p></div>" +
    '<div class="track-card__foot"><span>' + bt.range + " · canlı performans değildir</span><span>Ayrıntılar" + BO.icon("chevR") + "</span></div>";

  const matchesFor = (day) => BO.MATCHES.filter((m) => m.day === day);

  function filtered() {
    const f = u.fold(state.query.trim());
    return BO.MATCHES.filter((m) => {
      if (f) {
        // Arama yapılırken tüm günler taranır: kullanıcı takımını bulsun.
        const h = u.team(m.home), a = u.team(m.away);
        if (u.fold(h.name + " " + a.name + " " + h.short + " " + a.short).indexOf(f) === -1) return false;
      } else if (m.day !== state.day) return false;
      return state.league === "all" || m.league === state.league;
    });
  }

  function renderStrip() {
    strip.innerHTML = DAYS.map((d) => {
      const n = matchesFor(d).length;
      return (
        '<button class="day" type="button" data-day="' + d + '" aria-pressed="' + (d === state.day && !state.query) + '">' +
        '<span class="day__name">' + u.dayName(d) + '</span><span class="day__date">' + u.dayShort(d) + "</span>" +
        '<span class="day__count">' + (n ? n + " maç" : "Maç yok") + "</span></button>"
      );
    }).join("");
  }

  function renderChips() {
    const base = state.query ? BO.MATCHES : matchesFor(state.day);
    const cnt = (id) => base.filter((m) => id === "all" || m.league === id).length;
    chips.innerHTML =
      '<button class="chip chip--plain" type="button" data-league="all" aria-pressed="' + (state.league === "all") + '">Tüm ligler <span class="chip__count">' + cnt("all") + "</span></button>" +
      BO.LEAGUES.map(
        (l) =>
          '<button class="chip" type="button" data-league="' + l.id + '" aria-pressed="' + (state.league === l.id) + '" title="' + u.esc(l.name) + '">' +
          ui.leagueMark(l.id) + u.esc(l.short) + ' <span class="chip__count">' + cnt(l.id) + "</span></button>"
      ).join("");
  }

  function featuredHTML(m) {
    const h = u.team(m.home), a = u.team(m.away), l = u.league(m.league), v = u.verdict(m);
    return (
      '<a class="featured reveal" href="' + ui.detailHref(m) + '" style="--hc-soft:' + h.c1 + "33;--ac-soft:" + a.c2 + '26" ' +
      'aria-label="Günün öne çıkan maçı: ' + u.esc(h.name + " – " + a.name) + '. Maç detayını aç">' +
      '<div><div class="featured__meta"><span class="tag tag--brand">Günün maçı</span><span class="tag tag--sample">Örnek gösterim</span>' +
      "<span>" + u.esc(l.name) + " · " + u.dayName(m.day) + " " + m.time + "</span></div>" +
      '<div class="featured__teams"><span class="featured__team">' + ui.crest(m.home, "lg") + "<strong>" + u.esc(h.name) + "</strong></span>" +
      '<span class="featured__vs">–</span><span class="featured__team">' + ui.crest(m.away, "lg") + "<strong>" + u.esc(a.name) + "</strong></span></div>" +
      '<div class="featured__verdict">' + BO.icon(v.even ? "scale" : "trend") + u.esc(v.text) + ".</div></div>" +
      '<div class="featured__right">' + ui.prob(m, { lg: true }) +
      '<span class="featured__cta">Maçın ayrıntılarına bak' + BO.icon("arrowR") + "</span></div></a>"
    );
  }

  function emptyHTML() {
    const s = state.query.trim();
    const head = s ? "“" + u.esc(s) + "” için maç bulunamadı" : "Bu gün için maç bulunamadı";
    const text = s
      ? "Takım adını farklı yazmayı deneyin. Türkçe karakter kullanmasanız da bulunur: “besiktas” → Beşiktaş."
      : state.league !== "all"
      ? u.esc(u.league(state.league).name) + " için seçili günde karşılaşma yok. Tüm ligleri açabilir ya da başka bir gün seçebilirsiniz."
      : "Desteklenen liglerde bu gün karşılaşma yok. Başka bir gün seçebilirsiniz.";
    const next = DAYS.find((d) => d > state.day && matchesFor(d).length);
    return (
      '<div class="empty reveal">' + ui.emptyArt() + "<h3>" + head + "</h3><p>" + text + "</p>" +
      '<div class="empty__actions">' +
      (s ? '<button class="btn btn--ghost" type="button" data-act="clear-search">Aramayı temizle</button>' : "") +
      (state.league !== "all" ? '<button class="btn btn--ghost" type="button" data-act="all-leagues">Tüm ligleri göster</button>' : "") +
      (!s && next !== undefined ? '<button class="btn btn--primary" type="button" data-act="go-day" data-day="' + next + '">' + u.dayName(next) + " maçlarına git</button>" : "") +
      "</div></div>"
    );
  }

  function renderMatches() {
    const list = filtered();
    const searching = !!state.query.trim();
    title.textContent = searching ? "Arama sonuçları" : state.day === 0 ? "Bugünün maçları" : state.day === 1 ? "Yarının maçları" : u.dayLong(state.day);
    count.textContent = list.length ? list.length + " karşılaşma" : "";

    // Öne çıkan maç: yalnızca bugün, filtre/arama yokken
    const feat = !searching && state.league === "all" ? list.find((m) => m.featured) : null;
    featuredSlot.innerHTML = feat ? featuredHTML(feat) : "";
    const rest = list.filter((m) => m !== feat);

    if (!list.length) { groups.innerHTML = emptyHTML(); return; }

    // Kart görünümü: tek ızgara, saat sırasıyla (lig bilgisi kartın üstünde)
    if (state.view === "cards") {
      const sorted = rest.slice().sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
      groups.innerHTML = sorted.length ? '<div class="match-grid">' + sorted.map((m, k) => ui.matchCard(m, k)).join("") + "</div>" : "";
      return;
    }

    // Liste görünümü: lig başlığına göre grupla (desteklenen lig sırası korunur)
    let i = 0;
    groups.innerHTML = BO.LEAGUES.map((l) => {
      const ms = rest.filter((m) => m.league === l.id).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
      if (!ms.length) return "";
      const body =
        state.view === "list"
          ? '<div class="match-list">' + ms.map(ui.matchRow).join("") + "</div>"
          : '<div class="match-grid">' + ms.map((m) => ui.matchCard(m, i++)).join("") + "</div>";
      return (
        '<section class="league-group" aria-label="' + u.esc(l.name) + '">' +
        '<h3 class="league-group__head">' + ui.leagueMark(l.id) + u.esc(l.name) + ' <span class="muted">' + ms.length + " maç</span></h3>" +
        body + "</section>"
      );
    }).join("");
  }

  function sync() {
    u.setParams({ gun: state.day, lig: state.league, ara: state.query.trim(), gorunum: state.view === "list" ? "list" : "" });
    clear.hidden = !state.query;
    document.querySelectorAll(".view-switch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === state.view)));
    renderStrip(); renderChips(); renderMatches();
  }

  /* ---------- Olaylar ---------- */
  strip.addEventListener("click", (e) => {
    const b = e.target.closest(".day"); if (!b) return;
    state.day = +b.dataset.day; state.query = ""; input.value = ""; sync();
  });
  chips.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    state.league = b.dataset.league; sync();
  });
  let t;
  input.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => { state.query = input.value; sync(); }, 160);
  });
  clear.addEventListener("click", () => { input.value = ""; state.query = ""; sync(); input.focus(); });
  document.querySelector(".view-switch").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.view = b.dataset.view; sync();
  });
  groups.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "clear-search") { input.value = ""; state.query = ""; }
    if (b.dataset.act === "all-leagues") state.league = "all";
    if (b.dataset.act === "go-day") state.day = +b.dataset.day;
    sync();
  });

  sync();
})();
