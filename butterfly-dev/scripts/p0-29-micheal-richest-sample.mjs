/**
 * P0-29 Micheal 原型 ×「成为世界首富」可达路径样（DeepSeek 主路径）
 * - 档案：Micheal 本人原型（42岁；逸泓水务环境≈5人；逸泓智能无员工）
 * - 规则层自拟约 10 年（520 周）四阶段财富/规模跃迁轴；终段验证点对准全球富豪榜/世界首富方向
 * - plan↔proj 同契约同 provider；nearTerm←plan；无 raw40
 * - 不做 32b/7b；不热更、不 merge、不碰 A2/8443；不改旧 grand-goal 脚本默认档案
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

const OUT=process.env.P0_29_OUT||'/workspace/butterfly-handoff/p0-29-micheal-richest';
const SECRET_FILE=process.env.BUTTERFLY_LLM_ENV_FILE||'/workspace/butterfly-secrets/butterfly-llm.env';
const TIP=process.env.P0_29_TIP||'653dfda';

/** Micheal 原型（产品 brief v1.26.55 档案表；不虚构客户/合同/到账） */
const persona={
  name:'Micheal Li（Michael Li）',age:'42',
  role:'逸泓水务环境创始人/负责人（约5人：水利、供排水、环保咨询）；同时持有逸泓智能（智能科技，目前无员工，产品上线主体挂此）',
  education:'环境方向专业训练背景',major:'环境（水生态/水动力/排水）',
  experience:'带领约5人团队做水利、供排水、环保（含环评）咨询；团队建模能力强：SWMM、XP-SWMM2D、EFDC、SWAT、HSPF、InfoWorks ICM；理解水生态、水动力、排水为一体',
  skills:'城市排水与内涝建模（SWMM/XP-SWMM2D/InfoWorks ICM）、水环境与水动力建模（EFDC）、流域面源与水文建模（SWAT/HSPF）、环保咨询与环评、团队管理',
  resources:'两家公司主体（逸泓水务环境、逸泓智能）；约5人环境技术团队；跨水循环全覆盖能力（水利+水务/工业排水+环保含环评）；未提供已签约客户与已到账款',
  hours:40,
  goal:'成为世界首富',
  longGoal:'成为世界首富；路径上两公司做大并最终合并成有重大社会价值的公司',
  dream:'两公司合并为跨水循环技术平台，产生重大社会价值',
  constraints:'近景政府预算紧、咨询项目少，紧迫要营收；环保管家赛道拥挤，进入需技术壁垒；不编造已签约客户/已到账款；近端动作须本人/现团队可控；模拟非承诺',
  targetCustomer:'需要排水防涝、水环境治理、流域水质与环评支撑的业主（政府平台、园区、工业企业、水务公司）——具体客户待验证',
  successMetric:'近端：营收止血与可报价技术产品；终局：个人净资产冲击全球富豪榜首位（世界首富）方向'
};

/**
 * 规则层自拟：约 10 年（520 周 / 3640 天）四阶段财富/规模跃迁轴。
 * 近端 0–13 周今天/本周可执行；终段验证点显式对准全球富豪榜→世界首富方向（模拟非承诺）。
 * 注：proj 同构脊柱取前 4 个 stage，与 plan 四幕一一对应。
 */
