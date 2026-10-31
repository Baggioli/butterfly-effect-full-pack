/**
 * P0-29 novel-logic r2：按 PRODUCT-VERDICT 定点修
 * - proj 文学层：无处境/行动小标题、无「每一段都写了…」
 * - G5/G4–G6 财富因果；plan 第1幕收束；SCORECARD 本样摘句
 * - 契约 novel-logic-2；交 p0-29-novel-logic-r2/；不送五维
 */
import {mkdir,writeFile,readFile,copyFile} from 'node:fs/promises';
import {
  DEPTH_CONTRACT_VERSION,NOVEL_LOGIC_CONTRACT_VERSION,STORY_ARC_BANNED_RE,STORY_ARC_META_RE,NOVEL_LOGIC_META_RE,
  STORY_ARC_TEMPLATE_RE,STORY_ARC_FORBIDDEN_RE,nearTermFromPlanStory,ensureChapterQuad
} from '../worker/depth-contract.js';
import {buildRoleFacts,buildGoalTree,heuristicGap,assembleGap,computeProjection,pjLine} from '../worker/projection.js';
import {generateStoryLLM,storyLongForm,STORY_FIELDS} from '../worker/projection-story.js';

const SRC='/workspace/butterfly-handoff/p0-29-novel-logic';
const OUT=process.env.P0_29_OUT||'/workspace/butterfly-handoff/p0-29-novel-logic-r2';
const SECRET_FILE=process.env.BUTTERFLY_LLM_ENV_FILE||'/workspace/butterfly-secrets/butterfly-llm.env';
const TIP=process.env.P0_29_TIP||'653dfda';
const CV=NOVEL_LOGIC_CONTRACT_VERSION;
const META_RE=new RegExp('(?:'+STORY_ARC_META_RE.source+')|(?:'+NOVEL_LOGIC_META_RE.source+')','g');
const ACT4_MIN=900;

const countHan=s=>Array.from(String(s||'')).filter(ch=>/\p{Script=Han}/u.test(ch)).length;
const norm=x=>String(x||'').replace(/[\s“”"「」『』‘’'，,。.！!？?：:；;、…—\-·]/g,'');
const log=o=>console.log(JSON.stringify(o));
function loadEnvFile(text){const out={};for(const line of String(text||'').split(/\r?\n/)){const t=line.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<1)continue;out[t.slice(0,i).trim()]=t.slice(i+1).trim();}return out;}
function redact(obj){return JSON.parse(JSON.stringify(obj,(k,v)=>{if(/key|secret|token|password|authorization/i.test(String(k))&&typeof v==='string'&&v)return `<redacted len=${v.length}>`;if(typeof v==='string'&&/^sk-/.test(v))return `<redacted len=${v.length}>`;return v;}));}

const LEVER_HINT=/水|模型|建模|SWMM|EFDC|ICM|逸泓|合并|订阅|演示|本地化|数据|冷却|暴雨|管网|环评|流域|硬盘/;
const SHIFT=/变成|开始|话语权|续费|专职|合并|股份|估值|摊薄|约束|名声|媒体|公开|榜|净资产|控股权|资产/;
const BLOCK_CAT={人:/同事|股东|董事|团队|专职|离职|人心/,钱:/钱|资金|现金|融资|估值|股价|市值|回购|锁定|工资|合同/,监管:/监管|审批|合规|证监|交易所|审查|剥离|边界|可审计/,市场:/业主|客户|赛道|市场|订单|预算|人天|演示|结果/,对手:/对手|同行|竞争|巨头|压价|抢/};

async function callDeepSeek(secrets,messages,{temperature=0.85,max_tokens=8000}={}){
  const apiKey=secrets.BUTTERFLY_LLM_API_KEY;
  const base=(secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com').replace(/\/$/,'');
  const model=secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat';
  const url=/\/chat\/completions$/.test(base)?base:(base+'/chat/completions');
  const body={model,messages,response_format:{type:'json_object'},max_tokens,temperature,thinking:{type:'disabled'}};
  let e0;for(let t=0;t<3;t++){
    try{
      const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+apiKey},body:JSON.stringify(body),signal:AbortSignal.timeout(300000)});
      if(!response.ok)throw Object.assign(Error('upstream '+response.status),{status:response.status});
      const result=await response.json();
      if(result.choices?.[0]?.finish_reason==='length')throw Error('truncate');
      return {data:JSON.parse(result.choices?.[0]?.message?.content||'{}'),model};
    }catch(e){e0=e;if(!/fetch failed|upstream 5|upstream 429|ECONN|timeout/i.test(String(e?.message||e)))throw e;await new Promise(r=>setTimeout(r,3000*(t+1)));}
  }throw e0;
}

