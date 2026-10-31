import assert from 'node:assert/strict';
import {createDevWorker} from './scripts/dev.mjs';
const password='fictional-test-password-12345';
const worker=createDevWorker(password);
const origin='http://127.0.0.1:4173';
const page=await worker.fetch(new Request(origin));assert.equal(page.status,200);assert.match(await page.text(),/蝴蝶效应/);
assert.equal((await worker.fetch(new Request(origin+'/%2e%2e%2fscripts/dev.mjs'))).status,404);
const realFetch=globalThis.fetch;let calls=0;
globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'http://127.0.0.1:8787/api/ai');assert.equal(options.headers.get('origin'),'http://127.0.0.1:8787');assert.equal(options.headers.get('authorization'),'Basic '+Buffer.from('owner:'+password).toString('base64'));assert.equal(options.headers.get('oai-authenticated-user-id'),null);assert.equal(options.redirect,'error');return Response.json({ok:true})};
try{
 const make=source=>new Request(origin+'/api/ai',{method:'POST',headers:{Origin:source,Authorization:'untrusted','oai-authenticated-user-id':'spoof','Content-Type':'application/json'},body:'{}'});
 assert.equal((await worker.fetch(make('http://example.invalid'))).status,403);assert.equal(calls,0);
 assert.equal((await worker.fetch(make(origin))).status,200);assert.equal(calls,1);
 globalThis.fetch=async()=>{throw Error('offline')};
 assert.equal((await worker.fetch(make(origin))).status,502);
}finally{globalThis.fetch=realFetch}
console.log('通过：本机源码预览、目录越界拦截、跨来源拒绝、DGX认证代理与离线明确报错。');