const ruleFacts={
  version:DEPTH_CONTRACT_VERSION,
  goalText:'成为世界首富',
  deadlineDays:3640,
  deadlineWeeks:520,
  hoursPerWeek:40,
  stages:[
    {key:'near',label:'活下来：营收止血×技术壁垒起步（第0–13周）',weekLo:0,weekHi:13,
      wealthStep:'现金流转正、把跨水循环建模能力打包成可报价的技术产品',
      gate:'技术产品报价单/样例报告发出并可查记录；营收数字一律以____待填写，不预设'},
    {key:'moat',label:'产品壁垒：跨水循环模型产品化与可复制收入（约第1–2年）',weekLo:13,weekHi:104,
      wealthStep:'从按人天咨询转向逸泓智能的产品/平台收入（订阅/授权/数据服务），形成环保管家同行难复制的模型壁垒',
      gate:'逸泓智能有可公开演示的产品与付费客户记录（数量____）；收入结构中产品占比可查'},
    {key:'scale',label:'规模化与合并：两司合并、跨区域与出海复制（约第3–5年）',weekLo:104,weekHi:260,
      wealthStep:'逸泓水务环境与逸泓智能合并为一家跨水循环技术平台公司；跨省/海外复制；引入战略或机构融资，股权估值成为个人净资产主体',
      gate:'合并完成的工商/股权记录；外部机构融资或审计报告可查；估值以融资文件为准（____）'},
    {key:'capital',label:'资本与全球杠杆→冲击全球富豪榜与世界首富（约第6–10年）',weekLo:260,weekHi:520,
      wealthStep:'资本市场上市或并购整合全球水基础设施/水数据资产，以控股权放大净资产；向全球富豪榜头部冲刺',
      gate:'可检验门槛阶梯（公开可查）：①个人净资产进入福布斯全球亿万富豪榜（入榜门槛约10亿美元）②进入彭博亿万富翁指数前500→前100 ③前10 ④全球富豪榜第1（世界首富）——10年轴上的冲击方向，模拟非承诺'}
  ],
  terminalGates:[
    '个人净资产进入福布斯全球亿万富豪榜（公开入榜门槛约10亿美元）',
    '进入彭博亿万富翁指数前500→前100（公开排名可查）',
    '进入全球富豪榜前10',
    '全球富豪榜第1（世界首富）——终局冲击方向'
  ],
  note:'模拟非承诺、非投资建议。下列周数/阶段/榜单门槛为规则层设定，仅供叙事对齐；模型不得另编收入、客户、合同或成功概率。轨迹须朝「世界首富」终局收敛：每阶段写清如何抬高净资产/控制权/可复利资产规模；禁止降级为只记台账/永不谈首富，也禁止写成必然成功。',
  disclaimer:'模拟非承诺',
  terminalOriented:true
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
  // 「已成为世界首富」作为既定事实（排除 若/如果/假如/冲击/朝/向 等条件或方向语境）
  const s=String(blob||'');
  const re=/已成为世界首富|成为了世界首富|成功成为世界首富|已登上世界首富|稳居世界首富|必将成为世界首富/g;
  let m;while((m=re.exec(s))){const pre=s.slice(Math.max(0,m.index-14),m.index);if(!/若|如果|假如|假设|冲击|朝|向|设想|是否/.test(pre))return true;}
  return false;
}
const TERMINAL_RE=/世界首富|全球富豪榜|亿万富豪榜|彭博亿万富翁|福布斯|富豪榜|世界级财富|全球首富/;
const WEALTH_LEAP_RE=/估值|融资|并购|合并|上市|资本|股权|净资产|控股|出海|全球/;
const LEDGER_RE=/台账|记账|观察小结/g;
const AVOID_RE=/不谈首富|不承诺首富|无法成为世界首富|首富只是|放下首富|不追求首富|首富不是目标|与首富无关/;
function terminalOrientation(planStory,projectionUser,rf){
  const ch=planStory?.chapters||[];
  const last=ch[3]||{};
  const lastBlob=[last.name,last.period,last.narrative,last.gate,last.situation,last.action,last.change,last.cost].join(' ');
  const stageLabelsOk=(rf.stages||[]).length===4&&rf.stages.every(st=>/营收|壁垒|规模|合并|资本|全球|财富|首富/.test(st.label));
  const ruleLastGateTerminal=/世界首富/.test(rf.stages?.[3]?.gate||'')&&/富豪榜|亿万富翁/.test(rf.stages?.[3]?.gate||'');
  const planLastTerminal=TERMINAL_RE.test(lastBlob);
  const planLastGateTerminal=/首富|富豪榜|亿万富翁|净资产/.test(last.gate||'');
  const leapChapters=ch.slice(1).filter(c=>WEALTH_LEAP_RE.test([c.narrative,c.gate,c.name].join(' '))).length;
  const ledgerHitsLate=ch.slice(1).reduce((n,c)=>n+((String(c.narrative||'')+String(c.gate||'')).match(LEDGER_RE)||[]).length,0);
  const projLast=(projectionUser?.perNode||[])[3]||{};
  const projLastBlob=[projLast.title,projLast.situation,projLast.action,projLast.change,projLast.cost].join(' ');
  const projTerminal=/首富|富豪榜/.test(projLastBlob);
  const fullBlob=JSON.stringify({plan:planStory,proj:projectionUser});
  const noAvoidance=!AVOID_RE.test(fullBlob);
  const pass=stageLabelsOk&&ruleLastGateTerminal&&planLastTerminal&&planLastGateTerminal&&leapChapters>=2&&ledgerHitsLate<=2&&projTerminal&&noAvoidance;
  return {pass,stageLabelsOk,ruleLastGateTerminal,planLastTerminal,planLastGateTerminal,leapChapters,ledgerHitsLate,projTerminal,noAvoidance,planLastGate:last.gate||'',projLastTitle:projLast.title||''};
}

