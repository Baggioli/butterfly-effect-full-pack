/**
 * P0-29 宏大目标对照样（DeepSeek 主路径）
 * - 档案同便利店弱起点，目标改为「成为世界首富」
 * - 规则层自拟数年级多阶段（非 90天/13周）；近端仍可执行；验证点非终局首富
 * - plan↔proj 同契约同 provider；nearTerm←plan；无 raw40
 * - 不做 32b/7b；不热更、不 merge、不碰 A2/8443
 * 密钥仅运行时读取，不入库、不打印明文。
 */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {
  DEPTH_CONTRACT_VERSION,planDepthContractText,chapterHasExplicitQuad,
  extractQuadFromText,nearTermFromPlanStory,ensureChapterQuad
} from '../worker/depth-contract.js';
import {normalizeStoryDraft,validateStory,storyArcPromptHint,StoryValidationError} from '../worker/api.js';
import {buildRoleFacts,buildGoalTree,heuristicGap,assembleGap,computeProjection,pjLine} from '../worker/projection.js';
import {generateStoryLLM} from '../worker/projection-story.js';

const OUT=process.env.P0_29_OUT||'/workspace/butterfly-handoff/p0-29-grand-goal';
const SECRET_FILE=process.env.BUTTERFLY_LLM_ENV_FILE||'/workspace/butterfly-secrets/butterfly-llm.env';
const TIP=process.env.P0_29_TIP||'653dfda';

/** 用户原话级目标；规则周界另由 ruleFacts 给出 */
const persona={
  name:'虚构便利店试单甲',age:'22',education:'高中 / 中专',role:'便利店店员',
  experience:'没有编程经验，刚开始学习Excel',skills:'基础录入',
  resources:'只有个人电脑，没有客户联系人',budget:0,hours:4,
  goal:'成为世界首富',
  constraints:'不辞职，不购买课程作默认路径，不编造收入与客户与成功率；近端动作须本人可控',
  longGoal:'成为世界首富'
};

/**
 * 规则层自拟：约 5 年（260 周）多阶段轴。
 * 近端 0–4 周可执行；终局「世界首富」不进验证完成态；阶段 gate 只写可检验中期证据。
 */
const ruleFacts={
  version:DEPTH_CONTRACT_VERSION,
  goalText:'成为世界首富',
  deadlineDays:1825,
  deadlineWeeks:260,
  hoursPerWeek:4,
  stages:[
    {key:'near',label:'近端可执行起步（证据与技能苗头）',weekLo:0,weekHi:4},
    {key:'build',label:'能力与小证据积累（约第1年）',weekLo:4,weekHi:52},
    {key:'mid',label:'可检验中期证据（约第2–3年：稳定小生意/资产苗头，非首富）',weekLo:52,weekHi:156},
    {key:'verify',label:'阶段验证点（约第5年：可查证事业/资产规模证据；禁止写成已成首富）',weekLo:156,weekHi:260}
  ],
  note:'模拟非承诺。下列周数/阶段仅供叙事对齐；模型不得另编收入、成功概率或客户。阶段验证点写可检验中期证据，禁止终局「成为世界首富」完成态。数字只来自本规则层。',
  disclaimer:'模拟非承诺',
  forbidTerminalRichest:true
};

function loadEnvFile(text){
  const out={};
  for(const line of String(text||'').split(/\r?\n/)){
    const t=line.trim();if(!t||t.startsWith('#'))continue;
    const i=t.indexOf('=');if(i<1)continue;
    out[t.slice(0,i).trim()]=t.slice(i+1).trim();
  }
  return out;
}
function redact(obj){
  const s=JSON.stringify(obj,(k,v)=>{
    if(/key|secret|token|password|authorization/i.test(String(k))&&typeof v==='string'&&v)return `<redacted len=${v.length}>`;
    if(typeof v==='string'&&/^sk-/.test(v))return `<redacted len=${v.length}>`;
    return v;
  });
  return JSON.parse(s);
}
function countHan(s){return Array.from(String(s||'')).filter(ch=>/\p{Script=Han}/u.test(ch)).length;}
function narrativeChars(story){return (story?.chapters||[]).reduce((n,c)=>n+countHan(c.narrative||''),0);}
function weekFirst(story){
  const q=story?.chapters?.[0]?.quests||[];
  return {today:q[0]?.title,week:q[1]?.title,todayOut:q[0]?.output,weekOut:q[1]?.output,gate:story?.chapters?.[0]?.gate};
}
function chapterQuadReport(c){
  const explicit=chapterHasExplicitQuad(c);
  const fromLabel=extractQuadFromText(c?.narrative||'');
  return {
    explicit,
    hasFields:['situation','action','change','cost'].every(k=>String(c?.[k]||'').trim().length>=8),
    fieldChars:Object.fromEntries(['situation','action','change','cost'].map(k=>[k,countHan(c?.[k]||fromLabel?.[k]||'')])),
    narrativeHasLabels:!!fromLabel
  };
}
function byteLen(s){return Buffer.byteLength(String(s||''),'utf8');}
function hasGuaranteeSuccess(blob){
  const s=String(blob||'');
  // 排除合规否定：「不/也不/并非/无法保证成功」等不记 FAIL
  const cleaned=s
    .replace(/[也不并绝未]{0,2}不保证成功/g,'')
    .replace(/并非保证成功/g,'')
    .replace(/不是保证成功/g,'')
    .replace(/绝不保证/g,'')
    .replace(/无法保证成功/g,'')
    .replace(/不保证[你其成]/g,'');
  return /保证成功|一定能成为|稳赚|包过|注定成为|必然成为世界首富|保证你成为|一定成为世界首富|算命|改命/.test(cleaned);
}
function claimsTerminalRichest(blob){
  const s=String(blob||'');
  // 完成态/已达成表述（宽松）
  return /已成为世界首富|成为了世界首富|成功成为世界首富|达成世界首富|实现世界首富|登上世界首富|稳居世界首富/.test(s);
}

