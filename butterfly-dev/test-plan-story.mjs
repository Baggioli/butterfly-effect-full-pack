import assert from 'node:assert/strict';
import {api,normalizeStoryDraft,validateStory,StoryValidationError,withPlanSlot,PlanBusyError,__resetPlanQueueForTests,planQueueSnapshot,isAlreadyOperator,wantsBecomeOperator,isForbiddenOperatorTransitionTitle,rewriteOperatorArcTitle,applyStoryArcFraming,storyArcPromptHint} from './worker/api.js';

const baseQuest=()=>({title:'整理一份样表',steps:['打开表格','填三行样例','保存文件'],output:'一份样表文件',tool:'表格工具',example:'列A：____ 列B：____',minutes:20,why:'用已有工具先做出证据'});
const chapter=(name,quests,narrative='主人公根据现有条件先迈出可验证的一小步，观察反馈后再决定是否继续。')=>({name,period:'阶段',narrative,gate:'可核对的产出',quests});
const goodStory=()=>{
 const q1={...baseQuest(),title:'今天：列出三家目标机会'};
 const q2={...baseQuest(),title:'本周：发出一条询问'};
 return {title:'循序渐进',baseline:'每周4小时，年龄学历待补充',chapters:[
  chapter('起步',[q1,q2]),
  chapter('探索',[baseQuest()]),
  chapter('创作',[baseQuest()]),
  chapter('远方',[baseQuest()]),
 ]};
};

assert.throws(()=>validateStory({chapters:[]},4),e=>e instanceof StoryValidationError&&e.rule==='CHAPTER_COUNT');
assert.throws(()=>validateStory({...goodStory(),chapters:goodStory().chapters.map((c,i)=>i?c:{...c,quests:[baseQuest()]})},4),e=>e.rule==='CHAPTER1_QUEST_COUNT');
assert.throws(()=>validateStory({...goodStory(),chapters:goodStory().chapters.map((c,i)=>i?c:{...c,quests:[{...baseQuest(),title:'A'},{...baseQuest(),title:'B'}]})},4),e=>e.rule==='CHAPTER1_PREFIX');
assert.throws(()=>validateStory({...goodStory(),chapters:goodStory().chapters.map((c,i)=>i?c:{...c,quests:[{...baseQuest(),title:'今天：A',steps:['仅一步']},{...baseQuest(),title:'本周：B'}]})},4),e=>e.rule==='QUEST_STEPS');

const messy={
 title:'循序渐进',baseline:'每周4小时',
 chapters:[
  chapter('起步',[
   {...baseQuest(),title:'列出三家目标机会',steps:['a','b','c','多余']},
   {...baseQuest(),title:'本周：发出一条询问'},
   {...baseQuest(),title:'多余任务'},
  ]),
  chapter('探索',[baseQuest()]),
  chapter('创作',[baseQuest()]),
  chapter('远方',[baseQuest()]),
 ]
};
const normalized=normalizeStoryDraft(messy);
assert.equal(normalized.chapters[0].quests.length,2);
assert.equal(normalized.chapters[0].quests[0].title,'今天：列出三家目标机会');
assert.equal(normalized.chapters[0].quests[1].title,'本周：发出一条询问');
assert.equal(normalized.chapters[0].quests[0].steps.length,3);
assert.ok(validateStory(normalized,4));

const swapped=normalizeStoryDraft({
 ...goodStory(),
 chapters:goodStory().chapters.map((c,i)=>i?c:{...c,quests:[{...baseQuest(),title:'本周：后做'},{...baseQuest(),title:'今天：先做'}]})
});
// Slot-forced prefixes keep body order; no content-based swap.
assert.equal(swapped.chapters[0].quests[0].title,'今天：后做');
assert.equal(swapped.chapters[0].quests[1].title,'本周：先做');

