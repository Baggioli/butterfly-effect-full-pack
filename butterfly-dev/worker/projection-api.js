/** 人生推演 M1 API（/api/projection/*）。多数接口需登录 + 敏感信息同意；POST 校验来源。
 * 例外：params 公开；demo/actual（P0-25）允许未登录（合成画像，不落库）。 */
import {PROJECTION_PARAMS} from './projection-params.js';
import {INCOME_TABLE} from './projection-income-table.js';
import {getAccountStore,bearerToken} from './auth.js';
import {buildRoleFacts,buildGoalTree,detectCrisis,gapSchema,GAP_SYSTEM_PROMPT,sanitizeGap,heuristicGap,assembleGap,confirmGap,computeProjection,projectionInputsHash,validateProjection,shareCardModel,pjSha256,pjLine,computeActualLine,actualLineGate,demoExecution,buildWeeklyReport,weeklyReportGate,PJ_WEEKLY} from './projection.js';
import {generateStoryLLM,storyTemplate,storyContinuationTemplate,storyValidateContinuation,storyRewriteDiff,storyContinuationDiff} from './projection-story.js';

const pjJson=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const PJ_KEEP=20,PJ_KEEP_LOGS=200;
function pjMemoryStore(){const m=new Map();return {async load(k){return m.has(k)?structuredClone(m.get(k)):null;},async save(k,doc){m.set(k,structuredClone(doc));}};}
let pjSharedStore=null;
export function projectionStore(env){if(env?.PROJECTION_STORE)return env.PROJECTION_STORE;if(!pjSharedStore)pjSharedStore=pjMemoryStore();return pjSharedStore;}
export function __resetProjectionStoreForTests(){pjSharedStore=pjMemoryStore();}
const pjEmptyDoc=()=>({schema:'projection-user/v1',roleFacts:[],goalTrees:[],gaps:[],projections:[],logs:[]});
const pjPush=(arr,item,max=PJ_KEEP)=>{arr.push(item);while(arr.length>max)arr.shift();};
const pjId=p=>p+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);

/* 单飞队列：差距抽取一次只跑一个，避免与规划争抢 GPU 时无限并发 */
let pjActive=null;const pjWaiters=[];
async function pjSlot(fn){
 if(pjActive){if(pjWaiters.length>=6)throw Object.assign(Error('推演服务繁忙，请稍后重试'),{status:429});await new Promise(r=>pjWaiters.push(r));}
 pjActive=true;try{return await fn();}finally{pjActive=null;const next=pjWaiters.shift();if(next)next();}
}

/** 大模型①：差距抽取（schema 约束 + temperature 0）。返回 {dims, model, ms, source, attempts} */
export async function extractGapLLM(env,rf,goalTree,{model,fallbackModel,fetchImpl=fetch,base='http://127.0.0.1:11434'}={}){
 const attempts=[];const payload={facts:rf.facts.map(f=>({id:f.id,label:f.label,value:f.value})),unknowns:rf.unknowns.map(u=>u.label),bigGoal:goalTree.items[0].text,stageGoal:goalTree.items[1].text};
 const models=[model||env.AI_GAP_MODEL||'qwen2.5:7b',fallbackModel??(env.AI_GAP_FALLBACK_MODEL||'qwen2.5:32b')].filter((m,i,a)=>m&&a.indexOf(m)===i);
 for(const m of models){
  const t0=Date.now();
  try{
   const meta=await fetchImpl(base+'/api/show',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:m}),signal:AbortSignal.timeout(10000),redirect:'error'});
   if(!meta.ok)throw Error('model_missing');const d=await meta.json();if(d.remote_host||d.remote_model)throw Error('remote_blocked');
   const r=await fetchImpl(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:m,stream:false,format:gapSchema(rf),options:{temperature:0,num_predict:1200},messages:[{role:'system',content:GAP_SYSTEM_PROMPT},{role:'user',content:JSON.stringify(payload)}]}),signal:AbortSignal.timeout(180000),redirect:'error'});
   if(!r.ok)throw Error('chat_http_'+r.status);
   const res=await r.json();if(res.remote_host||res.remote_model)throw Error('remote_blocked');if(res.done_reason==='length')throw Error('truncated');
   const raw=JSON.parse(res.message?.content||'{}');
   const valid=raw&&raw.dims&&['ability','credential','experience','network','income'].every(k=>Number.isInteger(raw.dims[k]?.level));
   if(!valid)throw Error('schema_invalid');
   const dims=sanitizeGap(raw,rf);
   attempts.push({model:m,ok:true,ms:Date.now()-t0});
   return {dims,raw,model:m,ms:Date.now()-t0,source:'llm',attempts};
  }catch(e){attempts.push({model:m,ok:false,ms:Date.now()-t0,error:String(e.message||e).slice(0,60)});}
 }
 return {dims:heuristicGap(rf),model:null,ms:attempts.reduce((a,b)=>a+b.ms,0),source:'heuristic',attempts};
}

