/** Account / OTP stubs — isomorphic (no node:fs / node:crypto). File persist is optional via env hooks. */

const phoneOk=p=>/^1\d{10}$/.test(String(p||'').trim());
const maskPhone=p=>{const s=String(p||'');return s.length===11?s.slice(0,3)+'****'+s.slice(7):'****'};
const authJson=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});

function bytesToHex(buf){return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function hashCode(code,pepper){
 const data=new TextEncoder().encode((pepper||'dev-otp-pepper')+':'+String(code));
 if(globalThis.crypto?.subtle){const dig=await crypto.subtle.digest('SHA-256',data);return bytesToHex(dig)}
 // Fallback for rare environments without subtle
 let h=2166136261>>>0;for(const c of data){h^=c;h=Math.imul(h,16777619)>>>0}return ('00000000'+h.toString(16)).slice(-8).padStart(64,'0');
}
function newToken(){
 const a=new Uint8Array(24);
 (globalThis.crypto||{getRandomValues:x=>{for(let i=0;i<x.length;i++)x[i]=Math.floor(Math.random()*256);return x}}).getRandomValues(a);
 return bytesToHex(a);
}
function now(){return Date.now()}
function safeEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;
}

export function createAccountStore(options={}){
 const state=options.state||{users:{},otps:{},sessions:{}};
 const onChange=typeof options.onChange==='function'?options.onChange:null;
 const touch=()=>{try{onChange?.(state)}catch{/* ignore */}};
 const api={
  _state:state,
  reset(){state.users={};state.otps={};state.sessions={};touch()},
  getUser(phone){return state.users[phone]||null},
  getSession(token){
   const s=state.sessions[token];
   if(!s||s.expiresAt<now()){if(s)delete state.sessions[token];return null}
   const user=state.users[s.phone];
   if(!user||user.deletedAt)return null;
   return {token,phone:s.phone,user};
  },
  async sendCode({phone,agreedTerms,agreedPrivacy,env}){
   if(!phoneOk(phone))return {ok:false,status:400,error:'请输入有效的中国大陆手机号',code:'PHONE_INVALID'};
   if(!agreedTerms||!agreedPrivacy)return {ok:false,status:400,error:'请先勾选《用户协议》和《隐私政策》',code:'CONSENT_REQUIRED'};
   const provider=String(env?.SMS_PROVIDER||'mock').toLowerCase();
   if(provider!=='mock'){
    return {ok:false,status:503,error:'短信通道密钥未配置，开发期请设 SMS_PROVIDER=mock',code:'SMS_STUB_ONLY'};
   }
   const cooldown=Number(env?.AUTH_OTP_COOLDOWN_SEC)||60;
   const ttl=Number(env?.AUTH_OTP_TTL_SEC)||300;
   const prev=state.otps[phone];
   if(prev&&prev.sentAt+cooldown*1000>now()){
    return {ok:false,status:429,error:'验证码发送过于频繁，请稍后再试',code:'OTP_COOLDOWN',cooldownSec:Math.ceil((prev.sentAt+cooldown*1000-now())/1000)};
   }
   const code='000000';
   state.otps[phone]={hash:await hashCode(code,env?.AUTH_OTP_PEPPER),expiresAt:now()+ttl*1000,sentAt:now(),tries:0};
   touch();
   return {ok:true,status:200,data:{ok:true,cooldownSec:cooldown,mock:true,maskedPhone:maskPhone(phone)}};
  },
  async verifyCode({phone,code,env}){
   if(!phoneOk(phone))return {ok:false,status:400,error:'请输入有效的中国大陆手机号',code:'PHONE_INVALID'};
   const rec=state.otps[phone];
   if(!rec)return {ok:false,status:400,error:'请先获取验证码',code:'OTP_MISSING'};
   if(rec.expiresAt<now()){delete state.otps[phone];touch();return {ok:false,status:400,error:'验证码已过期，请重新获取',code:'OTP_EXPIRED'};}
   if(rec.tries>=5){delete state.otps[phone];touch();return {ok:false,status:400,error:'验证码错误次数过多，请重新获取',code:'OTP_LOCKED'};}
   const got=await hashCode(String(code||'').trim(),env?.AUTH_OTP_PEPPER);
   if(!safeEqual(rec.hash,got)){
    rec.tries+=1;touch();
    return {ok:false,status:400,error:'验证码不正确',code:'OTP_INVALID'};
   }
   delete state.otps[phone];
   let user=state.users[phone];
   if(!user||user.deletedAt){
    user={phone,createdAt:new Date().toISOString(),deletedAt:null,consents:{terms:true,privacy:true,sensitive:false,termsAt:new Date().toISOString(),privacyAt:new Date().toISOString()},journey:null};
    state.users[phone]=user;
   }else{
    user.consents={...user.consents,terms:true,privacy:true,termsAt:new Date().toISOString(),privacyAt:new Date().toISOString()};
   }
   const token=newToken();
   const lifetime=(Number(env?.AUTH_SESSION_TTL_SEC)||7*24*3600)*1000;
   state.sessions[token]={phone,expiresAt:now()+lifetime};
   touch();
   return {ok:true,status:200,data:{ok:true,token,phone:maskPhone(phone),sensitiveConsent:Boolean(user.consents?.sensitive),hasJourney:Boolean(user.journey)}};
  },
  setSensitiveConsent(phone,agreed){
   const user=state.users[phone];if(!user||user.deletedAt)return false;
   user.consents={...user.consents,sensitive:Boolean(agreed),sensitiveAt:agreed?new Date().toISOString():null};
   touch();return true;
  },
  saveJourney(phone,journey){
   const user=state.users[phone];if(!user||user.deletedAt)return false;
   user.journey=journey;user.updatedAt=new Date().toISOString();touch();return true;
  },
  exportUser(phone){
   const user=state.users[phone];if(!user||user.deletedAt)return null;
   return {exportedAt:new Date().toISOString(),phone:maskPhone(phone),consents:user.consents,createdAt:user.createdAt,updatedAt:user.updatedAt||null,journey:user.journey};
  },
  deleteUser(phone){
   const user=state.users[phone];if(!user)return false;
   user.deletedAt=new Date().toISOString();
   user.journey=null;
   user.consents={terms:false,privacy:false,sensitive:false};
   for(const [tok,s] of Object.entries(state.sessions))if(s.phone===phone)delete state.sessions[tok];
   touch();return true;
  }
 };
 return api;
}

