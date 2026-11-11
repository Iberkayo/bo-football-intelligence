/* Çekirdek mantık testleri — çalıştırma: node tools/logic-test.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = { window: {}, console, location: { search: "", pathname: "/" }, history: { replaceState() {} }, URLSearchParams, document: {} };
ctx.window = ctx;
vm.createContext(ctx);
["data.js", "icons.js", "core.js"].forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, "assets/js", f), "utf8"), ctx));
const BO = ctx.BO, u = BO.util;

let fail = 0;
const eq = (name, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) fail++;
  console.log((ok ? "✓ " : "✗ ") + name + (ok ? "" : "  → " + JSON.stringify(got) + " (beklenen " + JSON.stringify(exp) + ")"));
};

// 1) Olasılıklar her zaman toplam 100
[...BO.MATCHES.map((m) => m.p), ...BO.MATCHES.map((m) => m.alt), ...BO.PAST_SAMPLES.map((r) => r.p), [33.3, 33.3, 33.3], [1, 1, 1], [50, 30, 25]].forEach((p, i) => {
  const s = u.norm(p).reduce((a, b) => a + b, 0);
  if (s !== 100) { fail++; console.log("✗ toplam 100 değil:", p, u.norm(p)); }
});
console.log("✓ tüm olasılık setleri %100'e normalize ediliyor (" + (BO.MATCHES.length * 2 + BO.PAST_SAMPLES.length + 3) + " set)");
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

// 5) Geçmiş: doğru/yanlış hesabı
const ok = BO.PAST_SAMPLES.filter((r) => u.argmax(u.norm(r.p)) === u.outcomeOfScore(r.score)).length;
console.log("ℹ örnek kayıtlarda doğru seçim:", ok + "/" + BO.PAST_SAMPLES.length);
eq("gerçek test toplamı tutarlı", BO.BACKTEST.correct + BO.BACKTEST.wrong, BO.BACKTEST.total);
eq("oran %61,9", ((BO.BACKTEST.correct / BO.BACKTEST.total) * 100).toFixed(1).replace(".", ","), BO.BACKTEST.accuracyText);

// 6) Tüm maçların takım/lig kaydı var
const missing = BO.MATCHES.concat(BO.PAST_SAMPLES).filter((m) => !BO.TEAMS[m.home] || !BO.TEAMS[m.away] || !BO.LEAGUES.find((l) => l.id === m.league));
eq("eksik takım/lig yok", missing.length, 0);

// 7) Arma SVG üretimi
eq("arma SVG", /<svg viewBox="0 0 48 48">/.test(BO.ui.crest("gala")), true);

console.log(fail ? "\n" + fail + " test BAŞARISIZ" : "\nTüm testler geçti");
process.exit(fail ? 1 : 0);