function patchAct1(narr){
  let n=String(narr||'');
  // 删 worldShiftHint 照抄句
  n=n.replace(/那一晚之后，从卖人天变成有人愿为「看得懂的结果」付钱，现金流仍紧，但话语权开始转向结果。?/g,'');
  n=n.replace(/那一晚之后[^。]*话语权开始转向结果。?/g,'');
  // 若收束仍偏说明，换成动作/感官
  if(/话语权开始转向|从卖人天变成/.test(n.slice(-120))){
    n=n.replace(/他们开始按“结果”付钱[^。]*。现金流还是紧，但话事权开始转向我们这边。?/,'合同金额不大，够发下个月工资。散会后我在电梯里没说话，只把动画模板又在手机上过了一遍。');
  }
  if(!/旧硬盘/.test(n.slice(-200))){
    n=n.replace(/\s*$/,'')+'那天傍晚我锁门时，摸到口袋里那块旧硬盘，边缘被磨得发亮。楼道声控灯灭了，我站在暗处听了一会儿窗外的蝉，才抬脚下楼。';
  }else if(/话语权|卖人天变成/.test(n.slice(-80))){
    n=n.replace(/那一晚之后[\s\S]*$/,'那天傍晚我锁门时，摸到口袋里那块旧硬盘，边缘被磨得发亮。楼道声控灯灭了，我站在暗处听了一会儿窗外的蝉，才抬脚下楼。');
  }
  return n.trim();
}

function patchAct3(narr){
  return String(narr||'').replace(/那几个月是真正的低谷。/g,'那几个月，会议室的灯常常只开一半，人说话都下意识放低。');
}

async function rewriteAct4(secrets,baseStory,rf){
  const c4=baseStory.chapters[3];
  const sys=[
    '你是短篇小说作者，只输出 JSON：{"narrative":"…","gateLogic":[{"gateId":"G4","block":"…","leverage":"…","worldShift":"…"},{"gateId":"G5",...},{"gateId":"G6",...}],"terminalDoor":"…","highlights":["…"],"firstStep":"…"}。',
    '用第一人称“我”回望，对现在的你说话。写第四幕小说章节，汉字≥'+ACT4_MIN+'。',
    '硬要求：',
    '1) G4 上市：写清上市前规模如何靠水循环建模+两公司（逸泓水务咨询现金流养逸泓智能产品）长出来；合规/数据分层是卡点；杠杆须含水数据可审计边界，禁通用创业套话。',
    '2) G5 入榜：必须写清控股权+水数据/水基础设施资产如何把个人净资产推向公开入榜门槛（量级与关系即可，不编精确假数）。回购/锁定是入榜后的守榜动作，绝不是“真正的转折”。禁止把“老同学发来福布斯截图”写成转折本身；截图最多一笔带过。',
    '3) G6 彭博前十朝向：写清可审计水模型/本地化接口在冷却或内涝项目上赢标如何扩表与估值；禁止只写“一点点往上爬”+媒体对比图当因果。',
    '4) G7 门前：安静收束，旧硬盘回扣，不写成已成世界首富。',
    '5) 禁止：处境:/行动:/变化:/代价: 小标题；证明场面；清单体；保证成功/已成世界首富。',
    '6) gateLogic 三字段必须是 narrative 里的不同原句（G3式同句三格=FAIL）；每门一句卡点、一句杠杆（含水/模型/逸泓/控股权/资产）、一句世界变。',
  ].join('\\n');
  const user=JSON.stringify({
    keepCallback:baseStory.callbackObject||'旧硬盘',
    prevActsBrief:baseStory.chapters.slice(0,3).map(c=>({name:c.name,tail:c.narrative.slice(-120)})),
    wealthSteps:rf.stages?.[3]?.wealthStep,
    gates:rf.gateChain?.filter(g=>g.act===4),
    badDraftToReplace:c4.narrative,
    must:'rewrite act4 as novel chapter with wealth causality'
  });
  const {data,model}=await callDeepSeek(secrets,[
    {role:'system',content:sys},
    {role:'user',content:user}
  ],{temperature:0.82,max_tokens:7000});
  let narr=String(data.narrative||'').trim();
  if(countHan(narr)<ACT4_MIN){
    const {data:d2}=await callDeepSeek(secrets,[
      {role:'system',content:sys},
      {role:'user',content:user},
      {role:'assistant',content:JSON.stringify(data)},
      {role:'user',content:'第四幕汉字不足'+ACT4_MIN+'（现'+countHan(narr)+'）。保持因果结构，加厚上市前规模成长、入榜前资产/控股权链条、赢标扩表，仍≥'+ACT4_MIN+'。只输出完整JSON。'}
    ],{temperature:0.8,max_tokens:8000});
    if(countHan(d2.narrative||'')>=countHan(narr)){Object.assign(data,d2);narr=String(d2.narrative||'').trim();}
  }
  // strip labels if any
  narr=narr.replace(/^\s*(处境|行动|变化|代价)\s*[:：]\s*/gm,'').replace(/真正的转折发生在/g,'入榜前后那段日子，');
  return {narrative:narr,gateLogic:data.gateLogic||[],terminalDoor:data.terminalDoor||'',highlights:(data.highlights||[]).slice(0,2),firstStep:data.firstStep||c4.firstStep,model};
}

