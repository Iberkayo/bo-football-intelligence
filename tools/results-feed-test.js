/* node tools/results-feed-test.js — settled PAPER results validator */
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),assert=require("node:assert/strict");
const context={window:null,console,Date};context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,"../assets/js/results-feed.js"),"utf8"),context);
const v=context.BO.resultsFeed;
const ok={schema:"bo-results/v1",data_status:"PROSPECTIVE_FROZEN_BEFORE_KICKOFF",
  publication_state:"VERIFIED_PAPER_SETTLEMENT",model_version:"ridge_poisson_api_silver_v1",
  summary:{total:1,hits:1},
  results:[{fixture_id:"api-football:fixture:1",league:"premier",home:"A",away:"B",
    kickoff_utc:"2026-11-20T20:00:00+00:00",frozen_at_utc:"2026-11-18T05:00:00+00:00",horizon:"EARLY_24_TO_168H",
    record_sha256:"a".repeat(64),p:[.5,.3,.2],pick:"1",score:[2,0],actual:"1",hit:true,
    score_observed_at_utc:"2026-11-21T08:00:00+00:00",score_source_sha256:"b".repeat(64)}]};
const parsed=v.parse(ok);
assert.equal(parsed.total,1);
assert.equal(parsed.rows[0].date,"2026-11-20");
const clone=x=>JSON.parse(JSON.stringify(x));
for(const corrupt of [
  x=>x.results[0].hit=false,
  x=>x.results[0].score=[0,1],
  x=>x.results[0].frozen_at_utc="2026-11-20T21:00:00+00:00",
  x=>x.results[0].score_observed_at_utc="2026-11-20T19:00:00+00:00",
  x=>x.results.push(clone(x.results[0])),
  x=>x.summary.hits=0,
  x=>x.data_status="RETROSPECTIVE_REPLAY_NOT_PROSPECTIVE",
]){const x=clone(ok);corrupt(x);assert.throws(()=>v.parse(x),/Sonuç kaydı doğrulanamadı/);}
assert.equal(v.parse({...clone(ok),publication_state:"NO_SETTLED_FORECASTS",results:[],summary:{total:0,hits:0}}).total,0);
const live=path.join(__dirname,"../data/results.json");
if(fs.existsSync(live)) v.parse(JSON.parse(fs.readFileSync(live,"utf8")));  // published file must validate
console.log("PAPER results validator: prospective / pre-kickoff freeze / score consistency / fail-closed PASS");
