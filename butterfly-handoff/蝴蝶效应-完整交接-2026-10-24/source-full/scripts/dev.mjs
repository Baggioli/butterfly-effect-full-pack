// Mac development: read frontend files directly; authenticated API calls use the DGX backend.
import {readFile,realpath} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createBrowserSessionServer} from './browser-session.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const publicRoot=resolve(root,'public');
const upstream='http://127.0.0.1:8787';
const json=(error,status)=>Response.json({error},{status});
export function createDevWorker(password){
 return {async fetch(request){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/')){
   if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==url.origin)return json('请求来源不匹配',403);
   const headers=new Headers({'Authorization':'Basic '+Buffer.from('owner:'+password).toString('base64')});
   if(request.headers.has('content-type'))headers.set('content-type',request.headers.get('content-type'));
   if(!['GET','HEAD'].includes(request.method))headers.set('origin',upstream);
   try{return await fetch(upstream+url.pathname+url.search,{method:request.method,headers,redirect:'error',signal:AbortSignal.timeout(200000),...(!['GET','HEAD'].includes(request.method)?{body:await request.arrayBuffer()}:{})})}
   catch{return json('规划服务暂时无法连接，输入已保留，请稍后重试',502)}
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  try{
   const pathname=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
   const file=await realpath(resolve(publicRoot,'.'+pathname));
   if(!file.startsWith(publicRoot+sep))return new Response('Not found',{status:404});
   const body=await readFile(file),ext=file.split('.').at(-1);
   const type=({html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',png:'image/png',svg:'image/svg+xml',webmanifest:'application/manifest+json; charset=utf-8',webp:'image/webp'})[ext]||'application/octet-stream';
   return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return new Response('Not found',{status:404})}
 }};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let password;
 try{password=execFileSync('/usr/bin/ssh',['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','dgx','cat ~/.local/state/butterfly-effect/password'],{encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']})}
 catch{console.error('无法连接DGX读取应用凭据，请检查现有SSH连接。');process.exit(1)}
 const port=4173;
 const server=createBrowserSessionServer(createDevWorker(password),{DGX_APP_PASSWORD:password,DGX_APP_PORT:String(port),BUTTERFLY_DIRECT_ACCESS:'1'});
 server.on('error',()=>{console.error('本机预览启动失败，请检查4173端口是否被占用。');process.exit(1)});
 server.listen(port,'127.0.0.1',()=>console.log('Mac local preview: http://127.0.0.1:4173 · API via private DGX tunnel'));
}