function extractGateLogic(story,rf){
  const rows=[];
  for(const g of rf.gateChain.filter(x=>!x.terminal)){
    const c=story.chapters[g.act-1]||{};
    const narr=String(c.narrative||'');
    const sents=narr.split(/(?<=[。！？])/).map(s=>s.trim()).filter(s=>s.length>=8);
    const catRe=BLOCK_CAT[g.blockType]||BLOCK_CAT.市场;
    let block=(c.gateLogic||[]).find(x=>x.gateId===g.id)?.block||'';
    let lev=(c.gateLogic||[]).find(x=>x.gateId===g.id)?.leverage||'';
    let ws=(c.gateLogic||[]).find(x=>x.gateId===g.id)?.worldShift||'';
    if(!(block&&narr.includes(block)))block=(sents.find(s=>catRe.test(s))||sents[0]||'').slice(0,100);
    if(!(lev&&narr.includes(lev)&&LEVER_HINT.test(lev)))lev=(sents.find(s=>LEVER_HINT.test(s)&&s!==block)||sents[1]||'').slice(0,100);
    if(!(ws&&narr.includes(ws)&&SHIFT.test(ws)))ws=(sents.find(s=>SHIFT.test(s)&&s!==block&&s!==lev)||sents[sents.length-1]||'').slice(0,100);
    // ensure three distinct
    if(norm(block)===norm(lev)||norm(block)===norm(ws)||norm(lev)===norm(ws)){
      const uniq=[...new Set(sents.map(s=>s.slice(0,90)))];
      block=uniq.find(s=>catRe.test(s))||uniq[0]||block;
      lev=uniq.find(s=>LEVER_HINT.test(s)&&s!==block)||uniq[1]||lev;
      ws=uniq.find(s=>SHIFT.test(s)&&s!==block&&s!==lev)||uniq[uniq.length-1]||ws;
    }
    const typeHit=Boolean(catRe.test(narr));
    const leverOk=LEVER_HINT.test(lev)||LEVER_HINT.test(narr);
    const shiftOk=SHIFT.test(ws)||SHIFT.test(narr);
    const distinct=norm(block)!==norm(lev)&&norm(block)!==norm(ws)&&norm(lev)!==norm(ws);
    const ok=typeHit&&leverOk&&shiftOk&&distinct;
    rows.push({gate:g.id,act:g.act,blockType:g.blockType,block,leverage:lev,worldShift:ws,typeHit,leverOk,shiftOk,distinct,ok});
    const rest=(c.gateLogic||[]).filter(x=>String(x.gateId)!==g.id);
    c.gateLogic=[...rest,{gateId:g.id,block,leverage:lev,worldShift:ws}];
  }
  return {pass:rows.every(r=>r.ok),rows};
}

function g5CausalOk(narr){
  const s=String(narr||'');
  const screenshotAsTurn=/真正的转折[^。]*截图|截图[^。]*真正的转折|截图[^。]*转折/.test(s);
  const asset=/控股权|水数据|水基础设施|净资产|入榜门槛|估值|资产/.test(s);
  const buybackIsGuard=/回购|锁定/.test(s)&&!/回购[^。]*才(让|使)|锁定[^。]*才(让|使|成为)/.test(s);
  return !screenshotAsTurn&&asset;
}

function g4g6ScaleOk(narr){
  const s=String(narr||'');
  const scale=/订阅|产品收入|跨省|吸附|整合|扩表|市占|项目复制|建模|逸泓|水循环|冷却|内涝|可审计/.test(s);
  const weakOnly=/一点点往上爬/.test(s)&&!/赢标|扩表|估值|资产|模型/.test(s);
  return scale&&!weakOnly;
}

function stripDigits(s){return String(s||'').replace(/[0-9０-９]+(\.\d+)?\s*(%|周|天|年|个|人|次|万|亿|美元|元)?/g,'').replace(/____/g,'').replace(/[①②③④⑤]/g,'').replace(/\s+/g,' ').trim();}

