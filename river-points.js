/* Mistra river search points. Pure geometry, shared by browser and regression tests.
 * Points describe where to inspect the mapped river, not verified fish/pool positions.
 * Source lines are never invented, extrapolated or joined across disconnected paths.
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else root.MistraRiverPoints=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const R=6378137,DEG=Math.PI/180,MAX_POINTS=28;
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const valid=c=>Array.isArray(c)&&finite(c[0])&&finite(c[1])&&c[0]>=11.13&&c[0]<=11.66&&c[1]>=61.68&&c[1]<=62.06;
  const project=c=>({x:R*c[0]*DEG,y:R*Math.log(Math.tan(Math.PI/4+c[1]*DEG/2))});
  const unproject=p=>({lon:p.x/R/DEG,lat:(2*Math.atan(Math.exp(p.y/R))-Math.PI/2)/DEG});
  const norm=s=>String(s||'').toLowerCase().trim();
  const metres=(a,b)=>{if(!a||!b||![a.lat,a.lon,b.lat,b.lon].every(finite))return null;const dl=(b.lat-a.lat)*DEG,dn=(b.lon-a.lon)*DEG,h=Math.sin(dl/2)**2+Math.cos(a.lat*DEG)*Math.cos(b.lat*DEG)*Math.sin(dn/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));};
  function createIndex(data){
    const paths=[],segments=[];
    for(const [fi,f] of (Array.isArray(data?.features)?data.features:[]).entries()){
      const props=f.properties||{},name=norm(props.name||props.elvenavn);
      // Do not turn a tributary, lake or unrelated feature into a Mistra recommendation.
      if(name!=='mistra'||/innsj|lake|reservoir/i.test(String(props.objectType||props.objekttype||'')))continue;
      const g=f.geometry||{},raw=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
      for(const [pi,line] of (Array.isArray(raw)?raw:[]).entries()){
        if(!Array.isArray(line))continue;
        let chunk=[];
        const flush=()=>{
          if(chunk.length<2){chunk=[];return;}
          const points=chunk.map(project),lengths=[0];
          for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
          if(lengths.at(-1)<=.01){chunk=[];return;}
          const p={id:String(props.id??fi)+':'+pi+':'+paths.length,points,lengths,total:lengths.at(-1),source:props.source||data.source||'NVE ELVIS'};
          paths.push(p);
          for(let i=1;i<points.length;i++){
            const a=points[i-1],b=points[i],length=lengths[i]-lengths[i-1];
            if(length>.01)segments.push({path:p,i:i-1,a,b,length,offset:lengths[i-1],west:Math.min(a.x,b.x),east:Math.max(a.x,b.x),south:Math.min(a.y,b.y),north:Math.max(a.y,b.y)});
          }
          chunk=[];
        };
        for(const c of line){if(valid(c)){if(!chunk.length||c[0]!==chunk.at(-1)[0]||c[1]!==chunk.at(-1)[1])chunk.push(c);}else flush();}
        flush();
      }
    }
    return {paths,segments,source:data?.source||'NVE ELVIS',fetchedAt:data?.fetchedAt||null,stale:!!data?.stale,incomplete:!!data?.incomplete};
  }
  function validBounds(b){return b&&[b.west,b.south,b.east,b.north].every(finite)&&b.west<b.east&&b.south<b.north&&b.south>-85&&b.north<85;}
  // Liang-Barsky clipping also handles a line whose two vertices are off screen.
  function clipSegment(a,b,box){
    const dx=b.x-a.x,dy=b.y-a.y,ps=[-dx,dx,-dy,dy],qs=[a.x-box.west,box.east-a.x,a.y-box.south,box.north-a.y];
    let lo=0,hi=1;
    for(let i=0;i<4;i++){if(Math.abs(ps[i])<1e-12){if(qs[i]<0)return null;continue;}const t=qs[i]/ps[i];if(ps[i]<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}
    return [lo,hi];
  }
  function atDistance(path,d){
    d=clamp(d,0,path.total);const a=path.lengths;let lo=0,hi=a.length-2;
    while(lo<hi){const m=Math.ceil((lo+hi)/2);if(a[m]<=d)lo=m;else hi=m-1;}
    const p=path.points[lo],q=path.points[lo+1],t=(d-a[lo])/Math.max(.0001,a[lo+1]-a[lo]);
    return {x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t};
  }
  function makePoint(s,t){
    const p={x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.y+(s.b.y-s.a.y)*t},ll=unproject(p),along=s.offset+s.length*t;
    const window=60/Math.cos(ll.lat*DEG),before=atDistance(s.path,along-window),after=atDistance(s.path,along+window);
    const u={x:p.x-before.x,y:p.y-before.y},v={x:after.x-p.x,y:after.y-p.y},den=Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y);
    const bend=den>1?Math.acos(clamp((u.x*v.x+u.y*v.y)/den,-1,1))/DEG:0;
    return {id:'river-'+ll.lat.toFixed(7)+'-'+ll.lon.toFixed(7),...ll,x:p.x,y:p.y,pathId:s.path.id,along,bendDegrees:Math.round(bend),kind:bend>=25?'bend':'reach',source:s.path.source,access:'unknown',locationType:'mapped-river-line',verifiedCatch:false};
  }
  function nearest(index,point,maxDistance=Infinity){
    if(!point||![point.lat,point.lon].every(finite))return null;
    const p=project([point.lon,point.lat]);let best=null,d=Infinity;
    for(const s of index?.segments||[]){const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,t=clamp(((p.x-s.a.x)*dx+(p.y-s.a.y)*dy)/(s.length*s.length),0,1),q=makePoint(s,t),dist=metres(point,q);if(dist<d){d=dist;best=q;}}
    return best&&d<=maxDistance?{...best,distanceM:d}:null;
  }
  function suggest(index,options={}){
    const {bounds}=options,stats={visibleSegments:0,candidates:0,radiusRejected:0,accessRejected:0,missingBase:false,source:index?.source||null,reason:null};
    const empty=reason=>({points:[],stats:{...stats,reason}});
    if(!validBounds(bounds))return empty('invalid-view');
    if(!index?.segments?.length)return empty('no-geometry');
    const sw=project([bounds.west,bounds.south]),ne=project([bounds.east,bounds.north]),box={west:sw.x,east:ne.x,south:sw.y,north:ne.y};
    const zoom=finite(options.zoom)?clamp(options.zoom,3,20):14,mpp=2*Math.PI*R/(256*2**zoom),spacing=clamp(Number(options.spacingPx)||76,40,140),step=Math.max(8,mpp*spacing),pool=[],seen=new Set();
    const radius=finite(options.radius)?Math.max(0,options.radius):0,base=options.base&&[options.base.lat,options.base.lon].every(finite)?options.base:null;
    stats.missingBase=radius>0&&!base;
    function add(s,t){
      const q=makePoint(s,t),id=q.id;if(seen.has(id))return;seen.add(id);stats.candidates++;
      q.distanceM=metres(base,q);
      if(radius>0&&base&&q.distanceM>radius+.01){stats.radiusRejected++;return;}
      // A nearby road/hut is not evidence that the riverbank is easy to access.
      if(options.access&&options.access!=='all'&&options.access!=='unknown'){stats.accessRejected++;return;}
      pool.push(q);
    }
    for(const s of index.segments){
      if(s.west>box.east||s.east<box.west||s.south>box.north||s.north<box.south)continue;
      const c=clipSegment(s.a,s.b,box);if(!c)continue;stats.visibleSegments++;
      const start=s.offset+s.length*c[0],end=s.offset+s.length*c[1];let count=0;
      for(let d=Math.ceil(start/step)*step;d<=end+.0001;d+=step){add(s,clamp((d-s.offset)/s.length,c[0],c[1]));if(++count>5000)break;}
      // Even a very short visible piece or narrow radius gets a real line point.
      if(!count)add(s,(c[0]+c[1])/2);
      if(radius>0&&base){const p=project([base.lon,base.lat]),dx=s.b.x-s.a.x,dy=s.b.y-s.a.y;add(s,clamp(((p.x-s.a.x)*dx+(p.y-s.a.y)*dy)/(s.length*s.length),c[0],c[1]));}
    }
    if(!stats.visibleSegments)return empty('outside-river');
    if(!pool.length)return empty(stats.accessRejected?'access-filter':stats.radiusRejected?'radius-filter':'no-candidates');
    const center={x:(sw.x+ne.x)/2,y:(sw.y+ne.y)/2},limit=clamp(Math.floor(Number(options.limit)||MAX_POINTS),1,MAX_POINTS);
    pool.sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y)||a.id.localeCompare(b.id));
    const selected=[pool[0]],remaining=pool.slice(1).map(p=>({p,min:Math.hypot(p.x-pool[0].x,p.y-pool[0].y)}));
    // Farthest-first distributes points across the view rather than crowding one bend.
    while(selected.length<limit&&remaining.length){
      let bi=-1,bd=-1;for(let i=0;i<remaining.length;i++){if(remaining[i].min>bd){bd=remaining[i].min;bi=i;}}
      if(bd<step*.65)break;
      const next=remaining.splice(bi,1)[0].p;selected.push(next);
      for(const r of remaining)r.min=Math.min(r.min,Math.hypot(r.p.x-next.x,r.p.y-next.y));
    }
    return {points:selected,stats:{...stats,reason:'ready',shown:selected.length,spacingPx:spacing}};
  }
  return {createIndex,suggest,nearest,metres,project,unproject,clipSegment,validBounds,MAX_POINTS};
});