const halfLabeled=normalizeStoryDraft({
 ...goodStory(),
 chapters:goodStory().chapters.map((c,i)=>i?c:{...c,quests:[{...baseQuest(),title:'本周：已标错位'},{...baseQuest(),title:'没有任何前缀'}]})
});
assert.equal(halfLabeled.chapters[0].quests[0].title,'今天：已标错位');
assert.equal(halfLabeled.chapters[0].quests[1].title,'本周：没有任何前缀');
assert.ok(validateStory(halfLabeled,4));

const synonym=normalizeStoryDraft({
 ...goodStory(),
 chapters:goodStory().chapters.map((c,i)=>i?c:{...c,quests:[{...baseQuest(),title:'今日-列清单'},{...baseQuest(),title:'这周：发消息'}]})
});
assert.equal(synonym.chapters[0].quests[0].title,'今天：列清单');
assert.equal(synonym.chapters[0].quests[1].title,'本周：发消息');
assert.ok(validateStory(synonym,4));

const oneQuest=normalizeStoryDraft({
 ...goodStory(),
 chapters:goodStory().chapters.map((c,i)=>i?c:{...c,quests:[{...baseQuest(),title:'列机会'}]})
});
assert.equal(oneQuest.chapters[0].quests.length,2);
assert.equal(oneQuest.chapters[0].quests[0].title.slice(0,3),'今天：');
assert.equal(oneQuest.chapters[0].quests[1].title.slice(0,3),'本周：');
assert.ok(validateStory(oneQuest,4));

const zeroQuest=normalizeStoryDraft({
 ...goodStory(),
 chapters:goodStory().chapters.map((c,i)=>i?c:{...c,quests:[]})
});
assert.equal(zeroQuest.chapters[0].quests.length,2);
assert.ok(validateStory(zeroQuest,4));

const junkQuest=normalizeStoryDraft({
 ...goodStory(),
 chapters:goodStory().chapters.map((c,i)=>i?c:{...c,quests:['not-an-object',42,null]})
});
assert.equal(junkQuest.chapters[0].quests.length,2);
assert.ok(validateStory(junkQuest,4));


const origin='https://example.test';
const req=(body)=>new Request(origin+'/api/ai',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'oai-authenticated-user-id':'test-user'},body:JSON.stringify(body)});
const realFetch=globalThis.fetch;
let calls=0;
globalThis.fetch=async(url,options)=>{
 calls++;
 const body=JSON.parse(options.body);
 // First plan call returns almost-valid (missing prefixes, 3 quests ch1); repair returns good.
 if(String(url).includes('api.deepseek.com')){
  const isRepair=body.messages?.some(m=>typeof m.content==='string'&&m.content.includes('未通过校验'));
  if(isRepair)return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(goodStory())}}]});
  const almost={...goodStory(),chapters:goodStory().chapters.map((c,i)=>i?c:{...c,quests:[{...baseQuest(),title:'列机会'},{...baseQuest(),title:'发询问'},{...baseQuest(),title:'多余'}]})};
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(almost)}}]});
 }
 throw Error('unexpected '+url);
};
const env={AI_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'test-only-placeholder'};
const ok=await api(req({mode:'plan',profile:{goal:'虚构测试目标',hours:4}}),env);
assert.equal(ok.status,200);
const okBody=await ok.json();
assert.equal(okBody.story.chapters[0].quests[0].title.slice(0,3),'今天：');
assert.equal(okBody.story.repaired,undefined,'normalize alone should pass without repair');

calls=0;
globalThis.fetch=async(url,options)=>{
 calls++;
 const body=JSON.parse(options.body);
 if(String(url).includes('api.deepseek.com')){
  const isRepair=body.messages?.some(m=>typeof m.content==='string'&&m.content.includes('未通过校验'));
  if(!isRepair){
   // Empty chapters — normalize cannot invent structure; needs repair.
   const bad={title:'残缺',baseline:'x',chapters:[]};
   return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(bad)}}]});
  }
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(goodStory())}}]});
 }
 throw Error('unexpected');
};
const repaired=await api(req({mode:'plan',profile:{goal:'虚构测试目标',hours:4}}),env);
assert.equal(repaired.status,200);
assert.equal((await repaired.json()).story.repaired,true);
assert.ok(calls>=2,'repair should invoke model again');