export function publicParams(P=PROJECTION_PARAMS){
 const dimLabels=Object.fromEntries((P.dims||[]).map(d=>[d.key,d.label]));
 return {actualLine:{notice:P.actualLine.notice,placeholder:P.actualLine.placeholder,pauseReasons:P.actualLine.pauseReasons,demo:P.actualLine.demo,firstAppearance:P.actualLine.firstAppearance},version:P.version,incomeTableVersion:INCOME_TABLE.version,coefficientVersion:INCOME_TABLE.expCoefficients.version,dims:P.dims,dimLabels,levelLabels:P.levelLabels,badge:P.aiBadge,firstUseNotice:P.firstUseNotice,planAssumption:P.planAssumption,pageDisclaimer:P.pageDisclaimer,calibration:P.calibration,incomeDisclaimer:P.incomeDisclaimer,crisisNotice:P.crisisNotice};
}
/** 演示模式内置合成画像（用户尚无确认过的差距时使用；明确标注合成） */
const PJ_DEMO_PROFILE={name:'合成画像',age:'27',education:'本科',city:'深圳',role:'行政专员',workYears:'4',skills:'Excel 数据透视表，会写简单的 SQL 查询',hours:8,goal:'一年内转岗做数据分析师',longGoal:'做业务数据分析'};
const PJ_DEMO_LEVELS={ability:2,credential:1,experience:3,network:2,income:2};
/** 用户真实执行记录 → execution（只取当前推演版本之后的记录；暂停带原因与天数） */
export function pjExecutionFromLogs(doc,proj,now){
 const since=Date.parse(proj.createdAt||0);
 const records=(doc.logs||[]).filter(l=>(l.type==='task'||l.type==='pause')&&Date.parse(l.at)>=since).map(l=>({id:l.id,taskId:l.taskId||'',nodeId:l.nodeId||'',status:l.status,at:l.at,...(l.status==='paused'?{pauseReason:l.pauseReason,pauseDays:l.pauseDays}:{})}));
 return {startedAt:proj.createdAt,asOf:now,records};
}
/** 读取时计算实际线视图（不落库；R15 未过门槛 → 灰色占位） */
export function pjActualView(proj,execution,P=PROJECTION_PARAMS){
 if(!proj||proj.mode!=='normal')return proj;
 const plan=pjLine(proj,'plan');if(!plan)return proj;
 const gate=actualLineGate(execution,P);
 const lines=(proj.lines||[]).filter(l=>l.kind!=='actual');
 if(!gate.met)return {...proj,lines,actual:{status:'placeholder',gate,placeholder:P.actualLine.placeholder,notice:null,attribution:[],pauses:[]}};
 const titles=Object.fromEntries([...(proj.tasks?.today||[]),...(proj.tasks?.week||[])].map(t=>[t.id,t.title]));
 const a=computeActualLine({planLine:plan,execution,P,planStartedAt:proj.createdAt,taskTitles:titles});
 return {...proj,lines:[...lines,a.line],actual:{status:'ready',gate,placeholder:null,notice:P.actualLine.notice,attribution:a.attribution,pauses:a.pauses,perNode:a.perNode,startedAt:a.startedAt,asOf:a.asOf,deltaWeeks:a.line.deltaWeeks,paramVersion:a.paramVersion}};
}
function pjDimLabels(P=PROJECTION_PARAMS){return Object.fromEntries((P.dims||[]).map(d=>[d.key,d.label]));}

/* ---- P0-14 详细故事版：异步生成（骨架先返回；story.status pending→generating→ready|failed） ----
 * 故事单独存于 <userKey>_story（按 projectionId），后台任务只写这一份，避免与执行记录等请求互相覆盖。 */
