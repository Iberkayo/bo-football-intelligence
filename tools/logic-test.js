/* Çekirdek mantık testleri — çalıştırma: node tools/logic-test.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = { window: {}, console, location: { search: "", pathname: "/" }, history: { replaceState() {} }, URLSearchParams, document: {} };
ctx.window = ctx;
vm.createContext(ctx);
["data.js", "icons.js", "core.js", "history.js", "confidence.js"].forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, "assets/js", f), "utf8"), ctx));
const BO = ctx.BO, u = BO.util;

let fail = 0;
const eq = (name, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) fail++;
  console.log((ok ? "✓ " : "✗ ") + name + (ok ? "" : "  → " + JSON.stringify(got) + " (beklenen " + JSON.stringify(exp) + ")"));
};

// 1) Olasılıklar her zaman toplam 100
[...BO.MATCHES.map((m) => m.p), ...BO.MATCHES.map((m) => m.alt), [33.3, 33.3, 33.3], [1, 1, 1], [50, 30, 25]].forEach((p, i) => {
  const s = u.norm(p).reduce((a, b) => a + b, 0);
  if (s !== 100) { fail++; console.log("✗ toplam 100 değil:", p, u.norm(p)); }
});
console.log("✓ tüm olasılık setleri %100'e normalize ediliyor (" + (BO.MATCHES.length * 2 + 3) + " set)");
eq("norm [1,1,1]", u.norm([1, 1, 1]), [34, 33, 33]);

// 2) Değerlendirme dili
const vt = (p) => u.verdict({ home: "arsenal", away: "chelsea", p }).text;
eq("brief örneği (48/27/25)", vt([48, 27, 25]), "Arsenal daha avantajlı görünüyor");
eq("dengeli (fark < 6)", vt([38, 26, 36]), "Dengeli karşılaşma");
eq("beraberlik en yüksekse dengeli", vt([34, 36, 30]), "Dengeli karşılaşma");
eq("hafif önde (fark 6–11)", vt([42, 26, 32]), "Arsenal hafif önde görünüyor");
eq("deplasman daha avantajlı", vt([25, 27, 48]), "Chelsea daha avantajlı görünüyor");
eq("belirgin (fark ≥ 25)", vt([63, 20, 17]), "Arsenal belirgin şekilde avantajlı görünüyor");

// 3) Türkçe ekler
eq("39’unda", u.locSuffix(39), "39’unda");
eq("52’sinde", u.locSuffix(52), "52’sinde");
eq("40’ında", u.locSuffix(40), "40’ında");
eq("56’sında", u.locSuffix(56), "56’sında");
eq("63’ünde", u.locSuffix(63), "63’ünde");
eq("100’ünde", u.locSuffix(100), "100’ünde");

// 4) Arama normalizasyonu
eq("besiktas → Beşiktaş", u.fold("Beşiktaş").includes(u.fold("besiktas")), true);
eq("FENERBAHCE → Fenerbahçe", u.fold("Fenerbahçe").includes(u.fold("FENERBAHÇE")), true);
eq("istanbul İ", u.fold("İstanbul"), "istanbul");

// 5) Gerçek geçmiş maçların (v2, 10 lig) doğrulaması ve geriye dönük test özeti
const histDoc = JSON.parse(fs.readFileSync(path.join(root, "data", "history.json"), "utf8"));
const hist = BO.history.parse(histDoc);
eq("gerçek maç sayısı", hist.rows.length, 1084);
eq("Ridge doğru", hist.correct, 572);
eq("Ridge yanlış", hist.wrong, 512);
eq("v2: karşılaştırma modeli yok", hist.alternativeCorrect, null);
eq("10 lig", new Set(hist.rows.map(r => r.league)).size, 10);
const v2extra = JSON.parse(JSON.stringify(histDoc));
v2extra.matches[0].opportunity_c = v2extra.matches[0].ridge;
let v2rejected = false;
try { BO.history.parse(v2extra); } catch (_) { v2rejected = true; }
eq("v2'de ek model reddedilir", v2rejected, true);
eq("retrospektif durum", hist.data_status, "RETROSPECTIVE_REPLAY_NOT_PROSPECTIVE");
eq("sahte geçmiş kayıt yok", Object.prototype.hasOwnProperty.call(BO, "PAST_SAMPLES"), false);
const altered = JSON.parse(JSON.stringify(histDoc));
altered.matches[0].score = [99, 99];
let rejected = false;
try { BO.history.parse(altered); } catch (_) { rejected = true; }
eq("bozulmuş skor reddedilir", rejected, true);
// Maç haftası salı–pazartesi: cuma–pazartesi turu aynı haftada
eq("pazartesi önceki salıya bağlı", BO.history.weekOf("2026-11-09"), "2026-11-03");
eq("cuma aynı hafta", BO.history.weekOf("2026-11-06"), "2026-11-03");
eq("salı yeni hafta", BO.history.weekOf("2026-11-10"), "2026-11-10");
eq("hafta etiketi", BO.history.weekLabel("2026-11-03"), "3–9 Kasım");
eq("ay geçişi", BO.history.weekLabel("2026-10-27"), "27 Ekim – 2 Kasım");
eq("gerçek test toplamı tutarlı", BO.BACKTEST.correct + BO.BACKTEST.wrong, BO.BACKTEST.total);
eq("oran %52,8", ((hist.correct / hist.total) * 100).toFixed(1).replace(".", ","), BO.BACKTEST.accuracyText);

// 5b) Güven seviyesi: sabit eşikler ve geçmiş isabet oranları
const C = BO.confidence;
eq("≥%60 yüksek", C.level([0.60, 0.25, 0.15]).id, "high");
eq("%59,9 orta", C.level([0.599, 0.25, 0.151]).id, "mid");
eq("%45 orta", C.level([0.45, 0.30, 0.25]).id, "mid");
eq("%44,9 düşük", C.level([0.449, 0.30, 0.251]).id, "low");
eq("deplasman favorisi de sayılır", C.level([0.15, 0.20, 0.65]).id, "high");
const cs = C.stats(hist.rows);
eq("seviye sayıları", [cs.high.n, cs.mid.n, cs.low.n], [225, 441, 418]);
eq("seviyeler toplamı = tüm maçlar", cs.high.n + cs.mid.n + cs.low.n, hist.total);
eq("seviye doğruları toplamı", cs.high.correct + cs.mid.correct + cs.low.correct, hist.correct);
eq("yüksek > orta > düşük isabet", cs.high.correct / cs.high.n > cs.mid.correct / cs.mid.n && cs.mid.correct / cs.mid.n > cs.low.correct / cs.low.n, true);
eq("etiket metni", C.text([0.7, 0.2, 0.1], cs), "Yüksek güven · geçmişte %" + C.rateText(cs.high));
eq("oran yoksa yalnız etiket", C.text([0.5, 0.3, 0.2], null), "Orta güven");
eq("rozet kaçışlı", C.badge([0.7, 0.2, 0.1], cs, u.esc).includes('class="conf conf--high"'), true);

// 6) Tüm maçların takım/lig kaydı var
const missing = BO.MATCHES.filter((m) => !BO.TEAMS[m.home] || !BO.TEAMS[m.away] || !BO.LEAGUES.find((l) => l.id === m.league));
eq("örnek maç takım/lig kayıtları sağlam", missing.length, 0);
eq("gerçek geçmiş maçların ligleri tanımlı", hist.rows.every(r => BO.LEAGUES.some(l => l.id === r.league)), true);
eq("gerçek takım adları korunuyor", hist.rows.every(r => BO.util.team(r.home).name === r.home && BO.util.team(r.away).name === r.away), true);

// 7) Takım armaları yerine okunur takım adları
const card = BO.ui.matchCard(BO.MATCHES[0], 0);
eq("takım armaları kaldırıldı", /class="crest\b/.test(card), false);
eq("ev sahibi adı görünür", card.includes("Arsenal"), true);
eq("deplasman adı görünür", card.includes("Chelsea"), true);

console.log(fail ? "\n" + fail + " test BAŞARISIZ" : "\nTüm testler geçti");
process.exit(fail ? 1 : 0);
