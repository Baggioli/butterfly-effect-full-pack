import assert from 'node:assert/strict';
import {createBrowserSessionServer} from './scripts/browser-session.mjs';
import {createPrivateGateway} from './scripts/private-gateway.mjs';
const password='fictional-direct-password-123456';
const worker={fetch:async request=>Response.json({identity:request.headers.get('oai-authenticated-user-id'),origin:request.headers.get('origin')})};
const local=createBrowserSessionServer(worker,{DGX_APP_PASSWORD:password,DGX_APP_PORT:'18785',BUTTERFLY_DIRECT_ACCESS:'1'});
await new Promise(resolve=>local.listen(18785,'127.0.0.1',resolve));
try{
 const response=await fetch('http://127.0.0.1:18785/');assert.equal(response.status,200);assert.equal(response.headers.get('www-authenticate'),null);assert.equal((await response.json()).identity,'dgx-owner');
 assert.equal((await fetch('http://127.0.0.1:18785/api/ai',{method:'POST',headers:{Origin:'https://untrusted.invalid'},body:'{}'})).status,403);
 assert.equal((await fetch('http://127.0.0.1:18785/api/ai',{method:'POST',headers:{Origin:'http://127.0.0.1:18785'},body:'{}'})).status,200);
}finally{await new Promise(resolve=>local.close(resolve))}
const origin='https://private-test.example.ts.net:8443';
const gateway=createPrivateGateway(worker,{DGX_APP_PASSWORD:password,DGX_APP_PORT:'18784'},{origin,ownerLogin:'fictional-owner@example.test'});
await new Promise(resolve=>gateway.listen(18784,'127.0.0.1',resolve));
try{
 const headers={Host:'private-test.example.ts.net:8443','Tailscale-User-Login':'fictional-owner@example.test'};
 assert.equal((await fetch('http://127.0.0.1:18784/')).status,403);
 assert.equal((await fetch('http://127.0.0.1:18784/',{headers:{...headers,'Tailscale-User-Login':'someone-else@example.test'}})).status,403);
 assert.equal((await fetch('http://127.0.0.1:18784/',{headers})).status,200);
 assert.equal((await fetch('http://127.0.0.1:18784/api/ai',{method:'POST',headers:{...headers,Origin:'https://untrusted.invalid'},body:'{}'})).status,403);
 const result=await fetch('http://127.0.0.1:18784/api/ai',{method:'POST',headers:{...headers,Origin:origin},body:'{}'});assert.equal(result.status,200);assert.equal((await result.json()).origin,'http://127.0.0.1:18784');
}finally{await new Promise(resolve=>gateway.close(resolve))}
console.log('通过：本机免口令、跨来源保护、手机入口仅允许私人网络所有者、拒绝缺失或伪造身份。');
