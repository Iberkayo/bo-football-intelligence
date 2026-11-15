/* node tools/paper-markets-test.js — paper market math (no bookmaker data). */
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const assert=require("node:assert/strict");
const ctx={window:null,console};ctx.window=ctx;
ctx.BO={util:{esc:s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;")}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,
  "../assets/js/paper-markets.js"),"utf8"),ctx);
const api=ctx.BO.paperMarkets;
const fixture={p:[.50,.25,.25],expected_goals:[1.4,.9]};
const markets=api.calculate(fixture);
assert.equal(markets.length,5);
const map=Object.fromEntries(markets.map(x=>[x.id,x]));
for(const id of ["g15","g25","g35","btts"]){
  const m=map[id];
  assert.equal(m.options.length,2);
  assert.ok(Math.abs(m.options.reduce((s,x)=>s+x.p,0)-1)<1e-10);
}
assert.ok(map.g15.options[0].p>map.g25.options[0].p);
assert.ok(map.g25.options[0].p>map.g35.options[0].p);
const btts=(1-Math.exp(-1.4))*(1-Math.exp(-.9));
assert.ok(Math.abs(map.btts.options[0].p-btts)<1e-12);
assert.deepEqual(Array.from(map.dc.options,x=>x.label),["1X","X2","12"]);
assert.deepEqual(Array.from(map.dc.options,x=>x.p),[.75,.50,.75]);
// DC events overlap; probabilities are NOT required to sum to 100%.
assert.ok(map.dc.options.reduce((s,x)=>s+x.p,0)>1);
const html=api.rows(fixture);
assert.ok(html.includes("Ridge PAPER"));
assert.ok(html.includes("teorik adil oran"));
assert.ok(html.includes("gerçek bookmaker teklifleri değildir"));
assert.ok(html.includes("3 piyasa"));
assert.ok(html.includes("1,5") && html.includes("3,5") && html.includes("Çifte şans"));
assert.ok(!html.includes("2,5") && !html.includes("Karşılıklı gol"));
assert.ok(!html.includes("Bet365"));
// Card headline: 2,5 Over/Under + BTTS probabilities only (no fair price, no claim).
const head=api.headline(fixture);
const pctTR=p=>(100*p).toLocaleString("tr-TR",{maximumFractionDigits:1})+"%";
assert.ok(head.includes("2,5 gol") && head.includes("KG"));
assert.ok(head.includes(pctTR(map.g25.options[0].p)) && head.includes(pctTR(map.btts.options[1].p)));
assert.ok(!head.includes("Adil") && !/isabet|başarı|kazan/i.test(head));
// Freeze-age badge: none under 1 day, whole days after.
const frozen="2026-11-14T15:00:00+00:00", t0=Date.parse(frozen);
assert.equal(api.frozenAge(frozen,t0+23*3600e3).label,null);
assert.equal(api.frozenAge(frozen,t0+25*3600e3).label,"1 gün önce donduruldu");
assert.equal(api.frozenAge(frozen,t0+3*86400e3+5).days,3);
assert.equal(api.frozenAge(frozen,t0-3600e3).days,0);
assert.throws(()=>api.frozenAge("bad",t0),/doğrulanamadı/);
for(const invalid of [
  {p:[.8,.4,.1],expected_goals:[1.4,.9]},
  {p:[.5,.25,.25],expected_goals:[NaN,.9]},
  {p:[.5,.25,.25],expected_goals:[-1,.9]},
]){
  assert.throws(()=>api.calculate(invalid),/doğrulanamadı/);
}
console.log("PAPER multi-market probabilities: math, labels, fair price warning PASS");
