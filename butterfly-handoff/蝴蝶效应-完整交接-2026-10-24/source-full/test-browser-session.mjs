import assert from 'node:assert/strict';
import {createBrowserSessionServer} from './scripts/browser-session.mjs';
const password='fictional-session-password-12345',port=18786,origin='http://127.0.0.1:'+port;
let identity;
const server=createBrowserSessionServer({fetch:async request=>{identity=request.headers.get('oai-authenticated-user-id');return Response.json({ok:true})}},{DGX_APP_PASSWORD:password,DGX_APP_PORT:String(port)});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
const enter=(value,source=origin)=>fetch(origin+'/session',{method:'POST',redirect:'manual',headers:{Origin:source,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password:value})});
try{
 const landing=await fetch(origin);assert.equal(landing.status,200);assert.equal(landing.headers.get('www-authenticate'),null);assert.match(await landing.text(),/继续你的故事/);
 assert.equal((await fetch(origin+'/api/ai/status')).status,401);
 assert.equal((await enter(password,'http://example.invalid')).status,403);
 const wrong=await enter('wrong');assert.equal(wrong.headers.get('set-cookie'),null);assert.match(await wrong.text(),/口令不正确/);
 const signed=await enter(password);assert.equal(signed.status,303);const cookie=signed.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
 const headers={Cookie:cookie.split(';')[0],Authorization:'Basic invalid-cached-credentials'};
 assert.equal((await fetch(origin+'/api/ai/status',{headers})).status,200);assert.equal(identity,'dgx-owner');
 assert.equal((await fetch(origin+'/api/ai',{method:'POST',headers:{...headers,Origin:'http://example.invalid'},body:'{}'})).status,403);
 const logout=await fetch(origin+'/session/logout',{method:'POST',redirect:'manual',headers:{...headers,Origin:origin}});assert.equal(logout.status,303);
 assert.equal((await fetch(origin+'/api/ai/status',{headers})).status,401);
 assert.equal((await fetch(origin+'/api/ai/status',{headers:{Authorization:'Basic '+Buffer.from('owner:'+password).toString('base64')}})).status,200);
}finally{await new Promise(resolve=>server.close(resolve))}
console.log('通过：页面内登录、无原生认证弹窗、口令校验、会话Cookie、跨来源拦截、旧认证缓存兼容与退出失效。');
