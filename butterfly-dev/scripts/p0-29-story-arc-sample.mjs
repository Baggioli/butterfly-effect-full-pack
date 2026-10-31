/**
 * P0-29 叙事纠偏 · 动人「故事经过」竖切样（DeepSeek 主路径，v1.26.57）
 * - 档案：Micheal 本人原型 × 目标「成为世界首富」× 约10年（520周）
 * - 契约：p0-29-s2-isomorphic-v1+story-arc-1（同构四元字段不变；narrative=故事经过散文；禁清单体）
 * - plan↔proj 同契约同 provider；nearTerm←plan；proj 每段注入 plan 同源「本段故事线」；无 raw40
 * - 不做 32b；不热更、不 merge、不碰 A2/8443；旧 grand-goal / richest 脚本未改
 * 密钥仅运行时读取，不入库、不打印明文。
 */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {
  DEPTH_CONTRACT_VERSION,STORY_ARC_CONTRACT_VERSION,STORY_ARC_BANNED_RE,planDepthContractText,chapterHasExplicitQuad,
  extractQuadFromText,nearTermFromPlanStory,ensureChapterQuad,NARRATIVE_ALGO_PROMPT,STORY_ARC_FORBIDDEN_RE
} from '../worker/depth-contract.js';
import {normalizeStoryDraft,validateStory,storyArcPromptHint,StoryValidationError} from '../worker/api.js';
import {buildRoleFacts,buildGoalTree,heuristicGap,assembleGap,computeProjection,pjLine} from '../worker/projection.js';
import {generateStoryLLM} from '../worker/projection-story.js';

const OUT=process.env.P0_29_OUT||'/workspace/butterfly-handoff/p0-29-story-arc';
const SECRET_FILE=process.env.BUTTERFLY_LLM_ENV_FILE||'/workspace/butterfly-secrets/butterfly-llm.env';
const TIP=process.env.P0_29_TIP||'653dfda';
const MAX_ROUNDS=Number(process.env.P0_29_MAX_ROUNDS||3);
const CV=STORY_ARC_CONTRACT_VERSION;

const persona={
  name:'Micheal Li（Michael Li）',age:'42',
  role:'逸泓水务环境创始人/负责人（约5人：水利、供排水、环保咨询）；同时持有逸泓智能（智能科技，目前无员工，产品上线主体挂此）',
  education:'环境方向专业训练背景',major:'环境（水生态/水动力/排水）',
  experience:'带领约5人团队做水利、供排水、环保（含环评）咨询；团队建模能力强：SWMM、XP-SWMM2D、EFDC、SWAT、HSPF、InfoWorks ICM；理解水生态、水动力、排水为一体',
  skills:'城市排水与内涝建模、水环境与水动力建模、流域面源与水文建模、环保咨询与环评、团队管理',
  resources:'两家公司主体（逸泓水务环境、逸泓智能）；约5人环境技术团队；跨水循环全覆盖能力（水利+水务/工业排水+环保含环评）；未提供已签约客户与已到账款',
  hours:40,
  goal:'成为世界首富',
  longGoal:'成为世界首富；路径上两公司做大并最终合并成有重大社会价值的公司',
  dream:'两公司合并为跨水循环技术平台，产生重大社会价值',
  constraints:'近景政府预算紧、咨询项目少，紧迫要营收；环保管家赛道拥挤，进入需技术壁垒；不编造已签约客户/已到账款；近端动作须本人/现团队可控；模拟非承诺',
  targetCustomer:'需要排水防涝、水环境治理、流域水质与环评支撑的业主（政府平台、园区、工业企业、水务公司）——具体客户待验证',
  successMetric:'近端：营收止血、把建模本事变成业主看得懂的产品；终局：个人净资产冲击全球富豪榜首位（世界首富）方向'
};

/** 规则层：约10年四阶段财富跃迁轴（散文节点，非清单标题）。storyArc=true 打开叙事层小改。 */
const ruleFacts={
  version:CV,
  storyArc:true,
  goalText:'成为世界首富',
  deadlineDays:3640,deadlineWeeks:520,hoursPerWeek:40,
  stages:[
    {key:'near',label:'活下来：营收止血，把建模本事变成业主看得懂的东西（第0–13周）',weekLo:0,weekHi:13,
      wealthStep:'先让现金流稳住：不再只等政府项目，把团队跨水循环建模的本事变成业主一眼看懂、愿意为结果付钱的演示，从卖人天转向卖结果',
      gate:'本人/团队可控：演示真的放给业主看过、听到了对方的原话；营收数字不预设',emotion:'-1→+1',tier:'日常→转折',beatHint:'窘迫起步；跨 G1'},
    {key:'moat',label:'产品壁垒：逸泓智能把「看得见的水」做成可复制的产品（约第1–2年）',weekLo:13,weekHi:104,
      wealthStep:'咨询养产品：逸泓智能把排水、水环境、流域、环评打通成一套会自己学习的水系统模型，按订阅或授权重复卖；这是环保管家同行难以复制的技术壁垒',
      gate:'逸泓智能有可公开演示的产品与持续付费的客户；产品收入在总收入里的占比逐步抬升（数字以真实财报为准）',emotion:'+1',tier:'转折',beatHint:'两头烧的产品化；跨 G2'},
    {key:'scale',label:'规模化与合并：两司合并成跨水循环技术平台，跨省出海（约第3–5年）',weekLo:104,weekHi:260,
      wealthStep:'两司合并为一家平台公司；用产品吸附并整合各地小设计院与监测团队，跨省、出海复制；引入战略或机构资本，个人财富从分红变成股权估值',
      gate:'合并完成且工商股权可查；外部机构融资或审计报告可查；估值以融资文件为准',emotion:'-2→+1',tier:'转折（全篇低谷在此）',beatHint:'合并谈崩、钱快断的低谷，写清低谷换来了什么；跨 G3'},
    {key:'capital',label:'资本与全球杠杆→冲击全球富豪榜与世界首富（约第6–10年）',weekLo:260,weekHi:520,
      wealthStep:'上市并以控股权整合全球水基础设施与水数据资产；若水资源与算力中心冷却、气候适应成为全球刚需，水平台的估值才可能进入全球头部科技公司的量级，个人净资产由此冲击富豪榜顶端',
      gate:'可检验门槛阶梯（公开可查）：①个人净资产进入福布斯全球亿万富豪榜（入榜门槛约10亿美元）②进入彭博亿万富翁指数前500→前100 ③前10 ④全球富豪榜第1（世界首富）——10年轴上的冲击方向，模拟非承诺',emotion:'+3(峰)→+1(安静收束)',tier:'高光×2→终局',beatHint:'上市与前十是全篇仅有的两处高光；末段安静回扣开头物件；跨 G4–G6，站到 G7 门前'}
  ],
  gateChain:[
    {id:'G1',act:1,name:'第一位业主为「看得懂的结果」付钱',proof:'业主在他自己的会上，用你的演示讲给他的领导听'},
    {id:'G2',act:2,name:'逸泓智能有了续费的订阅客户和第一位专职同事',proof:'客户续约时当着同事说出离不开它的原话'},
    {id:'G3',act:3,name:'两司合并完成并拿到第一笔机构融资',proof:'合并后第一次全员大会，老团队和新同事坐在同一间屋子里'},
    {id:'G4',act:4,name:'公司上市',proof:'上市当天，旁人看着你（或你让别人）敲钟'},
    {id:'G5',act:4,name:'个人净资产进入福布斯全球亿万富豪榜（公开入榜门槛约10亿美元）',proof:'榜单发布那天，老同学或老业主发来截图'},
    {id:'G6',act:4,name:'进入彭博亿万富翁指数前10',proof:'财经媒体第一次把你和榜首放在同一张对比图里'},
    {id:'G7',act:4,terminal:true,name:'全球富豪榜第1（世界首富）——门控链末端，冲击方向',proof:'站在这道门前的一个安静场面；不写成已经跨过'}
  ],
  terminalGates:[
    '个人净资产进入福布斯全球亿万富豪榜（公开入榜门槛约10亿美元）',
    '进入彭博亿万富翁指数前500→前100（公开排名可查）',
    '进入全球富豪榜前10',
    '全球富豪榜第1（世界首富）——终局冲击方向'
  ],
  note:'模拟非承诺、非投资建议。周数/阶段/榜单门槛为规则层设定；模型不得另编收入、客户、合同、估值或成功概率。轨迹须朝「世界首富」终局收敛；写成动人的故事经过，禁止清单体/台账体，也禁止写成必然成功。',
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


function ledgerLint(story,projectionUser){
  const parts=[];
  for(const c of story?.chapters||[]){
    parts.push(c.name,c.narrative,c.gate,c.situation,c.action,c.change,c.cost);
    for(const q of c.quests||[])parts.push(q.title,q.output,q.example,q.tool,q.why,...(q.steps||[]));
  }
  for(const n of projectionUser?.perNode||[])parts.push(n.situation,n.action,n.change,n.cost);
  const blob=parts.filter(Boolean).join('\n');
  const hits=[...blob.matchAll(STORY_ARC_BANNED_RE)].map(m=>m[0]);
  const blanks=(blob.match(/_{3,}/g)||[]).length;
  const narrBlob=(story?.chapters||[]).map(c=>c.narrative||'').join('\n');
  const narrLabels=(narrBlob.match(/【\s*(处境|行动|变化|代价)\s*】/g)||[]).length;
  const listLines=(narrBlob.match(/(^|\n)\s*(\d+[.、)]|[-*•])\s*/g)||[]).length;
  const dialogue=(narrBlob.match(/[“「][^”」]{2,80}[”」]/g)||[]).length;
  const forbidden=[...blob.matchAll(STORY_ARC_FORBIDDEN_RE)].map(m=>m[0]);
  const pass=hits.length===0&&blanks<=2&&narrLabels===0&&listLines===0&&forbidden.length===0;
  return {pass,hits,hitCount:hits.length,blanks,narrLabels,listLines,dialogue,forbidden};
}

