'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../public/model'),guide=require('../public/data/mistra.json'),lures=require('../public/data/lures.json');
const lower=guide.reaches.find(r=>r.id==='nedre'),quiet=guide.reaches.find(r=>r.id==='lomnes');
const ctx=(values={})=>({reach:lower,goal:'big',date:'2026-07-15T11:00:00Z',method:'all',flow:'normal',clarity:'unknown',...values});
const obs=(t,value)=>({time:new Date(t).toISOString(),value});
test('Norway dates account for UTC offset and midnight',()=>{
 assert.deepEqual(M.parts('2026-04-30T22:30:00Z'),{year:2026,month:5,day:1,hour:0,minute:30});
 assert.equal(M.season('main','2026-04-30T21:59:00Z').open,false);
 assert.equal(M.season('main','2026-04-30T22:00:00Z').open,true);
});
test('Main season includes September 15 but not September 16',()=>{
 assert.equal(M.season('main','2026-09-15T21:59:00Z').open,true);
 assert.equal(M.season('main','2026-09-15T22:00:00Z').state,'closed');
});
test('August 20 release rule switches on Norwegian date',()=>{
 assert.match(M.season('main','2026-08-19T21:59:00Z').detail,/h.yest|h.yst/i);
 assert.match(M.season('main','2026-08-19T22:00:00Z').detail,/20\. august/);
});
test('North is separate; ambiguous September 1 is not asserted open',()=>{
 assert.equal(M.season('north','2026-05-31T10:00:00Z').open,false);
 assert.equal(M.season('north','2026-06-01T10:00:00Z').open,true);
 assert.equal(M.season('north','2026-08-31T10:00:00Z').open,true);
 assert.equal(M.season('north','2026-09-01T10:00:00Z').state,'confirm');
});
test('Tributaries end on August 25; no automatic boundary permission',()=>{
 assert.equal(M.season('tributary','2026-08-25T10:00:00Z').open,true);
 assert.equal(M.season('tributary','2026-08-26T10:00:00Z').open,false);
 assert.equal(M.season('boundary','2026-07-01T10:00:00Z').state,'confirm');
});
test('Future year and invalid dates cannot confirm fishing legality',()=>{
 assert.equal(M.season('main','2027-07-01').state,'unconfirmed');
 assert.equal(M.season('main','bad').open,false);
});
test('Unknown measurements are not interpreted as zero',()=>{
 assert.equal(M.finite(null),false);assert.equal(M.finite('1'),false);
 assert.equal(M.conditionsFrom(null).cloud,null);
 assert.equal(M.distance(null,{lat:61.7,lon:11.2}),null);
});
test('Distance uses metres and zero is valid',()=>{
 assert.equal(M.distance({lat:61.7,lon:11.2},{lat:61.7,lon:11.2}),0);
 const n=M.distance({lat:61.7,lon:11.2},{lat:61.701,lon:11.2});assert.ok(n>110&&n<112);
});
test('Forecast outside time coverage is absent, not nearest unrelated data',()=>{
 const series=[{time:'2026-07-15T11:00:00Z',cloud:50}];
 assert.equal(M.nearestWeather(series,'2026-07-15T11:30:00Z').cloud,50);
 assert.equal(M.nearestWeather(series,'2026-07-17T11:30:00Z'),null);
});
test('Rank does not fabricate weather or treat closed season as open',()=>{
 const x=M.rankReach(lower,'2026-09-20T12:00:00Z','big',null);
 assert.equal(x.rule.open,false);assert.equal(x.weatherApplied,false);assert.ok(x.score<=85);
});
test('High observed flow penalizes difficult entry, not measured safe wading',()=>{
 const r=guide.reaches.find(r=>r.id==='holsbu'),date='2026-07-15T11:00:00Z';
 assert.ok(M.rankReach(r,date,'big',null,{flow:'high'}).score<M.rankReach(r,date,'big',null,{flow:'normal'}).score);
});
test('Every source reference exists and every reach has provenance',()=>{
 const ids=new Set(guide.sources.map(s=>s.id));assert.equal(ids.size,guide.sources.length);
 for(const r of [...guide.reaches,...guide.strategy])for(const id of r.sources)assert.ok(ids.has(id),id);
 assert.equal(guide.reaches.length,8);
 for(const r of guide.reaches)assert.ok(r.sources.length);
});
test('Historical Holsbuholen has no invented location',()=>{
 const r=guide.reaches.find(r=>r.id==='holsbu');assert.ok(!r.anchor);assert.ok(!r.lookup);
});
test('All 18 own single-lure images exist with source crop coordinates',()=>{
 assert.equal(lures.length,18);assert.equal(new Set(lures.map(l=>l.id)).size,18);
 for(const l of lures){assert.ok(l.owned);assert.equal(l.lengthCm,null);assert.equal(l.buoyancy,'unknown');
 assert.ok(fs.statSync(path.join(__dirname,'../public',l.image)).size>1000);assert.equal(l.cropPixels.length,4);
 const [a,b,c,d]=l.cropPixels,[w,h]=l.sourceDimensions;assert.ok(a>=0&&b>=0&&c<=w&&d<=h&&c>a&&d>b);
 }
});
test('Method filters never show another family',()=>{
 for(const method of ['wobbler','spoon','spinner','fly']){const a=M.rankLures(lures,ctx({method}));assert.ok(a.length);assert.ok(a.every(l=>l.family===method));}
 assert.equal(M.rankLures(lures,ctx({method:'worm'})).length,0);
});
test('Green lipless lure is not classified as a floating minnow',()=>{
 const fire=lures.find(l=>l.id==='firetiger-vibration');assert.equal(fire.family,'vibration');assert.equal(fire.buoyancy,'unknown');
 const ranked=M.rankLures(lures,ctx({clarity:'coloured'}));assert.notEqual(ranked[0].id,fire.id);
});
test('Measured length changes match without changing the catalogue',()=>{
 const a=M.rankLures(lures,ctx(),{'perch-natural':{lengthCm:9,buoyancy:'floating'}});
 assert.equal(a[0].id,'perch-natural');assert.equal(a[0].lengthCm,9);assert.equal(a[0].buoyancy,'floating');
 assert.equal(lures.find(l=>l.id==='perch-natural').lengthCm,null);
});
test('Observed clarity and method produce appropriate alternative choices',()=>{
 const clear=M.rankLures(lures,ctx({clarity:'clear'})),coloured=M.rankLures(lures,ctx({clarity:'coloured'}));
 assert.ok(clear[0].tags.includes('natural'));
 assert.ok(coloured.some(l=>l.tags.includes('contrast')));
 assert.equal(new Set(clear.map(l=>l.id)).size,clear.length);
 const fly=M.rankLures(lures,ctx({reach:quiet,method:'fly',goal:'numbers'}));assert.ok(fly.every(l=>l.family==='fly'));
});
test('NVE parser enforces exact station and parameter, and keeps valid zero',()=>{
 const data={data:[{stationId:'2.267.0',parameter:1001,observations:[{time:'2026-07-01T00:00:00Z',value:null},{time:'2026-07-01T01:00:00Z',value:0},{time:'bad',value:5},{time:'2026-07-01T02:00:00Z',value:'6'}]},{stationId:'2.267.0',parameter:1000,observations:[obs('2026-07-01',290)]},{stationId:'2.123.0',parameter:1001,observations:[obs('2026-07-01',99)]}]};
 const s=M.hydrateSeries(data,'2.267.0',1001);assert.equal(s.length,1);assert.equal(s[0].value,0);
});
test('Observation parser orders and deduplicates timestamps',()=>{
 const d={data:[{stationId:'2.267.0',parameter:1001,observations:[obs('2026-07-02',2),obs('2026-07-01',1),obs('2026-07-01',3)]}]};
 const s=M.hydrateSeries(d,'2.267.0',1001);assert.deepEqual(s.map(p=>p.value),[3,2]);
});
test('Trend uses requested time window; zero denominator has no percent',()=>{
 const s=[obs('2026-07-01T00:00:00Z',0),obs('2026-07-01T03:00:00Z',4)];
 assert.equal(M.trend(s,3).delta,4);assert.equal(M.trend(s,3).percent,null);assert.equal(M.trend(s,24),null);
});
const now=Date.parse('2026-07-01T12:00:00Z');
const position=(values={})=>({timestamp:now,coords:{latitude:61.77,longitude:11.34,accuracy:5,speed:null,heading:null,...values}});
test('GPS absent speed and heading stay unknown',()=>{
 const p=M.gpsFix(position(),null,now);assert.equal(p.speedKmh,null);assert.equal(p.heading,null);assert.equal(p.segmentBreak,true);
});
test('GPS reports speed in km/h; validates freshness and coordinates',()=>{
 assert.equal(M.gpsFix(position({speed:2}),null,now).speedKmh,7.2);
 assert.equal(M.gpsFix({...position(),timestamp:now-46000},null,now),null);
 assert.equal(M.gpsFix(position({latitude:101}),null,now),null);
 assert.equal(M.gpsFix(position({accuracy:-1}),null,now),null);
});
test('Reordered GPS fixes do not move the map backwards',()=>{
 const p=M.gpsFix(position(),null,now);assert.equal(M.gpsFix(position(),p,now),null);
});
test('Track segments break after gaps and poor accuracy',()=>{
 const p=M.gpsFix(position({accuracy:100}),null,now);
 const next=M.gpsFix({...position(),timestamp:now+1000},p,now+1000);assert.equal(next.segmentBreak,true);
 const gap=M.gpsFix({...position(),timestamp:now+65000},next,now+65000);assert.equal(gap.segmentBreak,true);
});
test('GPX contains separate segments and excludes invalid points',()=>{
 const a=M.gpsFix(position(),null,now),b={...a,lat:61.771,timestamp:now+5000,segmentBreak:false},c={...b,lat:61.772,timestamp:now+70000,segmentBreak:true};
 const x=M.gpx([a,b,{lat:null},c]);assert.equal((x.match(/<trkseg>/g)||[]).length,2);assert.equal((x.match(/<trkpt /g)||[]).length,3);assert.match(x,/http:\/\/www.topografix.com\/GPX\/1\/1/);
});


