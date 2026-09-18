/* Derived from the Fiste REV27 map/panel, local-log and Live GPS patterns.
   River-specific data and ranking are deliberately separate from coastal scoring. */
'use strict';
const M=window.MistraModel,$=id=>document.getElementById(id);
const KEYS={ui:'mistra-ui-v1',log:'mistra-log-v1',lures:'mistra-owned-v1',places:'mistra-places-v1',track:'mistra-track-v1',river:'mistra-river-v1'};
const read=(k,f=null)=>{try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=1)=>M.finite(n)?n.toLocaleString('nb-NO',{maximumFractionDigits:d}):'--';
const when=t=>Number.isFinite(+new Date(t))?new Date(t).toLocaleString('nb-NO',{timeZone:'Europe/Oslo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'ukjent tidspunkt';
function setStatus(t){$('status').textContent=t;}
function localInput(t){const p=M.parts(t);return p?`${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}T${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`:'';}
function fromOsloInput(v){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v))return null;const target=Date.parse(v+'Z');let n=target;for(let i=0;i<3;i++){const p=M.parts(n);if(!p)return null;const wall=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);n+=target-wall;}return localInput(n)===v?new Date(n):null;}
const ui=read(KEYS.ui,{});
let guide=null,catalog=[],selectedId='nydammen',weatherData=null,hydroData=null,riverData=null;
let map=null,layers={},markers={},focusLayer=null,radiusLayer=null,placeLayer=null,riverLayer=null,base=null;
let places=read(KEYS.places,{}),lureOverrides=read(KEYS.lures,{}),logs=read(KEYS.log,[]);
let selectionGeneration=0,pendingPlaces=new Map(),liveActive=false,follow=true,watchId=null,wake=null;
let gps=null,lastFix=null,track=read(KEYS.track,[]),trackLayer=null,gpsLayer=null,gpsAccuracy=null;
let lastLiveAnalysis=0,lastLivePoint=null,refreshTimer=null,weatherPending=null,weatherKey=null,lastWeatherCall=0;
let followNow=true,viewerHistory=false;
// Map-following search points, independent of the few geocoded guide entry points.
const RP=window.MistraRiverPoints;
let riverIndex=null,riverMarkers=new Map(),visibleRiverPoints=[],selectedRiverPoint=null;
let pointLayer=null,pointTimer=null,lastPointSignature='',riverLoadingJob=null,riverLoadError=null;
function pointReach(point){
  const near=(guide?.reaches||[]).map(r=>({r,d:M.distance(point,getLocation(r))})).filter(x=>x.d!==null&&x.d<=1200).sort((a,b)=>a.d-b.d)[0];
  return {id:point.id,name:point.kind==='bend'?'Mistra - sving i elvelinja':'Mistra - elvepunkt',section:'boundary',access:'unknown',habitat:'unconfirmed',months:[5,6,7,8,9],
    sources:['nve-river','hooked','fishspot'],
    description:'Kartberegnet s\u00f8kepunkt p\u00e5 NVEs elvelinje. Ikke en dokumentert fiskeh\u00f8l, parkering eller trygg vadeplass.',
    tactic:point.kind==='bend'?'Unders\u00f8k svingen fra trygg bredde. Se etter faktiske str\u00f8mskiller og roligere lommer; kartlinjen alene viser ikke disse.':'Unders\u00f8k denne delen av elva fra trygg bredde. Begynn n\u00e6rt land og vurder str\u00f8m og dybde p\u00e5 stedet.',
    nearby:near?{name:near.r.name,distance:near.d}:null};
}
function pointRank(point){
  const reach=pointReach(point),localWeather=weatherData&&M.distance(point,{lat:weatherData.lat,lon:weatherData.lon})<=5000?M.nearestWeather(weatherData.series,date()):null,rank=M.rankReach(reach,date(),$('goal').value,localWeather,observations());
  const bendBonus=point.kind==='bend'?4:0;
  return {...point,score:Math.min(85,rank.score+bendBonus),reason:point.kind==='bend'?'Kartlagt sving: modellens forslag til et sted \u00e5 unders\u00f8ke.':'Fordelt s\u00f8kepunkt langs den synlige elvestrekningen.',reach,rank,
    planning:!M.season('main',date()).open&&!M.season('north',date()).open};
}
function riverPointContext(point){return {...context(point.reach||pointReach(point)),date:date().toISOString()};}
function riverPointPopup(point){
  const l=M.rankLures(catalog,riverPointContext(point),lureOverrides)[0];
  return `<b>P${point.number} \u00b7 ${esc(point.reach.name)}</b><small>${point.planning?'PLANLEGGING - kontroller sesongen':'Kartberegnet s\u00f8kepunkt - avklar fiskekort'}</small><p>${esc(point.reason)}</p>${l?`<div class="point-popup-lure"><img class="zoomable-lure" src="${esc(l.image)}" alt="${esc(l.name)}" tabindex="0" role="button"><span>${esc(l.name)}</span></div>`:''}<small>Modellprioritet ${point.score}/100. Ikke fangstsannsynlighet, elvedybde eller vadeplass.</small><button data-river-details="${esc(point.id)}">Sluk og fisker\u00e5d</button>`;
}
function renderRiverPointRules(){
  const main=M.season('main',date()),north=M.season('north',date());
  const closed=main.state==='closed'&&north.state==='closed';
  $('ruleContent').innerHTML=`<div class="rule-title"><h3>${closed?'\u00d8rretfisket er stengt':'Avklar fiskekort og sesong'}</h3><span class="rule-badge ${closed?'closed':''}">${closed?'PLANLEGGING':'KARTPUNKT'}</span></div><p>Et punkt p\u00e5 elvelinja avgj\u00f8r ikke hvilket kortomr\u00e5de du er i.</p><p><b>Mistra Elvelag:</b> ${esc(main.label)}. ${esc(main.detail)}</p><p><b>Nordre Mistra:</b> ${esc(north.label)}. ${esc(north.detail)}</p><p class="source-details">Punktene beholdes ogs\u00e5 utenfor sesongen for turplanlegging. Grense, adkomst og fiskerett er ikke beregnet fra elvelinja.</p>${sourceLinks(['rules-main','rules-north','rules-pdf'])}`;
}
function renderRiverPointDetails(){
  const p=pointRank(selectedRiverPoint),r=p.reach,ctx=riverPointContext(p),target=M.sourceTarget(ctx),lures=M.rankLures(catalog,ctx,lureOverrides),l=lures[0];
  $('selected').innerHTML=`<span class="card-label">VALGT KARTBEREGNET ELVEPUNKT</span><h2>${esc(r.name)}</h2><span class="chip">Modellprioritet ${p.score}/100</span><span class="chip">${p.planning?'Planlegging / kontroller sesong':'Fiskekort m\u00e5 avklares'}</span><p>${esc(r.description)}</p><p><b>Start her:</b> ${esc(r.tactic)}</p><p class="source-details">${p.lat.toFixed(6)}, ${p.lon.toFixed(6)} \u00b7 Adkomst er uavklart. ${r.nearby?'N\u00e6rmeste kildeomtalte utgangspunkt: '+esc(r.nearby.name)+' (ca. '+fmt(r.nearby.distance,0)+' m i luftlinje). Det betyr ikke at hele strekningen har enkel adkomst.':''}</p><button class="secondary" data-river-focus="${esc(p.id)}">Vis valgt elvepunkt</button><div class="notice good-note"><b>Det kildene foresl\u00e5r</b><p>${esc(target.text)}</p>${sourceLinks(target.sources)}</div>${l?`<div class="lure-pick"><img class="zoomable-lure" src="${esc(l.image)}" alt="${esc(l.name)}" tabindex="0" role="button"><div><span class="own-tag">N\u00c6RMEST I DIN EGEN ESKE</span><b>${esc(l.name)}</b><p>${esc(l.why)}</p><small>${esc(l.matchCaveat)}</small></div></div><div class="alternatives">${lures.slice(1).map(x=>`<article class="alternative"><img class="zoomable-lure" src="${esc(x.image)}" alt="${esc(x.name)}" tabindex="0" role="button"><b>${esc(x.name)}</b><small>${esc(M.methodLabel[x.family])}</small></article>`).join('')}</div>`:'<p class="muted">Mark er valgt. Ingen oppdiktet agnfotografi vises.</p>'}<p><b>Teknikkforslag:</b> ${esc(M.tactic(l?.family||'worm',ctx.flow))}</p><p class="source-details">${esc(p.reason)} Prioriteten er en forsiktig modell for utforsking, ikke dokumentert fangstrate. Elvelinjen viser ikke vanndybde, fisk, vannbredde eller trygg adkomst.</p>${sourceLinks(['nve-river','hooked','fishspot'])}`;
}
function scheduleRiverPoints(){
  if(!map||!guide)return;
  // One rebuild after movement settles; no upstream/API lookup on map movements.
  if(pointTimer)return;
  pointTimer=setTimeout(()=>{pointTimer=null;updateRiverPoints();},140);
}
function pointIcon(point){return L.divIcon({className:'river-point-marker',html:`<div class="river-point-pin ${point.planning?'planning':''} ${selectedRiverPoint?.id===point.id?'selected':''}"><b>${point.number}</b></div>`,iconSize:[32,32],iconAnchor:[16,16]});}
function emptyPointText(reason){return ({
  'no-geometry':riverLoadError||'Venter p\u00e5 elvelinja. Lagrede elvedata brukes automatisk n\u00e5r de finnes.',
  'outside-river':'Ingen del av Mistra-elvelinja i kartutsnittet. Flytt langs elva eller trykk Hele Mistra.',
  'radius-filter':'Ingen elvepunkter i utsnittet innen valgt avstand fra base. Flytt kartet til basen eller \u00f8k avstanden.',
  'access-filter':'Adkomst er ikke dokumentert for de kartberegnede elvepunktene. Velg Tilkomst: Alle / Uavklart. De kildeomtalte utgangspunktene beholder tilkomstfilteret.',
  'invalid-view':'Kartutsnittet er ikke klart enn\u00e5.',
  'hidden':'Elvepunkter er skjult. Trykk Elvepunkter over kartet for \u00e5 vise dem igjen.'
})[reason]||'Ingen aktuelle punkter i dette kartutsnittet.';}
function updateRiverPoints(){
  if(!map||!guide||!RP)return;
  const b=map.getBounds(),on=$('pointsToggle').getAttribute('aria-pressed')!=='false';
  const result=RP.suggest(riverIndex,{bounds:{west:b.getWest(),south:b.getSouth(),east:b.getEast(),north:b.getNorth()},zoom:map.getZoom(),base:currentBase(),radius:Number($('radius').value),access:$('access').value});
  const rows=on?result.points.map(pointRank).sort((a,b)=>b.score-a.score||a.lat-b.lat||a.lon-b.lon):[];
  rows.forEach((p,i)=>p.number=i+1);visibleRiverPoints=rows;
  $('map').dataset.riverPointCount=String(rows.length);
  $('riverPointCount').textContent=rows.length+' punkter';
  const reason=on?result.stats.reason:'hidden';
  $('riverPointSummary').textContent=rows.length?`${rows.length} kartberegnede s\u00f8kepunkter i kartutsnittet. ${rows[0].planning?'Vises for planlegging utenfor / uavklart sesong.':'Avklar kortomr\u00e5de f\u00f8r fiske.'}${result.stats.missingBase?' Avstand trenger en base eller et ferskt GPS-signal.':''}`:emptyPointText(reason);
  const sourceState=riverData?.stale?'Lagret':'Hentet';
  $('mapNotice').textContent=riverIndex?.segments.length?`${sourceState} NVE-elvelinje \u00b7 ${rows.length} s\u00f8kepunkter${riverData?.incomplete?' \u00b7 delvis kartgrunnlag':''}. ${rows.length?'Oppdateres n\u00e5r kartet flyttes.':emptyPointText(reason)}`:emptyPointText('no-geometry');
  const sig=JSON.stringify([on,rows.map(p=>[p.id,p.score,p.planning]),selectedRiverPoint?.id,$('method').value,$('flow').value,$('clarity').value,$('goal').value]);
  if(sig===lastPointSignature)return;lastPointSignature=sig;
  if(rows.length)setStatus(`${rows.length} elvepunkter i kartutsnittet - ${rows[0].planning?'planlegging':'kontroller sesong og fiskekort'}.`);
  const ids=new Set(rows.map(p=>p.id));
  for(const [id,marker] of riverMarkers){if(!ids.has(id)){pointLayer.removeLayer(marker);riverMarkers.delete(id);}}
  for(const p of rows){
    let marker=riverMarkers.get(p.id);
    if(!marker){marker=L.marker([p.lat,p.lon],{icon:pointIcon(p),title:`P${p.number} - ${p.reach.name}`,riseOnHover:true,zIndexOffset:500}).addTo(pointLayer);marker.on('click',()=>selectRiverPoint(p.id,false));riverMarkers.set(p.id,marker);}
    else marker.setIcon(pointIcon(p));
    if(!marker.getPopup())marker.bindPopup(riverPointPopup(p),{maxWidth:310,autoPan:false});else marker.setPopupContent(riverPointPopup(p));
    marker.bindTooltip(`P${p.number} - ${p.kind==='bend'?'Sving i elvelinja':'S\u00f8kepunkt'} - ${p.score}/100${p.planning?' (planlegging)':''}`,{direction:'top'});
  }
  const oldScroll=$('riverPointList').scrollTop;
  $('riverPointList').innerHTML=rows.map(p=>`<button class="river-point-row ${selectedRiverPoint?.id===p.id?'active':''}" data-river-point="${esc(p.id)}" aria-pressed="${selectedRiverPoint?.id===p.id}"><span class="rnum">P${p.number}</span><span><b>${p.kind==='bend'?'Sving i elvelinja':'S\u00f8k langs elvestrekningen'}</b><small>${p.planning?'PLANLEGGING':'KARTBEREGNET'} \u00b7 tilkomst uavklart${p.distanceM!==null?' \u00b7 '+fmt(p.distanceM,0)+' m fra base':''}</small></span><strong>${p.score}/100</strong></button>`).join('');
  $('riverPointList').scrollTop=oldScroll;
}
function selectRiverPoint(id,focus=false,details=false){
  const p=visibleRiverPoints.find(p=>p.id===id)||(selectedRiverPoint?.id===id?selectedRiverPoint:null);if(!p)return;
  ++selectionGeneration;selectedRiverPoint=p;
  if(focus){pauseFollowing();map.stop();map.setView([p.lat,p.lon],Math.max(16,map.getZoom()),{animate:false});}
  focusLayer.clearLayers();L.circleMarker([p.lat,p.lon],{radius:20,color:'#f2c94c',weight:2,fillOpacity:.04,interactive:false}).addTo(focusLayer);
  renderSelected();renderRules();updateRiverPoints();riverMarkers.get(id)?.openPopup();refreshWeather();
  setStatus('Elvepunkt valgt - '+(p.planning?'planlegging.':'kontroller fiskekort og adkomst.'));
  if(details){const aside=$('results'),card=$('selectedCard');if(window.innerWidth>=1000)aside.scrollTo({top:card.offsetTop-aside.offsetTop-10,behavior:'smooth'});else card.scrollIntoView({block:'start',behavior:'smooth'});}
}

