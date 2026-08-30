import { ask } from "../lib/assistant";
import { landmarks } from "../lib/routing";
const origin=landmarks.find(l=>l.id==="uscg-sector-miami") ?? landmarks[0];
const reply=ask("What is the water level now?",{step:0,horizonH:0,mode:"fastest",originNodeId:origin.nodeId});
if(typeof reply!=="string"||reply.length<5){console.error("FAIL assistant response");process.exit(1)} console.log("PASS assistant response");
