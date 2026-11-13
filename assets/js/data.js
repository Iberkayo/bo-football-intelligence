/* =========================================================
   BO Football Intelligence — Veri katmanı (prototip)
   ---------------------------------------------------------
   ÖNEMLİ:
   • MATCHES yalnızca TASARIM AMAÇLI ÖRNEKTİR.
     Canlı tahmin verisi değildir.
   • BACKTEST içindeki sayılar gerçek araştırma sonuçlarıdır
     (geçmiş maç verileri üzerinde retrospektif test).
   ========================================================= */

window.BO = window.BO || {};

BO.LEAGUES = [
  { id: "superlig", short: "Süper Lig", name: "Türkiye Süper Lig", code: "TR", color: "#c8102e" },
  { id: "premier", short: "Premier Lig", name: "İngiltere Premier Lig", code: "EN", color: "#5b2a86" },
  { id: "laliga", short: "La Liga", name: "İspanya La Liga", code: "ES", color: "#d9480f" },
  { id: "seriea", short: "Serie A", name: "İtalya Serie A", code: "IT", color: "#1c64c8" },
  { id: "bundesliga", short: "Bundesliga", name: "Almanya Bundesliga", code: "DE", color: "#b91c1c" },
  { id: "ligue1", short: "Ligue 1", name: "Fransa Ligue 1", code: "FR", color: "#0f766e" },
];

BO.TEAMS = {
  gala: { name: "Galatasaray", short: "GS", c1: "#a90432", c2: "#fdb913" },
  fener: { name: "Fenerbahçe", short: "FB", c1: "#14285f", c2: "#f5d10a" },
  besiktas: { name: "Beşiktaş", short: "BJK", c1: "#111317", c2: "#f2f4f7" },
  trabzon: { name: "Trabzonspor", short: "TS", c1: "#7a1f45", c2: "#5ec4e8" },
  basaksehir: { name: "Başakşehir", short: "İBFK", c1: "#10325a", c2: "#f47b20" },
  samsun: { name: "Samsunspor", short: "SAM", c1: "#d0131b", c2: "#f4f5f7" },

  arsenal: { name: "Arsenal", short: "ARS", c1: "#db0007", c2: "#f4f5f7" },
  chelsea: { name: "Chelsea", short: "CHE", c1: "#034694", c2: "#dba111" },
  mancity: { name: "Manchester City", short: "MCI", c1: "#6cabdd", c2: "#1c2c5b" },
  liverpool: { name: "Liverpool", short: "LIV", c1: "#c8102e", c2: "#00b2a9" },
  manutd: { name: "Manchester United", short: "MUN", c1: "#da291c", c2: "#fbe122" },
  tottenham: { name: "Tottenham", short: "TOT", c1: "#f4f5f7", c2: "#132257" },

  real: { name: "Real Madrid", short: "RMA", c1: "#eef0f4", c2: "#c9a227" },
  barca: { name: "Barcelona", short: "FCB", c1: "#a50044", c2: "#004d98" },
  atletico: { name: "Atlético Madrid", short: "ATM", c1: "#cb3524", c2: "#f4f5f7" },
  sevilla: { name: "Sevilla", short: "SEV", c1: "#f4f5f7", c2: "#d6001c" },
  bilbao: { name: "Athletic Bilbao", short: "ATH", c1: "#ee2523", c2: "#f4f5f7" },
  betis: { name: "Real Betis", short: "BET", c1: "#00954c", c2: "#f4f5f7" },

  inter: { name: "Inter", short: "INT", c1: "#0068a8", c2: "#111317" },
  milan: { name: "Milan", short: "MIL", c1: "#fb090b", c2: "#111317" },
  juventus: { name: "Juventus", short: "JUV", c1: "#111317", c2: "#f4f5f7" },
  napoli: { name: "Napoli", short: "NAP", c1: "#12a0d7", c2: "#f4f5f7" },
  roma: { name: "Roma", short: "ROM", c1: "#8e1f2f", c2: "#f0bc42" },
  atalanta: { name: "Atalanta", short: "ATA", c1: "#1e71b8", c2: "#111317" },

  bayern: { name: "Bayern Münih", short: "FCB", c1: "#dc052d", c2: "#0066b2" },
  dortmund: { name: "Borussia Dortmund", short: "BVB", c1: "#fde100", c2: "#111317" },
  leipzig: { name: "RB Leipzig", short: "RBL", c1: "#f4f5f7", c2: "#dd0741" },
  leverkusen: { name: "Bayer Leverkusen", short: "B04", c1: "#e32221", c2: "#111317" },
  frankfurt: { name: "Eintracht Frankfurt", short: "SGE", c1: "#111317", c2: "#e1000f" },
  wolfsburg: { name: "Wolfsburg", short: "WOB", c1: "#65b32e", c2: "#f4f5f7" },

  psg: { name: "Paris Saint-Germain", short: "PSG", c1: "#004170", c2: "#da291c" },
  marseille: { name: "Marsilya", short: "OM", c1: "#f4f5f7", c2: "#2faee0" },
  monaco: { name: "Monaco", short: "ASM", c1: "#e63312", c2: "#f4f5f7" },
  lyon: { name: "Lyon", short: "OL", c1: "#f4f5f7", c2: "#1a2b5e" },
  lille: { name: "Lille", short: "LOSC", c1: "#e01e13", c2: "#002d62" },
  nice: { name: "Nice", short: "OGCN", c1: "#cc0000", c2: "#111317" },
};

/* -------------------------------------------------------
   ÖRNEK MAÇLAR (tasarım amaçlı — canlı tahmin değildir)
   day : bugünden itibaren gün farkı (0 = bugün)
   p   : ana yöntem    [ev, beraberlik, deplasman]
   alt : ikinci yöntem [ev, beraberlik, deplasman]
   Toplamlar BO.util.norm ile her zaman %100'e sabitlenir.
   ------------------------------------------------------- */