const accessLabel={easier:'Enklere utgangspunkt',walk:'Gange / sti',mixed:'Varierende terreng',difficult:'Krevende terreng',unknown:'Adkomst uavklart'};
async function fetchData(url,{timeout=25000,cacheKey}={}){const ctrl=new AbortController(),id=setTimeout(()=>ctrl.abort(),timeout);try{const r=await fetch(url,{signal:ctrl.signal,cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();if(cacheKey&&j.available!==false)write(cacheKey,{...j,savedAt:new Date().toISOString()});if(j.available===false&&cacheKey){const old=read(cacheKey);if(old)return {...old,stale:true,warning:j.error||'Bruker lagrede data'};}return j;}catch(e){const old=cacheKey?read(cacheKey):null;if(old)return {...old,stale:true,warning:'Ingen forbindelse - tidligere data'};throw e;}finally{clearTimeout(id);}}
function saveUI(){write(KEYS.ui,{goal:$('goal').value,method:$('method').value,access:$('access').value,radius:$('radius').value,mapStyle:$('mapStyle').value,base,center:map?[map.getCenter().lat,map.getCenter().lng]:null,zoom:map?.getZoom()});}
function date(){return fromOsloInput($('tripTime').value)||new Date();}
function observations(){return {flow:$('flow').value,clarity:$('clarity').value};}
function currentBase(){if(liveActive)return gps&&Date.now()-gps.timestamp<45000&&gps.accuracy<=100?gps:null;return base;}
function currentWeather(){const p=weatherPoint(); if(weatherData&&M.distance({lat:weatherData.lat,lon:weatherData.lon},p)>5000)return null; return M.nearestWeather(weatherData?.series,date());}
function selectedReach(){if(selectedRiverPoint)return pointReach(selectedRiverPoint);return guide?.reaches.find(r=>r.id===selectedId)||guide?.reaches[0];}
function getLocation(r){const p=places[r.id]||r.anchor;return p&&M.finite(p.lat)&&M.finite(p.lon)?p:null;}
function sourceLinks(ids=[]){return `<div class="source-links">${ids.map(id=>guide.sources.find(s=>s.id===id)).filter(Boolean).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join('')}</div>`;}
function context(r){return {reach:r,goal:$('goal').value,method:$('method').value,date:date().toISOString(),...observations()};}
function ranked(){const b=currentBase(),radius=Number($('radius').value),ac=$('access').value;return guide.reaches.map(r=>({...r,...M.rankReach(r,date(),$('goal').value,currentWeather(),observations()),dist:M.distance(b,getLocation(r))})).filter(r=>(ac==='all'||r.access===ac)&&(radius===0||!b||(r.dist!==null&&r.dist<=radius))).sort((a,b)=>Number(b.rule.open)-Number(a.rule.open)||b.score-a.score||a.name.localeCompare(b.name,'nb'));}
function render(){if(!guide)return;const rows=ranked();$('placeCount').textContent=rows.length+' av '+guide.reaches.length;
 $('reachList').innerHTML=rows.map((r,i)=>`<button class="reach-row ${r.id===selectedId?'active':''}" data-reach="${r.id}" aria-pressed="${r.id===selectedId}"><span class="rnum">${i+1}</span><span><strong>${esc(r.name)}</strong><small>${esc(accessLabel[r.access])}${r.dist!==null?' - '+fmt(r.dist/1000)+' km i luftlinje':''}${Number($('radius').value)>0&&r.dist===null?' - avstand ukjent':''}</small><small>${esc(r.sourceLevel)}</small></span><span class="rs">${r.rule.open?r.score+'/100':r.rule.state==='closed'?'Stengt':'Avklar'}</span></button>`).join('')||'<p class="muted">Ingen strekninger passer filteret. Velg Alle / Ingen grense.</p>';
 const b=currentBase();if(Number($('radius').value)>0&&!b)setStatus('Avstandsfilteret trenger base eller et ferskt Live GPS-signal.');
 renderSelected();renderRules();renderWeather();drawPlaces();drawBase();scheduleRiverPoints();
}
function renderRules(){if(selectedRiverPoint){renderRiverPointRules();return;}const r=selectedReach(),s=M.season(r.section,date());$('ruleContent').innerHTML=`<div class="rule-title"><h3>${esc(s.label)}</h3><span class="rule-badge ${s.state}">${s.open?'ÅPEN SESONG':'PLANLEGGING'}</span></div><p>${esc(s.detail)}</p><p class="source-details">${esc(r.name)} - ${when(date())}. Kontroller rett kort og gjeldende regler før fiske. Unntak for barn og fullstendige vilkår står i regel-PDF-en.</p>${sourceLinks(r.section==='north'?['rules-north']:r.section==='boundary'?['rules-main','rules-north']:['rules-main','rules-pdf'])}`;}
function renderSelected(){if(selectedRiverPoint){renderRiverPointDetails();return;}const r=selectedReach();if(!r)return;const rank=M.rankReach(r,date(),$('goal').value,currentWeather(),observations()),ctx=context(r),target=M.sourceTarget(ctx),lures=M.rankLures(catalog,ctx,lureOverrides),loc=getLocation(r);
 const first=lures[0];
 $('selected').innerHTML=`<span class="card-label">VALGT STREKNING</span><h2>${esc(r.name)}</h2><span class="chip">${esc(accessLabel[r.access])}</span><span class="chip">${rank.rule.open?'Modellprioritet '+rank.score+'/100':'Fisket må avklares / utenfor sesong'}</span><p>${esc(r.description)}</p><p><b>Arbeidsforslag:</b> ${esc(r.tactic)}</p><div class="selected-actions"><button data-focus="${r.id}">${loc?'Vis utgangspunkt på kart':'Finn kildeomtalt utgangspunkt'}</button>${loc?`<button class="secondary" data-nav="${r.id}">Naviger til utgangspunkt</button>`:''}</div><p class="source-details" id="placeResult">${loc?esc(loc.notice||loc.label||'Områdereferanse - ikke nøyaktig fiskehøl.'):'Kildene og kartoppslaget må kunne stedfeste området. Ukjente punkter plasseres ikke vilkårlig.'}</p><div class="notice good-note"><b>Det kildene foreslår</b><p>${esc(target.text)}</p>${sourceLinks(target.sources)}</div>${first?`<div class="lure-pick"><img class="zoomable-lure" src="${first.image}" alt="${esc(first.name)}" tabindex="0" role="button"><div><span class="own-tag">NÅRMEST I DIN EGEN ESKE</span><b>${esc(first.name)}</b><p>${esc(first.why)}</p><small>${esc(first.matchCaveat)}</small></div></div><div class="alternatives">${lures.slice(1).map(l=>`<article class="alternative"><img class="zoomable-lure" tabindex="0" role="button" src="${l.image}" alt="${esc(l.name)}"><b>${esc(l.name)}</b><small>${esc(M.methodLabel[l.family])} - alternativ</small></article>`).join('')}</div><p class="source-details">Matchen sammenligner type/farge, ikke sannsynlighet for fangst. Farge og form fra foto er ikke bevis for modell, lengde eller flyteevne.</p>`:'<p class="muted">Mark omtales i kildene. Ingen markfoto legges inn som om det var fra slukesken din.</p>'}<p><b>Teknikkforslag:</b> ${esc(M.tactic(first?.family||'worm',ctx.flow))}</p>${rank.reasons.length?`<p class="source-details"><b>Modellens begrunnelse:</b> ${esc(rank.reasons.join('. '))}. ${rank.weatherApplied?'Timevarsel brukes som et svakt tillegg.':'Vær for valgt tidspunkt mangler; ingen oppdiktede værverdier brukes.'}</p>`:''}${sourceLinks(r.sources)}`;
}
function initMap(){if(!window.L){$('map').innerHTML='<p class="notice">Kartbiblioteket mangler. Kjør npm install i prosjektet / deploy på Render. Guiden er fortsatt tilgjengelig.</p>';return;}
 const c=Array.isArray(ui.center)&&ui.center.length===2&&ui.center.every(M.finite)?ui.center:guide.map.center;
 map=L.map('map',{zoomControl:true}).setView(c,Number.isFinite(ui.zoom)?ui.zoom:guide.map.zoom);
 const opts={maxZoom:19,updateWhenIdle:true,keepBuffer:1};
 layers.standard=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{...opts,attribution:'&copy; OpenStreetMap-bidragsytere'});
 layers.topo=L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png',{...opts,attribution:'&copy; Kartverket (CC BY 4.0)'});
 layers.satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{...opts,attribution:'Tiles &copy; Esri'});
 const selected=layers[$('mapStyle').value]||layers.topo;selected.addTo(map);
 let errors=0;Object.values(layers).forEach(l=>{l.on('tileerror',()=>{if(++errors>=3&&map.hasLayer(l)&&l!==layers.standard){map.removeLayer(l);layers.standard.addTo(map);$('mapNotice').textContent='Valgt kartlag svarte ikke. Standardkart vises i stedet.';}});l.on('tileload',()=>errors=0);});
 pointLayer=L.layerGroup().addTo(map);placeLayer=L.layerGroup().addTo(map);focusLayer=L.layerGroup().addTo(map);trackLayer=L.polyline([],{color:'#38d477',weight:4,opacity:.9}).addTo(map);
 const el=document.querySelector('.map-wrap');new ResizeObserver(()=>map.invalidateSize({pan:false})).observe(el);
 map.on('dragstart',()=>{if(liveActive){follow=false;$('follow').hidden=false;}});
 map.on('moveend zoomend resize',()=>{saveUI();scheduleRiverPoints();});
 map.on('contextmenu',e=>{base={lat:e.latlng.lat,lon:e.latlng.lng};saveUI();render();setStatus('Manuell base satt.');});
 drawTrack();drawPlaces();drawBase();
}
function drawPlaces(){if(!map||!placeLayer||!guide)return;placeLayer.clearLayers();markers={};if($('placesToggle').getAttribute('aria-pressed')==='false')return;
 ranked().forEach((r,i)=>{const p=getLocation(r);if(!p)return;const icon=L.divIcon({className:'',html:`<div class="map-reference ${r.id===selectedId?'selected':''}">${i+1}</div>`,iconSize:[30,30],iconAnchor:[15,15]});const m=L.marker([p.lat,p.lon],{icon,title:r.name}).bindPopup(`<b>${esc(r.name)}</b><small>${esc(p.notice||p.label||'Utgangspunkt, ikke fiskehøl')}</small><button data-reach="${r.id}">Åpne fiskeguiden</button>`);m.on('click',()=>selectReach(r.id,false));m.addTo(placeLayer);markers[r.id]=m;});}