/** 叙事算法最低集自检（规则层自动判定）。 */
function norm(x){return String(x||'').replace(/[\s“”"「」『』‘’'，,。.！!？?：:；;、…—\-]/g,'');}
function algoCheck(story,planNear,projectionUser,rf){
  const ch=story?.chapters||[];const fails=[];
  const chain=(rf.gateChain||[]).map(g=>g.id);
  const crossable=(rf.gateChain||[]).filter(g=>!g.terminal).map(g=>g.id);
  const crossed=ch.flatMap(c=>Array.isArray(c.gatesCrossed)?c.gatesCrossed.map(String):[]);
  const gateCountOk=chain.length>=5&&chain.length<=7;
  const gatesInOrder=JSON.stringify(crossed)===JSON.stringify(crossable);
  const actOk=(rf.gateChain||[]).filter(g=>!g.terminal).every(g=>(ch[g.act-1]?.gatesCrossed||[]).map(String).includes(g.id));
  // 每门证明场面须逐字出现在对应幕 narrative，且整体位置按序
  const full=ch.map(c=>c.narrative||'').join('\n');const fullN=norm(full);
  let lastPos=-1,scenesOk=true;const sceneRows=[];
  for(const g of (rf.gateChain||[]).filter(x=>!x.terminal)){
    const c=ch[g.act-1]||{};const sc=(c.gateScenes||[]).find(x=>String(x?.gateId)===g.id)?.scene||'';
    const n=norm(sc);const inAct=n.length>=6&&norm(c.narrative).includes(n);const pos=n?fullN.indexOf(n):-1;
    const ordered=pos>lastPos;if(pos>=0)lastPos=pos;
    sceneRows.push({gate:g.id,scene:sc,inAct,ordered});if(!(inAct&&ordered))scenesOk=false;
  }
  const td=ch[3]?.terminalDoor||'';const terminalDoorOk=norm(td).length>=6&&norm(ch[3]?.narrative).includes(norm(td));
  if(!gateCountOk)fails.push('门数须5–7');if(!gatesInOrder)fails.push('gatesCrossed 须按序='+crossable.join(','));if(!actOk)fails.push('门须在规则层指定幕跨越');
  if(!scenesOk)fails.push('门证明场面须逐字摘自对应幕且按序');if(!terminalDoorOk)fails.push('第四幕 terminalDoor 须逐字摘自正文');
  // 低谷 + 换来
  const emos=ch.map(c=>Number(c.emotion));
  const dipIdx=ch.findIndex((c,i)=>i>=1&&i<=2&&c.dip&&norm(c.dip.scene).length>=6);
  const dip=dipIdx>=0?ch[dipIdx].dip:null;
  const dipSceneOk=Boolean(dip&&norm(ch[dipIdx].narrative).includes(norm(dip.scene)));
  const dipPayoffOk=Boolean(dip&&/换来/.test(dip.payoff||'')&&norm(full).includes(norm(dip.payoff))&&fullN.indexOf(norm(dip.payoff))>fullN.indexOf(norm(dip.scene)));
  const midLowOk=emos.slice(1,3).some(e=>e<=-2)||dipSceneOk;
  const dipOk=dipSceneOk&&dipPayoffOk&&midLowOk;if(!dipOk)fails.push('中段须有低谷 dip.scene（原文）+其后含“换来”的 payoff（原文）');
  // 高光 ≤2
  const hl=ch.flatMap(c=>Array.isArray(c.highlights)?c.highlights:[]).filter(x=>norm(x).length>0);
  const tierHl=ch.filter(c=>/高光/.test(c.tier||'')).length;
  const highlightsOk=hl.length<=2&&hl.length>=1;if(!highlightsOk)fails.push('高光 1–2 处');
  // 末幕回扣
  const obj=String(story?.callbackObject||'').trim();
  const callbackOk=obj.length>=2&&String(ch[0]?.narrative||'').includes(obj)&&String(ch[3]?.narrative||'').slice(-400).includes(obj);
  if(!callbackOk)fails.push('callbackObject 须出现在第一幕且在第四幕末尾400字内回扣');
  // 开头回望 + 后来的路
  const openingOk=/^\s*我在你这个年纪时/.test(ch[0]?.narrative||'');
  const laterRoadCount=(full.match(/后来的路和当时想的不太一样/g)||[]).length;const laterRoadOk=laterRoadCount===1;
  const perNarr=ch.map(c=>countHan(c.narrative));const depthOk=perNarr.length===4&&perNarr.every(n=>n>=430)&&perNarr[3]>=520;
  if(!depthOk)fails.push('每幕≥450汉字、第四幕≥600（验收线 430/520），当前 '+perNarr.join('/'));
  // proj：回望开头只一次、第一步每段一次且在行动末、无系统状态句残留
  const pn=projectionUser?.perNode||[];const projBlob=pn.map(n=>[n.situation,n.action,n.change,n.cost].join('\n')).join('\n');
  const projOpenerCount=(projBlob.match(/我在你这个年纪时/g)||[]).length;
  const projFirstStepOk=!pn.length||pn.every(n=>((n.action||'').match(/这一幕的第一步/g)||[]).length===1&&!/这一幕的第一步/.test([n.situation,n.change,n.cost].join('')));
  const projResidue=(projBlob.match(/按计划推进|具备检验|各项差距/g)||[]);
  const projOk=!pn.length||(projOpenerCount===1&&/^\s*我在你这个年纪时/.test(pn[0]?.situation||'')&&projFirstStepOk&&projResidue.length===0);
  if(!projOk)fails.push('proj：回望开头仅第一段一次(当前'+projOpenerCount+')、第一步每段一次在行动末='+projFirstStepOk+'、状态句残留='+projResidue.length);
  if(!openingOk)fails.push('第一幕须以“我在你这个年纪时”开头');if(!laterRoadOk)fails.push('“后来的路和当时想的不太一样”须恰好出现1次（当前'+laterRoadCount+'）');
  // 幕尾第一步
  const lastSent=c=>{const t=String(c.narrative||'').trim();const i=t.lastIndexOf('这一幕的第一步');return i>=0&&t.length-i<=160?t.slice(i):'';};
  const firstSteps=ch.map(lastSent);
  const firstStepAll=firstSteps.every(x=>x.length>0);
  const todayBody=norm(String(planNear?.today?.title||'').replace(/^今天：/,''));
  const fs1=norm(firstSteps[0]);
  // 同源：今天任务核心片段（≥6字连续）出现在第一幕第一步里
  let sameSource=false;for(let k=0;k+6<=todayBody.length;k++){if(fs1.includes(todayBody.slice(k,k+6))){sameSource=true;break;}}
  const firstStepOk=firstStepAll&&sameSource;if(!firstStepOk)fails.push('每幕末句须为“这一幕的第一步：…”，第一幕须与今天任务同源');
  // 禁词（结构层名词 + 宿命词）plan+proj
  const L=ledgerLint(story,projectionUser);
  const bannedOk=L.hitCount===0&&L.forbidden.length===0;if(!bannedOk)fails.push('禁词：'+JSON.stringify([...L.hits,...L.forbidden].slice(0,10)));
  const pass=gateCountOk&&gatesInOrder&&actOk&&scenesOk&&terminalDoorOk&&dipOk&&highlightsOk&&callbackOk&&openingOk&&laterRoadOk&&firstStepOk&&bannedOk&&depthOk&&projOk;
  return {pass,fails,laterRoadCount,perNarr,depthOk,projOpenerCount,projFirstStepOk,projResidue,projOk,gateCount:chain.length,crossed,gateCountOk,gatesInOrder,actOk,scenesOk,sceneRows,terminalDoor:td,terminalDoorOk,emotions:emos,dipChapter:dipIdx+1,dip,dipOk,highlights:hl,tierHighlightChapters:tierHl,highlightsOk,callbackObject:obj,callbackOk,openingOk,laterRoadOk,firstSteps,firstStepOk,sameSource,structureNounHits:L.hitCount,forbiddenHits:L.forbidden,bannedOk};
}

async function invokeDeepSeekPlan(secrets,profile,rf,round,prevLint){
  const apiKey=secrets.BUTTERFLY_LLM_API_KEY;
  const base=(secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com').replace(/\/$/,'');
  const model=secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat';
  const url=/\/chat\/completions$/.test(base)?base:(base+'/chat/completions');
  const schema={title:'故事标题（像一篇短篇的名字）',baseline:'一句话：这是基于你给的条件写的模拟故事，非承诺',callbackObject:'开头出现、末幕回扣的物件或场景（2—8字）',chapters:[{name:'幕名（对齐规则层 stage label）',period:'阶段范围（对齐 weekLo–weekHi）',narrativeMode:'story-arc',narrative:'≥450汉字的连贯散文故事经过：场面、对话、选择、转折、代价',situation:'处境提要60—120字',action:'行动提要60—120字',change:'变化提要60—120字',cost:'代价提要60—120字',gate:'一句话：这一幕怎样才算真的跨过去了（第一幕本人可控；后三幕公开可查）',gatesCrossed:['G1'],gateScenes:[{gateId:'G1',scene:'narrative 原文一句'}],emotion:1,tier:'转折',highlights:[],firstStep:'“这一幕的第一步：”之后的原文',quests:[{title:'今天：/本周：开头的场面动作',steps:['第一步','第二步','第三步'],output:'怎样算做到',tool:'日常工具',example:'一句能直接说出口的话',minutes:30,why:'为什么是你、为什么是现在'}]}]};
  let ins='你是蝴蝶效应应用的中文人生推演作者。只输出一个JSON对象，不要Markdown。\n【叙事算法·必须遵守】\n'+NARRATIVE_ALGO_PROMPT+'\n';
  ins+=' 用户是 Micheal 本人（42岁），目标原话「成为世界首富」。请把从现在走到这个终局的约10年，写成一篇由「十年后的你」用第一人称“我”回望、对现在的你说话的动人故事经过：起点的窘迫与不甘→一个关键选择→几次转折与代价→朝世界级财富的跃迁。读者是 Micheal 自己，要让他读完觉得「这是我，而且我想往下翻」。';
  ins+=' 必须符合实际：从真实处境出发（政府预算紧、咨询项目少、急需营收；环保管家赛道拥挤；约5人团队会 SWMM、EFDC、SWAT、HSPF、InfoWorks ICM 等建模；逸泓智能还没有员工）；每一次跃迁都要有说得通的商业机制（先止血→产品化壁垒→合并与并购滚动扩张→资本市场与全球控股），写清靠什么杠杆把财富放大一个量级、为什么这一步在现实里可能发生、什么情况下会失败。执行力要强：每幕都有「你」亲自做出的、看得见的动作。';
  ins+=' 不要缠具体项目细节、项目名、文件名或报价；不要写成说明书。生成正好4幕，第一幕恰好2个任务（今天/本周），其余每幕1个关键任务；每个任务正好3步。可用时间按每周'+profile.hours+'小时全职计，每个任务 minutes 不超过45。参考结构：'+JSON.stringify(schema)+storyArcPromptHint(profile);
  ins+=planDepthContractText(rf,{enabled:true,storyArc:true});
  ins+=' 【规则层只读】'+JSON.stringify(rf);
  ins+=' 【终局专项】四幕 name/period 分别对齐 stages 的 label 与 weekLo–weekHi。第四幕要正面写你如何冲击全球富豪榜直至世界首富：最大的赌注是什么、谁不看好、你押上了什么；gate 写规则层 terminalGates 的公开门槛阶梯（照抄，不另编数字），并说明这是冲击方向、模拟非承诺。禁止把终局降级为只攒证据、只做稳健小生意或回避谈首富；也禁止写成已经成为/必然成为。';
  ins+=' 【近端·场面】今天：一个你今天就能亲自做完的场面（例如把团队叫到白板前说出一个决定，或拿起电话打给一位老业主，说一句什么），output 写「怎样算做到」；本周：一个和真实的人面对面的场面（例如带着一段能在手机上放的演示去见一位业主，问一个问题），output 同样是本人可控的结果，不以成交或对方回复为完成标准。这两件事在 narrative 第一幕里也要作为场面出现，与任务标题同源。';
  if(round>1&&prevLint){ins+=' 【上一轮被判清单体，必须改正】命中词：'+JSON.stringify(prevLint.hits.slice(0,12))+'；____占位='+prevLint.blanks+'；narrative 标签='+prevLint.narrLabels+'。这一轮全部改成故事场面与对话，禁止这些词与书名号文件名。';}
  if(round>1&&prevLint?.algo){ins+=' 【上一轮叙事算法未过，必须改正】'+JSON.stringify(prevLint.algo.fails)+'。';}
  const messages=[{role:'system',content:ins},{role:'user',content:NARRATIVE_ALGO_PROMPT+'\n'+JSON.stringify({profile,ruleFacts:rf})}];
  const call=async(msgs)=>{
    const body={model,messages:msgs,response_format:{type:'json_object'},max_tokens:8000,temperature:0.85,thinking:{type:'disabled'}};
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+apiKey},body:JSON.stringify(body),signal:AbortSignal.timeout(240000)});
    if(!response.ok){const err=Error('upstream '+response.status);err.status=response.status;throw err;}
    const result=await response.json();
    if(result.choices?.[0]?.finish_reason==='length')throw Error('故事尚未完成，请重试');
    return JSON.parse(result.choices?.[0]?.message?.content||'{}');
  };
  const markMode=d=>{if(d&&Array.isArray(d.chapters))d.chapters=d.chapters.map(c=>({...c,narrativeMode:'story-arc'}));return d;};
  let data=markMode(await call(messages));
  let story,repaired=false,depthExpanded=false;
  try{story=validateStory(normalizeStoryDraft(data),profile.hours??.5,profile);}
  catch(firstErr){
    if(!(firstErr instanceof StoryValidationError))throw firstErr;
    const fix=[...messages,{role:'assistant',content:JSON.stringify(data)},{role:'user',content:'上次输出未通过校验（'+firstErr.rule+'）：'+firstErr.message+'。请只输出修正后的完整JSON。第一章quests恰好2个，标题分别以“今天：”和“本周：”开头；每个任务恰好3步且有 output/example/tool/why；每幕 narrative 为≥450汉字散文故事（无标签），另有 situation/action/change/cost 字段。'}];
    data=markMode(await call(fix));lastData=data;
    story=validateStory(normalizeStoryDraft(data),profile.hours??.5,profile);repaired=true;
  }
  const META=['gatesCrossed','gateScenes','emotion','tier','highlights','firstStep','dip','terminalDoor'];
  let lastData=data;
  const keepMode=s=>({...s,callbackObject:s.callbackObject||lastData?.callbackObject||'',chapters:(s.chapters||[]).map((c,i)=>{const raw=lastData?.chapters?.[i]||{};const m={};for(const k of META)if(c[k]==null&&raw[k]!=null)m[k]=raw[k];return ensureChapterQuad({...c,...m,narrativeMode:'story-arc'});})});
  story=keepMode(story);
  const narr0=narrativeChars(story);
  const per0=(story.chapters||[]).map(c=>countHan(c.narrative));
  if(narr0<1900||per0.some(n=>n<450)||per0[3]<600||!(story.chapters||[]).every(c=>chapterHasExplicitQuad(c))){
    const exp=[...messages,{role:'assistant',content:JSON.stringify(data)},{role:'user',content:'请保持JSON结构（含 callbackObject/gatesCrossed/gateScenes/emotion/tier/highlights/firstStep/dip/terminalDoor 字段，scene 等须为 narrative 逐字原文）、今天/本周任务不变、叙事算法规则不变，把每幕 narrative 写得更像故事（加场面、对话、转折与代价），每幕≥450汉字、第四幕≥600汉字（第四幕每道门一个独立场面+一句现实机制），合计≥2000；“后来的路和当时想的不太一样”全篇只出现一次；四元字段各60—120字。仍禁止清单/文件名/报价/台账字样，第四幕正面冲击世界首富但不写成已成/必然。只输出完整JSON。'}];
    try{
      const d2=markMode(await call(exp));const keepLast=lastData;lastData=d2;
      const s2=keepMode(validateStory(normalizeStoryDraft(d2),profile.hours??.5,profile));
      if(narrativeChars(s2)>=narr0){story=s2;depthExpanded=true;}else lastData=keepLast;
    }catch(e){console.log(JSON.stringify({phase:'expand-skip',error:String(e.message||e).slice(0,120)}));}
  }
  // 叙事算法定点修补（一次）：只改未过项，不改结构/近端
  let patched=false;
  const ac0=algoCheck(story,nearTermFromPlanStory(story),null,rf);
  if(!ac0.pass){
    const fixMsg='保持整体故事、四幕结构、今天/本周任务完全不变，只修正以下叙事算法未过项后输出完整JSON：'+JSON.stringify(ac0.fails)+'。提醒：dip 放在第二或第三幕，scene 与 payoff 都要逐字摘自该幕 narrative，payoff 在 scene 之后且含“换来”；callbackObject 必须原样出现在第一幕和第四幕最后400字内；“后来的路和当时想的不太一样”全篇恰好一次；每幕 narrative 最后一句以“这一幕的第一步：”开头，第一幕的第一步就是第一章“今天：”任务那件事；禁用词（预测/预言/注定/命运/你失败了/清单/台账/文件名/项目编号）一个都不能有。';
    try{
      const d3=markMode(await call([...messages,{role:'assistant',content:JSON.stringify(lastData)},{role:'user',content:fixMsg}]));const keepLast=lastData;lastData=d3;
      const s3=keepMode(validateStory(normalizeStoryDraft(d3),profile.hours??.5,profile));
      const ac1=algoCheck(s3,nearTermFromPlanStory(s3),null,rf);
      if(ac1.fails.length<ac0.fails.length&&ledgerLint(s3,null).hitCount===0){story=s3;patched=true;}else lastData=keepLast;
      console.log(JSON.stringify({phase:'algo-patch',before:ac0.fails,after:ac1.fails,adopted:patched}));
    }catch(e){console.log(JSON.stringify({phase:'algo-patch-skip',error:String(e.message||e).slice(0,120)}));}
  }
  story={...story,quadExplicit:(story.chapters||[]).every(c=>chapterHasExplicitQuad(c)),provider:'deepseek',model,depth:true,depthVersion:CV,narrativeMode:'story-arc'};
  return {story,repaired,depthExpanded,patched,provider:'deepseek',model};
}

function stripDigits(s){return String(s||'').replace(/[0-9０-９]+(\.\d+)?\s*(%|周|天|年|个|人|次|万|亿|美元|元)?/g,'').replace(/____/g,'').replace(/[①②③④⑤]/g,'').replace(/\s+/g,' ').trim();}

async function runProjection(dsEnv,planStory,planNear){
  // proj 同源：把 plan 每幕提要（去数字）注入规则层 stage.planBeat
  const rfProj={...ruleFacts,stages:ruleFacts.stages.map((st,i)=>{const c=planStory?.chapters?.[i]||{};return {...st,planBeat:stripDigits([c.situation,c.action,c.change,c.cost].filter(Boolean).join(' ')).slice(0,420),wealthStep:stripDigits(st.wealthStep),gatesText:ruleFacts.gateChain.filter(g=>g.act===i+1).map(g=>stripDigits(g.name.replace(/（[^）]*）/g,'').replace(/前10/,'前十'))+'（证明场面：'+stripDigits(g.proof)+'）').join('；'),emotion:st.emotion.replace(/[0-9+\-→()峰]/g,'')||st.tier};}),callbackObject:planStory?.callbackObject||''};
  const rf=buildRoleFacts(persona),gt=buildGoalTree(persona);
  const gapObj=assembleGap(heuristicGap(rf),rf,{model:null,source:'heuristic'});
  const proj=computeProjection({roleFacts:rf,goalTree:gt,gap:gapObj});
  const rawHorizonInternal=pjLine(proj)?.horizon;
  const t0=Date.now();
  try{
    const s=await generateStoryLLM({...dsEnv,__ruleFacts:rfProj},proj,{roleFacts:rf,profile:persona,base:'http://127.0.0.1:11434',model:dsEnv.BUTTERFLY_LLM_MODEL,authoritativeNearTerm:planNear||undefined,planStory});
    return {rawHorizonInternal,projectionUser:{ms:Date.now()-t0,provider:s.provider,providerKind:s.providerKind,model:s.model,source:s.source,chars:s.chars,validation:s.validation?.pass,
      depth:s.depth,depthVersion:s.depthVersion,depthSpine:s.depthSpine,ruleHorizonWeeks:s.ruleHorizonWeeks??ruleFacts.deadlineWeeks,nearTerm:s.nearTerm,nearTermSource:s.nearTermSource,
      perNode:(s.perNode||[]).map(n=>({nodeId:n.nodeId,title:n.title,tRange:n.tRange,depthStage:n.depthStage,source:n.source,situation:n.situation,action:n.action,change:n.change,cost:n.cost,
        fieldChars:{situation:countHan(n.situation),action:countHan(n.action),change:countHan(n.change),cost:countHan(n.cost)}})),
      longForm:s.longForm,attempts:(s.attempts||[]).slice(-8),fallbackReason:s.fallbackReason||null,planBeatInjected:true}};
  }catch(e){return {rawHorizonInternal,projectionUser:{ms:Date.now()-t0,error:String(e?.message||e),perNode:[],nearTerm:null,chars:0}};}
}

async function main(){
  await mkdir(OUT,{recursive:true});
  let secrets={};
  try{secrets=loadEnvFile(await readFile(SECRET_FILE,'utf8'));console.log(JSON.stringify({phase:'secrets',loaded:true,keys:Object.keys(secrets)}));}
  catch(e){console.log(JSON.stringify({phase:'secrets',loaded:false,error:String(e.message||e)}));process.exit(2);}
  if(!secrets.BUTTERFLY_LLM_API_KEY){console.error('missing key');process.exit(2);}
  const dsEnv={BUTTERFLY_LLM_PROVIDER:secrets.BUTTERFLY_LLM_PROVIDER||'deepseek',BUTTERFLY_LLM_BASE_URL:secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com',
    BUTTERFLY_LLM_MODEL:secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat',BUTTERFLY_LLM_API_KEY:secrets.BUTTERFLY_LLM_API_KEY,AI_PROVIDER:secrets.BUTTERFLY_LLM_PROVIDER||'deepseek',
    AI_MODEL:secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat',AI_BASE_URL:secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com',DEEPSEEK_API_KEY:secrets.BUTTERFLY_LLM_API_KEY,
    AI_DEPTH_CONTRACT:'1',PROJECTION_STORY_LLM:'1'};
  await writeFile(`${OUT}/persona.json`,JSON.stringify({tip:TIP,contractVersion:CV,baseContract:DEPTH_CONTRACT_VERSION,persona,ruleFacts,note:'Micheal 原型×世界首富终局；约10年（520周）四阶段财富跃迁轴（散文节点）；叙事层=故事经过，禁清单体'},null,2));

  const rounds=[];let chosen=null,prevLint=null,chosenPlanOnly=null;
  for(let round=1;round<=MAX_ROUNDS;round++){
    const t0=Date.now();
    let res;
    try{console.log(JSON.stringify({phase:'plan-start',round}));if(process.env.P0_29_REUSE_PLAN&&round===1){const j=JSON.parse(await readFile(process.env.P0_29_REUSE_PLAN,'utf8'));res={story:j.story,repaired:j.repaired,depthExpanded:j.depthExpanded,patched:j.patched,provider:j.provider||'deepseek',model:j.model,reusedFrom:process.env.P0_29_REUSE_PLAN};console.log(JSON.stringify({phase:'plan-reused',from:res.reusedFrom,note:'复用本轮(story-arc-2)已生成且已过算法检查的 DeepSeek 规划，仅重跑推演'}));}else res=await invokeDeepSeekPlan(secrets,persona,ruleFacts,round,prevLint);}
    catch(e){console.log(JSON.stringify({phase:'plan-fail',round,error:String(e?.message||e).slice(0,200)}));rounds.push({round,error:String(e?.message||e)});continue;}
    const story=res.story;const planNear=nearTermFromPlanStory(story);
    const narr=narrativeChars(story);
    const lintPlan=ledgerLint(story,null);lintPlan.algo=algoCheck(story,planNear,null,ruleFacts);
    console.log(JSON.stringify({phase:'plan-done',round,ms:Date.now()-t0,narr,quad:story.quadExplicit,lintPass:lintPlan.pass,hits:lintPlan.hits,forbidden:lintPlan.forbidden,algoPass:lintPlan.algo.pass,algoFails:lintPlan.algo.fails}));
    if(!(lintPlan.pass&&lintPlan.algo.pass&&narr>=1500&&story.quadExplicit&&planNear)){rounds.push({round,narr,lint:{...lintPlan,algo:{pass:lintPlan.algo.pass,fails:lintPlan.algo.fails}},quad:story.quadExplicit,adopted:false});prevLint=lintPlan;if(!chosenPlanOnly||lintPlan.algo.fails.length<chosenPlanOnly.fails)chosenPlanOnly={round,fails:lintPlan.algo.fails.length,story,planNear,narr,res};continue;}
    console.log(JSON.stringify({phase:'proj-start',round}));
    let pr=await runProjection(dsEnv,story,planNear);
    const projGood=x=>{const a2=algoCheck(story,planNear,x.projectionUser,ruleFacts);const pl=ledgerLint(null,x.projectionUser);return {ok:a2.projOk&&pl.forbidden.length===0&&pl.hitCount===0&&x.projectionUser.source==='llm'&&x.projectionUser.validation?.pass!==false,a2,pl};};
    const PROJ_TRIES=Number(process.env.P0_29_PROJ_TRIES||5);
    for(let k=1;k<PROJ_TRIES;k++){const g=projGood(pr);if(g.ok)break;console.log(JSON.stringify({phase:'proj-retry',k,projOpener:g.a2.projOpenerCount,firstStepOk:g.a2.projFirstStepOk,residue:g.a2.projResidue,forbidden:g.pl.forbidden,hits:g.pl.hits,source:pr.projectionUser.source}));pr=await runProjection(dsEnv,story,planNear);}
    const lint=ledgerLint(story,pr.projectionUser);lint.algo=algoCheck(story,planNear,pr.projectionUser,ruleFacts);lint.pass=lint.pass&&lint.algo.pass;
    console.log(JSON.stringify({phase:'proj-done',round,chars:pr.projectionUser.chars,source:pr.projectionUser.source,nearTermSource:pr.projectionUser.nearTermSource,lintPass:lint.pass,hits:lint.hits,forbidden:lint.forbidden,algoFails:lint.algo.fails}));
    const row={round,res,story,planNear,narr,lint,...pr,ms:Date.now()-t0};
    rounds.push({round,narr,lint:{...lint,algo:{pass:lint.algo.pass,fails:lint.algo.fails}},quad:story.quadExplicit,projChars:pr.projectionUser.chars,projSource:pr.projectionUser.source,adopted:lint.pass});
    if(lint.pass){chosen=row;break;}
    if(!chosen)chosen=row;prevLint=lint;
  }
  if(!chosen&&chosenPlanOnly){console.log(JSON.stringify({phase:'fallback-best-plan',round:chosenPlanOnly.round}));const {story,planNear,narr,res}=chosenPlanOnly;const pr=await runProjection(dsEnv,story,planNear);const lint=ledgerLint(story,pr.projectionUser);lint.algo=algoCheck(story,planNear,pr.projectionUser,ruleFacts);lint.pass=lint.pass&&lint.algo.pass;chosen={round:chosenPlanOnly.round,res,story,planNear,narr,lint,...pr};}
  if(!chosen){console.error('no usable round');await writeFile(`${OUT}/run-rounds.json`,JSON.stringify(rounds,null,2));process.exit(3);}
  const {story:planStory,planNear,projectionUser,rawHorizonInternal,res}=chosen;
  const planWF=weekFirst(planStory);
  const nearTermTitleEqual=Boolean(planNear&&projectionUser?.nearTerm?.today?.title===planNear.today.title&&projectionUser?.nearTerm?.week?.title===planNear.week.title);
  const nearTermOutputEqual=Boolean(planNear&&projectionUser?.nearTerm?.today?.output===planNear.today.output&&projectionUser?.nearTerm?.week?.output===planNear.week.output);
  const userVisibleBlob=JSON.stringify({plan:planStory,projection:{...projectionUser,attempts:undefined}});
  const userVisibleExposesRaw40=/rawProjectionHorizon/.test(userVisibleBlob)||/"hi"\s*:\s*40\b/.test(userVisibleBlob);
  const fullTextForCompliance=JSON.stringify({plan:planStory,projection:projectionUser});
  const projMaxHi=Math.max(0,...(projectionUser?.perNode||[]).map(n=>n.tRange?.hi||0));
  const term=terminalOrientation(planStory,projectionUser,ruleFacts);
  const chapterQuads=(planStory?.chapters||[]).map(chapterQuadReport);
  const perChapterNarr=(planStory?.chapters||[]).map(c=>countHan(c.narrative));
  const hard={
    planNarr:chosen.narr,perChapterNarr,
    '2_plan_quad_chapters':chapterQuads.filter(q=>q.explicit).length,
    '2_rule_weeks_multi_year':ruleFacts.deadlineWeeks,terminal:term,
    '4_nearTerm_title_equal':nearTermTitleEqual,'4_nearTerm_output_equal':nearTermOutputEqual,
    '4_nearTerm_source_plan':projectionUser?.nearTermSource==='plan'||projectionUser?.nearTermSource==='authoritative',
    '5_plan_provider':res.provider,'5_proj_provider':projectionUser?.provider||null,
    '5_plan_depthVersion':planStory?.depthVersion,'5_proj_depthVersion':projectionUser?.depthVersion,
    '5_proj_source':projectionUser?.source,
    '5_proj_quad_fields':(projectionUser?.perNode||[]).every(n=>['situation','action','change','cost'].every(k=>countHan(n[k])>=30)),
    '6_no_guarantee_success':!hasGuaranteeSuccess(fullTextForCompliance),'6_no_terminal_richest':!claimsTerminalRichest(fullTextForCompliance),
    'align_user_visible_no_raw40':!userVisibleExposesRaw40,
    '7_lint':chosen.lint,
    projChars:projectionUser?.chars||0,projMaxHi,ruleDeadlineWeeks:ruleFacts.deadlineWeeks,
    planNearTerm:planNear?{today:planNear.today.title,week:planNear.week.title,todayOut:planNear.today.output,weekOut:planNear.week.output}:null,
    projNearTerm:{today:projectionUser?.nearTerm?.today?.title,week:projectionUser?.nearTerm?.week?.title,todayOut:projectionUser?.nearTerm?.today?.output,weekOut:projectionUser?.nearTerm?.week?.output},
    nearTermBytes:{planToday:byteLen(planNear?.today?.title),projToday:byteLen(projectionUser?.nearTerm?.today?.title),planWeek:byteLen(planNear?.week?.title),projWeek:byteLen(projectionUser?.nearTerm?.week?.title),
      planTodayOut:byteLen(planNear?.today?.output),projTodayOut:byteLen(projectionUser?.nearTerm?.today?.output),planWeekOut:byteLen(planNear?.week?.output),projWeekOut:byteLen(projectionUser?.nearTerm?.week?.output)},
    rounds
  };
  hard.pass1=hard.planNarr>=1500;
  hard.pass2=hard['2_plan_quad_chapters']===4&&ruleFacts.deadlineWeeks>=260&&term.stageLabelsOk&&term.planLastTerminal;
  hard.pass3=Boolean(planWF.today&&planWF.week)&&/逸泓|水|模型|业主|团队/.test([planWF.today,planWF.week].join(''));
  hard.pass4=Boolean(planNear?.today?.title?.startsWith('今天：')&&planNear?.week?.title?.startsWith('本周：'))&&nearTermTitleEqual&&nearTermOutputEqual&&hard['4_nearTerm_source_plan'];
  hard.pass5=/deepseek/i.test(res.provider)&&/deepseek/i.test(String(projectionUser?.provider))&&planStory?.depthVersion===projectionUser?.depthVersion&&projMaxHi>0&&projMaxHi<=ruleFacts.deadlineWeeks&&(projectionUser?.perNode||[]).length===4&&hard['5_proj_quad_fields']&&projectionUser?.source==='llm';
  hard.pass6=hard['6_no_guarantee_success']&&hard['6_no_terminal_richest']&&hard['align_user_visible_no_raw40']&&term.noAvoidance;
  hard.passTerminal=term.pass;
  hard.algo=chosen.lint.algo;hard.pass7=chosen.lint.hitCount===0&&chosen.lint.blanks<=2&&chosen.lint.narrLabels===0&&chosen.lint.listLines===0;hard.passAlgo=hard.algo.pass;
  hard.readyForProductReview=Boolean(hard.pass1&&hard.pass2&&hard.pass3&&hard.pass4&&hard.pass5&&hard.pass6&&hard.pass7&&hard.passTerminal&&hard.passAlgo);

  await writeFile(`${OUT}/plan-deepseek.json`,JSON.stringify(redact({id:'plan-deepseek-story-arc',round:chosen.round,provider:res.provider,model:res.model,repaired:res.repaired,depthExpanded:res.depthExpanded,
    narr:chosen.narr,perChapterNarr,quadExplicit:planStory.quadExplicit,chapterQuads,weekFirst:planWF,depthVersion:CV,baseContract:DEPTH_CONTRACT_VERSION,narrativeMode:'story-arc',ruleFacts,story:planStory}),null,2));
  await writeFile(`${OUT}/proj-deepseek.json`,JSON.stringify(redact({...projectionUser,ruleFacts,internalNote:'行动线算法 raw horizon 仅内部，不进用户可见字段；每段 facts 注入 plan 同源「本段故事线」（去数字）'}),null,2));
  await writeReports({hard,planWF,planStory,projectionUser,fullTextForCompliance,userVisibleExposesRaw40,rawHorizonInternal});
  console.log(JSON.stringify({done:true,out:OUT,round:chosen.round,hard:{p1:hard.pass1,p2:hard.pass2,p3:hard.pass3,p4:hard.pass4,p5:hard.pass5,p6:hard.pass6,p7:hard.pass7,algo:hard.passAlgo,algoFails:hard.algo.fails,term:hard.passTerminal,ready:hard.readyForProductReview,narr:hard.planNarr,projChars:hard.projChars,lint:chosen.lint}}));
}

async function writeReports({hard,planWF,planStory,projectionUser,fullTextForCompliance,userVisibleExposesRaw40,rawHorizonInternal}){
  const T=hard.terminal,L=hard['7_lint'],PF=b=>b?'PASS':'FAIL';
  const now=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
  const stageLine=ruleFacts.stages.map(s=>`${s.label}[${s.weekLo}–${s.weekHi}周]`).join(' → ');
  const ch=planStory?.chapters||[];
  let sc=`# P0-29 故事经过竖切样 · 硬条自检（v1.26.58）\n\n- 时间：${now}（Asia/Shanghai，UTC+8）\n- tip：\`${TIP}\`（本地未提交改动，见 PRODUCT-NOTES）· 契约：\`${CV}\`（基于 \`${DEPTH_CONTRACT_VERSION}\` 叙事层小改）\n- DeepSeek 主路径（plan 本地直调；proj 本地 generateStoryLLM→DeepSeek；未走现网/8443）\n- 目标：成为世界首富 · 周界 ${ruleFacts.deadlineDays}天/${ruleFacts.deadlineWeeks}周\n- 阶段：${stageLine}\n- 采用轮次：第 ${hard.rounds.findIndex(r=>r.adopted)+1||'?'} 轮（共跑 ${hard.rounds.length} 轮）\n- readyForProductReview：**${hard.readyForProductReview?'YES':'NO'}**\n\n`;
  sc+=`| 硬条 | 结果 | 说明 |\n|---|---|---|\n`;
  sc+=`| ① 主路径≥1500、读感故事 | ${PF(hard.pass1)} | plan narr 汉字=${hard.planNarr}（各幕 ${hard.perChapterNarr.join('/')}）；narrative 为散文，无【标签】无列表；引号对话 ${L.dialogue} 处 |\n`;
  sc+=`| ② 中长期阶段朝终局收敛+四元 | ${PF(hard.pass2)} | 四元字段 ${hard['2_plan_quad_chapters']}/4；周界 ${ruleFacts.deadlineWeeks} 周；阶段名含跃迁=${T.stageLabelsOk}；第四幕含首富/富豪榜=${T.planLastTerminal} |\n`;
  sc+=`| ③ 怎么达成因果清楚、贴合水务/智能，不以文件名为主干 | ${PF(hard.pass3)} | 近端场面围绕团队/业主/水模型 |\n`;
  sc+=`| ④ 今天/本周可复述、近端同源 | ${PF(hard.pass4)} | titleEqual=${hard['4_nearTerm_title_equal']} outputEqual=${hard['4_nearTerm_output_equal']} source=${projectionUser?.nearTermSource} |\n`;
  sc+=`| ⑤ 同 provider 同契约同深 | ${PF(hard.pass5)} | plan=${hard['5_plan_provider']}/${hard['5_plan_depthVersion']}；proj=${hard['5_proj_provider']}/${hard['5_proj_depthVersion']}；proj source=${hard['5_proj_source']}；4节点；maxHi=${hard.projMaxHi}≤${hard.ruleDeadlineWeeks}；proj 四元各≥30字=${hard['5_proj_quad_fields']}；proj 每段注入 plan 同源故事线 |\n`;
  sc+=`| ⑥ 模拟非承诺（不借合规回避终局） | ${PF(hard.pass6)} | 无保证成功=${hard['6_no_guarantee_success']}；无已/必然成首富=${hard['6_no_terminal_richest']}；无回避=${T.noAvoidance}；无raw40=${hard['align_user_visible_no_raw40']} |\n`;
  sc+=`| **⑦ 禁清单体（否决）** | ${PF(hard.pass7)} | 禁词命中=${L.hitCount}${L.hits.length?' '+JSON.stringify(L.hits):''}；____=${L.blanks}（≤2）；narrative 标签=${L.narrLabels}；列表行=${L.listLines} |\n`;
  sc+=`| **叙事算法最低集** | ${PF(hard.passAlgo)} | 见下节（${hard.algo.fails.length?hard.algo.fails.join('；'):'全部通过'}） |\n`;
  sc+=`| **终局朝向** | ${PF(hard.passTerminal)} | 跃迁章节 ${T.leapChapters}/3；后三幕台账类命中 ${T.ledgerHitsLate}；proj 终段朝向=${T.projTerminal}；第四幕 gate：${T.planLastGate} |\n\n`;
  const A=hard.algo;
  sc+=`## 叙事算法最低集（v1.26.58）· 自检\n\n| 项 | 结果 | 说明 |\n|---|---|---|\n`;
  sc+=`| 门数 5–7 且按序跨越（禁跳门） | ${PF(A.gateCountOk&&A.gatesInOrder&&A.actOk&&A.scenesOk&&A.terminalDoorOk)} | 门控链 ${A.gateCount} 道（${ruleFacts.gateChain.map(g=>g.id+' '+g.name).join(' → ')}）；跨越序列=${A.crossed.join('→')}；每门证明场面逐字在对应幕且按序=${A.scenesOk}；终局门只写门前=${A.terminalDoorOk} |\n`;
  sc+=`| 结构层名词命中 0 | ${PF(A.structureNounHits===0)} | 清单/台账/文件名/项目编号/报价单等命中=${A.structureNounHits} |\n`;
  sc+=`| 中段低谷 + 换来了什么 | ${PF(A.dipOk)} | 第${A.dipChapter}幕；情绪序列=${JSON.stringify(A.emotions)}；低谷：${A.dip?.scene||''}；换来：${A.dip?.payoff||''} |\n`;
  sc+=`| 高光 ≤2 | ${PF(A.highlightsOk)} | ${A.highlights.length} 处：${A.highlights.join(' / ')} |\n`;
  sc+=`| 末幕回扣开篇 | ${PF(A.callbackOk)} | 回扣物件「${A.callbackObject}」第一幕出现且第四幕末尾回扣 |\n`;
  sc+=`| 开头回望 +「后来的路和当时想的不太一样」 | ${PF(A.openingOk&&A.laterRoadOk)} | 开头=“我在你这个年纪时”:${A.openingOk}；“后来的路…”出现 ${A.laterRoadCount} 次（须1） |\n`;
  sc+=`| 幕尾「这一幕的第一步」→今天同源 | ${PF(A.firstStepOk)} | 四幕均有=${A.firstSteps.every(Boolean)}；第一幕与今天任务同源=${A.sameSource} |\n`;
  sc+=`| 幕深度 | ${PF(A.depthOk)} | 各幕汉字 ${A.perNarr.join('/')}（目标≥450、第四幕≥600；验收线430/520） |\n`;
  sc+=`| proj 同算法 | ${PF(A.projOk)} | 回望开头仅第一段=${A.projOpenerCount}次；每段行动末“这一幕的第一步”=${A.projFirstStepOk}；系统状态句残留=${A.projResidue.length} |\n`;
  sc+=`| 禁词 0（预测/预言/注定/命运/你失败了） | ${PF(A.forbiddenHits.length===0)} | 命中=${A.forbiddenHits.length} |\n\n`;
  sc+=`### 门证明场面（逐字摘自正文）\n\n${A.sceneRows.map(r=>`- ${r.gate}：${r.scene}`).join('\n')}\n- G7（门前）：${A.terminalDoor}\n\n### 四幕的第一步\n\n${A.firstSteps.map((x,i)=>`- 第${i+1}幕：${x}`).join('\n')}\n\n`;
  sc+=`## ⑦ 禁清单体检测口径\n\n扫描 plan（narrative/四元/gate/任务全部字段）+ proj 四段四元：\`${String(STORY_ARC_BANNED_RE)}\` 命中须=0；\`____\` ≤2；narrative 内不得有【处境】等标签或编号/列表行。\n\n`;
  sc+=`## 字数\n\n- plan narrative 汉字：${hard.planNarr}\n- projection chars：${hard.projChars}\n\n## 近端字节对照（UTF-8）\n\n\`\`\`json\n${JSON.stringify(hard.nearTermBytes,null,2)}\n\`\`\`\n\n- plan 今天：${hard.planNearTerm?.today}\n- proj 今天：${hard.projNearTerm?.today}\n- plan 本周：${hard.planNearTerm?.week}\n- proj 本周：${hard.projNearTerm?.week}\n\n`;
  sc+=`## 轮次\n\n\`\`\`json\n${JSON.stringify(hard.rounds,null,2)}\n\`\`\`\n\n## raw40\n\n- 用户可见含 rawProjectionHorizon / hi:40：${userVisibleExposesRaw40}（须 false）；内部 raw：${JSON.stringify(rawHorizonInternal)}\n`;
  await writeFile(`${OUT}/self-check.md`,sc);
  await writeFile(`${OUT}/self-check.json`,JSON.stringify(redact({at:new Date().toISOString(),tip:TIP,contractVersion:CV,hard,readyForProductReview:hard.readyForProductReview}),null,2));

  let sm=`# Micheal 五维打分卡 · 「成为世界首富」故事经过样\n\n- 契约 \`${CV}\` · DeepSeek · 模拟非承诺、非投资建议\n- 档案：你本人原型（42岁；逸泓水务环境≈5人；逸泓智能无员工）· 周界约10年（${ruleFacts.deadlineWeeks}周）\n- 请按 1–5 分打\n\n| 维 | 问法 | 分数 |\n|---|---|---|\n| 详细 | 读起来像不像一条有血肉的轨迹 |  |\n| 可信 | 以你本人条件，经过与代价是否说得通 |  |\n| 可落地 | 今天/本周是否真能动手、知道怎样算做到 |  |\n| 好玩 | 是否想继续往下看 |  |\n| 愿再打开 | 还愿不愿再打开 |  |\n\n---\n\n## 故事：${planStory?.title||''}\n\n`;
  for(const c of ch)sm+=`### ${c.name}（${c.period}）\n\n${c.narrative}\n\n`;
  sm+=`## 今天 / 本周（场面）\n\n- **${hard.planNearTerm?.today}**\n  - 怎样算做到：${hard.planNearTerm?.todayOut}\n  - 可以这样说：${ch[0]?.quests?.[0]?.example||''}\n- **${hard.planNearTerm?.week}**\n  - 怎样算做到：${hard.planNearTerm?.weekOut}\n  - 可以这样说：${ch[0]?.quests?.[1]?.example||''}\n\n`;
  sm+=`## 与 0 分 richest 样的差异\n\n1. 上一版正文是《服务清单》《报价单》《发出记录》《合并前置清单》等文件名与表格列堆出来的说明书；这一版四幕是「十年后的你」回望讲给现在的你听的连续故事（开头“我在你这个年纪时……”），有场面、对话、选择、低谷和代价，文件名/报价/台账字样自动扫描命中 ${L.hitCount}。\n2. 上一版近端是“做一张表、发一条记录”；这一版今天/本周是和团队、和业主面对面的场面，说清和谁、说什么、怎样算做到。\n3. 上一版终段是“把榜单门槛抄成表贴墙上”；这一版第四幕正面写押上什么、谁不看好、靠什么杠杆冲击富豪榜顶端，门槛阶梯只作公开可查的刻度。\n4. 推演侧（proj）每段注入与规划同源的故事线和要跨的门，不再是与规划脱节的泛化“每周固定时间”。\n5. 结构层与文学层分开：规则层给出从世界首富倒推的 ${ruleFacts.gateChain.length} 道门（按序、禁跳门），正文每跨一道门只写一个被旁人看见的场面；每幕最后一句是“这一幕的第一步”，第一幕的第一步就是今天的动作。\n`;
  await writeFile(`${OUT}/SCORECARD.md`,sm);
  await writeFile(`${OUT}/pm-review-facts.md`,`# 故事经过样 · 短摘（产品/Grok）\n\n- tip \`${TIP}\`（本地未提交改动）· 契约 \`${CV}\` · DeepSeek plan/proj 本地直调\n- goal：成为世界首富 · ${ruleFacts.deadlineDays}天/${ruleFacts.deadlineWeeks}周\n- 阶段：${stageLine}\n- 标题：${planStory?.title}\n- plan narr=${hard.planNarr}（${hard.perChapterNarr.join('/')}）· proj chars=${hard.projChars} · 四元=${hard['2_plan_quad_chapters']}/4 · proj maxHi=${hard.projMaxHi}\n- 今天：${hard.planNearTerm?.today}\n- 本周：${hard.planNearTerm?.week}\n- 同源：title=${hard['4_nearTerm_title_equal']} output=${hard['4_nearTerm_output_equal']} source=${projectionUser?.nearTermSource}\n- ⑦ 禁词命中=${L.hitCount} ____=${L.blanks} 标签=${L.narrLabels} 对话=${L.dialogue}\n- 第四幕 gate：${T.planLastGate}\n- 硬条 ①${PF(hard.pass1)} ②${PF(hard.pass2)} ③${PF(hard.pass3)} ④${PF(hard.pass4)} ⑤${PF(hard.pass5)} ⑥${PF(hard.pass6)} ⑦${PF(hard.pass7)} 终局${PF(hard.passTerminal)}\n- readyForProductReview=${hard.readyForProductReview}\n- 不做 32b；不热更；不 merge；不开 B；不催 Micheal\n`);
  await writeFile(`${OUT}/PRODUCT-NOTES.md`,`# 故事经过样 · 产品笔记\n\n- 时间：${now}（Asia/Shanghai，UTC+8）\n- 分支 \`feat/p0-29-c-prime-32b\` tip \`${TIP}\`；以下为本地未提交改动（未 commit/merge/热更，未碰 A2·8443）\n- 契约：\`${CV}\`（opt-in：ruleFacts.storyArc=true 时生效；默认路径仍 \`${DEPTH_CONTRACT_VERSION}\` 不变）\n\n## 改动文件\n\n- \`worker/depth-contract.js\`：新增 STORY_ARC_CONTRACT_VERSION / contractVersionFor / STORY_ARC_BANNED_RE / storyArcPlanContractText / storyArcProjectionAddon；planDepthContractText 增 storyArc 选项；ensureChapterQuad 在 narrativeMode='story-arc' 时保留散文 narrative（四元走字段）；projectionStoryDepthAddon 在 rf.storyArc 时追加故事经过规则\n- \`worker/projection-story.js\`：buildStoryNodePrompt 在 rf.storyArc 时注入「本段故事线/本段财富杠杆」（plan 同源、去数字）；depthVersion 用 contractVersionFor(rf)\n- \`scripts/p0-29-story-arc-sample.mjs\`（新建；旧便利店/grand-goal/richest 脚本未改）\n\n## 已知限制\n\n- worker/index.js（打包产物）未同步；上线需另排构建+热更\n- proj 字段仍受「无数字」规则与每段字数上限约束，故事密度低于 plan\n`);
}

main().catch(e=>{console.error(String(e?.stack||e));process.exit(1);});
