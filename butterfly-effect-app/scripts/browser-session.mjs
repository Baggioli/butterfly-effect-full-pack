import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {createDGXServer} from './dgx-server.mjs';
const html=(message='')=>`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>进入蝴蝶效应</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f8f2;color:#345842;font:16px/1.7 -apple-system,BlinkMacSystemFont,sans-serif;display:grid;place-items:center;min-height:100dvh;padding:24px}.card{width:100%;max-width:400px;background:white;padding:32px;border:1px solid #dce5d5;border-radius:24px}small{color:#7b8d70}h1{font-size:28px;margin:12px 0}label{display:block;margin-top:24px}input{width:100%;font:inherit;padding:14px;border:1px solid #cad8c3;border-radius:12px;margin-top:8px}button{width:100%;border:0;border-radius:12px;padding:14px;background:#315d48;color:white;font:inherit;font-weight:600;margin-top:20px}.error{color:#a74431}p{margin:12px 0}</style></head><body><main class="card"><small>蝴蝶效应 · 本机开发版</small><h1>继续你的故事</h1><p>输入应用访问口令，进入你的私人空间。</p><form method="post" action="/session"><label>访问口令<input name="password" type="password" autocomplete="current-password" required maxlength="512" autofocus></label><p class="error" role="alert">${message}</p><button type="submit">进入蝴蝶效应</button></form><p><small>使用启动时设置的应用口令。原有档案和记录会保留在当前浏览器。</small></p></main></body></html>`;
export function createBrowserSessionServer(worker,env){
 const server=createDGXServer(worker,env),[protectedHandler]=server.listeners('request');
 server.removeAllListeners('request');
 const password=env.DGX_APP_PASSWORD,port=Number(env.DGX_APP_PORT||4173);
 const hash=value=>createHash('sha256').update(value).digest(),expected=hash(password);
 const basic='Basic '+Buffer.from('owner:'+password).toString('base64');
 const sessions=new Map(),cookieName='butterfly_session',lifetime=8*60*60;
 const send=(res,status,body,headers={})=>{res.writeHead(status,{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',...headers});res.end(body)};
 const login=(res,message='')=>send(res,200,html(message),{'Content-Type':'text/html; charset=utf-8'});
 server.on('request',async(req,res)=>{
  const host=req.headers.host;
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(host))return send(res,403,'Host not allowed');
  const origin='http://'+host;let url;try{url=new URL(req.url,origin)}catch{return send(res,400,'Request not allowed')}
  if(url.origin!==origin)return send(res,403,'Request not allowed');
  if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin)return send(res,403,JSON.stringify({error:'请求来源不匹配'}),{'Content-Type':'application/json'});
  if(env.BUTTERFLY_DIRECT_ACCESS==='1'){
   if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return send(res,403,'Local access only');
   req.headers.authorization=basic;
   return protectedHandler(req,res);
  }
  const now=Date.now();for(const [key,expires] of sessions)if(expires<=now)sessions.delete(key);
  const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  const validSession=token&&sessions.has(token);
  if(url.pathname==='/session'&&req.method==='POST'){
   try{
    let body='';for await(const chunk of req){body+=chunk.toString('utf8');if(Buffer.byteLength(body)>4096)return send(res,413,'Request too large')}
    const supplied=new URLSearchParams(body).get('password')||'';
    if(!timingSafeEqual(hash(supplied),expected))return login(res,'访问口令不正确，请重试。');
    if(sessions.size>=32)sessions.delete(sessions.keys().next().value);
    const next=randomBytes(32).toString('hex');sessions.set(next,now+lifetime*1000);
    return send(res,303,'',{'Location':'/','Set-Cookie':cookieName+'='+next+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+lifetime});
   }catch{return login(res,'暂时无法登录，请重试。')}
  }
  if(url.pathname==='/session/logout'&&req.method==='POST'){
   if(token)sessions.delete(token);
   return send(res,303,'',{'Location':'/','Set-Cookie':cookieName+'=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'});
  }
  if(validSession)req.headers.authorization=basic;
  if(validSession||timingSafeEqual(hash(req.headers.authorization||''),hash(basic)))return protectedHandler(req,res);
  if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html'))return login(res);
  return send(res,401,JSON.stringify({error:'请先进入你的私人空间，再继续操作'}),{'Content-Type':'application/json'});
 });
 return server;
}
