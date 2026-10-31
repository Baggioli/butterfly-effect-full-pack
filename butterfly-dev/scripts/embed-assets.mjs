import fs from 'node:fs';
import path from 'node:path';
const assets={};
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const name=path.join(dir,entry.name);if(entry.isDirectory())walk(name);else{const ext=path.extname(name);assets['/'+path.relative('public',name)]={type:({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json; charset=utf-8','.md':'text/markdown; charset=utf-8'})[ext]||'application/octet-stream',body:fs.readFileSync(name).toString('base64')};}}}
walk('public');
const core=fs.readFileSync('public/onboarding-core.js','utf8').replace('export default InterviewCore;','');
const stripModule=src=>src
 .replace(/^import[^\n]*\n/gm,'')
 .replace(/^export \{[^}]*\};\n?/gm,'')
 .replace(/^export default /gm,'')
 .replace(/^export /gm,'');
const auth=stripModule(fs.readFileSync('worker/auth.js','utf8'));
const apiSrc=stripModule(fs.readFileSync('worker/api.js','utf8'));
const projection=['worker/depth-contract.js','worker/projection-params.js','worker/projection-income-table.js','worker/projection-persona-table.js','worker/projection-persona.js','worker/projection.js','worker/projection-story.js','worker/projection-api.js'].map(f=>stripModule(fs.readFileSync(f,'utf8'))).join('\n');
const api=core+'\n'+auth+'\n'+projection+'\n'+apiSrc;
fs.writeFileSync('worker/index.js',api+'\nconst assets='+JSON.stringify(assets)+';\nexport default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith("/api/"))return api(request,env);if(!["GET","HEAD"].includes(request.method))return new Response("Method not allowed",{status:405});const a=assets[url.pathname==="/"?"/index.html":url.pathname];if(!a)return new Response("Not found",{status:404});return new Response(request.method==="HEAD"?null:Uint8Array.from(atob(a.body),c=>c.charCodeAt(0)),{headers:{"Content-Type":a.type,"Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"}})}};\n');
