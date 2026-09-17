/* Mistra-specific decision support. Shared by browser and Node tests.
   Scores are explicit heuristics, not fitted catch probabilities. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MistraModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function parts(value){const d=new Date(value);if(!Number.isFinite(+d))return null;const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));return {year:+p.year,month:+p.month,day:+p.day,hour:+p.hour,minute:+p.minute};}
 function season(section,date){
  const p=parts(date); if(!p)return {state:'unknown',open:false,label:'Ugyldig dato',detail:'Velg en gyldig dato.'};
  const n=p.month*100+p.day;
  if(p.year!==2026)return {state:'unconfirmed',open:false,label:'Bekreft sesong '+p.year,detail:'Innlagte regler er kontrollert for publiserte 2026-tilbud. Ikke bruk dem som bekreftelse for et annet år.'};
  if(section==='boundary'||section==='unknown')return {state:'confirm',open:false,label:'Avklar kortområde',detail:'Kortgrensen må bekreftes på stedet. Elvekartet er ikke juridisk grensekart.'};
  if(section==='north'||section==='tributary'){
   if(n===901&&section==='north')return {state:'confirm',open:false,label:'1. september: avklar',detail:'Nordre-kortets produkt slutter 31. august, mens regelteksten sier 1. september. Avklar med Østagrenda.'};
   const end=section==='tributary'?825:831;
   const open=n>=601&&n<=end;
   return {state:open?'open':'closed',open,label:open?'Nordre-kort: sesong':'Utenfor nordre sesong',detail:section==='tributary'?'Sidebekker: siste fiskedag 25. august. Veslemistra ovenfor Skånsjøen er stengt.':'Eget kort for Nordre Mistra. Produktperiode 1. juni-31. august; sjøer inngår ikke.'};
  }
  if(n<501||n>915)return {state:'closed',open:false,label:'Ørretfisket er stengt',detail:'Publisert ørretsesong for Mistra Elvelag er 1. mai til og med 15. september.'};
  return {state:'open',open:true,label:n>=820?'Sesong - over 40 cm ut':'Sesong - uttaksgrense',detail:n>=820?'Minstemål 30 cm. Fra 20. august skal all fisk over 40 cm settes ut.':'Minstemål 30 cm. Til og med 19. august: høyst 1 fisk over 40 cm per fisker/døgn.'};
 }
 function distance(a,b){if(!a||!b||![a.lat,a.lon,b.lat,b.lon].every(finite))return null;const r=Math.PI/180,dl=(b.lat-a.lat)*r,dn=(b.lon-a.lon)*r;const h=Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
 function nearestWeather(series,date){const t=+new Date(date);if(!Array.isArray(series)||!finite(t))return null;let best=null,dt=Infinity;for(const x of series){const e=Math.abs(+new Date(x.time)-t);if(e<dt){dt=e;best=x;}}return dt<=95*60000?best:null;}
 function conditionsFrom(weather,manual={}){return {cloud:finite(weather?.cloud)?weather.cloud:null,wind:finite(weather?.wind)?weather.wind:null,clarity:manual.clarity||'unknown',flow:manual.flow||'unknown',waterTemp:finite(manual.waterTemp)?manual.waterTemp:null};}
 function rankReach(reach,date,goal='big',weather=null,manual={}){
  const rule=season(reach.section,date),p=parts(date),c=conditionsFrom(weather,manual);let score=48;const reasons=[];
  if(p&&reach.months.includes(p.month)){score+=12;reasons.push('Sesongprofil fra kildeomtale/modell');}
  if(goal==='big'&&reach.habitat==='pools'){score+=10;reasons.push('Søk etter storørret i kulp-/strykstrekning');}
  if(goal==='numbers'&&reach.habitat==='quiet'){score+=8;reasons.push('Roligere partier prioriteres for systematisk søk');}
  if(p&&(p.hour>=18||p.hour<9)){score+=4;reasons.push('Modell: dempet lys prioriteres forsiktig');}
  if(finite(c.cloud)&&c.cloud>60)score+=2;
  if(c.flow==='high'&&['difficult','unknown'].includes(reach.access)){score-=15;reasons.push('Høy vannføring + krevende/ukjent adkomst trekker ned');}
  if(c.flow==='low'&&reach.habitat==='quiet'){score-=3;reasons.push('Lav vannføring: forsiktig framferd');}
  if(reach.id==='holsbu'){score-=10;reasons.push('Kun historisk omtale; sted ikke bekreftet');}
  if(reach.access==='easier'&&goal==='numbers')score+=3;
  return {score:clamp(score,20,85),rule,reasons,sourceLevel:reach.id==='holsbu'||reach.id==='balstad'?'Historisk omtale':'Kildeomtalt strekning',weatherApplied:!!weather};
 }
 const methodLabel={all:'Alle metoder',wobbler:'Wobbler',spoon:'Sluk',spinner:'Spinner',fly:'Flue',worm:'Mark',vibration:'Vibrasjonsagn'};
 function sourceTarget(ctx){
  if(ctx.method==='worm')return {text:'Aktivt markfiske; tilpass søkke etter strøm og dybde. Ikke faststående redskap.',sources:['hooked','rules-pdf']};
  if(ctx.method==='fly'||(ctx.reach.habitat==='quiet'&&ctx.goal==='numbers'&&ctx.method==='all'))return {text:'Flue/streamer i roligere partier. Se etter vak og mattilgang; dette er ikke en flue-only-regel.',sources:['inatur-guide','rendalen']};
  if(ctx.method==='spoon')return {text:'Metallsluk når du trenger rekkevidde eller dypere søk. Fishspot nevner 20 g Møresild som eksempel, ikke som fast Mistra-fasit.',sources:['fishspot']};
  if(ctx.method==='spinner')return {text:'Spinner er et generelt søkealternativ. Det er ikke funnet et kildebekreftet universelt spinnermerke eller gramvalg for Mistra.',sources:[]};
  return {text:ctx.clarity==='coloured'?'Prøv en synlig grønn/oransje wobbler når du selv ser farget vann. Hooked nevner 9 cm. Kontroller stabil gang i strømmen.':'Begynn med en naturfarget wobbler omtrent 7-11 cm. Hooked oppgir også 9 cm grønn/grønn-oransje som personlig favoritt.',sources:['hooked','fishspot']};
 }
 function rankLures(catalog,ctx,overrides={}){
  if(ctx.method==='worm')return [];
  const p=parts(ctx.date),night=p&&(p.hour>=21||p.hour<6);
  const rows=catalog.map(original=>{
   const own=overrides[original.id]||{};const l={...original,lengthCm:finite(own.lengthCm)?own.lengthCm:original.lengthCm,buoyancy:['floating','sinking','suspending'].includes(own.buoyancy)?own.buoyancy:original.buoyancy};
   if(ctx.method!=='all'&&l.family!==ctx.method)return null;
   let score=42;const why=[];
   if(l.family==='wobbler'){score+=20;why.push('Wobbler er direkte omtalt i Mistra-kildene');}
   if(l.family==='fly'&&ctx.reach.habitat==='quiet'){score+=ctx.goal==='numbers'?24:15;why.push('Fluealternativ for roligere strekning');}
   if(l.family==='spinner'&&ctx.goal==='numbers'){score+=14;why.push('Generelt søkealternativ');}
   if(l.family==='spoon'&&ctx.flow==='high'){score+=12;why.push('Metallsluk kan gi et alternativt vannlag; ingen dybdegaranti');}
   if(l.family==='vibration'){score-=16;why.push('Lik farge er ikke lik gange: dette er uten skje');}
   if(ctx.clarity==='clear'&&l.tags.includes('natural')){score+=9;why.push('Naturfarge som startvalg i observert klart vann');}
   if(ctx.clarity==='coloured'&&l.tags.includes('contrast')){score+=9;why.push('Synlig alternativ i observert farget vann');}
   if(ctx.clarity==='coloured'&&l.tags.includes('warm'))score+=4;
   if(ctx.clarity==='unknown'&&l.tags.includes('natural'))score+=4;
   if(l.tags.includes('green')&&l.family==='wobbler'&&ctx.reach.habitat==='pools'){score+=7;why.push('Grønntone nær Hooked-favoritten');}
   if(night&&l.tags.includes('dark')){score+=8;why.push('Mørkere silhuett som et erfaringsbasert alternativ');}
   if(l.family==='wobbler'&&finite(l.lengthCm)){if(l.lengthCm>=7&&l.lengthCm<=11){score+=6;why.push('Din målte lengde samsvarer med 7-11 cm');}else{score-=6;why.push('Din målte lengde avviker fra kildenes 7-11 cm');}}
   return {...l,match:clamp(score,0,95),why:why.join('. '),matchCaveat:finite(l.lengthCm)?'Lengde fra din registrering. Sjekk flyteevne/gange.':'Kun type-/fargematch. Lengde og flyteevne er ukjent.'};
  }).filter(Boolean).sort((a,b)=>b.match-a.match||a.id.localeCompare(b.id));
  if(!rows.length)return rows;
  // Keep the true top choice. Alternatives seek different presentations only within a small score gap.
  const picked=[rows[0]],rest=rows.slice(1);
  while(picked.length<4&&rest.length){const top=rest[0].match;let i=rest.findIndex(l=>l.match>=top-6&&!picked.some(p=>p.family===l.family));if(i<0)i=0;picked.push(rest.splice(i,1)[0]);}
  return picked;
 }
 function tactic(family,flow){const base={wobbler:'Kontroller gangen ved land. Fisk strømkanten med jevn kontakt, korte retningsendringer og tilpassede pauser. Flyteevne og arbeidsdybde må sjekkes på ditt agn.',spoon:'Søk et vannlag om gangen. Begynn forsiktig med synketid, hold kontakt og stopp før du setter deg fast. Ingen fast sekund-til-meter-tabell brukes.',spinner:'Start bladet kontrollert og finn laveste fart som gir stabil rotasjon. Fisk korte kast ved strømkanter før du øker rekkevidden.',fly:'Ved vak: identifiser insektet før fluevalg. De fotograferte fluene her er streamere, ikke bekreftede tørrfluer. Fisk kontrollerte trekk/sving og varier presentasjonen.',worm:'Fisk mark aktivt og med kontinuerlig kontroll. Bruk bare nødvendig søkke, og vurder kunstagn når stor fisk skal gjenutsettes.',vibration:'Dette er et vibrasjonsagn uten skje. Ikke behandle det som en flytende minnow selv om fargen ligner. Kontroller gangen grunt.'};return (base[family]||base.wobbler)+(flow==='high'?' Høy vannføring: fisk bare fra trygg posisjon på land.':'');}
 function trend(series,hours){if(!Array.isArray(series)||series.length<2)return null;const last=series.at(-1),target=+new Date(last.time)-hours*3600000;let best=null,delta=Infinity;for(const p of series){const d=Math.abs(+new Date(p.time)-target);if(d<delta){delta=d;best=p;}}if(!best||delta>75*60000||+new Date(best.time)>=+new Date(last.time))return null;return {delta:last.value-best.value,percent:best.value>0?(last.value-best.value)/best.value*100:null,hours,from:best.time,to:last.time};}
 function hydrateSeries(payload,station,param){
  const data=Array.isArray(payload?.data)?payload.data:[];
  const found=data.filter(s=>String(s.stationId)===station&&Number(s.parameter)===param);
  const points=found.flatMap(s=>Array.isArray(s.observations)?s.observations:[]).filter(x=>finite(x.value)&&Number.isFinite(+new Date(x.time))).map(x=>({time:new Date(x.time).toISOString(),value:x.value,quality:x.quality??null,correction:x.correction??null}));
  const seen=new Map(points.map(p=>[p.time,p]));return [...seen.values()].sort((a,b)=>+new Date(a.time)-+new Date(b.time));
 }
 function gpsFix(position,previous,now=Date.now()){
  const c=position?.coords||{},timestamp=Number(position?.timestamp);
  if(![c.latitude,c.longitude,c.accuracy,timestamp].every(finite)||c.latitude < -90||c.latitude>90||c.longitude < -180||c.longitude>180||c.accuracy<0||now-timestamp>45000||timestamp>now+10000)return null;
  if(previous&&timestamp<=previous.timestamp)return null;
  const p={lat:c.latitude,lon:c.longitude,accuracy:c.accuracy,timestamp,speedKmh:finite(c.speed)&&c.speed>=0?c.speed*3.6:null,heading:finite(c.heading)&&c.heading>=0&&c.heading<360?c.heading:null};
  p.segmentBreak=!previous||timestamp-previous.timestamp>60000||c.accuracy>75||previous.accuracy>75;
  if(previous){const dt=(timestamp-previous.timestamp)/1000,d=distance(previous,p);if(dt>0&&d/dt>70){p.segmentBreak=true;p.speedKmh=null;}else if(p.speedKmh===null&&dt>=5&&c.accuracy<30&&previous.accuracy<30&&d>Math.max(c.accuracy,previous.accuracy)){p.speedKmh=d/dt*3.6;}}
  return p;
 }
 function gpx(points){const valid=points.filter(p=>[p.lat,p.lon,p.timestamp].every(finite));let body='',open=false;for(const p of valid){if(p.segmentBreak&&open){body+='</trkseg>';open=false;}if(!open){body+='<trkseg>';open=true;}body+=`<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"><time>${new Date(p.timestamp).toISOString()}</time></trkpt>`;}if(open)body+='</trkseg>';return '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Mistra Fiske" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Mistra - mitt GPS-spor</name>'+body+'</trk></gpx>';}
 return {finite,clamp,parts,season,distance,nearestWeather,conditionsFrom,rankReach,rankLures,methodLabel,sourceTarget,tactic,trend,hydrateSeries,gpsFix,gpx};
});
