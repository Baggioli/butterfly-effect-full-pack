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
  const auth=req.headers.authorization||'';
  const dgxBasic=req.headers['x-dgx-authorization']||'';
  let credentials='';let appBearer='';
  try{
   if(auth.startsWith('Basic '))credentials=Buffer.from(auth.slice(6),'base64').toString('utf8');
   else if(String(dgxBasic).startsWith('Basic '))credentials=Buffer.from(String(dgxBasic).slice(6),'base64').toString('utf8');
   if(auth.toLowerCase().startsWith('bearer '))appBearer=auth.slice(7).trim();
  }catch{}
  if(!timingSafeEqual(digest(credentials),expected)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Butterfly DGX", charset="UTF-8"','Cache-Control':'no-store'});return res.end('Authentication required');}
  const isGenerate=req.url.split('?')[0]==='/api/ai';
  if(isGenerate&&generating){res.writeHead(429,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'上一项规划仍在处理，请稍后重试'}));}
  if(isGenerate)generating=true;
  try{
   const chunks=[];let size=0;
   const path0=req.url.split('?')[0];const maxBody=path0==='/api/speech/transcribe'?2097152:path0.startsWith('/api/projection/')?120000:35000;for await(const chunk of req){size+=chunk.length;if(size>maxBody){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
   const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(!k.startsWith('oai-')&&!['authorization','connection','transfer-encoding','content-length','host','x-dgx-authorization'].includes(k)&&typeof v==='string')headers.set(k,v);
   // Discard caller identity; keep app session token for /api/auth/* (Bearer cannot share Authorization with Basic).
   if(appBearer)headers.set('x-butterfly-session',appBearer);
   headers.set('oai-authenticated-user-id','dgx-owner');
   const request=new Request('http://'+host+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
   const response=await worker.fetch(request,{AI_PROVIDER:env.BUTTERFLY_LLM_PROVIDER||env.AI_PROVIDER||'ollama',OLLAMA_BASE_URL:env.OLLAMA_BASE_URL||'http://127.0.0.1:11434',AI_MODEL:env.BUTTERFLY_LLM_MODEL||env.AI_MODEL||'qwen2.5:7b',AI_GAP_MODEL:env.AI_GAP_MODEL||env.AI_MODEL||'qwen2.5:7b',AI_GAP_FALLBACK_MODEL:env.AI_GAP_FALLBACK_MODEL||env.AI_NARRATIVE_MODEL||'qwen2.5:32b',AI_NARRATIVE_MODEL:env.AI_NARRATIVE_MODEL||'qwen2.5:32b',AI_STORY_MODEL:env.AI_STORY_MODEL||env.AI_NARRATIVE_MODEL||env.AI_MODEL||'qwen2.5:7b',AI_DEPTH_CONTRACT:env.AI_DEPTH_CONTRACT??'1',AI_FALLBACK_MODELS:env.AI_FALLBACK_MODELS||'qwen2.5:32b,qwen2.5:7b',AI_BASE_URL:env.BUTTERFLY_LLM_BASE_URL||env.AI_BASE_URL||'',DEEPSEEK_API_KEY:env.DEEPSEEK_API_KEY||'',OPENAI_API_KEY:env.OPENAI_API_KEY||'',AI_API_KEY:env.AI_API_KEY||'',BUTTERFLY_LLM_API_KEY:env.BUTTERFLY_LLM_API_KEY||'',BUTTERFLY_LLM_BASE_URL:env.BUTTERFLY_LLM_BASE_URL||'',BUTTERFLY_LLM_MODEL:env.BUTTERFLY_LLM_MODEL||'',BUTTERFLY_LLM_PROVIDER:env.BUTTERFLY_LLM_PROVIDER||'',...(env.PROJECTION_STORE?{PROJECTION_STORE:env.PROJECTION_STORE}:{}),...(env.__accountPersist?{__accountPersist:env.__accountPersist}:{})});
   const buf=Buffer.from(await response.arrayBuffer());
   const outHeaders={};for(const [k,v] of response.headers){if(k.toLowerCase()==='content-length')continue;outHeaders[k]=v;}
   outHeaders['Content-Length']=String(buf.length);
   outHeaders['Cache-Control']='no-store';outHeaders['Referrer-Policy']='no-referrer';outHeaders['X-Frame-Options']='DENY';
   res.writeHead(response.status,outHeaders);
   res.end(buf);
  }catch{res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'服务暂时无法处理，请稍后重试'}));}
  finally{if(isGenerate)generating=false;}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const worker=(await import(pathToFileURL(resolve('worker/index.js')))).default;
 const port=Number(process.env.DGX_APP_PORT||8787);
 const env={...process.env};
 if(env.DGX_APP_PASSWORD_FILE)env.DGX_APP_PASSWORD=readFileSync(env.DGX_APP_PASSWORD_FILE,'utf8');
 if(env.AI_API_KEY_FILE&&!env.AI_API_KEY){try{env.AI_API_KEY=readFileSync(env.AI_API_KEY_FILE,'utf8').trim();}catch{}}
 if(env.DEEPSEEK_API_KEY_FILE&&!env.DEEPSEEK_API_KEY){try{env.DEEPSEEK_API_KEY=readFileSync(env.DEEPSEEK_API_KEY_FILE,'utf8').trim();}catch{}}
 if(env.BUTTERFLY_LLM_ENV_FILE){try{for(const line of readFileSync(env.BUTTERFLY_LLM_ENV_FILE,'utf8').split(/\r?\n/)){const t=line.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<1)continue;const k=t.slice(0,i).trim(),v=t.slice(i+1).trim();if(k&&env[k]==null)env[k]=v;}}catch{}}
 if(env.BUTTERFLY_DATA_DIR){const {createFileProjectionStore,createFileAccountPersist}=await import('./projection-store.mjs');const {join}=await import('node:path');env.PROJECTION_STORE=createFileProjectionStore(join(env.BUTTERFLY_DATA_DIR,'projection'));env.__accountPersist=createFileAccountPersist(join(env.BUTTERFLY_DATA_DIR,'accounts.json'));}
 const server=createDGXServer(worker,env);
 server.listen(port,'127.0.0.1',()=>console.log('DGX app listening on loopback port '+port+'. Use an SSH tunnel; model requests stay on this machine.'));
}