const pjStoryRunning=new Set();let pjStoryChain=Promise.resolve();let pjStoryLock=Promise.resolve();
const pjStoryKey=k=>k+'_story';
const pjStoryNodes=proj=>(pjLine(proj,'plan')?.nodes||[]).length;
async function pjStoryAll(store,userKey){return (await store.load(pjStoryKey(userKey)))?.items||{};}
function pjStoryPut(store,userKey,projId,fn){
 const run=pjStoryLock.then(async()=>{const d=(await store.load(pjStoryKey(userKey)))||{schema:'projection-story-store/v1',items:{}};
  const next=fn(d.items[projId]||null);if(next===undefined)return d.items[projId];d.items[projId]=next;
  const ids=Object.keys(d.items);while(ids.length>PJ_KEEP)delete d.items[ids.shift()];
  await store.save(pjStoryKey(userKey),d);return next;});
 pjStoryLock=run.catch(()=>{});return run;
}
/** 读取视图：超时或进程内无对应任务（服务重启）→ failed，可重试；不改动推演本身。 */
export function pjStoryView(proj,stored,{now=Date.now(),P=PROJECTION_PARAMS}={}){
 let s=stored||proj?.story||null;
 const rw=s?.rewrite;if(rw?.status==='generating'){const ag=now-Date.parse(rw.startedAt||0);if(ag>(P.story.timeoutMs||360000)||(!pjStoryRunning.has(proj.id)&&ag>15000))s={...s,rewrite:{...rw,status:'failed',error:ag>(P.story.timeoutMs||360000)?'timeout':'interrupted',failedText:P.story.failedText,retryable:true}};}
 if(!s||s.status!=='generating')return s;
 const age=now-Date.parse(s.startedAt||0);
 if(age>(P.story.timeoutMs||360000))return {...s,status:'failed',error:'timeout',failedText:P.story.failedText,retryable:true};
 if(!pjStoryRunning.has(proj.id)&&age>15000)return {...s,status:'failed',error:'interrupted',failedText:P.story.failedText,retryable:true};
 return s;
}
const pjWithStory=(proj,items)=>proj?{...proj,story:pjStoryView(proj,items?.[proj.id])}:proj;
const pjStoryKeep=p=>({continuations:p?.continuations||[],drafts:p?.drafts||[],history:p?.history||[],storyVersion:p?.storyVersion||0});
function pjStoryMarked(proj,prev,now,P=PROJECTION_PARAMS){
 return {schema:'story/v1',version:P.story.version,status:'generating',startedAt:now,badge:P.aiBadge,pendingText:P.story.pendingText,generatingText:P.story.generatingText,
  summary:null,longForm:null,perNode:[],progress:{done:0,total:pjStoryNodes(proj)},error:null,attempt:(prev?.attempt||0)+1,...pjStoryKeep(prev)};
}
/** 需要（重新）生成：正常模式且尚无 ready/进行中的故事；force 时对 ready 故事走「改写草稿」。 */
async function pjStoryNeeds(store,userKey,proj,force=false){
 if(proj?.mode!=='normal')return false;const v=pjStoryView(proj,(await pjStoryAll(store,userKey))[proj.id]);
 if(v?.status==='generating'||v?.rewrite?.status==='generating')return false;return force||!v||v.status==='pending'||v.status==='failed';
}
const PJ_STORY_KEEP_DRAFTS=3,PJ_STORY_KEEP_HISTORY=5;
const pjStorySnap=s=>({storyVersion:s.storyVersion||0,source:s.source,model:s.model,summary:s.summary,longForm:s.longForm,perNode:s.perNode,chars:s.chars,generatedAt:s.generatedAt,continuations:s.continuations||[]});
/** 标记并启动后台生成（串行；每段写回进度）。首次生成 → 直接写入 ready（storyVersion 1）；
 * 已有 ready 故事时（AI 改写）→ 当前故事保持可见，结果进入 drafts 并附差异摘要，确认后才写入留版（P0-19）。
 * 返回 {marked,job}：marked 写好状态即 resolve；job 为整个生成任务。 */