globalThis.fetch=async()=>{const err=new DOMException('Timeout','TimeoutError');throw err;};
const timed=await api(req({mode:'plan',profile:{goal:'虚构超时',hours:4}}),{AI_PROVIDER:'ollama',OLLAMA_BASE_URL:'http://127.0.0.1:11434'});
assert.equal(timed.status,502);
const timedBody=await timed.json();
assert.equal(timedBody.code,'PLAN_TIMEOUT');
assert.match(timedBody.error,/超时/);
assert.equal(timedBody.retryable,true);

globalThis.fetch=async(url)=>{
 if(String(url).includes('/api/show'))return Response.json({modelfile:'fake'});
 return Response.json({message:{content:'{not-json'},done:true,done_reason:'stop'});
};
const badJson=await api(req({mode:'plan',profile:{goal:'虚构坏JSON',hours:4}}),{AI_PROVIDER:'ollama',OLLAMA_BASE_URL:'http://127.0.0.1:11434'});
assert.equal(badJson.status,502);
assert.equal((await badJson.json()).code,'PLAN_BAD_JSON');

globalThis.fetch=async(url)=>{
 if(String(url).includes('/api/show'))return Response.json({modelfile:'fake'});
 return Response.json({message:{content:JSON.stringify({title:'x'})},done:true,done_reason:'length'});
};
const trunc=await api(req({mode:'plan',profile:{goal:'虚构截断',hours:4}}),{AI_PROVIDER:'ollama',OLLAMA_BASE_URL:'http://127.0.0.1:11434'});
assert.equal(trunc.status,502);
assert.equal((await trunc.json()).code,'PLAN_TRUNCATED');

globalThis.fetch=async(url)=>{
 if(String(url).includes('/api/show'))return Response.json({modelfile:'fake'});
 // Persistently invalid after repair
 return Response.json({message:{content:JSON.stringify({title:'残缺',baseline:'x',chapters:[]})},done:true,done_reason:'stop'});
};
const schemaFail=await api(req({mode:'plan',profile:{goal:'虚构校验失败',hours:4}}),{AI_PROVIDER:'ollama',OLLAMA_BASE_URL:'http://127.0.0.1:11434'});
assert.equal(schemaFail.status,502);
const schemaBody=await schemaFail.json();
assert.equal(schemaBody.code,'PLAN_SCHEMA');
assert.equal(schemaBody.rule,'CHAPTER_COUNT');

globalThis.fetch=realFetch;

__resetPlanQueueForTests();
// Queue unit: second waiter runs after first; only one active.
let concurrent=0,maxConcurrent=0;
const slow=async(ms,label)=>{concurrent++;maxConcurrent=Math.max(maxConcurrent,concurrent);await new Promise(r=>setTimeout(r,ms));concurrent--;return label};
const [a,b]=await Promise.all([withPlanSlot(()=>slow(40,'a'),{maxWaitMs:2000,maxDepth:4}),withPlanSlot(()=>slow(10,'b'),{maxWaitMs:2000,maxDepth:4})]);
assert.deepEqual([a,b],['a','b']);
assert.equal(maxConcurrent,1,'plan slot must be exclusive');
assert.deepEqual(planQueueSnapshot(),{active:false,waiting:0});

__resetPlanQueueForTests();
// Depth overflow → PLAN_BUSY without waiting forever.
const blocker=withPlanSlot(()=>slow(80,'block'),{maxWaitMs:500,maxDepth:1});
const waiter=withPlanSlot(()=>slow(10,'wait'),{maxWaitMs:500,maxDepth:1});
await new Promise(r=>setTimeout(r,5));
let overflowErr=null;
try{await withPlanSlot(()=>slow(10,'overflow'),{maxWaitMs:500,maxDepth:1})}catch(e){overflowErr=e}
assert.ok(overflowErr instanceof PlanBusyError);
assert.equal(overflowErr.code,'PLAN_BUSY');
await Promise.all([blocker,waiter]);
__resetPlanQueueForTests();