function drawBase(){if(!map)return;if(radiusLayer){map.removeLayer(radiusLayer);radiusLayer=null;}const b=currentBase(),radius=Number($('radius').value);$('setBase').textContent=base?'Base satt - fjern':'Sett base';$('setBase').setAttribute('aria-pressed',String(!!base));if(!b)return;radiusLayer=L.layerGroup().addTo(map);L.circleMarker([b.lat,b.lon],{radius:6,color:'#f2c94c',fillOpacity:.8}).addTo(radiusLayer);if(radius>0)L.circle([b.lat,b.lon],{radius,color:'#f2c94c',weight:1,dashArray:'6 6',fillOpacity:.025,interactive:false}).addTo(radiusLayer);}
function displayRiver(data){
 if(!map||!data?.features?.length)return;
 riverIndex=RP.createIndex(data);
 if(riverLayer)map.removeLayer(riverLayer);
 riverLayer=L.geoJSON(data,{style:()=>({color:'#56b5ff',weight:4,opacity:.85}),onEachFeature:(f,l)=>l.on('click',e=>{
   const q=RP.nearest(riverIndex,{lat:e.latlng.lat,lon:e.latlng.lng},200);
   if(q){selectedRiverPoint=q;++selectionGeneration;renderSelected();renderRules();focusLayer.clearLayers();L.circleMarker([q.lat,q.lon],{radius:16,color:'#f2c94c',weight:2,interactive:false}).addTo(focusLayer);setStatus('Valgt punkt p\u00e5 elvelinja. Se sluk og r\u00e5d i panelet.');refreshWeather();scheduleRiverPoints();}
 })});
 if($('riverToggle').getAttribute('aria-pressed')!=='false')riverLayer.addTo(map);
 scheduleRiverPoints();
}
function loadRiver(){
 if(riverLoadingJob)return riverLoadingJob;
 riverLoadError=null;
 riverLoadingJob=(async()=>{
  const old=riverData||read(KEYS.river);
  if(old?.features&&!riverIndex){riverData={...old,stale:true};displayRiver(riverData);}
  try{const data=await fetchData('/api/river',{timeout:65000,cacheKey:KEYS.river});if(data.available===false)throw new Error(data.error);riverData=data;displayRiver(data);}
  catch(e){riverLoadError='Elvedata kunne ikke hentes. Trykk Pr\u00f8v igjen. Ingen punkter tegnes p\u00e5 gjettede posisjoner.';if(riverIndex?.segments.length){riverData={...riverData,stale:true};scheduleRiverPoints();}else{$('mapNotice').textContent='Elvedata kunne ikke hentes. Ingen punkter tegnes p\u00e5 gjettede posisjoner. Trykk Pr\u00f8v igjen.';$('riverPointSummary').textContent=$('mapNotice').textContent;}}
  finally{riverLoadingJob=null;}
 })();return riverLoadingJob;
}
async function resolvePlace(r){if(getLocation(r))return getLocation(r);if(pendingPlaces.has(r.id))return pendingPlaces.get(r.id);const job=(async()=>{try{const j=await fetchData('/api/place?id='+encodeURIComponent(r.id),{timeout:35000});if(!j.available||![j.lat,j.lon].every(M.finite))throw new Error(j.error||'Stedet er ikke entydig i kartkilden.');places[r.id]=j;write(KEYS.places,places);drawPlaces();return j;}finally{pendingPlaces.delete(r.id);}})();pendingPlaces.set(r.id,job);return job;}
async function warmPlaces(){const targets=guide.reaches.filter(r=>r.lookup);let next=0;async function worker(){while(next<targets.length){const r=targets[next++];try{await resolvePlace(r);}catch{} }}await Promise.all([worker(),worker()]);render();refreshWeather();}
function pauseFollowing(){if(liveActive){follow=false;$('follow').hidden=false;}}
async function selectReach(id,focus=true){const r=guide.reaches.find(r=>r.id===id);if(!r)return;selectedRiverPoint=null;selectedId=id;focusLayer?.clearLayers();render();if(focus)await focusReach(id);else refreshWeather();}
async function focusReach(id){const r=guide.reaches.find(r=>r.id===id);if(!r)return;const seq=++selectionGeneration;pauseFollowing();const node=$('placeResult');if(node)node.textContent='Finner utgangspunktet i kartkilden ...';
 try{const p=await resolvePlace(r);if(seq!==selectionGeneration||selectedId!==id)return;
  if(map){map.stop();map.setView([p.lat,p.lon],15,{animate:false});focusLayer.clearLayers();L.circleMarker([p.lat,p.lon],{radius:20,color:'#f2c94c',weight:2,fillOpacity:.03}).bindTooltip(r.name,{direction:'top'}).addTo(focusLayer);markers[id]?.openPopup();if(window.innerWidth<1000)document.querySelector('.map-wrap').scrollIntoView({behavior:'smooth',block:'start'});saveUI();}
  renderSelected();$('placeResult').textContent=p.notice||p.label||'Utgangspunkt vises. Ikke nøyaktig fiskehøl.';setStatus(r.name+' - utgangspunkt vist');refreshWeather();
 }catch(e){if(seq!==selectionGeneration||selectedId!==id)return;$('placeResult').textContent=e.message;setStatus('Kartplassering uavklart - kildeguiden er fortsatt tilgjengelig.');}
}
function weatherPoint(){const p=(liveActive&&gps)||selectedRiverPoint||getLocation(selectedReach());return p&&p.lat>=61.68&&p.lat<=62.06&&p.lon>=11.13&&p.lon<=11.66?p:{lat:61.775,lon:11.34};}
async function refreshWeather(force=false){if(!guide)return;const p=weatherPoint(),key=`${Math.round(p.lat*50)/50},${Math.round(p.lon*50)/50}`;if(weatherPending)return weatherPending;if(!force&&key===weatherKey&&Date.now()-lastWeatherCall<600000)return;weatherKey=key;lastWeatherCall=Date.now();
 weatherPending=(async()=>{try{weatherData=await fetchData('/api/weather?lat='+(Math.round(p.lat*50)/50)+'&lon='+(Math.round(p.lon*50)/50),{cacheKey:'mistra-weather-'+key});}catch(e){weatherData={available:false,error:'Vær kunne ikke hentes.'};}finally{weatherPending=null;render();const wanted=weatherPoint();const wantedKey=`${Math.round(wanted.lat*50)/50},${Math.round(wanted.lon*50)/50}`;if(wantedKey!==key)setTimeout(()=>refreshWeather(),0);}})();return weatherPending;}
