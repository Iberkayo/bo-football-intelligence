/* =========================================================
   Prototip vitrini: 6 ekran, masaüstü / mobil çerçeveler
   ========================================================= */
(function () {
  BO.shell();
  const SCREENS = [
    { id: "masaustu-ana", label: "1 · Masaüstü ana sayfa", device: "desktop", src: "index.html", url: "bo-bet / maçlar",
      desc: "Kullanıcı beş saniyede bugünün maçlarını, favoriyi ve yüzdeleri görür.",
      points: ["Gün şeridi ve maç sayıları", "Lig çipleri + Türkçe duyarlı takım araması", "Günün maçı vitrini ve lig gruplu kartlar", "Kart / liste görünümü", "Canlı tahmin boş durumu"] },
    { id: "masaustu-detay", label: "2 · Masaüstü maç detayı", device: "desktop", src: "mac.html?id=m01", url: "bo-bet / maç / arsenal-chelsea",
      desc: "Sitenin en etkileyici ekranı: takım isimleri, olasılıklar ve 100 maç görseli.",
      points: ["Ölçülü dille otomatik değerlendirme", "Kompakt 10×10 olasılık haritası", "Taslak olarak işaretli analiz alanları", "Açılır “BO nasıl yapıyor?” bölümü", "Başlangıçta kapalı yöntem karşılaştırması"] },
    { id: "masaustu-gecmis", label: "3 · Masaüstü geçmiş tahminler", device: "desktop", src: "gecmis-tahminler.html", url: "bo-bet / geçmiş-tahminler",
      desc: "Şeffaflık sayfası: gerçek 63 maçlık test sonucu ve açık uyarı.",
      points: ["%61,9 doğru sonuç oranı", "63 kutuluk oran şeridi", "Lig, tarih ve sonuç filtreleri", "Görünür retrospektif test uyarısı"] },
    { id: "mobil-ana", label: "4 · Mobil ana sayfa", device: "mobile", src: "index.html", url: "",
      desc: "Dikey kartlar, kaydırılabilir filtreler ve alt navigasyon.",
      points: ["44px+ dokunma alanları", "Yatay kaydırılan gün ve lig şeritleri", "Okunabilir olasılık çubukları", "Başparmak bölgesinde alt menü"] },
    { id: "mobil-detay", label: "5 · Mobil maç detayı", device: "mobile", src: "mac.html?id=m03", url: "",
      desc: "Dengeli bir maçta değerlendirme dilinin nasıl değiştiğini gösterir.",
      points: ["“Dengeli karşılaşma” durumu", "10×10 nokta ızgarası", "Tek sütun içerik akışı"] },
    { id: "hakkinda", label: "6 · BO Hakkında", device: "both", src: "hakkinda.html", url: "bo-bet / hakkında",
      desc: "Teknik makale değil, güvenilir bir ürün tanıtımı.",
      points: ["Teknik dil → futbol dili karşılaştırması", "Beş temel soru", "Geçmiş test / canlı tahmin farkı", "BO ürün ailesi: Scout ve Stories"] },
  ];

  const tabs = document.getElementById("tabs");
  const screen = document.getElementById("screen");
  const esc = BO.util.esc;

  function desktop(s) {
    return '<div class="browser"><div class="browser__bar"><span class="browser__dots"><i></i><i></i><i></i></span>' +
      '<span class="browser__url">' + esc(s.url || "bo-bet") + '</span></div>' +
      '<div class="browser__viewport" data-w="1440"><iframe src="' + s.src + '" title="' + esc(s.label) + ' — masaüstü" loading="lazy"></iframe></div></div>';
  }
  function mobile(s) {
    return '<div class="phone"><div class="phone__screen"><span class="phone__notch"></span>' +
      '<span class="phone__status" aria-hidden="true"><span>20.41</span><span>5G</span></span>' +
      '<div class="phone__viewport" data-w="390"><iframe src="' + s.src + '" title="' + esc(s.label) + ' — mobil" loading="lazy"></iframe></div></div></div>';
  }

  function fit() {
    document.querySelectorAll("[data-w]").forEach((box) => {
      const f = box.querySelector("iframe");
      const scale = box.clientWidth / +box.dataset.w;
      f.style.transform = "scale(" + scale + ")";
      // Çerçevenin yüksekliğini tamamen doldur
      f.style.height = Math.ceil(box.clientHeight / scale) + "px";
    });
  }

  function show(id, push) {
    const s = SCREENS.find((x) => x.id === id) || SCREENS[0];
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === s.id)));
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === s.id)));
    const stage =
      s.device === "desktop" ? desktop(s) :
      s.device === "mobile" ? mobile(s) :
      '<div class="pair">' + desktop(s) + mobile(s) + "</div>";
    screen.innerHTML =
      '<aside class="screen__info"><h2>' + esc(s.label.replace(/^\d · /, "")) + "</h2><p>" + esc(s.desc) + "</p>" +
      "<ul>" + s.points.map((p) => "<li>" + esc(p) + "</li>").join("") + "</ul>" +
      '<a class="btn btn--primary" href="' + s.src + '">Tam ekran aç</a></aside>' +
      '<div class="stage">' + stage + "</div>";
    fit();
    if (push) history.replaceState(null, "", "#" + s.id);
  }

  tabs.innerHTML = SCREENS.map(
    (s) => '<button class="chip chip--plain" type="button" role="tab" data-id="' + s.id + '">' + esc(s.label) + "</button>"
  ).join("");
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (b) show(b.dataset.id, true);
  });
  window.addEventListener("resize", fit);
  show(location.hash.slice(1), false);
})();