test('Point-specific lure bias varies owned wobbler first choice while keeping four owned choices',()=>{
 const picks=[];
 for(let v=0;v<5;v++){
  const ranked=M.rankLures(lures,ctx({method:'wobbler',pointId:'river-test-'+v,pointVariant:v,pointKind:v%2?'bend':'reach',bendDegrees:v%2?35:8}));
  assert.equal(ranked.length,4);
  assert.ok(ranked.every(x=>x.owned===true));
  picks.push(ranked[0].id);
 }
 assert.ok(new Set(picks).size>=3,'expected at least three distinct first choices across five points');
});

test('Source-backed Mistra lure list includes at least three historical choices and varies ordering',()=>{
 const a=M.sourceLures(ctx({pointId:'a',pointKind:'bend',bendDegrees:42,clarity:'clear',flow:'normal'}));
 const b=M.sourceLures(ctx({pointId:'b',pointKind:'reach',bendDegrees:5,clarity:'coloured',flow:'high'}));
 assert.ok(a.length>=3);assert.ok(b.length>=3);
 for(const row of a){assert.ok(row.name);assert.ok(row.source);assert.ok(row.detail);}
 assert.ok(a.some(x=>/grønn/i.test(x.name)));
 assert.ok(a.some(x=>/Rapala Original/i.test(x.name)));
 assert.ok(a.some(x=>/Møresild/i.test(x.name)));
 assert.notDeepEqual(a.map(x=>x.id),b.map(x=>x.id));
});
