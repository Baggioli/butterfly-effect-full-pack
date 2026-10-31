#!/usr/bin/env node
/** Local demo preview: static public/ + mock auth API. Port 18xxx only. No DGX / real SMS. */
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {api} from '../worker/api.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const publicRoot=resolve(root,'public');
const port=Number(process.env.DEMO_PREVIEW_PORT||18080);
if(!Number.isInteger(port)||port<18000||port>18999){
  console.error('DEMO_PREVIEW_PORT must be 18000–18999 (got '+port+')');
  process.exit(1);
}
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json; charset=utf-8','.md':'text/markdown; charset=utf-8','.json':'application/json; charset=utf-8'};
const env={AI_PROVIDER:'ollama',AI_MODEL:'qwen2.5:7b',...process.env,SMS_PROVIDER:process.env.SMS_PROVIDER||'mock'};

const server=http.createServer(async(req,res)=>{
  const host=req.headers.host||('127.0.0.1:'+port);
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(host)){res.writeHead(403);return res.end('Host not allowed');}
  let url;try{url=new URL(req.url,'http://'+host)}catch{res.writeHead(400);return res.end('bad request')}
  if(url.pathname.startsWith('/api/')){
    try{
      const chunks=[];for await(const c of req)chunks.push(c);
      const headers=new Headers();
      for(const [k,v] of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length'].includes(k))headers.set(k,v);
      // Demo: inject private-space header so /api/ai/status etc. are reachable without DGX session.
      if(!headers.get('oai-authenticated-user-id'))headers.set('oai-authenticated-user-id','demo-preview');
      if(!headers.get('origin'))headers.set('origin',url.origin);
      const request=new Request(url.href,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
      const response=await api(request,env);
      const out=Buffer.from(await response.arrayBuffer());
      res.writeHead(response.status,{...Object.fromEntries(response.headers),'Cache-Control':'no-store'});
      res.end(out);
    }catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'demo api error'}));}
    return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end('Method not allowed');}
  try{
    const pathname=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    const file=resolve(publicRoot,'.'+pathname);
    if(!file.startsWith(publicRoot+sep)&&file!==publicRoot){res.writeHead(404);return res.end('Not found');}
    await stat(file);
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404);res.end('Not found')}
});
server.listen(port,'127.0.0.1',()=>{
  console.log('Demo preview: http://127.0.0.1:'+port);
  console.log('Mock OTP: 000000 · SMS_PROVIDER=mock · auth/export/delete stubs on');
  console.log('UI-only alternative: cd public && python3 -m http.server 18081  (no /api)');
});