let sharedStore=null;
export function getAccountStore(env){
 if(env?.__accountStore)return env.__accountStore;
 if(!sharedStore){
  const persist=env?.__accountPersist;
  let state;try{state=persist?.load?.()||undefined}catch{state=undefined}
  sharedStore=createAccountStore(persist?{state,onChange:s=>persist.save(s)}:{});
 }
 return sharedStore;
}
export function __resetAccountStoreForTests(){
 sharedStore=createAccountStore({});
 return sharedStore;
}

export function bearerToken(request){
 // P0-25: normalize multi-value headers some proxies leave as arrays
 const one=v=>{if(Array.isArray(v))v=v.find(Boolean)||'';return String(v||'').trim();};
 const h=one(request.headers.get('authorization'));
 if(h.toLowerCase().startsWith('bearer '))return h.slice(7).trim();
 return one(request.headers.get('x-butterfly-session'));
}

export async function handleAccountApi(request,env,store){
 const url=new URL(request.url);
 const path=url.pathname;
 const storeApi=store||getAccountStore(env);

 if(path==='/api/auth/send-code'){
  if(request.method!=='POST')return authJson({error:'不支持此操作'},405);
  if(request.headers.get('origin')!==url.origin)return authJson({error:'请求来源不匹配'},403);
  let body;try{body=JSON.parse(await request.text())}catch{return authJson({error:'输入格式无效'},400)}
  const result=await storeApi.sendCode({
   phone:String(body.phone||'').trim(),
   agreedTerms:Boolean(body.agreedTerms),
   agreedPrivacy:Boolean(body.agreedPrivacy),
   env
  });
  if(!result.ok)return authJson({error:result.error,code:result.code,cooldownSec:result.cooldownSec},result.status);
  return authJson(result.data);
 }

 if(path==='/api/auth/verify-code'){
  if(request.method!=='POST')return authJson({error:'不支持此操作'},405);
  if(request.headers.get('origin')!==url.origin)return authJson({error:'请求来源不匹配'},403);
  let body;try{body=JSON.parse(await request.text())}catch{return authJson({error:'输入格式无效'},400)}
  const result=await storeApi.verifyCode({phone:String(body.phone||'').trim(),code:String(body.code||'').trim(),env});
  if(!result.ok)return authJson({error:result.error,code:result.code},result.status);
  return authJson(result.data);
 }

 const token=bearerToken(request);
 const session=token?storeApi.getSession(token):null;

 if(path==='/api/auth/me'){
  if(request.method!=='GET')return authJson({error:'不支持此操作'},405);
  if(!session)return authJson({error:'请先登录',code:'AUTH_REQUIRED'},401);
  return authJson({ok:true,phone:maskPhone(session.phone),sensitiveConsent:Boolean(session.user.consents?.sensitive),hasJourney:Boolean(session.user.journey)});
 }

 if(path==='/api/auth/sensitive-consent'){
  if(request.method!=='POST')return authJson({error:'不支持此操作'},405);
  if(request.headers.get('origin')!==url.origin)return authJson({error:'请求来源不匹配'},403);
  if(!session)return authJson({error:'请先登录',code:'AUTH_REQUIRED'},401);
  let body;try{body=JSON.parse(await request.text())}catch{return authJson({error:'输入格式无效'},400)}
  if(!body.agreed)return authJson({error:'请勾选敏感信息处理同意',code:'SENSITIVE_REQUIRED'},400);
  storeApi.setSensitiveConsent(session.phone,true);
  return authJson({ok:true,sensitiveConsent:true});
 }

 if(path==='/api/account/export'){
  if(request.method!=='GET')return authJson({error:'不支持此操作'},405);
  if(!session)return authJson({error:'请先登录',code:'AUTH_REQUIRED'},401);
  const data=storeApi.exportUser(session.phone);
  if(!data)return authJson({error:'账号不存在或已注销',code:'ACCOUNT_GONE'},404);
  return authJson({ok:true,data});
 }

 if(path==='/api/account/delete'){
  if(request.method!=='POST')return authJson({error:'不支持此操作'},405);
  if(request.headers.get('origin')!==url.origin)return authJson({error:'请求来源不匹配'},403);
  if(!session)return authJson({error:'请先登录',code:'AUTH_REQUIRED'},401);
  let body={};try{const raw=await request.text();if(raw)body=JSON.parse(raw)}catch{return authJson({error:'输入格式无效'},400)}
  if(body.confirm!=='DELETE')return authJson({error:'请确认注销：confirm 须为 DELETE',code:'CONFIRM_REQUIRED'},400);
  storeApi.deleteUser(session.phone);
  return authJson({ok:true,deleted:true});
 }

 if(path==='/api/account/journey'){
  if(!session)return authJson({error:'请先登录',code:'AUTH_REQUIRED'},401);
  if(request.method==='GET'){
   return authJson({ok:true,journey:session.user.journey||null,sensitiveConsent:Boolean(session.user.consents?.sensitive)});
  }
  if(request.method==='PUT'){
   if(request.headers.get('origin')!==url.origin)return authJson({error:'请求来源不匹配'},403);
   let body;try{body=JSON.parse(await request.text())}catch{return authJson({error:'输入格式无效'},400)}
   const journey=body.journey??body;
   if(!journey||typeof journey!=='object')return authJson({error:'旅程数据无效'},400);
   storeApi.saveJourney(session.phone,journey);
   return authJson({ok:true});
  }
  return authJson({error:'不支持此操作'},405);
 }

 return null;
}

export {phoneOk,maskPhone,hashCode};