export function pjStoryKick(env,store,userKey,proj,{fetchImpl=fetch,roleFacts=null,now=new Date().toISOString(),authoritativeNearTerm=null,planStory=null,profile=null}={}){
 const P=PROJECTION_PARAMS,projId=proj.id;
 if(pjStoryRunning.has(projId))return {marked:Promise.resolve(),job:pjStoryChain};
 pjStoryRunning.add(projId);
 let rewrite=false;
 const marked=pjStoryPut(store,userKey,projId,prev=>{
  if(prev?.status==='ready'){rewrite=true;return {...prev,rewrite:{status:'generating',startedAt:now,progress:{done:0,total:pjStoryNodes(proj)},generatingText:P.story.generatingText}};}
  return pjStoryMarked(proj,prev,now);});
 const fail=(err,extra={})=>pjStoryPut(store,userKey,projId,prev=>rewrite
  ?{...(prev||{}),rewrite:{status:'failed',error:err,failedText:P.story.failedText,retryable:true,...extra}}
  :{...(prev||{}),status:'failed',error:err,failedText:P.story.failedText,retryable:true,...extra});
 const job=pjStoryChain.then(()=>marked).then(async()=>{
  try{
   const story=await generateStoryLLM(env,proj,{roleFacts,fetchImpl,base:env?.OLLAMA_BASE_URL||'http://127.0.0.1:11434',
    profile,authoritativeNearTerm,planStory,
    onProgress:pr=>pjStoryPut(store,userKey,projId,prev=>rewrite?(prev?.rewrite?.status==='generating'?{...prev,rewrite:{...prev.rewrite,progress:pr}}:undefined):(prev?.status==='generating'?{...prev,progress:pr}:undefined))});
   if(!story.validation?.pass){await fail('validation',{validation:story.validation});return;}
   if(rewrite)await pjStoryPut(store,userKey,projId,prev=>{const d={id:pjId('sd'),kind:'rewrite',createdAt:new Date().toISOString(),story,diff:storyRewriteDiff(prev,story)};
    return {...prev,rewrite:null,drafts:[...(prev.drafts||[]),d].slice(-PJ_STORY_KEEP_DRAFTS)};});
   else await pjStoryPut(store,userKey,projId,prev=>({...story,attempt:prev?.attempt||1,startedAt:prev?.startedAt||null,...pjStoryKeep(prev),storyVersion:Math.max(1,(prev?.storyVersion||0)+1)}));
  }catch(e){await fail(String(e?.message||e).slice(0,60)).catch(()=>{});}
 }).finally(()=>pjStoryRunning.delete(projId));
 pjStoryChain=job.catch(()=>{});
 return {marked,job};
}
/** P0-16：节点完成 → 一幕续写草稿（模板排队；P0-19 先出差异摘要，确认后写入留版）。 */
async function pjStoryContinue(store,userKey,proj,nodeId,roleFacts){
 const c=storyContinuationTemplate(proj,nodeId,{roleFacts});if(!c)return {error:'节点不存在',code:'NODE_NOT_FOUND',status:400};
 const validation=storyValidateContinuation(c,proj,{roleFacts});if(!validation.pass)return {error:'续写未通过校验',code:'CONTINUATION_INVALID',status:422,validation};
 let draft=null;
 await pjStoryPut(store,userKey,proj.id,prev=>{
  const base=prev||{status:'pending',...pjStoryKeep(null)};
  if((base.continuations||[]).some(x=>x.nodeId===nodeId)){draft=null;return undefined;}
  const dup=(base.drafts||[]).find(d=>d.kind==='continuation'&&d.continuation.nodeId===nodeId);if(dup){draft=dup;return undefined;}
  draft={id:pjId('sd'),kind:'continuation',createdAt:new Date().toISOString(),continuation:{...c,validation},diff:storyContinuationDiff(c)};
  return {...base,drafts:[...(base.drafts||[]),draft].slice(-PJ_STORY_KEEP_DRAFTS)};});
 return {draft};
}
/** 确认 / 放弃草稿。确认 rewrite：旧版本进入 history（留版），storyVersion+1；确认续写：追加到 continuations。 */
async function pjStoryDecide(store,userKey,proj,draftId,accept){
 let out=null;
 await pjStoryPut(store,userKey,proj.id,prev=>{
  const d=(prev?.drafts||[]).find(x=>x.id===draftId);if(!d){out={error:'草稿不存在或已处理',code:'DRAFT_NOT_FOUND',status:404};return undefined;}
  const drafts=prev.drafts.filter(x=>x.id!==draftId);
  if(!accept){out={ok:true,accepted:false};return {...prev,drafts};}
  const at=new Date().toISOString(),hist=[...(prev.history||[]),{...pjStorySnap(prev),replacedAt:at}].slice(-PJ_STORY_KEEP_HISTORY);
  let next;
  if(d.kind==='rewrite')next={...d.story,attempt:prev.attempt||1,continuations:prev.continuations||[],drafts,history:prev.status==='ready'?hist:prev.history||[],storyVersion:(prev.storyVersion||1)+1,confirmedAt:at};
  else next={...prev,drafts,continuations:[...(prev.continuations||[]),{...d.continuation,confirmedAt:at}],history:prev.status==='ready'?hist:prev.history||[],storyVersion:(prev.storyVersion||0)+1};
  out={ok:true,accepted:true,kind:d.kind};return next;});
 return out;
}

async function buildSkeleton(doc,gap,now){
  const t0=Date.now();
  if(!gap||gap.status!=='confirmed')return {error:'请先确认差距评估',code:'GAP_CONFIRM_REQUIRED',status:400};
  const rf=doc.roleFacts.find(r=>r.id===gap.roleFactsId);const gt=doc.goalTrees.find(g=>g.roleFactsId===gap.roleFactsId);
  if(!rf||!gt)return {error:'角色卡记录缺失，请重新生成',code:'ROLEFACTS_MISSING',status:409};
  const prev=doc.projections.at(-1)||null;
  const inputsHash=await projectionInputsHash({roleFacts:rf,goalTree:gt,gap});
  let proj,reused=false;
  if(prev&&prev.inputsHash===inputsHash){proj=prev;reused=true;}
  else{
   proj=computeProjection({roleFacts:rf,goalTree:gt,gap,prev,now});
   proj.id=pjId('pj');proj.version=(prev?.version||0)+1;proj.inputsHash=inputsHash;proj.gapId=gap.id;proj.roleFactsId=rf.id;
   if(proj.diffFromPrev)proj.diffFromPrev.fromVersion=prev.version;
   proj.validation=validateProjection(proj,{roleFacts:rf,gap});
   proj.shareCard=shareCardModel(proj);
   proj.timings={ruleMs:Date.now()-t0,gapExtractMs:gap.extractMs??null};
   pjPush(doc.projections,proj);
  }
  return {projection:proj,reused,timings:{ruleMs:Date.now()-t0}};
 }