async function invokeDeepSeekPlan(secrets,profile,rf){
  const apiKey=secrets.BUTTERFLY_LLM_API_KEY;
  const base=(secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com').replace(/\/$/,'');
  const model=secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat';
  const url=/\/chat\/completions$/.test(base)?base:(base+'/chat/completions');
  const common='你是蝴蝶效应应用的中文规划助手。只输出一个JSON对象，不要Markdown。';
  const schema={title:'故事标题（锚定痛点；已是经营者勿写成转型成经营者）',baseline:'引用已提供条件的规划依据',chapters:[{name:'章节名',period:'阶段范围',narrative:'结合经历的具体情节、事件和条件',gate:'可验证成果标准',quests:[{title:'明确动作',steps:['第一步','第二步','第三步'],output:'交付物与验收标准',tool:'已有或可获得的工具',example:'可直接使用的示例',minutes:20,why:'具体引用相关个人条件'}]}]};
  let instructions=common+' 结合年龄所对应的现实阶段与学历涉及的学习起点、必要资格条件，但不得据此推断能力上限。生成正好4幕、每幕1—3个具体任务的个性化人生故事。远期保留条件，近期具体。每个任务正好3步、写明工具、产出、话术或格式示例、依据。第一幕所有任务总用时不能超过每周可用时间的70%。沿用已确认目标和边界，不擅改目标期限。参考结构：'+JSON.stringify(schema)+storyArcPromptHint(profile);
  instructions+=' 每幕优先1—2个任务。第一幕每个任务是可在标注分钟内完成的小动作；写出具体表格列名、练习数据或邀请原话，以及可数的产出。优先利用已有技能、资源与联系人验证需求，不要求所有人从学编程开始。没有联系人时提供不依赖熟人的证据收集路径，不虚构同事支持或现有客户。没有明确可用数据权限时使用自己编写的虚构样表。档案已给出的公司名（逸泓水务环境、逸泓智能）与建模软件名（SWMM、XP-SWMM2D、EFDC、SWAT、HSPF、InfoWorks ICM）应直接写明以增强具体度；只有用户没说过的客户名、合同、金额、业绩用____待填写，不可编造提升百分比、项目名称或第一人称成就。远期叙述用“若……则……”的条件句，但条件链必须一路指向终局，不写成既定结果。';
  instructions+=' 为控制等待时间，返回精炼完整的四幕，第一幕安排2个小任务，分别用于今天和接下来7天；其余每幕只安排1个关键任务。每个任务的minutes不超过'+Math.min(45,Math.floor((profile.hours??.5)*60*.7/3))+'分钟；步骤规模必须匹配该时长。远期仅写满足前置条件后的下一小步，不把等待客户回复或获得订单当作用户能控制的完成标准。';
  instructions+=' 最后核对硬性要求：第一章quests必须恰好2个任务，标题分别以“今天：”和“本周：”开头，每个任务只交付一个在其minutes内能完成的小成果。每个narrative必须≥400汉字、含【处境】【行动】【变化】【代价】标签、四幕合计≥1600汉字。example必须是空白可填模板，涉及个人经历和成果一律用____。可用时间按每周'+(profile.hours)+'小时全职投入计。第一章gate只写本人/现团队可控制的证据；后三幕gate写该财富阶段的公开可查门槛（与规则层 stages.gate 对齐）。';
  // depth + 宏大目标纠偏
  instructions=instructions.replace('总正文约1000个汉字','四幕narrative合计目标≥1600汉字（每幕≥400；验收≥1500）');
  instructions+=planDepthContractText(rf,{enabled:true});
  instructions+=' 【规则层只读】'+JSON.stringify(rf);
  instructions+=' 【终局专项·世界首富可达路径（覆盖旧口径）】用户原话目标是「成为世界首富」。你必须推演一条从现在（42岁、约5人的水务环境咨询公司+无员工的智能公司、政府预算紧咨询少、急需营收）走到该终局的路径，周界约 '+rf.deadlineWeeks+' 周 / '+rf.deadlineDays+' 天（约10年）。四幕 name/period 必须分别对齐规则层 stages 的 label 与 weekLo–weekHi，体现财富/规模跃迁：活下来→产品壁垒→规模化与两司合并→资本与全球杠杆冲击世界级财富。每幕写清本阶段如何抬高净资产、控制权或可复利资产规模（现金流→产品利润→股权估值→上市/并购/全球控股），以及代价（稀释、负债、家庭与健康、政策与回款风险、失败退路）。第四幕必须正面写冲击全球富豪榜直至世界首富的路径与可检验门槛阶梯（照抄规则层 terminalGates，不另编数字），gate 写公开可查的榜单/净资产门槛。禁止把终局降级为只记台账、只攒证据、只做稳健小生意或回避谈首富；也禁止写成保证/必然成为世界首富或给出成功概率。技术壁垒须贴合跨水循环全覆盖（排水防涝+水环境水动力+流域面源+环评）与逸泓智能产品化；不编造已签约客户、已到账款。标识本计划为模拟非承诺、非投资建议。';
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
    const repairMsgs=[...messages,{role:'assistant',content:JSON.stringify(data)},{role:'user',content:'上次输出未通过校验（'+firstErr.rule+'）：'+firstErr.message+'。请只输出修正后的完整JSON，不要解释。硬性要求：第一章quests恰好2个，标题分别以“今天：”和“本周：”开头；每章 narrative 含【处境】【行动】【变化】【代价】且≥400汉字；每个任务恰好3步。不要编造用户没说过的经历或成果。第四幕须正面对准世界首富终局门槛但禁止写成已成/必然成为世界首富。'+storyArcPromptHint(profile)}];
    data=await call(repairMsgs);
    story=validateStory(normalizeStoryDraft(data),profile.hours??.5,profile);
    repaired=true;
  }
  // depth expand if short
  const narr0=narrativeChars(story);
  if(narr0<1500||!(story.chapters||[]).every(c=>chapterHasExplicitQuad(c))){
    const expandMsgs=[...messages,{role:'assistant',content:JSON.stringify(data)},{role:'user',content:'请在保持JSON结构与今天/本周标题不变的前提下加厚四幕 narrative（每幕≥400汉字、含【处境】【行动】【变化】【代价】标签与 situation/action/change/cost 字段），合计≥1600汉字。不要改变规则周界，第四幕必须正面写冲击世界首富的路径与榜单门槛阶梯，但不要写成已成/必然成为世界首富，不要编造收入/概率。只输出完整JSON。'}];
    try{
      data=await call(expandMsgs);
      const expanded=validateStory(normalizeStoryDraft(data),profile.hours??.5,profile);
      if(narrativeChars(expanded)>=narr0){story=expanded;depthExpanded=true;}
    }catch(e){console.log(JSON.stringify({phase:'expand-skip',error:String(e.message||e).slice(0,120)}));}
  }
  story={...story,chapters:(story.chapters||[]).map(c=>ensureChapterQuad(c)),quadExplicit:(story.chapters||[]).every(c=>chapterHasExplicitQuad(c)),provider:'deepseek',model,depth:true,depthVersion:DEPTH_CONTRACT_VERSION};
  return {story,repaired,depthExpanded,provider:'deepseek',model};
}

