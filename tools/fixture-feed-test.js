/* node tools/fixture-feed-test.js — no backend / no API required */
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const assert=require("node:assert/strict");
const ctx={window:null,console,Intl,Date};ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,"../assets/js/fixture-feed.js"),"utf8"),ctx);
const feed=ctx.BO.fixtureFeed;
const pending=JSON.parse(fs.readFileSync(path.join(__dirname,"../data/fixtures.json"),"utf8"));
assert.equal(feed.parse(pending).fixtures.length,0);
const one={
 schema:"bo-fixtures/v1",source:"API_FOOTBALL_SILVER",
 publication_state:"ARCHIVED_SNAPSHOT_NOT_LIVE",
 snapshot_at_utc:"2026-11-09T09:42:32+00:00",
 coverage:{start_utc_date:"2026-11-13",end_exclusive_utc_date:"2026-12-04"},
 fixtures:[{id:"api-football:fixture:1584470",league:"superlig",status:"NS",
 kickoff_utc:"2026-11-21T10:30:00+00:00",home:"Team A",away:"Team B",
 source_observed_at_utc:"2026-11-09T09:42:30+00:00"}]
};
const r=feed.parse(one);assert.equal(r.fixtures.length,1);
assert.equal(r.fixtures[0].dateTR,"2026-11-21");
assert.equal(r.fixtures[0].timeTR,"13:30");
function reject(fn) {assert.throws(fn,/Fikstür doğrulanamadı/);}
function clone(){return JSON.parse(JSON.stringify(one));}
reject(()=>{const x=clone();x.fixtures[0].p=[.5,.3,.2];feed.parse(x);});
reject(()=>{const x=clone();x.fixtures[0].source_observed_at_utc="2026-11-25T10:30:00+00:00";feed.parse(x);});
reject(()=>{const x=clone();x.fixtures[0].league="unknown";feed.parse(x);});
reject(()=>{const x=clone();x.fixtures.push(x.fixtures[0]);feed.parse(x);});
reject(()=>{const x=clone();x.snapshot_at_utc=null;feed.parse(x);});
reject(()=>{const x=clone();x.publication_state="AWAITING_VERIFIED_REFRESH";feed.parse(x);});
console.log("Fixture feed: schema / Istanbul time / missing-prediction / source-time gates PASSED");
