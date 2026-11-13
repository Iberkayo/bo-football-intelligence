/* BO-BET — gerçek fakat kaynak-zamanlı maç takvimi; tahmin YOK. */
(function () {
  BO.shell();
  const u=BO.util,ui=BO.ui;
  const $=id=>document.getElementById(id);
  const strip=$("date-strip"),chips=$("league-chips"),search=$("team-search"),clear=$("search-clear");
  const group=$("match-groups"),featured=$("featured-slot"),notice=document.querySelector(".live-empty");
  const count=$("results-count"),title=$("results-title");
  const viewSwitcher=document.querySelector(".view-switch");
  const q=u.params(),MAX_DAYS=21;
  const params=new URLSearchParams(location.search);
  const explicitDay=params.has("gun");
  const state={day:Math.min(MAX_DAYS-1,Math.max(0,parseInt(q.get("gun")||"0",10)||0)),
    league:BO.LEAGUES.some(l=>l.id===q.get("lig"))?q.get("lig"):"all",
    query:q.get("ara")||"",view:q.get("gorunum")==="list"?"list":"cards"};
  let feed={publication_state:"AWAITING_VERIFIED_REFRESH",fixtures:[],snapshot_at_utc:null};
  let paper={byFixture:new Map(),total:0,state:"NO_VERIFIED_FROZEN_FORECASTS"};
  let paperError=false;
  clear.innerHTML=BO.icon("close");
  search.value=state.query;

  /* Açıklayıcı araştırma özeti: canlı başarı iddiası değildir. */
  const bt=BO.BACKTEST;
  $("track-card").innerHTML=
    '<div class="track-card__top"><span class="track-card__label">Geçmiş maç testi</span><span class="tag">Retrospektif</span></div>'+
    '<div class="track-card__body">'+ui.ring((bt.correct/bt.total)*100)+
    '<p class="track-card__text">Test edilen <strong>'+bt.total+' maçın '+u.locSuffix(bt.correct)+
    '</strong> en olası gördüğümüz sonuç gerçekleşti.</p></div>'+
    '<div class="track-card__foot"><span>'+bt.range+' · canlı performans değildir</span><span>Ayrıntılar'+BO.icon("chevR")+'</span></div>';

  function isoToday() {return BO.fixtureFeed.dateInTR(new Date().toISOString());}
  function dayIso(d) {const p=isoToday().split("-").map(Number);return new Date(Date.UTC(p[0],p[1]-1,p[2]+d)).toISOString().slice(0,10);}
  function dayName(d) {
    if (d===0)return "Bugün";
    if (d===1)return "Yarın";
    const name=new Date(dayIso(d)+"T12:00:00+03:00").toLocaleDateString("tr-TR",{timeZone:"Europe/Istanbul",weekday:"short"});
    return name.charAt(0).toLocaleUpperCase("tr-TR")+name.slice(1);
  }
  function shortDate(d) {return new Date(dayIso(d)+"T12:00:00+03:00").toLocaleDateString("tr-TR",{timeZone:"Europe/Istanbul",day:"numeric",month:"short"});}
  function longDate(d) {return new Date(dayIso(d)+"T12:00:00+03:00").toLocaleDateString("tr-TR",{timeZone:"Europe/Istanbul",day:"numeric",month:"long",weekday:"long"});}
  function futureMatches() {const now=Date.now();return feed.fixtures.filter(m=>Date.parse(m.kickoff_utc)>now);}
  function matchesFor(day) {const date=dayIso(day);return futureMatches().filter(m=>m.dateTR===date);}
  function showStatus() {
    const stamp=feed.snapshot_at_utc?new Date(feed.snapshot_at_utc):null;
    const age=stamp?(Date.now()-stamp.getTime())/3600000:Infinity;
    const stale=age>36||feed.publication_state!=="VERIFIED_SCHEDULE_SNAPSHOT";
    const label=stamp?stamp.toLocaleString("tr-TR",{timeZone:"Europe/Istanbul",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}):"henüz yok";
    notice.classList.toggle("is-stale",stale);
    notice.querySelector("h3").textContent=stale?"Kaynak yenilenmesi gerekiyor":"Fikstür kaynağı doğrulandı";
    notice.querySelector("p").textContent=
      "Son kaydedilmiş fikstür: "+label+". "+(stale?
      "Bu canlı bilgi değildir; saat veya karşılaşma programı değişmiş olabilir. ":"")+
      (paperError?"Tahmin veri dosyası doğrulanamadı; olasılıklar gizlendi.":
        paper.byFixture.size?"Maç öncesinde kaydedilmiş "+paper.byFixture.size+
        " Ridge PAPER tahmini bulunuyor (canlı model güncellemesi değildir).":
        "Henüz doğrulanmış maç öncesi Ridge tahmini yok; olasılık gösterilmiyor.");
  }
  function filtered() {
    const norm=u.fold(state.query.trim());
    return futureMatches().filter(m=>{
      if(norm){if(!u.fold(m.home+" "+m.away).includes(norm))return false;}
      else if(m.dateTR!==dayIso(state.day))return false;
      return state.league==="all"||m.league===state.league;
    });
  }
  function renderStrip() {
    strip.innerHTML=Array.from({length:MAX_DAYS},(_,d)=>{
      const n=matchesFor(d).length;
      return '<button class="day" type="button" data-day="'+d+'" aria-pressed="'+(d===state.day&&!state.query)+'">'+
        '<span class="day__name">'+dayName(d)+'</span><span class="day__date">'+shortDate(d)+'</span>'+
        '<span class="day__count">'+(n?n+" maç":"Maç yok")+'</span></button>';
    }).join("");
  }
  function renderChips() {
    const base=state.query?futureMatches():matchesFor(state.day);
    const n=id=>base.filter(m=>id==="all"||m.league===id).length;
    chips.innerHTML='<button class="chip chip--plain" type="button" data-league="all" aria-pressed="'+
      (state.league==="all")+'">Tüm ligler <span class="chip__count">'+n("all")+'</span></button>'+
      BO.LEAGUES.map(l=>'<button class="chip" type="button" data-league="'+l.id+'" aria-pressed="'+
      (state.league===l.id)+'" title="'+u.esc(l.name)+'">'+ui.leagueMark(l.id)+u.esc(l.short)+
      ' <span class="chip__count">'+n(l.id)+'</span></button>').join("");
  }
  function statusLine(m) {
    const forecast=paper.byFixture.get(m.id);
    if(!forecast) return '<span class="fixture-await">Tahmin bekleniyor</span>';
    return '<span class="fixture-await fixture-await--paper">Ridge · PAPER tahmini</span>';
  }
  function paperProb(m) {
    const forecast=paper.byFixture.get(m.id);
    return forecast?ui.prob({home:m.home,away:m.away,p:forecast.p},{short:true}):"";
  }
  function paperNote(m) {
    const forecast=paper.byFixture.get(m.id);
    if(!forecast) return "Maç öncesi olasılık henüz yayımlanmadı";
    const t=new Date(forecast.frozen_at_utc).toLocaleString("tr-TR",
      {timeZone:"Europe/Istanbul",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
    return "Dondurulma: "+t+" · Kaydedilmiş araştırma tahmini";
  }
  function card(m) {
    const l=u.league(m.league);
    return '<article class="match-card fixture-card" aria-label="'+u.esc(m.home+" – "+m.away+", "+m.dateTR+" "+m.timeTR)+
      '"><div class="match-card__top"><span class="match-card__league">'+ui.leagueMark(m.league)+
      '<span>'+u.esc(l.short)+'</span></span><span class="tag">Maç takvimi</span></div>'+
      '<div class="match-card__teams"><div class="mc-team"><span class="mc-team__name">'+u.esc(m.home)+'</span></div>'+
      '<div class="mc-center"><span class="mc-center__time">'+u.esc(m.timeTR)+'</span><span class="mc-center__day">'+
      u.esc(shortDate(Math.round((new Date(m.dateTR+"T00:00:00Z")-new Date(isoToday()+"T00:00:00Z"))/86400000)))+'</span></div>'+
      '<div class="mc-team"><span class="mc-team__name">'+u.esc(m.away)+'</span></div></div>'+
      (paperProb(m)?'<div class="fixture-card__prob">'+paperProb(m)+'</div>':"")+
      (paper.byFixture.has(m.id)?BO.paperMarkets.rows(paper.byFixture.get(m.id)):"")+
      '<div class="fixture-card__foot">'+statusLine(m)+'<span class="fixture-card__note">'+
      u.esc(paperNote(m))+'</span></div></article>';
  }
  function row(m) {
    return '<div class="fixture-row" role="listitem"><span class="fixture-row__time">'+u.esc(m.timeTR)+
      '</span><div class="fixture-row__teams"><strong>'+u.esc(m.home)+'</strong><span class="muted"> – </span><strong>'+
      u.esc(m.away)+'</strong><small>'+u.esc(u.league(m.league).short)+'</small></div>'+
      '<span class="fixture-row__state">'+
      (paper.byFixture.has(m.id)?
        '<span class="fixture-row__paper">1 %'+u.norm(paper.byFixture.get(m.id).p)[0]+
        ' · X %'+u.norm(paper.byFixture.get(m.id).p)[1]+
        ' · 2 %'+u.norm(paper.byFixture.get(m.id).p)[2]+'</span>':
        statusLine(m))+'</span></div>';
  }
  function renderMatches() {
    const xs=filtered(),searching=!!state.query.trim();
    title.textContent=searching?"Arama sonuçları":state.day===0?"Bugünün maçları":state.day===1?"Yarının maçları":longDate(state.day);
    count.textContent=xs.length?xs.length+" karşılaşma":"";
    featured.innerHTML="";
    if(!xs.length){
      const hasData=feed.fixtures.length>0;
      group.innerHTML='<div class="empty">'+ui.emptyArt()+
        '<h3>'+(searching?"Bu aramada maç bulunamadı":hasData?"Bu gün için kayıtlı maç yok":"Henüz doğrulanmış fikstür yüklenmedi")+
        '</h3><p>'+(searching?"Takım adını farklı yazmayı deneyin.":hasData?
        "Başka bir gün seçebilirsiniz. Kayıtlar son veri çekimi zamanını yansıtır.":
        "Sonraki doğrulanmış kaynak yenilemesiyle maç programı burada görünecek.")+
        '</p></div>';return;
    }
    const sorted=xs.slice().sort((a,b)=>a.kickoff_utc.localeCompare(b.kickoff_utc));
    if(state.view==="cards"){group.innerHTML='<div class="match-grid">'+sorted.map(card).join("")+'</div>';return;}
    group.innerHTML='<div class="match-list" role="list">'+sorted.map(row).join("")+'</div>';
  }
  function sync() {
    u.setParams({gun:state.day,lig:state.league,ara:state.query.trim(),gorunum:state.view==="list"?"list":""});
    clear.hidden=!state.query;
    document.querySelectorAll(".view-switch button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.view===state.view)));
    renderStrip();renderChips();renderMatches();
  }
  strip.addEventListener("click",e=>{const b=e.target.closest(".day");if(!b)return;state.day=+b.dataset.day;state.query="";search.value="";sync();});
  chips.addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b)return;state.league=b.dataset.league;sync();});
  let timer;
  search.addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(()=>{state.query=search.value;sync();},180);});
  clear.addEventListener("click",()=>{search.value="";state.query="";sync();search.focus();});
  viewSwitcher.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;state.view=b.dataset.view;sync();});
  async function load() {
    try {
      const res=await fetch("data/fixtures.json",{cache:"no-cache"});
      if(!res.ok)throw new Error("HTTP "+res.status);
      feed=BO.fixtureFeed.parse(await res.json());
      try {
        const rp=await fetch("data/predictions.json",{cache:"no-cache"});
        if(!rp.ok)throw new Error("Tahmin HTTP "+rp.status);
        paper=BO.predictionFeed.parse(await rp.json(),feed);
        paperError=false;
      } catch(predictionError) {
        console.error("BO PAPER tahminleri doğrulanamadı",predictionError);
        paper={byFixture:new Map(),total:0,state:"NO_VERIFIED_FROZEN_FORECASTS"};
        paperError=true;
      }
      if(!explicitDay&&!state.query) {
        const first=Array.from({length:MAX_DAYS},(_,i)=>i).find(i=>matchesFor(i).length>0);
        if(first!==undefined)state.day=first;
      }
      showStatus();sync();
    } catch(err) {
      console.error("Fikstür yüklenemedi",err);
      feed={publication_state:"AWAITING_VERIFIED_REFRESH",fixtures:[],snapshot_at_utc:null};
      paper={byFixture:new Map(),total:0,state:"NO_VERIFIED_FROZEN_FORECASTS"};
      showStatus();sync();
      notice.querySelector("h3").textContent="Fikstür bilgisi yüklenemedi";
    }
  }
  showStatus();sync();load();
})();