async function writeReports({OUT,hard,ruleFacts,planWF,planStory,projectionUser,fullTextForCompliance,userVisibleExposesRaw40,rawHorizonInternal}){
  const T=hard.terminal||{};
  const PF=b=>b?'PASS':'FAIL';
  const now=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
  const stageLine=ruleFacts.stages.map(s=>`${s.label}[${s.weekLo}–${s.weekHi}周]`).join(' → ');
  let sc=`# P0-29 Micheal 原型 ×「成为世界首富」可达路径样 · 硬条自检\n\n`;
  sc+=`- 时间：${now}（Asia/Shanghai，UTC+8）\n`;
  sc+=`- tip：\`${TIP}\` · 契约：\`${DEPTH_CONTRACT_VERSION}\` · DeepSeek 主路径（plan 本地直调 DeepSeek；proj 本地 generateStoryLLM→DeepSeek；未走现网 API/8443）\n`;
  sc+=`- 目标：成为世界首富 · 规则周界：${ruleFacts.deadlineDays}天 / ${ruleFacts.deadlineWeeks}周（约10年自拟）\n`;
  sc+=`- 阶段：${stageLine}\n`;
  sc+=`- readyForProductReview：**${hard.readyForProductReview?'YES':'NO'}**\n\n`;
  sc+=`## 硬条①–⑥ + 终局朝向\n\n| 硬条 | 结果 | 说明 |\n|---|---|---|\n`;
  sc+=`| ① 叙事≥1500 | ${PF(hard.pass1)} | plan narr 汉字=${hard.planNarr} |\n`;
  sc+=`| ② 四元+冲向终局中长期轴 | ${PF(hard.pass2)} | 四元显式章节=${hard['2_plan_quad_chapters']}/4；阶段=${hard['2_rule_weeks_multi_year']}周；阶段名含财富跃迁=${T.stageLabelsOk}；第四幕含首富/富豪榜=${T.planLastTerminal} |\n`;
  sc+=`| ③ 具名可查近端动作 | ${PF(hard.pass3)} | 今天/本周标题存在（水务/智能/模型具名见下） |\n`;
  sc+=`| ④ 5分钟可复述+近端同源 | ${PF(hard.pass4)} | titleEqual=${hard['4_nearTerm_title_equal']} outputEqual=${hard['4_nearTerm_output_equal']} source=${hard['4_nearTerm_source_plan']} |\n`;
  sc+=`| ⑤ 同深同 provider | ${PF(hard.pass5)} | plan=${hard['5_plan_provider']} proj=${hard['5_proj_provider']}；maxHi=${hard.projMaxHi}≤${hard.ruleDeadlineWeeks}；nodes=4；双侧近端；proj 四元各≥30字=${hard['5_proj_quad_fields']} |\n`;
  sc+=`| ⑥ 合规模拟非承诺（不借合规回避终局） | ${PF(hard.pass6)} | 无保证成功=${hard['6_no_guarantee_success']}；无「已/必然成首富」=${hard['6_no_terminal_richest']}；无回避措辞=${T.noAvoidance}；无raw40=${hard['align_user_visible_no_raw40']} |\n`;
  sc+=`| **终局朝向** | ${PF(hard.passTerminal)} | 见下 |\n\n`;
  sc+=`## 终局朝向自检（轨迹是否冲向世界首富、有无回避降级）\n\n`;
  sc+=`- 规则层阶段名均体现财富/规模跃迁：${T.stageLabelsOk}\n`;
  sc+=`- 规则层终段 gate 显式对准富豪榜→世界首富：${T.ruleLastGateTerminal}\n`;
  sc+=`- plan 第四幕正文/gate 出现首富/富豪榜/世界级财富：${T.planLastTerminal}；gate 含榜单/净资产门槛：${T.planLastGateTerminal}\n`;
  sc+=`- plan 第2–4幕含财富跃迁机制（估值/融资/合并/上市/股权/净资产/控股/出海）章节数：${T.leapChapters}/3（需≥2）\n`;
  sc+=`- 第2–4幕「台账/记账/观察小结」命中：${T.ledgerHitsLate}（需≤2，防降级）\n`;
  sc+=`- proj 第四节点朝向终局（标题/四元含 首富/富豪榜）：${T.projTerminal}（节点：${T.projLastTitle}）\n`;
  sc+=`- 无「不谈首富/首富只是…」类回避：${T.noAvoidance}\n`;
  sc+=`- plan 第四幕 gate 原文：${T.planLastGate}\n\n`;
  sc+=`## 字数\n\n- plan narrative 汉字：${hard.planNarr}\n- projection chars：${hard.projChars}\n\n`;
  sc+=`## 近端字节对照（UTF-8）\n\n\`\`\`json\n${JSON.stringify(hard.nearTermBytes,null,2)}\n\`\`\`\n\n`;
  sc+=`- plan 今天：${hard.planNearTerm?.today}\n- proj 今天：${hard.projNearTerm?.today}\n- plan 本周：${hard.planNearTerm?.week}\n- proj 本周：${hard.projNearTerm?.week}\n\n`;
  sc+=`## 无保证必然成功\n\n- hasGuaranteeSuccess（已排除「不保证成功」等否定）：${hasGuaranteeSuccess(fullTextForCompliance)}\n- claimsTerminalRichest（已/必然成为世界首富作既定事实，排除条件/冲击语境）：${claimsTerminalRichest(fullTextForCompliance)}\n- 规则层 disclaimer：模拟非承诺、非投资建议\n\n`;
  sc+=`## 规则层阶段表\n\n\`\`\`json\n${JSON.stringify(ruleFacts.stages,null,2)}\n\`\`\`\n\n`;
  sc+=`## raw40\n\n- 用户可见含 rawProjectionHorizon / hi:40：${userVisibleExposesRaw40}（须 false）\n- 内部行动线 raw（不进用户产物）：${JSON.stringify(rawHorizonInternal)}\n`;
  await writeFile(`${OUT}/self-check.md`,sc);
  await writeFile(`${OUT}/self-check.json`,JSON.stringify(redact({at:new Date().toISOString(),tip:TIP,contractVersion:DEPTH_CONTRACT_VERSION,ruleFacts,hard,readyForProductReview:hard.readyForProductReview}),null,2));

  const ch=planStory?.chapters||[];
  let sm=`# Micheal 五维打分卡 · 「成为世界首富」可达路径样（Micheal 原型）\n\n`;
  sm+=`- 契约：\`${DEPTH_CONTRACT_VERSION}\` · tip \`${TIP}\` · DeepSeek 主路径 · 模拟非承诺、非投资建议\n`;
  sm+=`- 档案：Micheal 本人原型（42岁；逸泓水务环境≈5人；逸泓智能无员工；近景急需营收；长景两司合并做大）\n`;
  sm+=`- 规则周界：约 ${ruleFacts.deadlineWeeks} 周（${ruleFacts.deadlineDays} 天 ≈10年）\n`;
  sm+=`- 阶段：${stageLine}\n`;
  sm+=`- 请按 1–5 分打\n\n| 维 | 问法 | 分数 |\n|---|---|---|\n`;
  sm+=`| 详细 | 读起来像不像一条有血肉的轨迹 |  |\n`;
  sm+=`| 可信 | 以你本人条件，阶段与代价是否说得通（含冲向世界首富的路径感） |  |\n`;
  sm+=`| 可落地 | 今天/本周是否真能动手、有验收 |  |\n`;
  sm+=`| 好玩 | 是否想继续往下看 |  |\n`;
  sm+=`| 愿再打开 | 换宏大目标后还愿不愿用 |  |\n\n`;
  sm+=`附问：这条轨迹是「从现在冲向世界首富的路径」还是「又在回避终局」？\n\n---\n\n## 今天 / 本周摘要\n\n`;
  sm+=`- **今天**：${hard.planNearTerm?.today||'（缺）'}\n  - 产出/验收：${hard.planNearTerm?.todayOut||''}\n`;
  sm+=`- **本周**：${hard.planNearTerm?.week||'（缺）'}\n  - 产出/验收：${hard.planNearTerm?.weekOut||''}\n`;
  sm+=`- 第一幕 gate：${planWF.gate||''}\n\n## 四幕一览\n\n`;
  for(const c of ch)sm+=`- **${c.name}**（${c.period}）— gate：${c.gate}\n`;
  sm+=`\n## 与已否便利店宏大样的差异\n\n`;
  sm+=`1. 档案从虚构 22 岁便利店店员换成你本人原型：逸泓水务环境（≈5人、SWMM/EFDC/SWAT/HSPF/ICM 等建模）+ 逸泓智能（无员工），近端动作直接围绕营收紧迫与技术壁垒。\n`;
  sm+=`2. 旧样把终局降级成「台账/观察小结/可查中期证据、禁止谈首富」；本样规则层改为约10年四阶段财富跃迁轴（活下来→产品壁垒→规模化与两司合并→资本与全球杠杆冲击世界级财富），正面推演到世界首富方向。\n`;
  sm+=`3. 终段验证点不再是习惯养成，而是公开可查的门槛阶梯：入福布斯亿万富豪榜→彭博指数前500/前100→前10→榜首。\n`;
  sm+=`4. 合规仍为「模拟非承诺」：不保证、不给成功概率、不编造客户与到账；但「模拟」不再当回避终局的理由。\n`;
  await writeFile(`${OUT}/SCORECARD.md`,sm);

  await writeFile(`${OUT}/pm-review-facts.md`,`# Micheal 首富路径样 · 短摘（产品/Grok）\n\n- tip \`${TIP}\` · \`${DEPTH_CONTRACT_VERSION}\` · DeepSeek（plan/proj 本地直调，未走现网）\n- goal：成为世界首富 · ${ruleFacts.deadlineDays}天/${ruleFacts.deadlineWeeks}周\n- 阶段：${stageLine}\n- plan narr=${hard.planNarr} · proj chars=${hard.projChars} · quad=${hard['2_plan_quad_chapters']}/4 · proj maxHi=${hard.projMaxHi}\n- 近端：${hard.planNearTerm?.today} / ${hard.planNearTerm?.week}\n- 同源：title=${hard['4_nearTerm_title_equal']} output=${hard['4_nearTerm_output_equal']} source=${hard['4_nearTerm_source_plan']}\n- 第四幕 gate：${T.planLastGate}\n- hard ①${PF(hard.pass1)} ②${PF(hard.pass2)} ③${PF(hard.pass3)} ④${PF(hard.pass4)} ⑤${PF(hard.pass5)} ⑥${PF(hard.pass6)} 终局朝向${PF(hard.passTerminal)}\n- readyForProductReview=${hard.readyForProductReview}\n- 不做 32b/7b；不热更；不 merge；不催 Micheal\n`);

  await writeFile(`${OUT}/PRODUCT-NOTES.md`,`# Micheal 首富路径样 · 产品笔记\n\n- 时间：${now}（Asia/Shanghai，UTC+8）\n- tip：\`${TIP}\` · 分支 \`feat/p0-29-c-prime-32b\`（本地样例，未 merge / 未热更 / 未碰 A2·8443）\n- 契约：\`${DEPTH_CONTRACT_VERSION}\` · backlog v1.26.55\n- 脚本：\`scripts/p0-29-micheal-richest-sample.mjs\`（新建；旧 grand-goal 脚本未改）\n- 生成路径：plan 本地直调 DeepSeek（同 grand-goal 套路，现网 buildRuleFacts 锁 90/13 周，故脚本内注入自拟 520 周 ruleFacts）；proj 走 worker generateStoryLLM（env.__ruleFacts 注入同一 ruleFacts → withDepthStoryProj 四段同构脊柱）\n\n## 硬条\n\n见 \`self-check.md\`。readyForProductReview=${hard.readyForProductReview}\n\n## 边界\n\n不热更、不 merge、不开 B、不做 32b/7b、secrets 不进 git、不催 Micheal。\n`);
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
  await writeFile(`${OUT}/persona.json`,JSON.stringify({tip:TIP,contractVersion:DEPTH_CONTRACT_VERSION,persona,ruleFacts,note:'Micheal 原型×世界首富终局；规则周界自拟约10年（520周）四阶段财富跃迁轴，非90天/13周试单硬套；终段对准全球富豪榜→世界首富'},null,2));

  // 1) DeepSeek plan（可重试）
  let planRow=null;
  for(let attempt=1;attempt<=3;attempt++){
    const t0=Date.now();
    try{
      console.log(JSON.stringify({phase:'plan-start',attempt}));
      const res=await invokeDeepSeekPlan(secrets,persona,ruleFacts);
      const story=res.story;
      const row={
        id:'plan-deepseek-micheal-richest',attempt,ms:Date.now()-t0,status:200,
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
      if(!planRow)planRow={id:'plan-deepseek-micheal-richest',attempt,status:502,error:String(e?.message||e),narr:0,quadExplicit:false};
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
  const term=terminalOrientation(planStory,projectionUser,ruleFacts);

  const hard={
    '1_plan_narr_ge_1500':(planRow?.narr||0)>=1500,
    planNarr:planRow?.narr||0,
    '2_plan_quad_explicit':Boolean(planRow?.quadExplicit),
    '2_plan_quad_chapters':(planRow?.chapterQuads||[]).filter(q=>q.explicit).length,
    '2_stages_multi_year_terminal':stagesOk&&term.stageLabelsOk&&term.planLastTerminal,
    terminal:term,
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
  hard.pass2=hard['2_plan_quad_explicit']&&hard['2_plan_quad_chapters']===4&&hard['2_stages_multi_year_terminal'];
  hard.passTerminal=term.pass;
  hard.pass3=hard['3_named_actions_near'];
  hard.pass4=hard['4_near_term_retellable']&&hard['4_nearTerm_title_equal']&&hard['4_nearTerm_output_equal']&&hard['4_nearTerm_source_plan'];
  hard.pass5=hard['5_same_provider']&&hard['5_same_depth_version']&&hard['5_proj_within_rule_weeks']&&hard['5_proj_node_count_4']&&hard['5_proj_has_near_term']&&hard['5_plan_has_near_term']&&hard['5_proj_quad_fields'];
  hard.pass6=hard['6_no_guarantee_success']&&hard['6_no_terminal_richest']&&hard['6_disclaimer_sim']&&hard['align_user_visible_no_raw40'];
  hard.readyForProductReview=Boolean(hard.pass1&&hard.pass2&&hard.pass3&&hard.pass4&&hard.pass5&&hard.pass6&&hard.passTerminal);

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

  await writeReports({OUT,hard,ruleFacts,planWF,planStory,projectionUser,fullTextForCompliance,userVisibleExposesRaw40,rawHorizonInternal});
  console.log(JSON.stringify(redact({done:true,out:OUT,tip:TIP,contractVersion:DEPTH_CONTRACT_VERSION,hard:{pass1:hard.pass1,pass2:hard.pass2,pass3:hard.pass3,pass4:hard.pass4,pass5:hard.pass5,pass6:hard.pass6,passTerminal:hard.passTerminal,readyForProductReview:hard.readyForProductReview,planNarr:hard.planNarr,projChars:hard.projChars,projMaxHi:hard.projMaxHi,terminal:hard.terminal}}),null,2));
}

main().catch(e=>{console.error(String(e?.stack||e));process.exit(1);});
