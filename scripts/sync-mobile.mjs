import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
const root=process.cwd(), source=join(root,"coastguard-ai.html"), out=join(root,"public"), dest=join(out,"mobile.html");
if(!existsSync(source)){console.error(`sync-mobile: ${source} not found`);process.exit(1)}
let html=readFileSync(source,"utf8");
const files={DEM:"dem.json",FORCING:"forcing.json",ROADS:"roads.json",LANDMARKS:"landmarks.json"};
for(const [key,file] of Object.entries(files)){const raw=readFileSync(join(root,"data",file),"utf8").replaceAll("<","\\u003c");html=html.replace(`__${key}_JSON__`,raw)}
mkdirSync(out,{recursive:true});writeFileSync(dest,html);console.log(`sync-mobile: embedded Miami datasets -> public/mobile.html (${(statSync(dest).size/1024).toFixed(1)} kB)`);
