// Run ON the DGX. Model and app ports remain loopback-only.
import http from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
export function createDGXServer(worker,env){
 const password=env.DGX_APP_PASSWORD||'';
 if(password.length<16)throw Error('Set DGX_APP_PASSWORD to at least 16 characters before starting.');
 const port=Number(env.DGX_APP_PORT||8787);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid DGX_APP_PORT');
 const digest=s=>createHash('sha256').update(s).digest();
 const expected=digest('owner:'+password);
 let generating=false;
 return http.createServer(async(req,res)=>{
  const host=req.headers.host;
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(host)){res.writeHead(403);return res.end('Host not allowed');}
  const auth=req.headers.authorization||'';let credentials='';
  try{if(auth.startsWith('Basic '))credentials=Buffer.from(auth.slice(6),'base64').toString('utf8')}catch{}
  if(!timingSafeEqual(digest(credentials),expected)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Butterfly DGX", charset="UTF-8"','Cache-Control':'no-store'});return res.end('Authentication required');}
  const isGenerate=req.url.split('?')[0]==='/api/ai';
  if(isGenerate&&generating){res.writeHead(429,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'上一项规划仍在处理，请稍后重试'}));}
  if(isGenerate)generating=true;
  try{
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>(req.url.split('?')[0]==='/api/speech/transcribe'?2097152:35000)){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
   const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(!k.startsWith('oai-')&&!['authorization','connection','transfer-encoding','content-length','host'].includes(k)&&typeof v==='string')headers.set(k,v);
   // Discard all caller-supplied identity; only inject after local authentication.
   headers.set('oai-authenticated-user-id','dgx-owner');
   const request=new Request('http://'+host+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
   const response=await worker.fetch(request,{AI_PROVIDER:'ollama',OLLAMA_BASE_URL:'http://127.0.0.1:11434',AI_MODEL:env.AI_MODEL||'qwen2.5:7b'});
   res.writeHead(response.status,{...Object.fromEntries(response.headers),'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});
   res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'服务暂时无法处理，请稍后重试'}));}
  finally{if(isGenerate)generating=false;}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const worker=(await import(pathToFileURL(resolve('worker/index.js')))).default;
 const port=Number(process.env.DGX_APP_PORT||8787);
 const env={...process.env};
 if(env.DGX_APP_PASSWORD_FILE)env.DGX_APP_PASSWORD=readFileSync(env.DGX_APP_PASSWORD_FILE,'utf8');
 const server=createDGXServer(worker,env);
 server.listen(port,'127.0.0.1',()=>console.log('DGX app listening on loopback port '+port+'. Use an SSH tunnel; model requests stay on this machine.'));
}
