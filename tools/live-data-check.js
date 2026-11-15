/* node tools/live-data-check.js — schema-only check of the PUBLISHED data/*.json.
   Unit tests use tools/fixtures/; this step only proves the live files still pass
   the same browser validators (fixtures, and forecasts against those fixtures). */
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const ctx={window:null,console,Intl,Date};ctx.window=ctx;
vm.createContext(ctx);
for(const f of ["fixture-feed.js","prediction-feed.js"])
  vm.runInContext(fs.readFileSync(path.join(__dirname,"../assets/js",f),"utf8"),ctx);
const read=f=>JSON.parse(fs.readFileSync(path.join(__dirname,"../data",f),"utf8"));
const fixtures=read("fixtures.json");
const feed=ctx.BO.fixtureFeed.parse(fixtures);
const preds=ctx.BO.predictionFeed.parse(read("predictions.json"),fixtures);
console.log(`Live data schema PASS: ${feed.fixtures.length} fixtures, `+
  `${preds.byFixture.size} matched PAPER forecasts (${fixtures.publication_state})`);