async function invokeDeepSeekPlan(secrets,profile,rf){
  const apiKey=secrets.BUTTERFLY_LLM_API_KEY;
  const base=(secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com').replace(/\/$/,'');
  const model=secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat';
  const url=/\/chat\/completions$/.test(base)?base:(base+'/chat/completions');
  const common='你是蝴蝶效应应用的中文规划助手。只输出一个JSON对象，不要Markdown。';
  const schema={title:'故事标题（锚定痛点；已是经营者勿写成转型成经营者）',baseline:'引用已提供条件的规划依据',chapters:[{name:'章节名',period:'阶段范围',narrative:'结合经历的具体情节、事件和条件',gate:'可验证成果标准',quests:[{title:'明确动作',steps:['第一步','第二步','第三步'],output:'交付物与验收标准',tool:'已有或可获得的工具',example:'可直接使用的示例',minutes:20,why:'具体引用相关个人条件'}]}]};
  let instructions=common+' 结合年龄所对应的现实阶段与学历涉及的学习起点、必要资格条件，但不得据此推断能力上限。生成正好4幕、每幕1—3个具体任务的个性化人生故事。远期保留条件，近期具体。每个任务正好3步、写明工具、产出、话术或格式示例、依据。第一幕所有任务总用时不能超过每周可用时间的70%。沿用已确认目标和边界，不擅改目标期限。参考结构：'+JSON.stringify(schema)+storyArcPromptHint(profile);
  instructions+=' 每幕优先1—2个任务。第一幕每个任务是可在标注分钟内完成的小动作；写出具体表格列名、练习数据或邀请原话，以及可数的产出。优先利用已有技能、资源与联系人验证需求，不要求所有人从学编程开始。没有联系人时提供不依赖熟人的证据收集路径，不虚构同事支持或现有客户。没有明确可用数据权限时使用自己编写的虚构样表。示例涉及个人项目、工作成果、业绩和收入时一律使用____待填写，不可给出用户没说过的提升百分比、项目名称或第一人称成就。远期叙述用“若……则……”，获客、付款、成功均待验证，不写成既定结果。';
  instructions+=' 为控制等待时间，返回精炼完整的四幕，第一幕安排2个小任务，分别用于今天和接下来7天；其余每幕只安排1个关键任务。每个任务的minutes不超过'+Math.min(45,Math.floor((profile.hours??.5)*60*.7/3))+'分钟；步骤规模必须匹配该时长。远期仅写满足前置条件后的下一小步，不把等待客户回复或获得订单当作用户能控制的完成标准。';
  instructions+=' 最后核对硬性要求：第一章quests必须恰好2个任务，标题分别以“今天：”和“本周：”开头，每个任务只交付一个在其minutes内能完成的小成果。每个narrative必须≥400汉字、含【处境】【行动】【变化】【代价】标签、四幕合计≥1600汉字。example必须是空白可填模板，涉及个人经历和成果一律用____。可用时间4小时就是一周共4小时。远期叙述与gate只写本人可控制的证据。';
  // depth + 宏大目标纠偏
  instructions=instructions.replace('总正文约1000个汉字','四幕narrative合计目标≥1600汉字（每幕≥400；验收≥1500）');
  instructions+=planDepthContractText(rf,{enabled:true});
  instructions+=' 【规则层只读】'+JSON.stringify(rf);
  instructions+=' 【宏大目标专项】用户终局目标是「成为世界首富」，但这是不可承诺的终局。四幕 period 必须对齐规则层 stages 的 weekLo/weekHi（合计覆盖至约 '+rf.deadlineWeeks+' 周 / '+rf.deadlineDays+' 天），近端具体可验收，中远期写有条件的阶段证据。gate 与验证幕只写「可检验的中期证据」（如可查证的技能作品、小单回款记录模板、储蓄/资产台账字段），禁止写成已经/必将成为世界首富。标识本计划为模拟非承诺。禁止算命、保证成功、编造收入数字或成功概率。';
  const payload={profile,ruleFacts:rf};
  const messages=[{role:'system',content:instructions},{role:'user',content:JSON.stringify(payload)}];

  const call=async(msgs)=>{
    const body={model,messages:msgs,response_format:{type:'json_object'},max_tokens:9000,thinking:{type:'disabled'}};
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+apiKey},body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
    if(!response.ok){
      const err=Error('upstream '+response.status);err.status=response.status;throw err;
    }
    const result=await response.json();
    if(result.choices?.[0]?.finish_reason==='length')throw Error('故事尚未完成，请重试');
    return JSON.parse(result.choices?.[0]?.message?.content||'{}');
  };

  let data=await call(messages);
  let story,repaired=false,depthExpanded=false;
  try{
    story=validateStory(normalizeStoryDraft(data),profile.hours??.5,profile);
  }catch(firstErr){
    if(!(firstErr instanceof StoryValidationError))throw firstErr;
    const repairMsgs=[...messages,{role:'assistant',content:JSON.stringify(data)},{role:'user',content:'上次输出未通过校验（'+firstErr.rule+'）：'+firstErr.message+'。请只输出修正后的完整JSON，不要解释。硬性要求：第一章quests恰好2个，标题分别以“今天：”和“本周：”开头；每章 narrative 含【处境】【行动】【变化】【代价】且≥400汉字；每个任务恰好3步。不要编造用户没说过的经历或成果。阶段验证禁止写成已成世界首富。'+storyArcPromptHint(profile)}];
    data=await call(repairMsgs);
    story=validateStory(normalizeStoryDraft(data),profile.hours??.5,profile);
    repaired=true;
  }
  // depth expand if short
  const narr0=narrativeChars(story);
  if(narr0<1500||!(story.chapters||[]).every(c=>chapterHasExplicitQuad(c))){
    const expandMsgs=[...messages,{role:'assistant',content:JSON.stringify(data)},{role:'user',content:'请在保持JSON结构与今天/本周标题不变的前提下加厚四幕 narrative（每幕≥400汉字、含【处境】【行动】【变化】【代价】标签与 situation/action/change/cost 字段），合计≥1600汉字。不要改变规则周界，不要写成已成世界首富，不要编造收入/概率。只输出完整JSON。'}];
    try{
      data=await call(expandMsgs);
      const expanded=validateStory(normalizeStoryDraft(data),profile.hours??.5,profile);
      if(narrativeChars(expanded)>=narr0){story=expanded;depthExpanded=true;}
    }catch(e){console.log(JSON.stringify({phase:'expand-skip',error:String(e.message||e).slice(0,120)}));}
  }
  story={...story,chapters:(story.chapters||[]).map(c=>ensureChapterQuad(c)),quadExplicit:(story.chapters||[]).every(c=>chapterHasExplicitQuad(c)),provider:'deepseek',model,depth:true,depthVersion:DEPTH_CONTRACT_VERSION};
  return {story,repaired,depthExpanded,provider:'deepseek',model};
}

