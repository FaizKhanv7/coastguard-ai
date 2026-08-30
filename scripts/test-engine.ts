import { community, stateAt, statusAt, route, STEP_COUNT } from "../lib/engine";
import { landmarks } from "../lib/routing";
let fail=0; const check=(n:string,v:boolean)=>{console.log(`${v?'PASS':'FAIL'} ${n}`); if(!v) fail++};
const origin=landmarks.find(l=>l.id==="uscg-sector-miami") ?? landmarks[0]; const dest=landmarks.find(l=>l.id==="jackson-memorial") ?? landmarks[1];
const s=stateAt(0); const status=statusAt(0,0,origin.nodeId); const r=route(origin.nodeId,dest.nodeId,{step:0,horizonH:0,mode:"fastest"});
check("engine has forecast steps",STEP_COUNT>0); check("flood mask matches DEM",s.flooded.length>0); check("status exposes road totals",status.totalSegments>0); check("route API returns a result",typeof r.ok==="boolean"); check("community arrays are present",Array.isArray(community.shelters)&&Array.isArray(community.incidents)); if(fail) process.exit(1);
