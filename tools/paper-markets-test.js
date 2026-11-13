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
assert.ok(html.includes("2,5"));
assert.ok(!html.includes("Bet365"));
for(const invalid of [
  {p:[.8,.4,.1],expected_goals:[1.4,.9]},
  {p:[.5,.25,.25],expected_goals:[NaN,.9]},
  {p:[.5,.25,.25],expected_goals:[-1,.9]},
]){
  assert.throws(()=>api.calculate(invalid),/doğrulanamadı/);
}
console.log("PAPER multi-market probabilities: math, labels, fair price warning PASS");