/** P0-25: build demo actual-line (never persists). Uses user gap when doc+confirmed gap exist, else synthetic. */
function buildDemoActualResponse(body,doc,now){
 const P=PROJECTION_PARAMS,D=P.actualLine.demo;
 const scenario=D.scenarios.includes(body.scenario)?body.scenario:'behind';
 const gap=doc?([...doc.gaps].reverse().find(g=>g.status==='confirmed')):null;
 let rf=gap&&doc?doc.roleFacts.find(r=>r.id===gap.roleFactsId):null,gt=rf&&doc?doc.goalTrees.find(g=>g.roleFactsId===rf.id):null,g=gap,source='user';
 if(!rf||!gt){rf=buildRoleFacts(PJ_DEMO_PROFILE,{confirmedAt:now});gt=buildGoalTree(PJ_DEMO_PROFILE);g=confirmGap(assembleGap(heuristicGap(rf),rf,{source:'heuristic'}),PJ_DEMO_LEVELS,now);source='synthetic'}
 const startedAt=now;
 const base=computeProjection({roleFacts:rf,goalTree:gt,gap:g,now,planStartedAt:startedAt});
 if(base.mode!=='normal')return pjJson({ok:true,demo:true,projection:{...base,demo:{label:D.label,note:D.note,scenario,source}}});
 const ex=demoExecution({planLine:pjLine(base,'plan'),startedAt,scenario,days:body.days,P});
 const demo={label:D.label,note:D.note,scenario,days:ex.demo.days,source,startedAt:ex.startedAt,asOf:ex.asOf,records:ex.records.length};
 const proj=computeProjection({roleFacts:rf,goalTree:gt,gap:g,now,planStartedAt:startedAt,execution:ex,demo});
 proj.id='demo';proj.version=0;proj.validation=validateProjection(proj,{roleFacts:rf,gap:g});proj.shareCard=null;
 proj.story=storyTemplate(proj,{roleFacts:rf,now});
 const wr=buildWeeklyReport({proj,execution:ex,story:proj.story,now:ex.asOf});
 return pjJson({ok:true,demo:true,projection:proj,execution:{startedAt:ex.startedAt,asOf:ex.asOf,records:ex.records},weeklyReport:wr.ok?wr.report:null,weeklyGate:wr.gate});
}