// API-level PLAN_BUSY when queue wait times out (mock slow first plan).
let gateResolve;const gate=new Promise(r=>{gateResolve=r});
let phase=0;
globalThis.fetch=async(url)=>{
 if(String(url).includes('api.deepseek.com')){
  phase++;
  if(phase===1){await gate;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(goodStory())}}]});}
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(goodStory())}}]});
 }
 throw Error('unexpected '+url);
};
const envBusy={AI_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'test-only-placeholder',PLAN_QUEUE_MAX_WAIT_MS:'40',PLAN_QUEUE_MAX_DEPTH:'2'};
const first=api(req({mode:'plan',profile:{goal:'排队甲',hours:4}}),envBusy);
await new Promise(r=>setTimeout(r,5));
const second=await api(req({mode:'plan',profile:{goal:'排队乙',hours:4}}),envBusy);
assert.equal(second.status,503);
const busyBody=await second.json();
assert.equal(busyBody.code,'PLAN_BUSY');
assert.equal(busyBody.retryable,true);
assert.match(busyBody.error,/排队|角色卡/);
assert.ok(busyBody.retryAfterSec>=1);
gateResolve();
assert.equal((await first).status,200);
__resetPlanQueueForTests();
globalThis.fetch=realFetch;


// ——— P0-24: already-operator must not be framed as becoming operator ———
const alreadyOp={role:'自主经营者',experience:'已是自主经营者，做数学模型相关业务',goal:'工作更自主，对用户的理解还不够深入透彻',dream:'工作更自主'};
const wantOp={role:'工程师',goal:'想成为自主经营者',dream:'转型成经营者'};
const workAutonomyOnly={role:'产品经理',goal:'工作更自主',dream:'工作更自主'};
assert.equal(isAlreadyOperator(alreadyOp),true);
assert.equal(wantsBecomeOperator(alreadyOp),false);
assert.equal(isAlreadyOperator(wantOp),false);
assert.equal(wantsBecomeOperator(wantOp),true);
assert.equal(wantsBecomeOperator(workAutonomyOnly),false,'工作更自主 ≠ 成为经营者');
assert.equal(isForbiddenOperatorTransitionTitle('从数学模型创造者到自主经营者的转型'),true);
assert.equal(isForbiddenOperatorTransitionTitle('深化对用户的理解与洞察'),false);
assert.match(rewriteOperatorArcTitle(alreadyOp),/用户|洞察|理解|经营/);
assert.doesNotMatch(rewriteOperatorArcTitle(alreadyOp),/转型|到自主经营者/);

const badArc={
 ...goodStory(),
 title:'从数学模型创造者到自主经营者的转型',
 chapters:goodStory().chapters.map((c,i)=>i?c:{...c,narrative:'他想转型成自主经营者并开始验证用户需求。'})
};
const fixedArc=validateStory(badArc,4,alreadyOp);
assert.doesNotMatch(fixedArc.title,/转型|到自主经营者/);
assert.match(fixedArc.title,/用户|洞察|理解|经营/);
assert.doesNotMatch(fixedArc.chapters[0].narrative,/转型成(?:自主)?经营者/);
const keepArc=validateStory(badArc,4,wantOp);
assert.equal(keepArc.title,'从数学模型创造者到自主经营者的转型');
const framed=applyStoryArcFraming({title:'转型成经营者',chapters:[{name:'起步',narrative:'从会计到自主经营者的转型'}]},alreadyOp);
assert.doesNotMatch(framed.title,/转型成/);
assert.doesNotMatch(framed.chapters[0].narrative,/到自主经营者的转型/);
assert.match(storyArcPromptHint(alreadyOp),/禁止|已是经营者/);
assert.match(storyArcPromptHint(wantOp),/允许/);
assert.match(storyArcPromptHint(workAutonomyOnly),/工作更自主/);

console.log('通过：normalize前缀/裁剪、校验规则码、归一化免重试、自动修复重试、超时/坏JSON/截断/结构失败分流、plan单队列互斥与PLAN_BUSY、P0-24已是经营者禁转型对照（模拟接口，非真实模型）。');