BO.MATCHES = [
  { id: "m01", league: "premier", home: "arsenal", away: "chelsea", day: 0, time: "22.00", venue: "Emirates Stadyumu", p: [48, 27, 25], alt: [45, 29, 26], featured: true },
  { id: "m02", league: "superlig", home: "gala", away: "fener", day: 0, time: "20.00", venue: "RAMS Park", p: [44, 27, 29], alt: [41, 28, 31] },
  { id: "m03", league: "laliga", home: "real", away: "barca", day: 0, time: "23.00", venue: "Santiago Bernabéu", p: [38, 26, 36], alt: [40, 25, 35] },
  { id: "m04", league: "seriea", home: "inter", away: "milan", day: 0, time: "22.45", venue: "San Siro", p: [47, 28, 25], alt: [44, 30, 26] },
  { id: "m05", league: "bundesliga", home: "bayern", away: "dortmund", day: 0, time: "20.30", venue: "Allianz Arena", p: [61, 21, 18], alt: [57, 23, 20] },
  { id: "m06", league: "ligue1", home: "psg", away: "marseille", day: 0, time: "22.45", venue: "Parc des Princes", p: [63, 20, 17], alt: [60, 22, 18] },
  { id: "m07", league: "superlig", home: "besiktas", away: "trabzon", day: 1, time: "19.00", venue: "Tüpraş Stadyumu", p: [41, 29, 30], alt: [43, 28, 29] },
  { id: "m08", league: "premier", home: "mancity", away: "liverpool", day: 1, time: "19.30", venue: "Etihad Stadyumu", p: [43, 26, 31], alt: [40, 27, 33] },
  { id: "m09", league: "laliga", home: "atletico", away: "sevilla", day: 1, time: "21.00", venue: "Metropolitano", p: [54, 27, 19], alt: [51, 28, 21] },
  { id: "m10", league: "seriea", home: "juventus", away: "napoli", day: 1, time: "22.45", venue: "Allianz Stadyumu", p: [35, 31, 34], alt: [37, 32, 31] },
  { id: "m11", league: "bundesliga", home: "leipzig", away: "leverkusen", day: 1, time: "20.30", venue: "Red Bull Arena", p: [33, 26, 41], alt: [35, 27, 38] },
  { id: "m12", league: "superlig", home: "basaksehir", away: "samsun", day: 2, time: "17.00", venue: "Fatih Terim Stadyumu", p: [42, 29, 29], alt: [39, 31, 30] },
  { id: "m13", league: "premier", home: "manutd", away: "tottenham", day: 2, time: "18.00", venue: "Old Trafford", p: [40, 26, 34], alt: [42, 25, 33] },
  { id: "m14", league: "laliga", home: "bilbao", away: "betis", day: 2, time: "20.15", venue: "San Mamés", p: [46, 28, 26], alt: [44, 29, 27] },
  { id: "m15", league: "seriea", home: "roma", away: "atalanta", day: 2, time: "20.00", venue: "Olimpico", p: [34, 28, 38], alt: [36, 29, 35] },
  { id: "m16", league: "ligue1", home: "monaco", away: "lyon", day: 2, time: "21.00", venue: "Louis II Stadyumu", p: [45, 27, 28], alt: [43, 27, 30] },
  { id: "m17", league: "bundesliga", home: "frankfurt", away: "wolfsburg", day: 4, time: "17.30", venue: "Deutsche Bank Park", p: [50, 26, 24], alt: [47, 27, 26] },
  { id: "m18", league: "ligue1", home: "lille", away: "nice", day: 4, time: "19.00", venue: "Pierre-Mauroy", p: [44, 30, 26], alt: [41, 31, 28] },
  { id: "m19", league: "superlig", home: "trabzon", away: "gala", day: 4, time: "20.00", venue: "Papara Park", p: [30, 27, 43], alt: [32, 27, 41] },
];

/* -------------------------------------------------------
   GERÇEK ARAŞTIRMA SONUÇLARI — retrospektif test
   ------------------------------------------------------- */
BO.BACKTEST = {
  range: "2–8 Kasım 2026",
  total: 63,
  correct: 39,
  wrong: 24,
  accuracyText: "61,9",
};

/* Gerçek geçmiş maçlar data/history.json dosyasından doğrulanarak yüklenir.
   Tasarım amaçlı geçmiş maç kayıtları kaldırılmıştır. */

/* -------------------------------------------------------
   Maç detayında gelecekte yer alacak analiz alanları (TASLAK)
   ------------------------------------------------------- */
BO.DRAFT_MODULES = [
  { id: "form", icon: "trend", title: "Son maçlardaki performans", desc: "İki takımın son beş maçı sade bir form şeridiyle gösterilecek." },
  { id: "venue", icon: "home", title: "Ev sahibi ve deplasman performansı", desc: "Ev sahibinin iç saha, konuk takımın dış saha sonuçları karşılaştırılacak." },
  { id: "power", icon: "shield", title: "Hücum ve savunma gücü", desc: "Gol üretme ve gol önleme eğilimleri karşılıklı çubuklarla anlatılacak." },
  { id: "xg", icon: "target", title: "Beklenen gol sayısı", desc: "Her takımın bu maçta kaç gol bulmasının beklendiği basit bir ölçekte gösterilecek." },
  { id: "gap", icon: "scale", title: "Takımlar arasındaki güç farkı", desc: "İki takımın genel güç seviyesi tek bir terazi görseliyle karşılaştırılacak.", wide: true },
];