export async function handleProjectionApi(request,env,{cleanProfile=x=>x,ctx=null}={}){
 const pjBg=pr=>{try{ctx?.waitUntil?.(pr);}catch{}pr?.catch?.(()=>{});};
 const pjRf=proj=>doc.roleFacts.find(r=>r.id===proj.roleFactsId)||null;
 const url=new URL(request.url),path=url.pathname;
 if(!path.startsWith('/api/projection/'))return null;
 if(path==='/api/projection/params'&&request.method==='GET')return pjJson({ok:true,params:publicParams()});
 // P0-25: demo actual-line is non-persisting; allow without login so ?demo=1 two-line path works.
 // Prefer user confirmed gap when session+sensitive present; otherwise synthetic profile.
 if(path==='/api/projection/demo/actual'&&request.method==='POST'){
  if(request.headers.get('origin')!==url.origin)return pjJson({error:'请求来源不匹配'},403);
  let body={};try{const raw=await request.text();if(raw.length>120000)return pjJson({error:'内容过长'},413);body=raw?JSON.parse(raw):{};}catch{return pjJson({error:'输入格式无效'},400);}
  const now=new Date().toISOString();
  const accounts=getAccountStore(env);const token=bearerToken(request);const session=token?accounts.getSession(token):null;
  let doc=null;
  if(session?.user?.consents?.sensitive){
   const store=projectionStore(env);const userKey=(await pjSha256('pj:'+session.phone)).slice(0,24);
   doc=(await store.load(userKey))||pjEmptyDoc();
  }
  return buildDemoActualResponse(body,doc,now);
 }
 const accounts=getAccountStore(env);const token=bearerToken(request);const session=token?accounts.getSession(token):null;
 if(!session)return pjJson({error:'请先登录',code:'AUTH_REQUIRED'},401);
 if(!session.user.consents?.sensitive)return pjJson({error:'请先同意敏感个人信息处理',code:'SENSITIVE_REQUIRED'},403);
 if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return pjJson({error:'请求来源不匹配'},403);
 const store=projectionStore(env);const userKey=(await pjSha256('pj:'+session.phone)).slice(0,24);
 const doc=(await store.load(userKey))||pjEmptyDoc();
 let body={};if(request.method==='POST'){try{const raw=await request.text();if(raw.length>35000)return pjJson({error:'内容过长'},413);body=raw?JSON.parse(raw):{};}catch{return pjJson({error:'输入格式无效'},400);}}
 const now=new Date().toISOString();
 // P0-29：近端以规划草案为权威同源（profile.aiStory / planStory / 会话旅程）

 const slimPlanHandoff=(ps)=>{
  if(!ps||typeof ps!=='object')return null;
  const slimQuest=q=>({title:q?.title,output:q?.output,minutes:q?.minutes,steps:Array.isArray(q?.steps)?q.steps.slice(0,3):undefined,tool:q?.tool,example:typeof q?.example==='string'?String(q.example).slice(0,160):undefined,why:typeof q?.why==='string'?String(q.why).slice(0,120):undefined});
  const chapters=Array.isArray(ps.chapters)?ps.chapters.map(c=>({
   name:c?.name,period:c?.period,situation:c?.situation,action:c?.action,change:c?.change,cost:c?.cost,
   narrative:typeof c?.narrative==='string'?String(c.narrative).slice(0,280):undefined,
   gate:c?.gate,quests:Array.isArray(c?.quests)?c.quests.slice(0,3).map(slimQuest):undefined,
  })):[];
  const stages=Array.isArray(ps.stages)?ps.stages.map(s=>({
   name:s?.name,period:s?.period,situation:s?.situation,action:s?.action,change:s?.change,cost:s?.cost,
   narrative:typeof s?.narrative==='string'?String(s.narrative).slice(0,280):undefined,
  })):[];
  const nt=ps.nearTerm&&typeof ps.nearTerm==='object'?{
   todayTitle:ps.nearTerm.todayTitle,todayOutput:ps.nearTerm.todayOutput,
   weekTitle:ps.nearTerm.weekTitle,weekOutput:ps.nearTerm.weekOutput,
   today:ps.nearTerm.today,week:ps.nearTerm.week,
   todayMinutes:ps.nearTerm.todayMinutes,weekMinutes:ps.nearTerm.weekMinutes,
  }:undefined;
  return {title:ps.title,baseline:ps.baseline,nearTerm:nt,chapters:chapters.length?chapters:undefined,stages:stages.length?stages:undefined,provider:ps.provider,providerKind:ps.providerKind,model:ps.model,depthVersion:ps.depthVersion};
};
 const resolvePlanCtx=()=>{
  const profile=(body.profile&&typeof body.profile==='object')?body.profile:(session.user.journey?.profile||null);
  const rawPlan=(body.planStory&&typeof body.planStory==='object')?body.planStory:(profile?.aiStory&&typeof profile.aiStory==='object'?profile.aiStory:null);
  const planStory=slimPlanHandoff(rawPlan);
  const authoritativeNearTerm=(body.authoritativeNearTerm&&typeof body.authoritativeNearTerm==='object')?body.authoritativeNearTerm
   :(body.nearTerm&&typeof body.nearTerm==='object'?body.nearTerm:null);
  return {profile,planStory,authoritativeNearTerm};
 };
 // 骨架返回后自动开始故事生成（body.story===false 可关闭），返回最新故事表
 const pjStoryStart=async proj=>{
  if(body.story!==false&&await pjStoryNeeds(store,userKey,proj)){
   const ctx=resolvePlanCtx();
   const k=pjStoryKick(env,store,userKey,proj,{roleFacts:pjRf(proj),now,profile:ctx.profile,planStory:ctx.planStory,authoritativeNearTerm:ctx.authoritativeNearTerm});
   pjBg(k.job);await k.marked;
  }
  return pjStoryAll(store,userKey);
 };

 if(path==='/api/projection/gap'&&request.method==='POST'){
  const profile=cleanProfile(body.profile||{});
  if(!profile.goal)return pjJson({error:'请先确认目标',code:'GOAL_REQUIRED'},400);
  const rf=buildRoleFacts(profile,{confirmedAt:now});
  if(detectCrisis(rf.facts.map(f=>String(f.value)).join('\n'))){
   pjPush(doc.logs,{id:pjId('l'),type:'crisis_hold',at:now});await store.save(userKey,doc);
   return pjJson({ok:true,mode:'crisis_hold',crisis:PROJECTION_PARAMS.crisisNotice});
  }
  const goalTree=buildGoalTree(profile);
  const t0=Date.now();
  let ext;try{ext=await pjSlot(()=>extractGapLLM(env,rf,goalTree,{base:env.OLLAMA_BASE_URL||'http://127.0.0.1:11434'}));}catch(e){return pjJson({error:e.message||'推演服务繁忙'},e.status||503);}
  const gap={id:pjId('gap'),roleFactsId:null,...assembleGap(ext.dims,rf,{model:ext.model,ms:ext.ms,source:ext.source}),attempts:ext.attempts,createdAt:now};
  const rfRec={id:pjId('rf'),...rf};gap.roleFactsId=rfRec.id;
  pjPush(doc.roleFacts,rfRec);pjPush(doc.goalTrees,{id:pjId('gt'),roleFactsId:rfRec.id,...goalTree});pjPush(doc.gaps,gap);
  await store.save(userKey,doc);
  return pjJson({ok:true,mode:'normal',roleFacts:rfRec,goalTree,gap,dimLabels:pjDimLabels(),timings:{gapExtractMs:ext.ms,totalMs:Date.now()-t0}});
 }

 if(path==='/api/projection/gap/confirm'&&request.method==='POST'){
  const gap=doc.gaps.find(g=>g.id===body.gapId)||doc.gaps.at(-1);
  if(!gap)return pjJson({error:'请先生成差距评估',code:'GAP_REQUIRED'},400);
  const confirmed={...confirmGap(gap,body.levels||{},now),id:pjId('gapc'),fromGapId:gap.id};
  pjPush(doc.gaps,confirmed);
  if(body.generate){
   const sk=await buildSkeleton(doc,confirmed,now);
   if(sk.error){await store.save(userKey,doc);return pjJson({error:sk.error,code:sk.code},sk.status);}
   await store.save(userKey,doc);
   const items=await pjStoryStart(sk.projection);
   return pjJson({ok:true,gap:confirmed,projection:pjWithStory(sk.projection,items),reused:sk.reused,timings:sk.timings,dimLabels:pjDimLabels()});
  }
  await store.save(userKey,doc);
  return pjJson({ok:true,gap:confirmed,dimLabels:pjDimLabels()});
 }
 if(path==='/api/projection/skeleton'&&request.method==='POST'){
  const gap=body.gapId?doc.gaps.find(g=>g.id===body.gapId):[...doc.gaps].reverse().find(g=>g.status==='confirmed');
  const sk=await buildSkeleton(doc,gap,now);
  if(sk.error)return pjJson({error:sk.error,code:sk.code},sk.status);
  if(!sk.reused)await store.save(userKey,doc);
  const items=await pjStoryStart(sk.projection);
  return pjJson({ok:true,projection:pjWithStory(sk.projection,items),reused:sk.reused,timings:sk.timings});
 }
 if(path==='/api/projection/latest'&&request.method==='GET'){
  const stored=doc.projections.at(-1)||null;const gap=doc.gaps.at(-1)||null;const rf=gap?doc.roleFacts.find(r=>r.id===gap.roleFactsId):doc.roleFacts.at(-1)||null;
  const proj=stored?pjWithStory(pjActualView(stored,pjExecutionFromLogs(doc,stored,now)),await pjStoryAll(store,userKey)):null;
  return pjJson({ok:true,projection:proj,gap,roleFacts:rf||null,logs:doc.logs.slice(-20)});
 }
 // 详细故事版：手动触发 / 重试（force 重新生成；wait 等待完成，供验收脚本）
 if(path==='/api/projection/story/generate'&&request.method==='POST'){
  const proj=body.projectionId?doc.projections.find(p=>p.id===body.projectionId):doc.projections.at(-1);
  if(!proj)return pjJson({error:'请先生成推演',code:'PROJECTION_REQUIRED'},400);
  if(proj.mode!=='normal')return pjJson({error:'当前状态下不生成故事',code:'STORY_UNAVAILABLE'},409);
  if(!await pjStoryNeeds(store,userKey,proj,!!body.force)){const v=pjStoryView(proj,(await pjStoryAll(store,userKey))[proj.id]);return pjJson({ok:true,projectionId:proj.id,story:v,started:false},v?.status==='generating'?202:200);}
  const ctx=resolvePlanCtx();
  const k=pjStoryKick(env,store,userKey,proj,{roleFacts:pjRf(proj),now,authoritativeNearTerm:ctx.authoritativeNearTerm,planStory:ctx.planStory,profile:ctx.profile});
  if(body.wait)await k.job.catch(()=>{});else{pjBg(k.job);await k.marked;}
  const v=pjStoryView(proj,(await pjStoryAll(store,userKey))[proj.id]);
  return pjJson({ok:true,projectionId:proj.id,story:v,started:true},body.wait?200:202);
 }
 if(path==='/api/projection/story/continue'&&request.method==='POST'){
  const proj=body.projectionId?doc.projections.find(p=>p.id===body.projectionId):doc.projections.at(-1);
  if(!proj||proj.mode!=='normal')return pjJson({error:'请先生成推演',code:'PROJECTION_REQUIRED'},400);
  const r=await pjStoryContinue(store,userKey,proj,String(body.nodeId||''),pjRf(proj));if(r.error)return pjJson(r,r.status);
  return pjJson({ok:true,projectionId:proj.id,draft:r.draft,story:pjStoryView(proj,(await pjStoryAll(store,userKey))[proj.id])});
 }
 if(path==='/api/projection/story/confirm'&&request.method==='POST'){
  const proj=body.projectionId?doc.projections.find(p=>p.id===body.projectionId):doc.projections.at(-1);
  if(!proj)return pjJson({error:'请先生成推演',code:'PROJECTION_REQUIRED'},400);
  const r=await pjStoryDecide(store,userKey,proj,String(body.draftId||''),body.accept!==false);if(r?.error)return pjJson(r,r.status);
  return pjJson({...r,projectionId:proj.id,story:pjStoryView(proj,(await pjStoryAll(store,userKey))[proj.id])});
 }
 if(path==='/api/projection/story'&&request.method==='GET'){
  const id=url.searchParams.get('id');const proj=id?doc.projections.find(p=>p.id===id):doc.projections.at(-1);
  if(!proj)return pjJson({error:'请先生成推演',code:'PROJECTION_REQUIRED'},404);
  return pjJson({ok:true,projectionId:proj.id,story:pjStoryView(proj,(await pjStoryAll(store,userKey))[proj.id])});
 }
 // demo/actual handled before auth (P0-25)
 // P0-20 W1：周报（固定模板，无模型）。GET 看门槛与最近一份；POST 生成并留存
 if(path==='/api/projection/weekly-report'&&(request.method==='GET'||request.method==='POST')){
  const proj=doc.projections.at(-1);
  if(!proj||proj.mode!=='normal')return pjJson({error:'请先生成推演',code:'PROJECTION_REQUIRED'},request.method==='GET'?404:400);
  const ex=pjExecutionFromLogs(doc,proj,now);const gate=weeklyReportGate(ex);
  const mine=(doc.weeklyReports||[]).filter(r=>r.projectionId===proj.id);
  if(request.method==='GET')return pjJson({ok:true,gate,minDays:PJ_WEEKLY.minDays,report:mine.at(-1)||null,reports:mine.map(r=>({id:r.id,week:r.week,title:r.title,generatedAt:r.generatedAt}))});
  if(!gate.met)return pjJson({error:gate.text,code:'WEEKLY_NOT_READY',gate},409);
  const view=pjActualView(proj,ex);const story=(await pjStoryAll(store,userKey))[proj.id]||null;
  const r=buildWeeklyReport({proj:view,execution:ex,story,now});
  if(!r.ok)return pjJson({error:'暂不能生成周报',code:r.code,gate:r.gate},409);
  doc.weeklyReports=doc.weeklyReports||[];const i=doc.weeklyReports.findIndex(x=>x.id===r.report.id&&x.projectionId===proj.id);
  if(i>=0)doc.weeklyReports[i]=r.report;else pjPush(doc.weeklyReports,r.report,12);
  await store.save(userKey,doc);
  return pjJson({ok:true,gate,report:r.report});
 }
 if(path==='/api/projection/log'&&request.method==='POST'){
  const proj=doc.projections.at(-1);if(!proj)return pjJson({error:'请先生成推演'},400);
  const status=['done','partial','skipped','paused'].includes(body.status)?body.status:null;if(!status)return pjJson({error:'状态无效'},400);
  if(status==='paused'){
   const R=PROJECTION_PARAMS.actualLine.pauseReasons;const r=R.find(x=>x.key===body.pauseReason||x.label===body.pauseReason);
   if(!r)return pjJson({error:'请选择暂停原因',code:'PAUSE_REASON_REQUIRED',reasons:R},400);
   const log={id:pjId('l'),type:'pause',projectionId:proj.id,projectionVersion:proj.version,taskId:'',nodeId:'',status,pauseReason:r.key,pauseLabel:r.label,pauseDays:Math.max(1,Math.min(60,Math.round(Number(body.pauseDays)||7))),at:now};
   pjPush(doc.logs,log,PJ_KEEP_LOGS);await store.save(userKey,doc);return pjJson({ok:true,log});
  }
  const log={id:pjId('l'),type:'task',projectionId:proj.id,projectionVersion:proj.version,taskId:String(body.taskId||'').slice(0,40),nodeId:String(body.nodeId||'').slice(0,40),status,actualMinutes:Math.max(0,Math.min(600,Number(body.actualMinutes)||0)),note:String(body.note||'').slice(0,300),...(body.nodeComplete===true?{nodeComplete:true}:{}),at:now};
  pjPush(doc.logs,log,PJ_KEEP_LOGS);await store.save(userKey,doc);
  // P0-16：标记「完成节点」→ 生成该幕续写草稿（确认后写入留版）
  let storyDraft=null;if(status==='done'&&body.nodeComplete===true&&log.nodeId&&proj.mode==='normal'){const r=await pjStoryContinue(store,userKey,proj,log.nodeId,pjRf(proj));storyDraft=r.draft||null;}
  return pjJson({ok:true,log,...(storyDraft?{storyDraft}:{})});
 }
 return pjJson({error:'不支持此操作'},404);
}
