'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mistra-test-'));process.env.CACHE_DIR=temp;
const S=require('../server'),nativeFetch=global.fetch;
let server,base;
test.before(async()=>{server=S.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{global.fetch=nativeFetch;delete process.env.NVE_API_KEY;await new Promise(r=>server.close(r));fs.rmSync(temp,{recursive:true,force:true});});
test.afterEach(()=>{global.fetch=nativeFetch;});
const request=p=>nativeFetch(base+p);
test('Health, guide and all entry records load locally',async()=>{
 const health=await (await request('/api/health')).json();assert.equal(health.ok,true);assert.equal(health.app,'Mistra Fiske');assert.equal(health.version,'1.0.1');
 const g=await (await request('/api/guide')).json();assert.equal(g.reaches.length,8);
});
test('No NVE key gives configuration status, never sample data',async()=>{
 delete process.env.NVE_API_KEY;const j=await(await request('/api/hydrology')).json();assert.equal(j.available,false);assert.equal(j.needsKey,true);assert.ok(!j.discharge);
});
test('Static frontend and all lure images are served with correct types',async()=>{
 const h=await request('/');assert.equal(h.status,200);assert.match(h.headers.get('content-type'),/text\/html/);assert.equal(h.headers.get('cache-control'),'no-store');
 const cat=await(await request('/data/lures.json')).json();for(const l of cat){const r=await request(l.image);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/jpeg');}
});
test('User coordinates cannot cause arbitrary external URL calls',async()=>{
 const r=await request('/api/weather?lat=0&lon=0');assert.equal(r.status,400);
 const j=await(await request('/api/place?id=arbitrary')).json();assert.equal(j.available,false);
});
test('Server denies path traversal and state-changing HTTP methods',async()=>{
 const r=await request('/..%2f..%2fserver.js');assert.equal(r.status,403);
 const p=await nativeFetch(base+'/api/guide',{method:'POST'});assert.equal(p.status,405);
});
test('MET parser distinguishes hourly and six-hour rain totals',()=>{
 const j={properties:{timeseries:[{time:'2026-07-01T12:00:00Z',data:{instant:{details:{air_temperature:12}},next_6_hours:{details:{precipitation_amount:6}}}},{time:'2026-07-01T13:00:00Z',data:{instant:{details:{cloud_area_fraction:0}},next_1_hours:{details:{precipitation_amount:0}}}}]}};
 const s=S.parseWeather(j);assert.equal(s[0].rainPeriodH,6);assert.equal(s[0].rainMm,6);assert.equal(s[1].rainMm,0);assert.equal(s[0].cloud,null);
});
test('Failed external weather does not invent temperatures',async()=>{
 global.fetch=async()=>{throw new Error('offline')};const j=await S.weather(61.701,11.22);assert.equal(j.available,false);assert.ok(!j.series);
});
test('NVE flow uses fixed station, secret header, and tolerates no temperature series',async()=>{
 process.env.NVE_API_KEY='test-key-not-real';const calls=[];global.fetch=async(u,o)=>{calls.push({u:String(u),o});if(String(u).includes('2.695.0'))throw new Error('unavailable temp');return {ok:true,json:async()=>({data:[{stationId:'2.267.0',parameter:1001,observations:[{time:'2026-07-01T10:00:00Z',value:12}]},{stationId:'2.267.0',parameter:1000,observations:[{time:'2026-07-01T10:00:00Z',value:290.3}]}]})};};
 const j=await S.hydrology();assert.equal(j.available,true);assert.equal(j.discharge[0].value,12);assert.equal(j.temperature.length,0);assert.equal(calls.length,2);assert.ok(calls.every(x=>x.o.headers['X-API-Key']==='test-key-not-real'));
 const h=JSON.stringify(await(await request('/api/health')).json());assert.ok(!h.includes('test-key-not-real'));
});
test('River parser only accepts lines wholly inside Mistra region',()=>{
 const good={attributes:{objectid:1,elvenavn:'Mistra'},geometry:{paths:[[[11.3,61.75],[11.31,61.76]]]}};
 const bad={geometry:{paths:[[[10,59],[10.1,59.1]]]}};
 const f=S.parseNveFeatures({features:[good,bad]});assert.equal(f.length,1);assert.equal(f[0].geometry.type,'LineString');assert.equal(f[0].properties.source,'NVE ELVIS');
});
test('River endpoint pages upstream records and caches actual geometry',async()=>{
 let calls=0;global.fetch=async u=>{calls++;const q=new URL(String(u)).searchParams;assert.equal(q.get('outSR'),'4326');assert.equal(q.get('where'),"elvenavn = 'Mistra'");return {ok:true,json:async()=>({features:[{attributes:{objectid:calls,elvenavn:'Mistra'},geometry:{paths:[[[11.3,61.75],[11.31,61.76]]]}}],exceededTransferLimit:calls===1})};};
 const j=await S.riverGeometry();assert.equal(j.available,true);assert.equal(j.features.length,2);assert.equal(calls,2);const k=await S.riverGeometry();assert.equal(k.cached,true);assert.equal(calls,2);
});
test('Address lookup refuses another municipality or ambiguous addresses',()=>{
 const a={nummer:484,kommunenavn:'Rendalen',adressetekst:'Lomnesmistra 484',representasjonspunkt:{lat:61.79,lon:11.37}};
 assert.equal(S.parseAddress({adresser:[a]},'Lomnesmistra 484').precision,'address');
 assert.equal(S.parseAddress({adresser:[{...a,kommunenavn:'Oslo'}]},'Lomnesmistra 484'),null);
 assert.equal(S.parseAddress({adresser:[a,a]},'Lomnesmistra 484'),null);
});
test('Place names cannot silently choose a distant same-name result',()=>{
 const p={kommuner:[{kommunenavn:'Rendalen'}],representasjonspunkt:{lat:61.79,lon:11.37}};
 assert.ok(S.parseName({navn:[p]}));assert.equal(S.parseName({navn:[p,{...p,representasjonspunkt:{lat:61.82,lon:11.40}}]}),null);
});
test('Historical unlocated pool stays unlocated through API',async()=>{
 const j=await S.locatePlace('holsbu');assert.equal(j.available,false);assert.ok(!j.lat);assert.ok(!j.lon);
});
