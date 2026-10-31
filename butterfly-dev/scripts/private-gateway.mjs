import {createDGXServer} from './dgx-server.mjs';
export function createPrivateGateway(worker,env,{origin,ownerLogin}){
 const expected=new URL(origin);
 if(expected.protocol!=='https:'||!expected.hostname.endsWith('.ts.net')||expected.pathname!=='/'||!ownerLogin)throw Error('Private HTTPS origin and owner identity are required');
 const server=createDGXServer(worker,env),[handler]=server.listeners('request');server.removeAllListeners('request');
 const port=Number(env.DGX_APP_PORT||8790),internal='127.0.0.1:'+port;
 const deny=(res,status,message)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end(message)};
 server.on('request',(req,res)=>{
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return deny(res,403,'此入口仅供私人网络访问');
  if(![expected.host,internal,'localhost:'+port].includes(req.headers.host))return deny(res,403,'访问地址不匹配');
  const login=req.headers['tailscale-user-login'];
  if(typeof login!=='string'||login.toLowerCase()!==ownerLogin.toLowerCase())return deny(res,403,'请先连接你的私人网络，再打开此页面');
  let url;try{url=new URL(req.url,expected.origin)}catch{return deny(res,400,'访问地址无效')}
  if(url.origin!==expected.origin)return deny(res,403,'访问地址不匹配');
  if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==expected.origin)return deny(res,403,'请求来源不匹配');
  req.url=url.pathname+url.search;req.headers.host=internal;
  if(req.headers.origin===expected.origin)req.headers.origin='http://'+internal;
  req.headers.authorization='Basic '+Buffer.from('owner:'+env.DGX_APP_PASSWORD).toString('base64');
  return handler(req,res);
 });
 return server;
}
