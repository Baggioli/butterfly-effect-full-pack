#!/usr/bin/env node
import { writeFileSync } from 'fs';
const BASE='http://127.0.0.1:18888', ORIGIN='http://192.168.0.109:18888';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function api(path,{method='GET',token,body,timeoutMs=300000}={}){
  const headers={'Content-Type':'application/json',Origin:ORIGIN};
  if(token)headers.Authorization='Bearer '+token;
  const t0=Date.now();
  try{
    const r=await fetch(BASE+path,{method,headers,body:body!==undefined?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeoutMs)});
    const data=await r.json().catch(()=>({}));
    return {status:r.status,data,ms:Date.now()-t0};
  }catch(e){return {status:0,err:String(e),ms:Date.now()-t0}}
}
async function login(phone){
  await api('/api/auth/send-code',{method:'POST',body:{phone,agreedTerms:true,agreedPrivacy:true},timeoutMs:15000});
  const v=await api('/api/auth/verify-code',{method:'POST',body:{phone,code:'000000'},timeoutMs:15000});
  const token=v.data?.token; if(!token) throw Error('login fail '+JSON.stringify(v));
  const c=await api('/api/auth/sensitive-consent',{method:'POST',token,body:{agreed:true},timeoutMs:15000});
  if(c.status!==200) throw Error('consent '+c.status);
  return token;
}
function profile(tag){return {name:'虚构测试'+tag,goal:'90天内做出一份可展示的数据分析作品集（虚构验收档）',role:'会计',age:29,education:'本科',hours:4,skills:'Excel',constraints:'不能裸辞',experience:'5年总账（虚构）',resources:'旧电脑',interests:'表格',city:'杭州'};}
function journey(p){return {id:'g'+Date.now()+Math.random().toString(36).slice(2,6),profile:p,week:1,chapter:0,tasks:[],versions:[],observations:[],results:[],notes:'',learn:false,questChecks:{},storyChoices:{},events:[],profileEvidence:{},profileInterpretations:[],lastConversationAt:new Date().toISOString(),contentVersion:1};}
async function mainPath(tag,phone){
  const token=await login(phone); const p=profile(tag); const j=journey(p);
  await api('/api/account/journey',{method:'PUT',token,body:{journey:j},timeoutMs:15000});
  const got=await api('/api/account/journey',{token,timeoutMs:15000});
  const card=got.data?.journey?.profile?.name===p.name;
  const pl=await api('/api/ai',{method:'POST',token,body:{mode:'plan',profile:p}});
  const story=pl.data?.story; const today=story?.chapters?.[0]?.quests?.[0]?.title;
  if(pl.status===200&&story?.chapters?.length===4){
    await api('/api/account/journey',{method:'PUT',token,body:{journey:{...j,profile:{...p,aiStory:story}}},timeoutMs:15000});
  }
  return {tag,login:true,card,planStatus:pl.status,planMs:pl.ms,code:pl.data?.code,rule:pl.data?.rule,error:pl.data?.error,chapters:story?.chapters?.length,today,ok:pl.status===200&&story?.chapters?.length===4&&card};
}
const out={at:new Date().toISOString(),runs:[]};
out.runs.push(await mainPath('D','13800138021'));
console.log('runD',JSON.stringify(out.runs[0]));
out.runs.push(await mainPath('E','13800138022'));
console.log('runE',JSON.stringify(out.runs[1]));
{
  const token=await login('13800138023'); const p=profile('H3c'); const j=journey(p);
  await api('/api/account/journey',{method:'PUT',token,body:{journey:j},timeoutMs:15000});
  const firstP=api('/api/ai',{method:'POST',token,body:{mode:'plan',profile:p}});
  await sleep(600);
  const concurrent=await api('/api/ai',{method:'POST',token,body:{mode:'plan',profile:p},timeoutMs:20000});
  const mid=await api('/api/account/journey',{token,timeoutMs:15000});
  const first=await firstP;
  let retry=first; const attempts=[{n:0,status:first.status,code:first.data?.code,rule:first.data?.rule,ms:first.ms,ch:first.data?.story?.chapters?.length,today:first.data?.story?.chapters?.[0]?.quests?.[0]?.title}];
  let n=0;
  while(!(retry.status===200&&retry.data?.story?.chapters?.length===4)&&n<2){
    n++; await sleep(1000);
    retry=await api('/api/ai',{method:'POST',token,body:{mode:'plan',profile:p}});
    attempts.push({n,status:retry.status,code:retry.data?.code,rule:retry.data?.rule,ms:retry.ms,ch:retry.data?.story?.chapters?.length,today:retry.data?.story?.chapters?.[0]?.quests?.[0]?.title});
    console.log('retry',JSON.stringify(attempts.at(-1)));
  }
  const after=await api('/api/account/journey',{token,timeoutMs:15000});
  out.H3={concurrent:concurrent.status,cardSurvived:mid.data?.journey?.profile?.name===p.name,stillThere:after.data?.journey?.profile?.name===p.name,attempts,ok:(concurrent.status===429||concurrent.status===503)&&mid.data?.journey?.profile?.name===p.name&&retry.status===200&&retry.data?.story?.chapters?.length===4};
}
out.H1=out.runs.every(r=>r.ok);
out.H2=out.runs.every(r=>r.ok&&r.planMs<=300000);
out.ready=out.H1&&out.H2&&out.H3.ok;
console.log(JSON.stringify(out,null,2));
writeFileSync('/Users/lq/gate-h1-h4-result-v2.json',JSON.stringify(out,null,2));
process.exit(out.ready?0:2);