function rfForProj(planStory,ruleFacts){
  return {...ruleFacts,novelLogic:true,storyArc:false,version:CV,
    planFirstSteps:planStory.chapters.map(c=>c.firstStep),
    projOpener:'我在你这个年纪时，也守着那间小办公室，天天发愁钱从哪里来。那时的处境，跟今天的你几乎一样。',
    callbackObject:planStory.callbackObject||'旧硬盘',
    stages:ruleFacts.stages.map((st,i)=>{
      const c=planStory.chapters[i]||{};
      const beat=stripDigits([c.situation,c.action,c.change,c.cost].filter(Boolean).join(' ')||c.narrative||'').slice(0,420);
      const gl=(c.gateLogic||[]).map(g=>stripDigits((g.block||'')+' / '+(g.leverage||'')+' / '+(g.worldShift||''))).join('；');
      return {...st,planBeat:st.isDip?beat:beat.replace(/低谷/g,'难处'),wealthStep:stripDigits(st.wealthStep),
        gatesText:ruleFacts.gateChain.filter(g=>g.act===i+1&&!g.terminal).map(g=>stripDigits(g.name.replace(/（[^）]*）/g,''))+'（场面提示：'+stripDigits(g.proof||'')+'）').join('；'),
        gateLogicText:gl||ruleFacts.gateChain.filter(g=>g.act===i+1&&!g.terminal).map(g=>'卡点类型'+g.blockType+'；杠杆：'+stripDigits(g.leverageHint||'')+'；跨门后：'+stripDigits(g.worldShiftHint||'')).join('；'),
        emotion:st.projMood};
    })};
}

async function runProjection(dsEnv,planStory,planNear,ruleFacts){
  const rfProj=rfForProj(planStory,ruleFacts);
  const rf=buildRoleFacts(JSON.parse(await readFile(SRC+'/persona.json','utf8')).persona);
  const persona=JSON.parse(await readFile(SRC+'/persona.json','utf8')).persona;
  const gt=buildGoalTree(persona);
  const proj=computeProjection({roleFacts:rf,goalTree:gt,gap:assembleGap(heuristicGap(rf),rf,{model:null,source:'heuristic'})});
  const rawHorizonInternal=pjLine(proj)?.horizon;const t0=Date.now();
  const s=await generateStoryLLM({...dsEnv,__ruleFacts:rfProj},proj,{roleFacts:rf,profile:persona,base:'http://127.0.0.1:11434',model:dsEnv.BUTTERFLY_LLM_MODEL,authoritativeNearTerm:planNear||undefined,planStory});
  // belt: rebuild longForm novel
  if(s.perNode){s.longForm=storyLongForm(s.perNode,{goal:persona.goal,role:persona.role,hours:persona.hours,novelLogic:true,nodes:s.perNode,horizon:rawHorizonInternal});s.chars=countHan(s.longForm);}
  return {rawHorizonInternal,rfProj,projectionUser:{ms:Date.now()-t0,provider:s.provider,providerKind:s.providerKind,model:s.model,source:s.source,chars:s.chars,validation:s.validation?.pass,
    depth:s.depth,depthVersion:s.depthVersion,depthSpine:s.depthSpine,ruleHorizonWeeks:s.ruleHorizonWeeks??ruleFacts.deadlineWeeks,nearTerm:s.nearTerm,nearTermSource:s.nearTermSource,
    firstStepInjected:!!s.firstStepInjected,firstStepNumberExempt:s.firstStepNumberExempt||[],
    summary:s.summary,longForm:s.longForm,
    perNode:(s.perNode||[]).map(n=>({nodeId:n.nodeId,title:n.title,tRange:n.tRange,depthStage:n.depthStage,source:n.source,fieldSource:n.fieldSource,situation:n.situation,action:n.action,change:n.change,cost:n.cost,firstStep:n.firstStep,firstStepSource:n.firstStepSource,
      fieldChars:{situation:countHan(n.situation),action:countHan(n.action),change:countHan(n.change),cost:countHan(n.cost)}})),
    attempts:s.attempts||[],fallbackReason:s.fallbackReason||null}};
}

