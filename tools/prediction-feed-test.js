/* node tools/prediction-feed-test.js — static browser validator tests */
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),assert=require("node:assert/strict");
const context={window:null,console,Date};context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,"../assets/js/prediction-feed.js"),"utf8"),context);
const validator=context.BO.predictionFeed;
const blank=JSON.parse(fs.readFileSync(path.join(__dirname,"../data/predictions.json"),"utf8"));
const fixtures={
  snapshot_at_utc:"2025-11-13T12:30:00+00:00",
  fixtures:[{id:"api-football:fixture:777",kickoff_utc:"2025-11-16T13:00:00+00:00"}]
};
assert.equal(validator.parse(blank,fixtures).byFixture.size,0);
const t={
 schema:"bo-predictions/v1", source:"BO_BET_APPEND_ONLY_LEDGER",
 publication_state:"VERIFIED_PAPER_LEDGER_EXPORT",
 model_version:"ridge_poisson_api_silver_v1",
 fixtures_snapshot_at_utc:"2025-11-13T12:30:00+00:00",
 exported_at_utc:"2025-11-13T14:00:00+00:00",
 forecasts:[{
   fixture_id:"api-football:fixture:777",model_version:"ridge_poisson_api_silver_v1",
   horizon:"EARLY_24_TO_168H",kickoff_utc:"2025-11-16T13:00:00+00:00",
   frozen_at_utc:"2025-11-13T13:00:00+00:00",record_sha256:"a".repeat(64),
   source_sha256:"b".repeat(64),source_snapshot_id:"abc",
   base_training_sha256:"c".repeat(64),training_rows:400,
   p:[.46,.27,.27],expected_goals:[1.4,.9]
 }]
};
assert.equal(validator.parse(t,fixtures).byFixture.size,1);
const bad=clone=>JSON.parse(JSON.stringify(clone));
for(const corrupt of [
  x=>x.forecasts[0].p=[.6,.3,.3],
  x=>x.forecasts[0].frozen_at_utc="2025-11-16T14:00:00+00:00",
  x=>x.forecasts[0].model_version="other",
  x=>x.forecasts.push({...x.forecasts[0]}),
  x=>x.fixtures_snapshot_at_utc="2025-11-14T00:00:00+00:00",
]) {
  const x=bad(t);corrupt(x);
  assert.throws(()=>validator.parse(x,fixtures),/Tahmin kaydı doğrulanamadı/);
}
const moved={...fixtures,fixtures:[{...fixtures.fixtures[0],kickoff_utc:"2025-11-17T13:00:00+00:00"}]};
assert.equal(validator.parse(t,moved).byFixture.size,0);
console.log("PAPER forecast validator: pre-kickoff / provenance / no reschedule / fail-closed PASS");