function renderWeather(){const w=currentWeather();$('weather').innerHTML=w?[['Tid (Norge)',when(w.time)],['Lufttemperatur',fmt(w.temp)+' °C'],['Vind',fmt(w.wind)+' m/s'],['Vind fra',fmt(w.windDirection,0)+'°'],['Skydekke',fmt(w.cloud,0)+' %'],['Nedbør',fmt(w.rainMm)+' mm / '+(w.rainPeriodH||'?')+' t']].map(([l,v])=>`<div class="weather-item"><span>${l}</span><strong>${v}</strong></div>`).join(''):'<p class="muted span-all">Ingen timeprognose for valgt tidspunkt. Steds- og sesongguiden brukes uten værverdier.</p>';
 $('weatherNote').textContent=weatherData?.available?`${weatherData.stale?'Tidligere lagret varsel. ':''}MET-kilde hentet ${when(weatherData.fetchedAt)}. Punkt ${fmt(weatherData.lat,3)}, ${fmt(weatherData.lon,3)}. Lufttemperatur er ikke vanntemperatur.`:(weatherData?.error||'Henter MET-prognose ...');
 const reach=selectedReach();const windows=(weatherData?.series||[]).filter(x=>+new Date(x.time)>=Date.now()&&+new Date(x.time)<Date.now()+36*3600000).filter(x=>M.season(reach.section,x.time).open).map(x=>({time:x.time,...M.rankReach(reach,x.time,$('goal').value,x,observations())})).sort((a,b)=>b.score-a.score).filter((x,i,a)=>a.slice(0,i).every(y=>Math.abs(+new Date(y.time)-+new Date(x.time))>=3*3600000)).slice(0,3);
 $('forecastWindows').innerHTML=windows.length?'<p class="source-details"><b>Modellens tidsvinduer (ikke bitegaranti)</b></p>'+windows.map(x=>`<div class="forecast-row"><span>${when(x.time)}</span><span>${x.score}/100</span><button class="secondary" data-time="${x.time}">Velg</button></div>`).join(''):'';
}
function metric(label,p,unit){if(!p)return `<div class="metric"><span>${label}</span><strong>Ingen data</strong></div>`;const age=(Date.now()-+new Date(p.time))/3600000;return `<div class="metric"><span>${label}</span><strong>${fmt(p.value,unit==='m'?3:2)} ${unit}</strong><small>${when(p.time)}${age>6?' - eldre enn 6 timer':''}</small></div>`;}
function renderHydro(){const d=hydroData;if(!d?.available){$('hydrology').innerHTML=`<p class="notice">${esc(d?.error||'NVE-data er ikke tilgjengelig.')}</p><p class="source-details">Appen fungerer uten nøkkel, men automatiske NVE-målinger krever gratis nøkkel i serverens NVE_API_KEY. Sildre-lenken nedenfor fungerer uavhengig av dette.</p>`;$('flowChart').innerHTML='';return;}
 const tr=d.trend3h,rapid=tr&&M.finite(tr.percent)&&tr.percent>30;const age=Date.now()-+new Date(d.discharge?.at(-1)?.time||0);$('hydrology').innerHTML=`${d.stale?'<p class="notice">Lagrede målinger: oppdatering feilet. Kontroller tidsstemplene.</p>':''}<div class="hydro-grid">${metric('Vannføring - 2.267.0',d.discharge?.at(-1),'m3/s')}${metric('Vannstand / referansenivå',d.stage?.at(-1),'m')}${metric('Vanntemperatur - 2.695.0',d.temperature?.at(-1),'°C')}<div class="metric"><span>Endring siste 3 timer</span><strong>${tr?(tr.delta>=0?'+':'')+fmt(tr.delta,2)+' m3/s':'Ukjent'}</strong><small>${tr?when(tr.from)+' - '+when(tr.to):'Mangler sammenlignbare målinger'}</small></div></div>${rapid&&age<6*3600000?'<p class="notice">Appvarsel: vannføringen har økt over 30 % på 3 timer. Dette er en forsiktig modellgrense, ikke et offisielt flomvarsel. Hold avstand fra utsatte bredder.</p>':''}<p class="source-details">NVE HydAPI, hentet ${when(d.fetchedAt)}. Sanntidsmålingene kan være ukontrollerte.</p>`;
 const pts=d.discharge||[];if(pts.length<2){$('flowChart').innerHTML='';return;}const t0=+new Date(pts[0].time),t1=+new Date(pts.at(-1).time),lo=Math.min(...pts.map(p=>p.value)),hi=Math.max(...pts.map(p=>p.value));const xy=pts.map(p=>(38+(+new Date(p.time)-t0)/Math.max(1,t1-t0)*340).toFixed(1)+','+(148-(p.value-lo)/Math.max(.01,hi-lo)*117).toFixed(1)).join(' ');
 $('flowChart').innerHTML=`<svg class="flow-chart" viewBox="0 0 400 180" role="img" aria-label="NVE vannføring siste tre døgn"><line x1="38" y1="150" x2="378" y2="150" stroke="currentColor" opacity=".35"/><text x="2" y="33">${fmt(hi)}</text><text x="2" y="149">${fmt(lo)}</text><text x="38" y="172">${when(pts[0].time)}</text><text x="270" y="172">${when(pts.at(-1).time)}</text><text x="38" y="15">Vannføring (m3/s)</text><polyline points="${xy}"/></svg>`;
}
async function refreshHydro(){try{hydroData=await fetchData('/api/hydrology',{timeout:28000,cacheKey:'mistra-hydrology-v1'});}catch(e){hydroData={available:false,error:'NVE-målinger kunne ikke hentes.'};}renderHydro();}
function renderTackle(){const families=M.methodLabel;$('tackleBox').innerHTML=catalog.map(l=>{const o=lureOverrides[l.id]||{};return `<article class="lure-edit"><img class="zoomable-lure" tabindex="0" role="button" src="${l.image}" alt="${esc(l.name)}"><div><b>${esc(l.name)}</b><small class="source-details">${esc(families[l.family])}${l.weightG?' - synlig merking '+l.weightG+' g':''}</small><div class="obs-grid"><label class="field"><span>Din målte lengde (cm)</span><input type="number" min="1" max="40" step=".1" data-lure-length="${l.id}" value="${M.finite(o.lengthCm)?o.lengthCm:''}" placeholder="Ukjent"></label><label class="field"><span>Din bekreftede flyteevne</span><select data-lure-buoyancy="${l.id}">${[['unknown','Ukjent'],['floating','Flytende'],['sinking','Synkende'],['suspending','Suspenderende']].map(([v,t])=>`<option value="${v}" ${(o.buoyancy||'unknown')===v?'selected':''}>${t}</option>`).join('')}</select></label></div></div></article>`;}).join('');}
function renderGuide(){$('guide').innerHTML=guide.strategy.map(s=>`<article class="source-entry"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>${sourceLinks(s.sources)}</article>`).join('');$('sources').innerHTML=guide.sources.map(s=>`<article class="source-entry"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><p>${esc(s.summary)}</p><small>${esc(s.kind)} Kontrollert ${esc(s.checked)}.</small></article>`).join('');}
function showLure(src,caption){$('lureViewerImage').src=src;$('lureViewerImage').alt=caption;$('lureViewerCaption').textContent=caption;const d=$('lureViewer');if(!d.open){history.pushState({mistraLure:true},'');viewerHistory=true;d.showModal();}}
function renderLog(){$('catchList').innerHTML=logs.slice(0,8).map(x=>`<div class="catch-row"><b>${esc(x.place)}</b> - ${x.result==='catch'?'Fangst':'Ingen fangst'}${x.length?' - '+esc(x.length)+' cm':''}<br>${when(x.time)} - ${esc(x.note||'')}</div>`).join('')||'<p class="source-details">Ingen turer lagret.</p>';}
function download(name,data,mime){const url=URL.createObjectURL(new Blob([data],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
// Live GPS ported from REV27 with stale-fix checks, track gaps and follow/pan separation.
function drawTrack(){if(!trackLayer)return;const segments=[];for(const p of track){if(p.segmentBreak||!segments.length)segments.push([]);segments.at(-1).push([p.lat,p.lon]);}trackLayer.setLatLngs(segments);}
function drawGps(){if(!map||!gps)return;const ll=[gps.lat,gps.lon];if(!gpsLayer)gpsLayer=L.circleMarker(ll,{radius:8,weight:3,color:'#fff',fillColor:'#38d477',fillOpacity:1}).addTo(map);else gpsLayer.setLatLng(ll);if(gpsAccuracy)map.removeLayer(gpsAccuracy);gpsAccuracy=L.circle(ll,{radius:gps.accuracy,color:'#38d477',weight:1,fillOpacity:.04,interactive:false}).addTo(map);if(follow)map.panTo(ll,{animate:false,noMoveStart:true});}
function liveHud(){const stale=!gps||Date.now()-gps.timestamp>45000;$('liveText').textContent=stale?'Venter på ferskt GPS-signal ...':`${M.finite(gps.speedKmh)?fmt(gps.speedKmh)+' km/t':'Fart ukjent'} - nøyaktighet +/-${fmt(gps.accuracy,0)} m${M.finite(gps.heading)?' - kurs '+fmt(gps.heading,0)+'°':''}`;}
async function acquireWake(){if(!liveActive||document.visibilityState!=='visible'||!navigator.wakeLock||wake)return;try{const w=await navigator.wakeLock.request('screen');if(!liveActive){await w.release();return;}wake=w;w.addEventListener('release',()=>{if(wake===w)wake=null;},{once:true});}catch{}}
function gpsSuccess(position){if(!liveActive)return;const p=M.gpsFix(position,lastFix);if(!p)return;gps=p;const first=!lastFix;lastFix=p;if(first&&map&&follow)map.setView([p.lat,p.lon],Math.max(map.getZoom(),15),{animate:false});
 if(p.accuracy<=75){const prev=track.at(-1);if(!prev||p.segmentBreak||M.distance(prev,p)>=Math.max(4,p.accuracy*.4)){track.push(p);if(track.length>12000)track.splice(0,1000);drawTrack();if(track.length%5===0)write(KEYS.track,track);}}
 drawGps();liveHud();drawBase();if(followNow)$('tripTime').value=localInput(new Date());const moved=M.distance(lastLivePoint,p);if(!lastLiveAnalysis||Date.now()-lastLiveAnalysis>=20000||(moved!==null&&moved>=60&&Date.now()-lastLiveAnalysis>=5000)){lastLiveAnalysis=Date.now();lastLivePoint=p;render();refreshWeather();}
}
function stopLive(message=true){liveActive=false;if(watchId!==null)navigator.geolocation?.clearWatch(watchId);watchId=null;lastFix=null;gps=null;$('live').classList.remove('live-active');$('live').textContent='Live';$('live').setAttribute('aria-pressed','false');$('liveHud').hidden=true;if(gpsAccuracy){map?.removeLayer(gpsAccuracy);gpsAccuracy=null;}if(gpsLayer){map?.removeLayer(gpsLayer);gpsLayer=null;}if(wake){wake.release().catch(()=>{});wake=null;}write(KEYS.track,track);drawBase();if(message)setStatus('Live stoppet. Sporet beholdes og kan eksporteres.');}
function startLive(){if(liveActive){stopLive();return;}if(!window.isSecureContext||!navigator.geolocation){setStatus('Live krever HTTPS (eller localhost) og posisjonstilgang.');return;}if(track.length&&!confirm('Starte nytt GPS-spor? Det forrige sporet erstattes. Eksporter det først dersom du vil beholde det.'))return;
 followNow=true;$('tripTime').value=localInput(new Date());track=[];write(KEYS.track,track);drawTrack();lastFix=null;gps=null;liveActive=true;follow=true;lastLiveAnalysis=0;lastLivePoint=null;$('live').textContent='LIVE PÅ';$('live').classList.add('live-active');$('live').setAttribute('aria-pressed','true');$('liveHud').hidden=false;$('follow').hidden=true;liveHud();acquireWake();
 try{watchId=navigator.geolocation.watchPosition(gpsSuccess,e=>{if(e.code===1){stopLive(false);setStatus('Posisjonstillatelse avslått. Tillat posisjon for nettstedet.');}else{$('liveText').textContent='GPS midlertidig utilgjengelig. Venter ...';}}, {enableHighAccuracy:true,maximumAge:1000,timeout:20000});}catch{stopLive(false);setStatus('Kunne ikke starte GPS. Sjekk nettlesertillatelsen.');}
}
async function init(){try{[guide,catalog]=await Promise.all([fetchData('/api/guide',{cacheKey:'mistra-guide-v1'}),fetchData('/data/lures.json')]);}catch{setStatus('Kunne ikke laste lokale appfiler. Last siden på nytt.');return;}
 $('tripTime').value=localInput(new Date());for(const id of ['goal','method','access','radius','mapStyle'])if(ui[id]&&[...$(id).options].some(o=>o.value===String(ui[id])))$(id).value=String(ui[id]);base=ui.base&&[ui.base.lat,ui.base.lon].every(M.finite)?ui.base:null;
 if(!Array.isArray(logs))logs=[];if(!Array.isArray(track))track=[];track=track.filter(p=>[p.lat,p.lon,p.timestamp].every(M.finite));
 initMap();renderGuide();renderTackle();renderLog();render();setStatus('Kildeguide klar - henter kart og målinger.');
 loadRiver();warmPlaces();refreshWeather();refreshHydro();
 refreshTimer=setInterval(()=>{if(document.visibilityState==='visible'){if(followNow)$('tripTime').value=localInput(new Date());refreshWeather();refreshHydro();render();}},600000);
 if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{});
}
$('live').onclick=startLive;$('follow').onclick=()=>{follow=true;$('follow').hidden=true;drawGps();};
$('locate').onclick=()=>{if(!navigator.geolocation){setStatus('GPS ikke tilgjengelig.');return;}navigator.geolocation.getCurrentPosition(p=>{base={lat:p.coords.latitude,lon:p.coords.longitude};map?.setView([base.lat,base.lon],15);saveUI();render();setStatus('GPS-base satt. Trykk Live for kontinuerlig følging.');},()=>setStatus('Posisjonen kunne ikke hentes. Tillat GPS for nettstedet.'),{enableHighAccuracy:true,timeout:20000});};
$('setBase').onclick=()=>{if(base)base=null;else if(map){const c=map.getCenter();base={lat:c.lat,lon:c.lng};}saveUI();render();};
$('showAll').onclick=()=>{pauseFollowing();if(map)map.fitBounds(guide.map.bounds,{padding:[18,18]});};
$('mapStyle').onchange=()=>{if(map){Object.values(layers).forEach(l=>{if(map.hasLayer(l))map.removeLayer(l);});(layers[$('mapStyle').value]||layers.topo).addTo(map);}saveUI();};
$('riverToggle').onclick=()=>{const on=$('riverToggle').getAttribute('aria-pressed')!=='true';$('riverToggle').setAttribute('aria-pressed',String(on));if(map&&riverLayer){if(on)riverLayer.addTo(map);else map.removeLayer(riverLayer);}else if(on)loadRiver();};
$('pointsToggle').onclick=()=>{const b=$('pointsToggle');b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'));scheduleRiverPoints();};
$('retryRiver').onclick=()=>loadRiver();
$('pointsShowAll').onclick=()=>$('showAll').click();
$('placesToggle').onclick=()=>{$('placesToggle').setAttribute('aria-pressed',String($('placesToggle').getAttribute('aria-pressed')!=='true'));drawPlaces();};
for(const id of ['goal','method','access','radius','flow','clarity'])$(id).onchange=()=>{saveUI();render();};
$('tripTime').onchange=()=>{followNow=false;if(!fromOsloInput($('tripTime').value)){setStatus('Ugyldig norsk dato/tid (eventuelt sommertidsovergang).');return;}render();};
$('now').onclick=()=>{followNow=true;$('tripTime').value=localInput(new Date());render();};
$('evening').onclick=()=>{followNow=false;const d=localInput(new Date()).slice(0,10)+'T19:00';$('tripTime').value=d;render();};
$('refreshData').onclick=()=>{refreshWeather(true);refreshHydro();loadRiver();};
function closeViewer(){if($('lureViewer').open)$('lureViewer').close();if(viewerHistory){viewerHistory=false;history.back();}}
$('closeLureViewer').onclick=closeViewer;$('lureViewer').onclick=e=>{if(e.target===$('lureViewer'))closeViewer();};$('lureViewer').addEventListener('cancel',e=>{e.preventDefault();closeViewer();});window.addEventListener('popstate',()=>{viewerHistory=false;if($('lureViewer').open)$('lureViewer').close();});
document.addEventListener('click',e=>{const img=e.target.closest('.zoomable-lure');if(img){showLure(img.src,img.alt);return;}const b=e.target.closest('button');if(!b)return;if(b.dataset.riverPoint)selectRiverPoint(b.dataset.riverPoint,true,true);if(b.dataset.riverDetails)selectRiverPoint(b.dataset.riverDetails,false,true);if(b.dataset.riverFocus)selectRiverPoint(b.dataset.riverFocus,true);if(b.dataset.reach)selectReach(b.dataset.reach);if(b.dataset.focus)focusReach(b.dataset.focus);if(b.dataset.hour){followNow=false;$('tripTime').value=localInput(Date.now()+Number(b.dataset.hour)*3600000);render();}if(b.dataset.time){followNow=false;$('tripTime').value=localInput(b.dataset.time);render();}if(b.dataset.nav){const p=getLocation(guide.reaches.find(r=>r.id===b.dataset.nav));if(p)window.open('https://www.google.com/maps/dir/?api=1&destination='+p.lat+','+p.lon,'_blank','noopener');}});
document.addEventListener('keydown',e=>{const img=e.target.closest('.zoomable-lure');if(img&&['Enter',' '].includes(e.key)){e.preventDefault();showLure(img.src,img.alt);}});
document.addEventListener('change',e=>{const id=e.target.dataset.lureLength||e.target.dataset.lureBuoyancy;if(!id)return;const old=lureOverrides[id]||{};if(e.target.dataset.lureLength){const x=Number(e.target.value);old.lengthCm=e.target.value!==''&&x>=1&&x<=40?x:null;}else old.buoyancy=e.target.value;lureOverrides[id]=old;write(KEYS.lures,lureOverrides);renderSelected();lastPointSignature='';scheduleRiverPoints();});
$('catchForm').onsubmit=e=>{e.preventDefault();if(!guide)return;const f=new FormData(e.target),r=selectedReach(),l=M.rankLures(catalog,context(r),lureOverrides)[0];logs.unshift({id:Date.now().toString(36),time:new Date().toISOString(),place:r.name,reachId:r.id,result:f.get('result'),length:f.get('length')||null,note:f.get('note')||'',lureId:l?.id||'worm',lureName:l?.name||'Mark',position:liveActive&&gps&&Date.now()-gps.timestamp<45000?{lat:gps.lat,lon:gps.lon,accuracy:gps.accuracy}:null,weather:currentWeather(),flowMeasurement:hydroData?.discharge?.at(-1)||null,observations:observations()});logs=logs.slice(0,1000);if(!write(KEYS.log,logs))setStatus('Enheten kunne ikke lagre. Eksporter backup nå.');else setStatus('Turen er lagret lokalt. Husk offisiell fangstrapport.');renderLog();e.target.reset();};
$('exportLog').onclick=()=>download('Mistra-min-backup.json',JSON.stringify({version:1,exportedAt:new Date().toISOString(),logs,lureOverrides},null,2),'application/json');
$('exportTrack').onclick=()=>{if(!track.length){setStatus('Ingen GPS-spor å eksportere.');return;}download('Mistra-GPS-spor.gpx',M.gpx(track),'application/gpx+xml');};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(liveActive){acquireWake();liveHud();}refreshWeather();}});
window.addEventListener('pagehide',()=>{write(KEYS.track,track);if(liveActive)stopLive(false);});
window.addEventListener('online',()=>{refreshWeather(true);refreshHydro();});window.addEventListener('offline',()=>setStatus('Offline: lokal guide og lagrede data. Bakgrunnskart kan mangle.'));
setInterval(()=>{if(liveActive)liveHud();},10000);
init();