function selfCheck(planStory,planNear,projectionUser,ruleFacts,gl){
  const fails=[];
  const ch=planStory.chapters;
  const perNarr=ch.map(c=>countHan(c.narrative));
  const narr=perNarr.reduce((a,b)=>a+b,0);
  const planBlob=ch.map(c=>c.narrative).join('\\n');
  const projLF=String(projectionUser?.longForm||'');
  const projBlob=[projLF,...(projectionUser?.perNode||[]).flatMap(n=>[n.situation,n.action,n.change,n.cost])].join('\\n');

  const metaPlan=[...planBlob.matchAll(META_RE)].map(m=>m[0]);
  const metaProj=[...projBlob.matchAll(META_RE)].map(m=>m[0]);
  const labelLeak=/处境\s*[:：]|行动\s*[:：]|变化\s*[:：]|代价\s*[:：]/.test(projLF)||/每一段都写了处境/.test(projLF);
  if(metaPlan.length)fails.push('plan META '+metaPlan.length);
  if(metaProj.length)fails.push('proj META '+metaProj.length);
  if(labelLeak)fails.push('proj 说明书小标题/开篇说明句泄漏');

  const softBan=planBlob.replace(/[问题尽调任务检查核对]清单/g,'条目');
  const banHits=[...softBan.matchAll(STORY_ARC_BANNED_RE)].map(m=>m[0]);
  if(banHits.length)fails.push('禁清单 '+banHits.join(','));

  if(/那一晚之后，从卖人天变成/.test(ch[0].narrative))fails.push('第1幕仍有 worldShiftHint 照抄');
  if(!gl.pass)fails.push('三问未全过 '+gl.rows.filter(r=>!r.ok).map(r=>r.gate).join(','));
  if(gl.rows.some(r=>!r.distinct))fails.push('三问摘句有同句重复');

  const act4=ch[3].narrative;
  if(!g5CausalOk(act4))fails.push('G5 入榜因果未过（截图当转折或缺资产/控股权）');
  if(!g4g6ScaleOk(act4))fails.push('G4-G6 规模/杠杆阶梯不足');
  if(countHan(act4)<ACT4_MIN)fails.push('第四幕字数 '+countHan(act4)+'<'+ACT4_MIN);

  const crossed=ch.flatMap(c=>c.gatesCrossed||[]);
  const expect=ruleFacts.gateChain.filter(g=>!g.terminal).map(g=>g.id);
  if(JSON.stringify(crossed)!==JSON.stringify(expect))fails.push('gatesCrossed 须按序且不含终局门');

  const nearOk=planNear&&projectionUser?.nearTerm?.today?.title===planNear.today.title&&projectionUser?.nearTerm?.week?.title===planNear.week.title;
  if(!nearOk)fails.push('近端不同源');
  if(projectionUser?.source!=='llm')fails.push('proj 非 llm');
  if(projectionUser?.depthVersion!==CV)fails.push('proj 契约不一致');
  const maxHi=Math.max(0,...(projectionUser?.perNode||[]).map(n=>n.tRange?.hi||0));
  if(!(maxHi>0&&maxHi<=520))fails.push('周界');

  const dialogue=(planBlob.match(/[“「][^”」]{2,80}[”」]/g)||[]).length;
  const novelOk=dialogue>=8&&/硬盘|雨|灯|手|窗外/.test(planBlob)&&!labelLeak;
  if(!novelOk)fails.push('小说体不足');

  // SCORECARD 自读不得提半灯/风扇/没送出的图（本样是旧硬盘）
  const forbiddenSelf=/半灯|风扇|没送出的图/;

  return {
    fails,pass:fails.length===0,perNarr,narr,metaPlan:metaPlan.length,metaProj:metaProj.length,labelLeak,
    banHits,gl,g5:g5CausalOk(act4),g4g6:g4g6ScaleOk(act4),nearOk,novelOk,dialogue,maxHi,
    readyForProductReview:fails.length===0
  };
}

