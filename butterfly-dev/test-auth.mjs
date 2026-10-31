import assert from 'node:assert/strict';
import {api,__resetAccountStoreForTests} from './worker/api.js';
import {createAccountStore,phoneOk} from './worker/auth.js';

const origin='https://example.test';
const env={SMS_PROVIDER:'mock',AUTH_OTP_COOLDOWN_SEC:'1'};
const headers=(extra={})=>({'Content-Type':'application/json',Origin:origin,...extra});
const post=(path,body,extra={})=>new Request(origin+path,{method:'POST',headers:headers(extra),body:JSON.stringify(body)});
const get=(path,extra={})=>new Request(origin+path,{headers:headers(extra)});

__resetAccountStoreForTests();

assert.equal(phoneOk('13800138000'),true);
assert.equal(phoneOk('123'),false);

// Consent gates: cannot send OTP without both agreements
let r=await api(post('/api/auth/send-code',{phone:'13800138000',agreedTerms:false,agreedPrivacy:true}),env);
assert.equal(r.status,400);
assert.equal((await r.json()).code,'CONSENT_REQUIRED');
r=await api(post('/api/auth/send-code',{phone:'13800138000',agreedTerms:true,agreedPrivacy:false}),env);
assert.equal(r.status,400);

r=await api(post('/api/auth/send-code',{phone:'13800138000',agreedTerms:true,agreedPrivacy:true}),env);
assert.equal(r.status,200);
const sent=await r.json();
assert.equal(sent.mock,true);

// Wrong OTP
r=await api(post('/api/auth/verify-code',{phone:'13800138000',code:'111111'}),env);
assert.equal(r.status,400);

// Mock OTP 000000
r=await api(post('/api/auth/verify-code',{phone:'13800138000',code:'000000'}),env);
assert.equal(r.status,200);
const session=await r.json();
assert.ok(session.token);
assert.equal(session.sensitiveConsent,false);
const auth={Authorization:'Bearer '+session.token};

r=await api(get('/api/auth/me',auth),env);
assert.equal(r.status,200);
assert.equal((await r.json()).sensitiveConsent,false);

// Sensitive consent
r=await api(post('/api/auth/sensitive-consent',{agreed:false},auth),env);
assert.equal(r.status,400);
r=await api(post('/api/auth/sensitive-consent',{agreed:true},auth),env);
assert.equal(r.status,200);

// Journey persist
const journey={id:'j1',profile:{name:'测',goal:'试单',hours:4},week:1,chapter:0,tasks:[],versions:[],observations:[],results:[],notes:[]};
r=await api(new Request(origin+'/api/account/journey',{method:'PUT',headers:headers(auth),body:JSON.stringify({journey})}),env);
assert.equal(r.status,200);
r=await api(get('/api/account/journey',auth),env);
assert.equal(r.status,200);
assert.equal((await r.json()).journey.id,'j1');

// Export
r=await api(get('/api/account/export',auth),env);
assert.equal(r.status,200);
const exported=await r.json();
assert.equal(exported.data.journey.id,'j1');
assert.match(exported.data.phone,/\*\*\*\*/);

// Delete
r=await api(post('/api/account/delete',{confirm:'no'},auth),env);
assert.equal(r.status,400);
r=await api(post('/api/account/delete',{confirm:'DELETE'},auth),env);
assert.equal(r.status,200);
r=await api(get('/api/auth/me',auth),env);
assert.equal(r.status,401);
r=await api(get('/api/account/export',auth),env);
assert.equal(r.status,401);

// Non-mock SMS refused
__resetAccountStoreForTests();
r=await api(post('/api/auth/send-code',{phone:'13900139000',agreedTerms:true,agreedPrivacy:true}),{SMS_PROVIDER:'aliyun'});
assert.equal(r.status,503);

// Auth routes do not require oai header; AI still does
r=await api(get('/api/ai/status'),env);
assert.equal(r.status,401);

// Store unit: isolated instance
const store=createAccountStore();
await store.sendCode({phone:'13700137000',agreedTerms:true,agreedPrivacy:true,env});
const v=await store.verifyCode({phone:'13700137000',code:'000000',env});
assert.ok(v.ok);
store.deleteUser('13700137000');
assert.equal(store.getSession(v.data.token),null);

console.log('通过：协议勾选门禁、mock OTP、敏感同意、旅程存取、导出/注销、非 mock 短信拒绝、AI 仍需私人空间头。');
