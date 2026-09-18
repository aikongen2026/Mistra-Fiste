'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const M=require('./public/model.js');
const ROOT=__dirname,PUBLIC=path.join(ROOT,'public');
const config=JSON.parse(fs.readFileSync(path.join(PUBLIC,'data/mistra.json'),'utf8'));
const cache=new Map(),pending=new Map();const CACHE_DIR=process.env.CACHE_DIR||path.join(ROOT,'.cache');
const UA=process.env.MET_USER_AGENT||'MistraFiske/1.0 (+https://www.inatur.no/fiske/5aca4566c9f22e00032850cc; personal fishing guide)';
function nowISO(){return new Date().toISOString();}
function diskRead(key){try{return JSON.parse(fs.readFileSync(path.join(CACHE_DIR,key+'.json'),'utf8'));}catch{return null;}}
function diskSave(key,value){try{fs.mkdirSync(CACHE_DIR,{recursive:true});const p=path.join(CACHE_DIR,key+'.json');fs.writeFileSync(p+'.tmp',JSON.stringify(value));fs.renameSync(p+'.tmp',p);}catch{}}
async function cached(key,ttl,fn,{disk=false,stale=true}={}){
 let old=cache.get(key)||(disk?diskRead(key):null);if(old&&Date.now()-old.at<ttl)return {...old.value,cached:true};
 if(pending.has(key))return pending.get(key);
 const job=(async()=>{try{const value=await fn();if(value.available!==false){const item={at:Date.now(),value};cache.set(key,item);if(disk)diskSave(key,item);if(cache.size>80)cache.delete(cache.keys().next().value);}else cache.set(key,{at:Date.now()-ttl+60000,value});return value;}catch(e){
 const value=stale&&old&&old.value&&old.value.available!==false?{...old.value,stale:true,warning:'Ny henting feilet; tidligere data vises.'}:{available:false,error:e.publicMessage||'Datakilden svarte ikke. Pr'+String.fromCharCode(248)+'v igjen senere.',fetchedAt:nowISO()};
 cache.set(key,{at:Date.now()-ttl+(e.status===429?180000:60000),value});return value;
}finally{pending.delete(key);}})();
 pending.set(key,job);return job;
}
async function getJSON(url,{key,method='GET',body,timeout=12000}={}){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
 try{const headers={'User-Agent':UA,Accept:'application/json'};if(key)headers['X-API-Key']=key;if(body)headers['Content-Type']='application/x-www-form-urlencoded';
 const r=await fetch(url,{headers,method,body,signal:c.signal});if(!r.ok){const e=new Error('upstream');e.status=r.status;e.publicMessage=r.status===429?'Datakilden begrenser forespørsler. Mellomlagrede data brukes der de finnes.':`Datakilden svarte HTTP ${r.status}.`;throw e;}
 const j=await r.json();if(j.error){const e=new Error('upstream data error');e.publicMessage='Karttjenesten avviste forespørselen.';throw e;}return j;}finally{clearTimeout(t);}
}
function parseWeather(j){return (j.properties?.timeseries||[]).map(x=>{const d=x.data?.instant?.details||{},n=x.data?.next_1_hours||x.data?.next_6_hours,period=x.data?.next_1_hours?1:6;return {time:x.time,temp:d.air_temperature??null,cloud:d.cloud_area_fraction??null,wind:d.wind_speed??null,windDirection:d.wind_from_direction??null,pressure:d.air_pressure_at_sea_level??null,rainMm:n?.details?.precipitation_amount??null,rainPeriodH:n?period:null};}).filter(x=>Number.isFinite(+new Date(x.time)));}
async function weather(lat=61.775,lon=11.34){lat=Math.round(lat*50)/50;lon=Math.round(lon*50)/50;return cached(`weather-${lat}-${lon}`,600000,async()=>{const url=`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;const j=await getJSON(url);const series=parseWeather(j);if(!series.length)throw new Error('empty');return {available:true,source:'MET Norway Locationforecast',lat,lon,fetchedAt:nowISO(),updatedAt:j.properties?.meta?.updated_at||null,series};});}
async function hydrology(){
 const key=process.env.NVE_API_KEY;if(!key)return {available:false,needsKey:true,source:'NVE HydAPI',stationId:'2.267.0',error:'Legg NVE_API_KEY i Render Environment for automatiske målinger.',url:'https://sildre.nve.no/station/2.267.0'};
 return cached('hydrology',600000,async()=>{
  const base='https://hydapi.nve.no/api/v1/Observations?';
  const [flow,temp]=await Promise.allSettled([
   getJSON(base+new URLSearchParams({StationId:'2.267.0',Parameter:'1000,1001',ResolutionTime:'60',ReferenceTime:'P3D/'}),{key}),
   getJSON(base+new URLSearchParams({StationId:'2.695.0',Parameter:'1003',ResolutionTime:'60',ReferenceTime:'P3D/'}),{key})]);
  if(flow.status==='rejected')throw flow.reason;
  const discharge=M.hydrateSeries(flow.value,'2.267.0',1001),stage=M.hydrateSeries(flow.value,'2.267.0',1000);
  const temperature=temp.status==='fulfilled'?M.hydrateSeries(temp.value,'2.695.0',1003):[];
  return {available:discharge.length>0||stage.length>0,source:'NVE HydAPI (ukontrollerte sanntidsdata)',stationId:'2.267.0',stationName:'Mistra bru',temperatureStationId:'2.695.0',fetchedAt:nowISO(),discharge,stage,temperature,trend3h:M.trend(discharge,3),trend24h:M.trend(discharge,24),error:!discharge.length?'Ingen vannføringsserie i siste tre døgn.':null,caveat:'Vannstand er relativ til stasjonens referanse, ikke elvedybde. Nedre målepunkt beskriver ikke strøm og vadedybde i alle høler.'};
 },{disk:true});
}
const inside=(p)=>p&&M.finite(p.lat)&&M.finite(p.lon)&&p.lat>=61.68&&p.lat<=62.06&&p.lon>=11.13&&p.lon<=11.66;
function parseNveFeatures(j){return (j.features||[]).flatMap(f=>{
 const paths=f.geometry?.paths||[];return paths.filter(p=>p.length>1&&p.every(c=>Array.isArray(c)&&inside({lat:c[1],lon:c[0]}))).map(p=>({type:'Feature',properties:{name:f.attributes?.elvenavn||'Mistra',source:'NVE ELVIS',id:String(f.attributes?.objectid||f.attributes?.strekninglnr||'')},geometry:{type:'LineString',coordinates:p.map(c=>[c[0],c[1]])}}));});}
async function riverGeometry(){return cached('river-mistra-v1',7*86400000,async()=>{
 const features=[];let incomplete=false;
 for(let page=0;page<10;page++){
  const q=new URLSearchParams({where:"elvenavn = 'Mistra'",outFields:'objectid,elvenavn,strekninglnr',returnGeometry:'true',outSR:'4326',resultOffset:String(page*2000),resultRecordCount:'2000',orderByFields:'objectid',f:'json'});
  const j=await getJSON('https://kart.nve.no/enterprise/rest/services/Elvenett1/MapServer/2/query?'+q,{timeout:18000});features.push(...parseNveFeatures(j));
  if(!j.exceededTransferLimit){incomplete=false;break;}incomplete=true;
 }
 if(!features.length)throw new Error('no geometry');
 return {available:true,type:'FeatureCollection',features,source:'NVE ELVIS / Elvenett1, NLOD',fetchedAt:nowISO(),incomplete,description:'Digital elvelinje. Ikke dybder, fiskehøler eller juridiske fiskekortgrenser.'};
 },{disk:true});}
function normalize(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ø/g,'o').replace(/[^a-z0-9]+/g,' ');}
function parseAddress(j,expected){const q=normalize(expected),n=q.match(/\d+/)?.[0];const list=(j.adresser||[]).filter(a=>inside(a.representasjonspunkt)&&(!a.kommunenavn||a.kommunenavn.toLowerCase()==='rendalen')&&(!n||String(a.nummer)===n||String(a.adressetekst).includes(n))&&normalize(a.adressetekst||'').startsWith(q));if(list.length!==1)return null;const a=list[0];return {lat:a.representasjonspunkt.lat,lon:a.representasjonspunkt.lon,name:a.adressetekst,source:'Kartverket adresse-API',precision:'address'};}
function parseName(j){const rows=(j.navn||[]).filter(n=>inside(n.representasjonspunkt)&&(!n.kommuner?.length||n.kommuner.some(k=>k.kommunenavn==='Rendalen')));if(!rows.length)return null;const first=rows[0];if(rows.some(x=>M.distance({lat:first.representasjonspunkt.lat,lon:first.representasjonspunkt.lon},x.representasjonspunkt)>300))return null;return {...first.representasjonspunkt,name:first.skrivemåte||first.stedsnavn||'Kartreferanse',source:'Kartverket SSR',precision:'place'};}
async function locatePlace(id){const item=config.reaches.find(r=>r.id===id);if(!item)return {available:false,error:'Ukjent sted.'};
 if(item.anchor)return {available:true,...item.anchor,name:item.name,source:item.anchor.source,notice:item.anchor.label};
 if(!item.lookup)return {available:false,error:'Kilden stedfester ikke denne hølen. Ingen gjettet kartpin er lagt inn.'};
 return cached('place-'+id,30*86400000,async()=>{
  let result=null;
  if(item.lookup.type==='address'){
   const q=new URLSearchParams({sok:item.lookup.query,kommunenavn:'Rendalen',treffPerSide:'10',utkoordsys:'4258'});
   result=parseAddress(await getJSON('https://ws.geonorge.no/adresser/v1/sok?'+q),item.lookup.query);
  }else{
   for(const name of item.lookup.queries){const q=new URLSearchParams({sok:name,knr:'3424',treffPerSide:'20',utkoordsys:'4258'});result=parseName(await getJSON('https://ws.geonorge.no/stedsnavn/v1/navn?'+q));if(result)break;}
  }
  if(!result)return {available:false,error:'Fant ikke en entydig kartreferanse innen Mistra-området. Bruk kildekartet; stedet plasseres ikke vilkårlig.'};
  return {available:true,...result,fetchedAt:nowISO(),notice:'Utgangspunkt/områdereferanse, ikke dokumentert fiskehøl. Privat adkomst må avklares.'};
 },{disk:true});
}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function serve(req,res){const u=new URL(req.url,'http://localhost');let decoded;try{decoded=decodeURIComponent(u.pathname);}catch{return send(res,400,{error:'Ugyldig sti'});}
 let root=PUBLIC,p=decoded==='/'?'index.html':decoded.slice(1);
 if(p.startsWith('vendor/leaflet/')){root=path.join(ROOT,'node_modules/leaflet/dist');p=p.slice('vendor/leaflet/'.length);}
 const f=path.resolve(root,p);if(f!==root&&!f.startsWith(root+path.sep))return send(res,403,{error:'Forbudt'});
 fs.readFile(f,(e,b)=>{if(e)return send(res,404,{error:'Filen finnes ikke. Har npm install blitt kjørt?'});
 const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'}[path.extname(f)]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':type,'Cache-Control':/\.html$|sw\.js$/.test(f)?'no-store':'public, max-age=3600','X-Content-Type-Options':'nosniff'});res.end(b);});}
function createServer(){return http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');
 if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Kun GET støttes.'});
 if(u.pathname==='/api/health')return send(res,200,{ok:true,app:config.app,version:config.version,basedOn:config.basedOn,nveConfigured:!!process.env.NVE_API_KEY});
 if(u.pathname==='/api/weather'){const la=u.searchParams.get('lat'),lo=u.searchParams.get('lon');const lat=la===null?61.775:Number(la),lon=lo===null?11.34:Number(lo);if(!inside({lat,lon}))return send(res,400,{error:'Værpunkt må ligge i Mistra-området.'});return send(res,200,await weather(lat,lon));}
 if(u.pathname==='/api/hydrology')return send(res,200,await hydrology());
 if(u.pathname==='/api/river')return send(res,200,await riverGeometry());
 if(u.pathname==='/api/place')return send(res,200,await locatePlace(u.searchParams.get('id')));
 if(u.pathname==='/api/guide')return send(res,200,config);
 serve(req,res);
 }catch{return send(res,500,{available:false,error:'Intern feil. Grunnkart og lokal guide kan fortsatt brukes.'});}});}
if(require.main===module){const port=Number(process.env.PORT||3000);createServer().listen(port,'0.0.0.0',()=>console.log('Mistra Fiske '+config.version+' - port '+port));}
module.exports={createServer,parseWeather,parseAddress,parseName,parseNveFeatures,inside,weather,hydrology,riverGeometry,locatePlace};
