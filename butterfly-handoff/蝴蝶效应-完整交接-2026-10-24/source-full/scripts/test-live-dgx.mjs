// Real HTTP + real Ollama integration. All profiles below are fictional test data.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createDGXServer} from './dgx-server.mjs';
import worker from '../worker/index.js';
const model=process.env.AI_MODEL||'qwen2.5:7b';
const port=18788, origin=`http://127.0.0.1:${port}`;
const password=randomBytes(32).toString('base64url');
const headers={Authorization:'Basic '+Buffer.from('owner:'+password).toString('base64'),Origin:origin,'Content-Type':'application/json'};
const realFetch=globalThis.fetch;
let metrics=null,rawModelOutput=null;
globalThis.fetch=async(...args)=>{
 const response=await realFetch(...args);
 if(String(args[0])==='http://127.0.0.1:11434/api/chat'){
  const data=await response.clone().json();
  rawModelOutput=data.message?.content;
  metrics={done:data.done,doneReason:data.done_reason,promptTokens:data.prompt_eval_count,outputTokens:data.eval_count,loadSeconds:data.load_duration/1e9,inferenceSeconds:data.eval_duration/1e9,tokensPerSecond:data.eval_count/(data.eval_duration/1e9)};
 }
 return response;
};
const server=createDGXServer(worker,{AI_MODEL:model,DGX_APP_PASSWORD:password,DGX_APP_PORT:String(port)});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
const common={goal:'90天内完成一个Excel表格自动化服务的付费试单',hours:4,constraints:'不辞职，不购买课程，不编造收入与客户'};
const novice={...common,name:'虚构测试甲',age:'22',education:'高中 / 中专',role:'便利店店员',experience:'没有编程经验，刚开始学习Excel',skills:'基础录入',resources:'只有个人电脑，没有客户联系人',budget:0};
const experienced={...common,name:'虚构测试乙',age:'45',education:'本科',major:'会计',role:'制造业财务主管',workYears:'15',experience:'15年财务报表和流程管理，熟练Excel但不会编程',skills:'Excel透视表和财务流程梳理',resources:'有3位愿意交流的同行，可使用脱敏示例表，不能用公司机密数据',budget:0};
const cases=[
 {id:'extract',body:{mode:'extract',intro:'以下是虚构测试人物：我22岁，高中毕业，在便利店上班，没有编程经验，只有个人电脑，没有客户联系人。想90天内完成一个Excel表格自动化服务的付费试单，每周可用4小时。不辞职，不买课程。'},check:d=>{assert.equal(String(d.profile.age),'22');assert.equal(d.profile.hours,4);assert.ok(d.summary);assert.equal(d.profile.city,undefined);assert.equal(d.profile.budget,undefined);assert.ok(d.questions.length<=2)}},
 {id:'plan-novice',body:{mode:'plan',profile:novice}},
 {id:'plan-experienced',body:{mode:'plan',profile:experienced}},
 {id:'adjust-feedback',body:{mode:'adjust',profile:{...experienced,hours:.5},stage:{name:'访谈与验证',gate:'确认一个可用脱敏表验证的问题'},records:[{title:'邀请3位同行交流报表痛点',status:'done',actual:25,result:'3人都拒绝访谈，未取得任何客户需求证据',reason:'同行没有时间'},{title:'制作脱敏样表',status:'unknown',result:'尚未反馈'}],observations:[{text:'只能每周投入30分钟，无法开视频会议',state:'已确认'},{text:'用户不擅长Excel',state:'不准确'}]}},
];
const report={date:new Date().toISOString(),model,fictionalData:true,cases:[],checks:{}};
try{
 assert.equal((await fetch(origin+'/api/ai/status')).status,401);
 report.checks.unauthenticatedRejected=true;
 for(const c of cases.filter(c=>!process.env.LIVE_CASES||process.env.LIVE_CASES.split(',').includes(c.id))){
  metrics=null;rawModelOutput=null;const start=performance.now();
  const response=await fetch(origin+'/api/ai',{method:'POST',headers,body:JSON.stringify(c.body)});
  const output=await response.json();const elapsedSeconds=(performance.now()-start)/1000;
  const entry={id:c.id,status:response.status,elapsedSeconds,metrics,input:c.body,output,rawModelOutput};
  report.cases.push(entry);
  try{
   assert.equal(response.status,200,JSON.stringify(output));c.check?.(output);
   if(c.body.mode!=='extract'){
    const s=output.story;assert.equal(s.chapters.length,4);
    for(const chapter of s.chapters){assert.ok(chapter.quests.length>=1&&chapter.quests.length<=3);for(const q of chapter.quests){assert.equal(q.steps.length,3);for(const k of ['title','output','tool','example','why'])assert.ok(q[k])}}
    const minutes=s.chapters[0].quests.reduce((sum,q)=>sum+q.minutes,0);
    assert.ok(minutes<=c.body.profile.hours*60*.7);entry.firstStageMinutes=minutes;
   }
   entry.passed=true;
  }catch(e){entry.passed=false;entry.failure=e.message}
  console.log(JSON.stringify({id:c.id,status:entry.status,seconds:+elapsedSeconds.toFixed(2),passed:entry.passed,metrics,firstStageMinutes:entry.firstStageMinutes,failure:entry.failure}));
  await mkdir('reports',{recursive:true});
  await writeFile(`reports/live-${model.replace(/[^a-z0-9.-]/gi,'-')}.json`,JSON.stringify(report,null,2)+'\n');
 }
 const a=report.cases.find(c=>c.id==='plan-novice').output.story;
 const b=report.cases.find(c=>c.id==='plan-experienced').output.story;
 report.checks.routesDiffer=!!a&&!!b&&JSON.stringify(a.chapters[0].quests)!==JSON.stringify(b.chapters[0].quests);
 report.passed=report.cases.every(c=>c.passed)&&report.checks.routesDiffer;
}finally{
 await mkdir('reports',{recursive:true});
 await writeFile(`reports/live-${model.replace(/[^a-z0-9.-]/gi,'-')}.json`,JSON.stringify(report,null,2)+'\n');
 await new Promise(resolve=>server.close(resolve));globalThis.fetch=realFetch;
}
if(!report.passed)process.exitCode=1;
