/* BO-BET — PAPER Ridge score-distribution derivatives; NOT bookmaker prices. */
window.BO = window.BO || {};
BO.paperMarkets = (function () {
  "use strict";
  function assert(ok) { if (!ok) throw new Error("PAPER piyasa modeli doğrulanamadı"); }
  function over(lambda, threshold) {
    assert(Number.isFinite(lambda) && lambda > 0 && lambda <= 14 &&
      Number.isInteger(threshold) && threshold >= 0 && threshold <= 10);
    let term=Math.exp(-lambda),cdf=term;
    for(let i=1;i<=threshold;i++){term*=lambda/i;cdf+=term;}
    return Math.min(1,Math.max(0,1-cdf));
  }
  function calculate(f) {
    assert(f && Array.isArray(f.expected_goals) && f.expected_goals.length === 2 &&
      f.expected_goals.every(v=>typeof v==="number" && Number.isFinite(v) && v>0 && v<=7) &&
      Array.isArray(f.p) && f.p.length === 3 &&
      f.p.every(v=>typeof v==="number" && Number.isFinite(v) && v>=0 && v<=1) &&
      Math.abs(f.p.reduce((a,b)=>a+b,0)-1)<1e-7);
    const [home,away]=f.expected_goals, [h,d,a]=f.p;
    const both=(1-Math.exp(-home))*(1-Math.exp(-away));
    const total=home+away;
    const binary=(label,p)=>({label,p});
    return [
      {id:"g15",label:"Toplam gol 1,5",options:[
        binary("Üst",over(total,1)),binary("Alt",1-over(total,1))]},
      {id:"g25",label:"Toplam gol 2,5",options:[
        binary("Üst",over(total,2)),binary("Alt",1-over(total,2))]},
      {id:"g35",label:"Toplam gol 3,5",options:[
        binary("Üst",over(total,3)),binary("Alt",1-over(total,3))]},
      {id:"btts",label:"Karşılıklı gol",options:[
        binary("Var",both),binary("Yok",1-both)]},
      {id:"dc",label:"Çifte şans",options:[
        binary("1X",h+d),binary("X2",d+a),binary("12",h+a)]},
    ];
  }
  function pct(p) {return (100*p).toLocaleString("tr-TR",{maximumFractionDigits:1})+"%";}
  function fair(p) {
    if(p<=0 || 1/p>1000)return "—";
    return (1/p).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function rows(f) {
    const markets=calculate(f);
    const esc=BO.util.esc;
    return '<details class="paper-markets">'+
      '<summary>Diğer piyasalar · Ridge PAPER <span>5 piyasa</span></summary>'+
      '<p class="paper-markets__caption">Model olasılığı ve teorik adil oran. Bunlar gerçek bookmaker teklifleri değildir.</p>'+
      '<div class="paper-markets__list">'+markets.map(m=>
        '<div class="paper-market"><span class="paper-market__name">'+esc(m.label)+'</span>'+
        '<div class="paper-market__options">'+m.options.map(option=>
          '<span class="paper-market__option"><b>'+esc(option.label)+'</b> '+
          esc(pct(option.p))+' <small>Adil: '+esc(fair(option.p))+'</small></span>'
        ).join("")+'</div></div>'
      ).join("")+'</div></details>';
  }
  return {calculate,rows};
})();