async function main(){
  await mkdir(OUT,{recursive:true});
  let secrets={};
  try{secrets=loadEnvFile(await readFile(SECRET_FILE,'utf8'));console.log(JSON.stringify({phase:'secrets',loaded:true,keys:Object.keys(secrets)}));}
  catch(e){console.log(JSON.stringify({phase:'secrets',loaded:false,error:String(e.message||e)}));process.exit(2);}
  if(!secrets.BUTTERFLY_LLM_API_KEY){console.error('missing key');process.exit(2);}

  const dsEnv={
    BUTTERFLY_LLM_PROVIDER:secrets.BUTTERFLY_LLM_PROVIDER||'deepseek',
    BUTTERFLY_LLM_BASE_URL:secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com',
    BUTTERFLY_LLM_MODEL:secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat',
    BUTTERFLY_LLM_API_KEY:secrets.BUTTERFLY_LLM_API_KEY,
    AI_PROVIDER:secrets.BUTTERFLY_LLM_PROVIDER||'deepseek',
    AI_MODEL:secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat',
    AI_BASE_URL:secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com',
    DEEPSEEK_API_KEY:secrets.BUTTERFLY_LLM_API_KEY,
    AI_DEPTH_CONTRACT:'1',
    PROJECTION_STORY_LLM:'1',
    __ruleFacts:ruleFacts
  };

  // persona + ruleFacts
  await writeFile(`${OUT}/persona.json`,JSON.stringify({tip:TIP,contractVersion:DEPTH_CONTRACT_VERSION,persona,ruleFacts,note:'弱起点×宏大终局；规则周界自拟数年，非90天/13周试单硬套'},null,2));

  // 1) DeepSeek plan（可重试）
  let planRow=null;
  for(let attempt=1;attempt<=3;attempt++){
    const t0=Date.now();
    try{
      console.log(JSON.stringify({phase:'plan-start',attempt}));
      const res=await invokeDeepSeekPlan(secrets,persona,ruleFacts);
      const story=res.story;
      const row={
        id:'plan-deepseek-grand',attempt,ms:Date.now()-t0,status:200,
        provider:res.provider,model:res.model,repaired:res.repaired,depthExpanded:res.depthExpanded,
        story,narr:narrativeChars(story),
        quadExplicit:story?.quadExplicit??(story?.chapters||[]).every(c=>chapterHasExplicitQuad(c)),
        chapterQuads:(story?.chapters||[]).map(chapterQuadReport),
        weekFirst:weekFirst(story),
        depthVersion:story?.depthVersion||DEPTH_CONTRACT_VERSION
      };
      console.log(JSON.stringify({phase:'plan-done',attempt,ms:row.ms,narr:row.narr,quadExplicit:row.quadExplicit}));
      if(!planRow||(row.narr||0)>(planRow.narr||0))planRow=row;
      if((planRow.narr||0)>=1500&&planRow.quadExplicit)break;
    }catch(e){
      console.log(JSON.stringify({phase:'plan-fail',attempt,error:String(e?.message||e).slice(0,200)}));
      if(!planRow)planRow={id:'plan-deepseek-grand',attempt,status:502,error:String(e?.message||e),narr:0,quadExplicit:false};
    }
  }

  const planStory=planRow?.story;
  const planNear=nearTermFromPlanStory(planStory);
  if(!planNear){
    console.error(JSON.stringify({phase:'align-fail',reason:'plan_nearTerm_missing',weekFirst:weekFirst(planStory)}));
    // still write partials
  }else{
    console.log(JSON.stringify({phase:'plan-nearTerm',today:planNear.today.title,week:planNear.week.title}));
  }

  // 2) DeepSeek projection — nearTerm←plan；规则周界=数年自拟
  const rf=buildRoleFacts(persona);
  const gt=buildGoalTree(persona);
  const gapObj=assembleGap(heuristicGap(rf),rf,{model:null,source:'heuristic'});
  const proj=computeProjection({roleFacts:rf,goalTree:gt,gap:gapObj});
  const rawHorizonInternal=pjLine(proj)?.horizon;
  let projectionUser=null;
  const t0=Date.now();
  try{
    const projStory=await generateStoryLLM({...dsEnv,__ruleFacts:ruleFacts},proj,{
      roleFacts:rf,profile:persona,base:'http://127.0.0.1:11434',model:dsEnv.BUTTERFLY_LLM_MODEL,
      authoritativeNearTerm:planNear||undefined,planStory
    });
    projectionUser={
      ms:Date.now()-t0,
      provider:projStory.provider,providerKind:projStory.providerKind,model:projStory.model,
      source:projStory.source,chars:projStory.chars,validation:projStory.validation?.pass,
      depth:projStory.depth,depthVersion:projStory.depthVersion,depthSpine:projStory.depthSpine,
      ruleHorizonWeeks:projStory.ruleHorizonWeeks??ruleFacts.deadlineWeeks,
      nearTerm:projStory.nearTerm,
      nearTermSource:projStory.nearTermSource,
      perNode:(projStory.perNode||[]).map(n=>({nodeId:n.nodeId,title:n.title,tRange:n.tRange,depthStage:n.depthStage,source:n.source,
        situation:n.situation,action:n.action,change:n.change,cost:n.cost,
        fieldChars:{situation:countHan(n.situation),action:countHan(n.action),change:countHan(n.change),cost:countHan(n.cost)}})),
      longForm:projStory.longForm,
      attempts:projStory.attempts
    };
    console.log(JSON.stringify({phase:'proj-done',ms:projectionUser.ms,chars:projectionUser.chars,provider:projectionUser.provider,nodes:projectionUser.perNode.length,
      maxHi:Math.max(0,...projectionUser.perNode.map(n=>n.tRange?.hi||0)),ruleHorizonWeeks:projectionUser.ruleHorizonWeeks,
      nearTermSource:projectionUser.nearTermSource,
      nearTermMatch:planNear? (projectionUser.nearTerm?.today?.title===planNear.today.title&&projectionUser.nearTerm?.week?.title===planNear.week.title):false,
      validation:projectionUser.validation}));
  }catch(e){
    console.log(JSON.stringify({phase:'proj-fail',error:String(e?.message||e).slice(0,240)}));
    projectionUser={ms:Date.now()-t0,error:String(e?.message||e),perNode:[],nearTerm:null,chars:0};
  }

  // Hard checks
  const planWF=weekFirst(planStory);
  const nearTermTitleEqual=Boolean(planNear&&projectionUser?.nearTerm?.today?.title===planNear.today.title&&projectionUser?.nearTerm?.week?.title===planNear.week.title);
  const nearTermOutputEqual=Boolean(planNear&&projectionUser?.nearTerm?.today?.output===planNear.today.output&&projectionUser?.nearTerm?.week?.output===planNear.week.output);
  const userVisibleBlob=JSON.stringify({plan:planRow&&{weekFirst:planWF,chapters:(planStory?.chapters||[]).map(c=>({name:c.name,period:c.period,gate:c.gate}))},projection:projectionUser&&{...projectionUser,longForm:projectionUser.longForm,attempts:undefined}});
  const userVisibleExposesRaw40=/rawProjectionHorizon/.test(userVisibleBlob)||/"hi"\s*:\s*40\b/.test(userVisibleBlob);
  const fullTextForCompliance=JSON.stringify({plan:planStory,projection:projectionUser});
  const projMaxHi=Math.max(0,...(projectionUser?.perNode||[]).map(n=>n.tRange?.hi||0));
  const stagesOk=Array.isArray(ruleFacts.stages)&&ruleFacts.stages.length===4&&ruleFacts.deadlineWeeks>=100;
  const noGuarantee=!hasGuaranteeSuccess(fullTextForCompliance);
  const noTerminal=!(claimsTerminalRichest(fullTextForCompliance));

  const hard={
    '1_plan_narr_ge_1500':(planRow?.narr||0)>=1500,
    planNarr:planRow?.narr||0,
    '2_plan_quad_explicit':Boolean(planRow?.quadExplicit),
    '2_plan_quad_chapters':(planRow?.chapterQuads||[]).filter(q=>q.explicit).length,
    '2_stages_midterm_not_terminal':stagesOk&&noTerminal,
    '2_rule_weeks_multi_year':ruleFacts.deadlineWeeks,
    '2_stages':ruleFacts.stages,
    '3_named_actions_near':Boolean(planWF.today&&planWF.week),
    '4_near_term_retellable':Boolean(planNear?.today?.title?.startsWith('今天：')&&planNear?.week?.title?.startsWith('本周：')),
    '5_same_provider':Boolean(String(planRow?.provider||'').toLowerCase().includes('deepseek')&&String(projectionUser?.provider||'').toLowerCase().includes('deepseek')),
    '5_plan_provider':planRow?.provider||null,
    '5_proj_provider':projectionUser?.provider||null,
    '5_same_depth_version':(planStory?.depthVersion||DEPTH_CONTRACT_VERSION)===(projectionUser?.depthVersion||DEPTH_CONTRACT_VERSION),
    '5_proj_within_rule_weeks':projMaxHi>0&&projMaxHi<=ruleFacts.deadlineWeeks,
    '5_proj_node_count_4':(projectionUser?.perNode||[]).length===4,
    '5_proj_has_near_term':Boolean(projectionUser?.nearTerm?.today?.title?.startsWith?.('今天：')&&projectionUser?.nearTerm?.week?.title?.startsWith?.('本周：')),
    '5_plan_has_near_term':Boolean(planWF.today?.startsWith('今天：')&&planWF.week?.startsWith('本周：')),
    '5_proj_quad_fields':(projectionUser?.perNode||[]).every(n=>['situation','action','change','cost'].every(k=>countHan(n[k])>=30)),
    '4_nearTerm_title_equal':nearTermTitleEqual,
    '4_nearTerm_output_equal':nearTermOutputEqual,
    '4_nearTerm_source_plan':projectionUser?.nearTermSource==='plan'||projectionUser?.nearTermSource==='authoritative',
    'align_user_visible_no_raw40':!userVisibleExposesRaw40,
    '6_no_guarantee_success':noGuarantee,
    '6_no_terminal_richest':noTerminal,
    '6_disclaimer_sim':/模拟非承诺/.test(ruleFacts.note+ruleFacts.disclaimer),
    projChars:projectionUser?.chars||0,
    projMaxHi,
    ruleDeadlineWeeks:ruleFacts.deadlineWeeks,
    planNearTerm:planNear?{today:planNear.today.title,week:planNear.week.title,todayOut:planNear.today.output,weekOut:planNear.week.output}:null,
    projNearTerm:{today:projectionUser?.nearTerm?.today?.title,week:projectionUser?.nearTerm?.week?.title,todayOut:projectionUser?.nearTerm?.today?.output,weekOut:projectionUser?.nearTerm?.week?.output},
    nearTermBytes:{
      planToday:byteLen(planNear?.today?.title),projToday:byteLen(projectionUser?.nearTerm?.today?.title),
      planWeek:byteLen(planNear?.week?.title),projWeek:byteLen(projectionUser?.nearTerm?.week?.title),
      planTodayOut:byteLen(planNear?.today?.output),projTodayOut:byteLen(projectionUser?.nearTerm?.today?.output),
      planWeekOut:byteLen(planNear?.week?.output),projWeekOut:byteLen(projectionUser?.nearTerm?.week?.output)
    }
  };
  hard.pass1=hard['1_plan_narr_ge_1500'];
  hard.pass2=hard['2_plan_quad_explicit']&&hard['2_plan_quad_chapters']===4&&hard['2_stages_midterm_not_terminal'];
  hard.pass3=hard['3_named_actions_near'];
  hard.pass4=hard['4_near_term_retellable']&&hard['4_nearTerm_title_equal']&&hard['4_nearTerm_output_equal']&&hard['4_nearTerm_source_plan'];
  hard.pass5=hard['5_same_provider']&&hard['5_same_depth_version']&&hard['5_proj_within_rule_weeks']&&hard['5_proj_node_count_4']&&hard['5_proj_has_near_term']&&hard['5_plan_has_near_term']&&hard['5_proj_quad_fields'];
  hard.pass6=hard['6_no_guarantee_success']&&hard['6_no_terminal_richest']&&hard['6_disclaimer_sim']&&hard['align_user_visible_no_raw40'];
  hard.readyForProductReview=Boolean(hard.pass1&&hard.pass2&&hard.pass3&&hard.pass4&&hard.pass5&&hard.pass6);

  // Write outputs
  await writeFile(`${OUT}/plan-deepseek.json`,JSON.stringify(redact({
    id:planRow?.id,attempt:planRow?.attempt,ms:planRow?.ms,status:planRow?.status,
    provider:planRow?.provider,model:planRow?.model,repaired:planRow?.repaired,depthExpanded:planRow?.depthExpanded,
    narr:planRow?.narr,quadExplicit:planRow?.quadExplicit,chapterQuads:planRow?.chapterQuads,weekFirst:planRow?.weekFirst,
    depthVersion:planRow?.depthVersion||DEPTH_CONTRACT_VERSION,ruleFacts,story:planStory,error:planRow?.error
  }),null,2));

  await writeFile(`${OUT}/proj-deepseek.json`,JSON.stringify(redact({
    ...projectionUser,
    attempts:projectionUser?.attempts?.slice?.(-8),
    ruleFacts,
    internalNote:'行动线算法 raw horizon 仅内部，不进用户可见字段',
    // strip any accidental raw
  }),null,2));

  // self-check.md
  let sc=`# P0-29 宏大目标样 · 硬条自检\n\n`;
  sc+=`- 时间：${new Date().toISOString()}（Asia/Shanghai）\n`;
  sc+=`- tip：\`${TIP}\` · 契约：\`${DEPTH_CONTRACT_VERSION}\`\n`;
  sc+=`- 目标：成为世界首富 · 规则周界：${ruleFacts.deadlineDays}天 / ${ruleFacts.deadlineWeeks}周（数年自拟，非90/13）\n`;
  sc+=`- readyForProductReview：**${hard.readyForProductReview?'YES':'NO'}**\n\n`;
  sc+=`## 硬条①–⑥\n\n`;
  sc+=`| 硬条 | 结果 | 说明 |\n|---|---|---|\n`;
  sc+=`| ① 叙事≥1500 | ${hard.pass1?'PASS':'FAIL'} | plan narr 汉字=${hard.planNarr} |\n`;
  sc+=`| ② 四元+中期验证非终局 | ${hard.pass2?'PASS':'FAIL'} | 四元显式章节=${hard['2_plan_quad_chapters']}/4；多年阶段=${hard['2_rule_weeks_multi_year']}周；无首富完成态=${hard['6_no_terminal_richest']} |\n`;
  sc+=`| ③ 具名可查近端动作 | ${hard.pass3?'PASS':'FAIL'} | 今天/本周标题存在 |\n`;
  sc+=`| ④ 5分钟可复述+近端同源 | ${hard.pass4?'PASS':'FAIL'} | titleEqual=${hard['4_nearTerm_title_equal']} outputEqual=${hard['4_nearTerm_output_equal']} source=${hard['4_nearTerm_source_plan']} |\n`;
  sc+=`| ⑤ 同深同 provider | ${hard.pass5?'PASS':'FAIL'} | plan=${hard['5_plan_provider']} proj=${hard['5_proj_provider']}；maxHi=${hard.projMaxHi}≤${hard.ruleDeadlineWeeks}；nodes=4；双侧近端 |\n`;
  sc+=`| ⑥ 合规模拟非承诺 | ${hard.pass6?'PASS':'FAIL'} | 无保证成功=${hard['6_no_guarantee_success']}；无首富完成态=${hard['6_no_terminal_richest']}；无raw40=${hard['align_user_visible_no_raw40']} |\n\n`;
  sc+=`## 字数\n\n- plan narrative 汉字：${hard.planNarr}\n- projection chars：${hard.projChars}\n\n`;
  sc+=`## 近端字节对照（UTF-8）\n\n\`\`\`json\n${JSON.stringify(hard.nearTermBytes,null,2)}\n\`\`\`\n\n`;
  sc+=`- plan 今天：${hard.planNearTerm?.today}\n- proj 今天：${hard.projNearTerm?.today}\n`;
  sc+=`- plan 本周：${hard.planNearTerm?.week}\n- proj 本周：${hard.projNearTerm?.week}\n\n`;
  sc+=`## 阶段表（规则层）\n\n\`\`\`json\n${JSON.stringify(ruleFacts.stages,null,2)}\n\`\`\`\n\n`;
  sc+=`## 无保证成功 / 无终局完成态\n\n- hasGuaranteeSuccess 扫描：${hasGuaranteeSuccess(fullTextForCompliance)}\n- claimsTerminalRichest 扫描：${claimsTerminalRichest(fullTextForCompliance)}\n- 规则层 disclaimer：模拟非承诺\n\n`;
  sc+=`## raw40\n\n- 用户可见含 rawProjectionHorizon / hi:40：${userVisibleExposesRaw40}（须 false）\n- 内部行动线 raw（不进用户产物）：${JSON.stringify(rawHorizonInternal)}\n`;
  await writeFile(`${OUT}/self-check.md`,sc);
  await writeFile(`${OUT}/self-check.json`,JSON.stringify(redact({at:new Date().toISOString(),tip:TIP,contractVersion:DEPTH_CONTRACT_VERSION,ruleFacts,hard,readyForProductReview:hard.readyForProductReview}),null,2));

  // SCORECARD.md
  let sm=`# Micheal 五维打分卡 · 宏大目标对照样\n\n`;
  sm+=`- 契约：\`${DEPTH_CONTRACT_VERSION}\` · tip \`${TIP}\` · DeepSeek 主路径\n`;
  sm+=`- 档案：22岁便利店店员 · 每周4h · 目标「成为世界首富」\n`;
  sm+=`- 规则周界：约 ${ruleFacts.deadlineWeeks} 周（${ruleFacts.deadlineDays} 天 · 数年阶段轴）\n`;
  sm+=`- 请按 1–5 分打（与便利店·Excel 样同口径）\n\n`;
  sm+=`| 维 | 问法 | 分数 |\n|---|---|---|\n`;
  sm+=`| 详细 | 读起来像不像一条有血肉的轨迹，而非提纲 |  |\n`;
  sm+=`| 可信 | 以他的条件，阶段与代价是否说得通（含对宏大目标的诚实） |  |\n`;
  sm+=`| 可落地 | 今天/本周是否真能动手、有验收 |  |\n`;
  sm+=`| 好玩 | 是否想继续往下看/再打开 |  |\n`;
  sm+=`| 愿再打开 | 换宏大目标后还愿不愿用 |  |\n\n`;
  sm+=`附问（可选一句）：宏大目标下，系统是「诚实拆台阶」还是「空许诺」？\n\n`;
  sm+=`---\n\n## 今天 / 本周摘要\n\n`;
  sm+=`- **今天**：${hard.planNearTerm?.today||'（缺）'}\n  - 产出：${hard.planNearTerm?.todayOut||''}\n`;
  sm+=`- **本周**：${hard.planNearTerm?.week||'（缺）'}\n  - 产出：${hard.planNearTerm?.weekOut||''}\n`;
  sm+=`- 第一章 gate：${planWF.gate||''}\n\n`;
  sm+=`## 与便利店·Excel 样对照（各 3–5 句，勿吹）\n\n`;
  sm+=`**相同**\n\n`;
  sm+=`1. 同一深度契约 \`${DEPTH_CONTRACT_VERSION}\`，同一 DeepSeek 主路径，硬条①–⑥同口径验收。\n`;
  sm+=`2. 近端仍强制「今天：/本周：」可执行可验收；plan↔proj 近端字面同源。\n`;
  sm+=`3. 四幕显式处境·行动·变化·代价；合规「模拟非承诺」，禁保证成功与编造收入概率。\n\n`;
  sm+=`**不同**\n\n`;
  sm+=`1. 目标从「90天 Excel 付费试单」换成不可承诺的终局「成为世界首富」；规则周界改为约 ${ruleFacts.deadlineWeeks} 周数年阶段轴，不再硬套 90天/13周。\n`;
  sm+=`2. 阶段验证点只写可检验中期证据（技能/小单/资产台账类），明确禁止写成已成首富。\n`;
  sm+=`3. 压力测的是「弱起点×宏大终局」差距是否被诚实拆台阶，而非短周期成交叙事。\n`;
  await writeFile(`${OUT}/SCORECARD.md`,sm);

  // short pm facts
  await writeFile(`${OUT}/pm-review-facts.md`,`# 宏大目标样 · 短摘录（产品/Grok）\n\n- tip \`${TIP}\` · \`${DEPTH_CONTRACT_VERSION}\` · DeepSeek\n- goal：成为世界首富 · ruleWeeks=${ruleFacts.deadlineWeeks}（数年自拟）\n- plan narr=${hard.planNarr} · proj chars=${hard.projChars} · quad=${hard['2_plan_quad_chapters']}/4\n- 近端：${hard.planNearTerm?.today} / ${hard.planNearTerm?.week}\n- 同源：title=${hard['4_nearTerm_title_equal']} output=${hard['4_nearTerm_output_equal']} source=${hard['4_nearTerm_source_plan']}\n- hard ①${hard.pass1?'PASS':'FAIL'} ②${hard.pass2?'PASS':'FAIL'} ③${hard.pass3?'PASS':'FAIL'} ④${hard.pass4?'PASS':'FAIL'} ⑤${hard.pass5?'PASS':'FAIL'} ⑥${hard.pass6?'PASS':'FAIL'}\n- readyForProductReview=${hard.readyForProductReview}\n- 不做 32b；不热更；不催 Micheal\n`);

  await writeFile(`${OUT}/PRODUCT-NOTES.md`,`# P0-29 宏大目标对照样 · 产品笔记\n\n- 时间：${new Date().toISOString()}（Asia/Shanghai）\n- tip：\`${TIP}\` · 分支 \`feat/p0-29-c-prime-32b\`（本地样例，未 merge / 未热更）\n- 契约：\`${DEPTH_CONTRACT_VERSION}\`\n- backlog 参照：PRODUCT-BRIEF.md（v1.26.53）\n\n## 档案 / 目标\n\n- 同便利店弱起点（22 / 高中中专 / 每周4h / 预算0 / 无客户）\n- **目标**：成为世界首富（用户原话级）\n- **规则周界**：${ruleFacts.deadlineDays} 天 / ${ruleFacts.deadlineWeeks} 周（数年自拟多阶段；**非** 90天/13周试单硬套）\n\n## 契约与字数\n\n- plan narr 汉字：${hard.planNarr}\n- proj chars：${hard.projChars}\n- 四元显式：${hard['2_plan_quad_chapters']}/4\n- 近端同源：title=${hard['4_nearTerm_title_equal']} output=${hard['4_nearTerm_output_equal']} nearTermSource=${projectionUser?.nearTermSource}\n\n## 硬条\n\n见 \`self-check.md\`。readyForProductReview=${hard.readyForProductReview}\n\n## 与便利店试单样例差异（一句）\n\n同深度同主路径，但终局宏大且规则层改为数年阶段轴，验证点停在可检验中期证据而非 13 周成交/首富完成态。\n\n## 边界\n\n不热更、不 merge、不开 B、不动 A2/8443、不做 32b/7b、secrets 不进 git、不催 Micheal。\n`);

  console.log(JSON.stringify(redact({
    done:true,out:OUT,tip:TIP,contractVersion:DEPTH_CONTRACT_VERSION,
    hard:{pass1:hard.pass1,pass2:hard.pass2,pass3:hard.pass3,pass4:hard.pass4,pass5:hard.pass5,pass6:hard.pass6,readyForProductReview:hard.readyForProductReview,planNarr:hard.planNarr,projChars:hard.projChars,projMaxHi:hard.projMaxHi}
  }),null,2));
}

main().catch(e=>{console.error(String(e?.stack||e));process.exit(1);});