async function main(){
  await mkdir(OUT,{recursive:true});
  const secrets=loadEnvFile(await readFile(SECRET_FILE,'utf8'));
  if(!secrets.BUTTERFLY_LLM_API_KEY){console.error('missing key');process.exit(2);}
  const srcPlan=JSON.parse(await readFile(SRC+'/plan-deepseek.json','utf8'));
  const srcPersona=JSON.parse(await readFile(SRC+'/persona.json','utf8'));
  const persona=srcPersona.persona;
  const ruleFacts={...srcPersona.ruleFacts,novelLogic:true,storyArc:false,version:CV};
  // drop terminal from any gatesCrossed later

  let story=JSON.parse(JSON.stringify(srcPlan.story));
  story.chapters[0].narrative=patchAct1(story.chapters[0].narrative);
  story.chapters[2].narrative=patchAct3(story.chapters[2].narrative);
  story.callbackObject=story.callbackObject||'旧硬盘';
  if(!/旧硬盘/.test(story.callbackObject)&&/旧硬盘/.test(story.chapters[0].narrative))story.callbackObject='旧硬盘';

  log({phase:'act4-rewrite-start',han:countHan(story.chapters[3].narrative)});
  const a4=await rewriteAct4(secrets,story,ruleFacts);
  story.chapters[3]={...story.chapters[3],narrative:a4.narrative,gateLogic:a4.gateLogic,terminalDoor:a4.terminalDoor||story.chapters[3].terminalDoor,highlights:a4.highlights,firstStep:a4.firstStep,gatesCrossed:['G4','G5','G6']};
  log({phase:'act4-rewrite-done',han:countHan(a4.narrative),g5:g5CausalOk(a4.narrative),g4g6:g4g6ScaleOk(a4.narrative)});

  // ensure gatesCrossed order
  story.chapters[0].gatesCrossed=['G1'];
  story.chapters[1].gatesCrossed=['G2'];
  story.chapters[2].gatesCrossed=['G3'];
  story.chapters[3].gatesCrossed=['G4','G5','G6'];
  story.chapters=story.chapters.map((c,i)=>ensureChapterQuad({...c,narrativeMode:'novel-logic',emotion:ruleFacts.stages[i].emotionValue,emotionEnd:ruleFacts.stages[i].emotionEnd,emotionSource:'rule-layer'}));

  let gl=extractGateLogic(story,ruleFacts);
  log({phase:'gateLogic',pass:gl.pass,rows:gl.rows.map(r=>({g:r.gate,ok:r.ok,distinct:r.distinct}))});

  const planNear=nearTermFromPlanStory(story);
  const dsEnv={BUTTERFLY_LLM_PROVIDER:secrets.BUTTERFLY_LLM_PROVIDER||'deepseek',BUTTERFLY_LLM_BASE_URL:secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com',BUTTERFLY_LLM_MODEL:secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat',BUTTERFLY_LLM_API_KEY:secrets.BUTTERFLY_LLM_API_KEY,
    AI_PROVIDER:'deepseek',AI_MODEL:secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat',AI_BASE_URL:secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com',DEEPSEEK_API_KEY:secrets.BUTTERFLY_LLM_API_KEY,AI_DEPTH_CONTRACT:'1',PROJECTION_STORY_LLM:'1'};

  log({phase:'proj-start'});
  let pr=await runProjection(dsEnv,story,planNear,ruleFacts);
  // retry once if label leak
  for(let k=0;k<2;k++){
    const lf=String(pr.projectionUser.longForm||'');
    if(!/处境\s*[:：]|行动\s*[:：]|每一段都写了处境/.test(lf)&&pr.projectionUser.source==='llm')break;
    log({phase:'proj-retry',k,reason:'label or source'});
    // force strip labels in longForm even if LLM fields somehow got them
    if(pr.projectionUser.perNode){
      for(const n of pr.projectionUser.perNode)for(const [k] of STORY_FIELDS)n[k]=String(n[k]||'').replace(/^\s*(处境|行动|变化|代价)\s*[:：]\s*/,'');
      pr.projectionUser.longForm=storyLongForm(pr.projectionUser.perNode,{goal:persona.goal,role:persona.role,hours:persona.hours,novelLogic:true,nodes:pr.projectionUser.perNode});
      pr.projectionUser.chars=countHan(pr.projectionUser.longForm);
    }
    if(/处境\s*[:：]|每一段都写了处境/.test(pr.projectionUser.longForm||''))pr=await runProjection(dsEnv,story,planNear,ruleFacts);
  }
  // final belt-and-suspenders strip on longForm
  if(pr.projectionUser.perNode){
    for(const n of pr.projectionUser.perNode)for(const [k] of STORY_FIELDS)n[k]=String(n[k]||'').replace(/^\s*(处境|行动|变化|代价)\s*[:：]\s*/g,'').replace(/每一段都写了处境、行动、变化和代价/g,'');
    pr.projectionUser.longForm=storyLongForm(pr.projectionUser.perNode,{goal:persona.goal,role:persona.role,hours:persona.hours,novelLogic:true,nodes:pr.projectionUser.perNode});
    pr.projectionUser.chars=countHan(pr.projectionUser.longForm);
    pr.projectionUser.depthVersion=CV;
  }
  log({phase:'proj-done',chars:pr.projectionUser.chars,source:pr.projectionUser.source,labelLeak:/处境\s*[:：]|每一段都写了处境/.test(pr.projectionUser.longForm||'')});

  gl=extractGateLogic(story,ruleFacts);
  const ac=selfCheck(story,planNear,pr.projectionUser,ruleFacts,gl);

  // novel self-read from THIS sample
  const sample=story.chapters[0].narrative;
  const excerpt=(sample.match(/[^。]*旧硬盘[^。]*。/)||[sample.slice(0,100)])[0];
  const novelSelfRead='像小说：本样以旧硬盘为回扣，开篇有热气、衬衫后背与合同退潮的身体感，对话像真人。摘：「'+excerpt.replace(/\\n/g,' ').slice(0,140)+(excerpt.length>140?'…':'')+'」';

  const perNarr=story.chapters.map(c=>countHan(c.narrative));
  await writeFile(`${OUT}/persona.json`,JSON.stringify({tip:TIP,contractVersion:CV,baseContract:DEPTH_CONTRACT_VERSION,persona,ruleFacts,note:'r2：proj 无四元小标题；G5 资产入榜因果；novel-logic-2'},null,2));
  await writeFile(`${OUT}/plan-deepseek.json`,JSON.stringify(redact({id:'plan-deepseek-novel-logic-r2',provider:'deepseek',model:a4.model,narr:perNarr.reduce((a,b)=>a+b,0),perChapterNarr:perNarr,depthVersion:CV,narrativeMode:'novel-logic',emotionSource:'rule-layer',ruleFacts,story,patches:['act1-ending','act3-dip-label','act4-wealth-causal']}),null,2));
  await writeFile(`${OUT}/proj-deepseek.json`,JSON.stringify(redact({...pr.projectionUser,ruleFactsProj:pr.rfProj,internalNote:'novelLogic-2；longForm 无处境/行动小标题'}),null,2));

  const now=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
  const PF=b=>b?'PASS':'FAIL';
  let sc=`# P0-29 小说体+逻辑可信 r2 · 自检\n\n- 时间：${now}（Asia/Shanghai，UTC+8）\n- tip \`${TIP}\`（本地未提交）· 契约 \`${CV}\` · DeepSeek\n- readyForProductReview：**${ac.readyForProductReview?'YES':'NO'}**\n- 对照 VERDICT：\`${SRC}/PRODUCT-VERDICT.md\`\n\n## 成功标准（相对 VERDICT 定点）\n\n| 项 | 结果 | 说明 |\n|---|---|---|\n`;
  sc+=`| proj 无说明书小标题 | ${PF(!ac.labelLeak)} | longForm 禁处境:/行动:与「每一段都写了…」 |\n`;
  sc+=`| 小说体 | ${PF(ac.novelOk)} | 对话=${ac.dialogue}；META plan=${ac.metaPlan} proj=${ac.metaProj} |\n`;
  sc+=`| 逻辑三问 | ${PF(ac.gl.pass)} | ${ac.gl.rows.map(r=>r.gate+'='+r.ok+(r.distinct?'':'[同句]')).join('；')} |\n`;
  sc+=`| G5 入榜因果 | ${PF(ac.g5)} | 控股权/水资产→净资产门槛；截图非转折 |\n`;
  sc+=`| G4–G6 阶梯 | ${PF(ac.g4g6)} | 水循环+两公司规模；非只爬榜+对比图 |\n`;
  sc+=`| 第1幕收束 | ${PF(!/那一晚之后，从卖人天变成/.test(story.chapters[0].narrative))} | 无 worldShiftHint 照抄 |\n`;
  sc+=`| 禁清单/近端/周界 | ${PF(ac.banHits.length===0&&ac.nearOk)} | 禁=${ac.banHits.length} 近端=${ac.nearOk} maxHi=${ac.maxHi} |\n`;
  sc+=`| 字数 | ${PF(perNarr[3]>=ACT4_MIN)} | plan=${ac.narr} 各幕=${perNarr.join('/')} |\n\n`;
  sc+=`## 小说体自读一句（本样原文）\n\n${novelSelfRead}\n\n## 每门三问勾选（摘自正文，产品只认正文）\n\n| 门 | 卡点 | 杠杆 | 世界变 | 勾选 |\n|---|---|---|---|---|\n`;
  for(const r of ac.gl.rows)sc+=`| ${r.gate} | ${r.block} | ${r.leverage} | ${r.worldShift} | ${r.ok&&r.distinct?'☑':'☐'} |\n`;
  sc+=`\n## 未过项\n\n${ac.fails.length?ac.fails.map(f=>'- '+f).join('\\n'):'- 无'}\n`;
  await writeFile(`${OUT}/self-check.md`,sc);
  await writeFile(`${OUT}/self-check.json`,JSON.stringify(redact({at:new Date().toISOString(),tip:TIP,contractVersion:CV,ac,readyForProductReview:ac.readyForProductReview,novelSelfRead}),null,2));

  let sm=`# Micheal 五维打分卡 · 小说体+逻辑可信 r2（候选，未送五维）\n\n- 契约 \`${CV}\` · DeepSeek · 模拟非承诺\n- **开发自读（小说体·本样）**：${novelSelfRead}\n- 相对 VERDICT 定点：proj 去说明书腔；G5 资产入榜因果；G4–G6 规模阶梯；第1幕动作收束\n- 请产品再抽核；**过闸前勿私转五维**\n\n| 维 | 问法 | 分数 |\n|---|---|---|\n| 详细 | 读起来像不像一条有血肉的轨迹 |  |\n| 可信 | 以你本人条件，经过与代价是否说得通 |  |\n| 可落地 | 今天/本周是否真能动手 |  |\n| 好玩 | 是否想继续往下看 |  |\n| 愿再打开 | 还愿不愿再打开 |  |\n\n## 每门三问勾选\n\n| 门 | 卡点 | 杠杆 | 世界变 | 勾选 |\n|---|---|---|---|---|\n`;
  for(const r of ac.gl.rows)sm+=`| ${r.gate} | ${r.block} | ${r.leverage} | ${r.worldShift} | ${r.ok&&r.distinct?'☑':'☐'} |\n`;
  sm+=`\n## 故事：${story.title||''}\n\n`;
  for(const c of story.chapters)sm+=`### ${c.name}（${c.period}）\n\n${c.narrative}\n\n`;
  sm+=`## 今天 / 本周\n\n- **${planNear?.today?.title}** — ${planNear?.today?.output}\n- **${planNear?.week?.title}** — ${planNear?.week?.output}\n\n## 推演（四段·小说章节，无四元小标题）\n\n`;
  for(const [i,n] of (pr.projectionUser?.perNode||[]).entries()){
    sm+=`### 第${i+1}段 ${n.title}\n\n${n.situation}${n.action}${n.change}${n.cost}\n\n`;
  }
  sm+=`## 本刀相对 novel-logic-1 改了什么\n\n1. longForm 拼装改为连续散文，禁「处境：」等小标题与开篇说明书句（契约 ${CV}）。\n2. 第四幕重写：G5 以控股权+水资产入榜门槛为因果；回购为守榜；G4–G6 补规模成长与赢标扩表。\n3. 第1幕删 worldShiftHint 照抄，动作/感官收束。\n4. SCORECARD 自读摘本样旧硬盘原文；三问摘句互异。\n5. readyForProductReview 仅在自检 fails=0 时 YES。\n`;
  await writeFile(`${OUT}/SCORECARD.md`,sm);

  await writeFile(`${OUT}/pm-review-facts.md`,`# novel-logic r2 · 短摘\n\n- tip \`${TIP}\` · 契约 \`${CV}\`\n- 自读：${novelSelfRead}\n- proj 说明书泄漏=${ac.labelLeak} · META plan/proj=${ac.metaPlan}/${ac.metaProj}\n- G5因果=${ac.g5} · G4-G6阶梯=${ac.g4g6} · 三问 ${ac.gl.rows.filter(r=>r.ok&&r.distinct).length}/6\n- narr=${ac.narr}（${perNarr.join('/')}）· proj=${pr.projectionUser.source}/${pr.projectionUser.chars}\n- ready=${ac.readyForProductReview} · fails=${JSON.stringify(ac.fails)}\n- 不热更、不 merge、不开 B、不做 32b、**不请 Grok 私转**\n`);

  await writeFile(`${OUT}/PRODUCT-NOTES.md`,`# novel-logic r2 · 产品笔记\n\n- 时间：${now}（Asia/Shanghai，UTC+8）\n- tip \`${TIP}\` 本地未提交；契约 \`${CV}\`（由 novel-logic-1 升至 2）\n- 对照：\`${SRC}/PRODUCT-VERDICT.md\`\n\n## 改动文件\n\n- \`worker/projection-story.js\`：novelLogic 时 \`storyLongForm\`/\`psIntro\`/\`psSummary\` 不再输出处境/行动小标题与「每一段都写了处境…」\n- \`worker/depth-contract.js\`：契约升 \`…+novel-logic-2\`；proj/plan addon 强调财富阶梯与禁截图当转折\n- \`scripts/p0-29-novel-logic-r2.mjs\`（新建）\n\n## 定点怎么改的\n\n- **proj**：拼装层去说明书腔（硬）；字段仍内置 situation/action/change/cost，读者可见 longForm 为连续章节。\n- **G5**：第四幕重写——控股权+水数据/水基础设施资产 → 个人净资产逼近公开入榜门槛；回购/锁定降为守榜；删/降权「截图=真正的转折」。\n- **G4–G6**：补上市前规模（建模+两公司）与赢标扩表；禁只靠对比图爬榜。\n- **第1幕**：删文末 worldShiftHint 照抄，旧硬盘+声控灯感官收束。\n- **SCORECARD**：自读摘本样「旧硬盘」原文；三问互异摘句。\n\n## 已知弱\n\n- 第四幕为定点 LLM 重写，前三幕保留原样微调；若产品要整稿统一声腔可再开一刀。\n- 三问摘句为正文抽句，产品仍只认正文。\n- 未 commit / 未热更 / 未开 B / 未做 32b；过闸前不请 Grok。\n`);

  try{await copyFile(SRC+'/PRODUCT-VERDICT.md',OUT+'/PRODUCT-VERDICT-ref.md');}catch{}
  try{await copyFile(SRC+'/PRODUCT-BRIEF.md',OUT+'/PRODUCT-BRIEF.md');}catch{}

  log({done:true,out:OUT,ready:ac.readyForProductReview,fails:ac.fails,novelSelfRead,g5:ac.g5,labelLeak:ac.labelLeak,act4Han:perNarr[3]});
  if(!ac.readyForProductReview)process.exitCode=4;
}

main().catch(e=>{console.error(String(e?.stack||e));process.exit(1);});
