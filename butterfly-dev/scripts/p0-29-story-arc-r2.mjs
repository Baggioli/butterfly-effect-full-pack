/**
 * P0-29 故事经过样 · r2 定点修补（v1.26.59 有条件未过 → 6 条）
 * - 第一到第三幕保留不动：只做两处元词句的确定性替换（第二幕首句「第一道门」、第三幕「低谷里换来了什么？」设问），其余逐字不改
 * - 方案 b：保留四幕；只重写第四幕（≥900 汉字；G4/G5/G6 各有挡路现实 + 你本人一个动作 + 场面）
 * - emotion 由规则层落值；proj 每段第一步由规则层逐字注入 plan 同幕 firstStep
 * - 不热更、不 merge、不开 B、不做 32b；密钥仅运行时读取，不打印
 */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {
  DEPTH_CONTRACT_VERSION,STORY_ARC_CONTRACT_VERSION,STORY_ARC_BANNED_RE,STORY_ARC_META_RE,STORY_ARC_TEMPLATE_RE,STORY_ARC_META_PROMPT,planDepthContractText,chapterHasExplicitQuad,
  extractQuadFromText,nearTermFromPlanStory,ensureChapterQuad,NARRATIVE_ALGO_PROMPT,STORY_ARC_FORBIDDEN_RE
} from '../worker/depth-contract.js';
import {normalizeStoryDraft,validateStory,storyArcPromptHint,StoryValidationError} from '../worker/api.js';
import {buildRoleFacts,buildGoalTree,heuristicGap,assembleGap,computeProjection,pjLine} from '../worker/projection.js';
import {generateStoryLLM,storyArcCallbackHits} from '../worker/projection-story.js';

const OUT=process.env.P0_29_OUT||'/workspace/butterfly-handoff/p0-29-story-arc-r2';
const BASE_PLAN=process.env.P0_29_BASE_PLAN||'/workspace/butterfly-handoff/p0-29-story-arc/plan-deepseek.json';
const SECRET_FILE=process.env.BUTTERFLY_LLM_ENV_FILE||'/workspace/butterfly-secrets/butterfly-llm.env';
const TIP=process.env.P0_29_TIP||'653dfda';
const RATE_N=Number(process.env.P0_29_RATE_N||3);
const FULL_PLAN_N=Number(process.env.P0_29_FULL_PLAN_N||3);
const CV=STORY_ARC_CONTRACT_VERSION;
const ACT4_MIN=900;

const persona={
  name:'Micheal Li（Michael Li）',age:'42',
  role:'逸泓水务环境创始人/负责人（约5人：水利、供排水、环保咨询）；同时持有逸泓智能（智能科技，目前无员工，产品上线主体挂此）',
  education:'环境方向专业训练背景',major:'环境（水生态/水动力/排水）',
  experience:'带领约5人团队做水利、供排水、环保（含环评）咨询；团队建模能力强：SWMM、XP-SWMM2D、EFDC、SWAT、HSPF、InfoWorks ICM；理解水生态、水动力、排水为一体',
  skills:'城市排水与内涝建模、水环境与水动力建模、流域面源与水文建模、环保咨询与环评、团队管理',
  resources:'两家公司主体（逸泓水务环境、逸泓智能）；约5人环境技术团队；跨水循环全覆盖能力（水利+水务/工业排水+环保含环评）；未提供已签约客户与已到账款',
  hours:40,goal:'成为世界首富',
  longGoal:'成为世界首富；路径上两公司做大并最终合并成有重大社会价值的公司',
  dream:'两公司合并为跨水循环技术平台，产生重大社会价值',
  constraints:'近景政府预算紧、咨询项目少，紧迫要营收；环保管家赛道拥挤，进入需技术壁垒；不编造已签约客户/已到账款；近端动作须本人/现团队可控；模拟非承诺',
  targetCustomer:'需要排水防涝、水环境治理、流域水质与环评支撑的业主（政府平台、园区、工业企业、水务公司）——具体客户待验证',
  successMetric:'近端：营收止血、把建模本事变成业主看得懂的产品；终局：个人净资产冲击全球富豪榜首位（世界首富）方向'
};

/** 规则层（r2）：emotion 落数值；低谷段/回扣段由规则层指定；提示文案去掉结构元词。 */
const ruleFacts={
  version:CV,storyArc:true,goalText:'成为世界首富',
  deadlineDays:3640,deadlineWeeks:520,hoursPerWeek:40,act4MinHan:ACT4_MIN,
  emotionSource:'rule-layer',dipAct:3,
  stages:[
    {key:'near',label:'活下来：营收止血，把建模本事变成业主看得懂的东西（第0–13周）',weekLo:0,weekHi:13,
      wealthStep:'先让现金流稳住：不再只等政府项目，把团队跨水循环建模的本事变成业主一眼看懂、愿意为结果付钱的演示，从卖人天转向卖结果',
      gate:'本人/团队可控：演示真的放给业主看过、听到了对方的原话；营收数字不预设',emotion:'-1→+1',emotionValue:-1,emotionEnd:1,projMood:'窘迫→回暖',tier:'日常→转折',beatHint:'窘迫起步；跨 G1',isDip:false,callbackHere:true},
    {key:'moat',label:'产品壁垒：逸泓智能把「看得见的水」做成可复制的产品（约第1–2年）',weekLo:13,weekHi:104,
      wealthStep:'咨询养产品：逸泓智能把排水、水环境、流域、环评打通成一套会自己学习的水系统模型，按订阅或授权重复卖；这是环保管家同行难以复制的技术壁垒',
      gate:'逸泓智能有可公开演示的产品与持续付费的客户；产品收入在总收入里的占比逐步抬升（数字以真实财报为准）',emotion:'+1',emotionValue:1,emotionEnd:1,projMood:'两头烧但在往上走',tier:'转折',beatHint:'两头烧的产品化；跨 G2',isDip:false,callbackHere:false},
    {key:'scale',label:'规模化与合并：两司合并成跨水循环技术平台，跨省出海（约第3–5年）',weekLo:104,weekHi:260,
      wealthStep:'两司合并为一家平台公司；用产品吸附并整合各地小设计院与监测团队，跨省、出海复制；引入战略或机构资本，个人财富从分红变成股权估值',
      gate:'合并完成且工商股权可查；外部机构融资或审计报告可查；估值以融资文件为准',emotion:'-2→+1',emotionValue:-2,emotionEnd:1,projMood:'最暗→缓过来',tier:'转折（最低处在此）',beatHint:'合并谈崩、钱快断；用一个场面写清那段日子换来的东西；跨 G3',isDip:true,callbackHere:true},
    {key:'capital',label:'资本与全球杠杆→冲击全球富豪榜与世界首富（约第6–10年）',weekLo:260,weekHi:520,
      wealthStep:'上市并以控股权整合全球水基础设施与水数据资产；若水资源与算力中心冷却、气候适应成为全球刚需，水平台的估值才可能进入全球头部科技公司的量级，个人净资产由此冲击富豪榜顶端',
      gate:'可检验门槛阶梯（公开可查）：①个人净资产进入福布斯全球亿万富豪榜（入榜门槛约10亿美元）②进入彭博亿万富翁指数前500→前100 ③前10 ④全球富豪榜第1（世界首富）——10年轴上的冲击方向，模拟非承诺',emotion:'+3(峰)→+1(安静收束)',emotionValue:3,emotionEnd:1,projMood:'最亮→安静收束',tier:'终局',beatHint:'上市与进入前十是仅有的两处最亮时刻，其后安静收束；末段安静回扣开头物件；跨 G4–G6，停在 G7 跟前',isDip:false,callbackHere:true}
  ],
  gateChain:[
    {id:'G1',act:1,name:'第一位业主为「看得懂的结果」付钱',proof:'业主在他自己的会上，用你的演示讲给他的领导听'},
    {id:'G2',act:2,name:'逸泓智能有了续费的订阅客户和第一位专职同事',proof:'客户续约时当着同事说出离不开它的原话'},
    {id:'G3',act:3,name:'两司合并完成并拿到第一笔机构融资',proof:'合并后第一次全员大会，老团队和新同事坐在同一间屋子里'},
    {id:'G4',act:4,name:'公司上市',proof:'上市当天，旁人看着你（或你让别人）敲钟',blockHint:'监管或审批（如交易所问询、合规整改）'},
    {id:'G5',act:4,name:'个人净资产进入福布斯全球亿万富豪榜（公开入榜门槛约10亿美元）',proof:'榜单发布那天，老同学或老业主发来截图',blockHint:'人或钱（如老股东想套现、股价被质疑撑不住）'},
    {id:'G6',act:4,name:'进入彭博亿万富翁指数前10',proof:'财经媒体第一次把你和榜首放在同一张对比图里',blockHint:'对手或监管（如海外巨头压价围堵、跨境数据审查）'},
    {id:'G7',act:4,terminal:true,name:'全球富豪榜第1（世界首富）——冲击方向',proof:'离它还差一步的一个安静场面；不写成已经跨过'}
  ],
  terminalGates:['个人净资产进入福布斯全球亿万富豪榜（公开入榜门槛约10亿美元）','进入彭博亿万富翁指数前500→前100（公开排名可查）','进入全球富豪榜前10','全球富豪榜第1（世界首富）——终局冲击方向'],
  note:'模拟非承诺、非投资建议。周数/阶段/榜单门槛为规则层设定；模型不得另编收入、客户、合同、估值或成功概率。轨迹须朝「世界首富」终局收敛；写成动人的故事经过，禁止清单体/台账体，也禁止写成必然成功。',
  disclaimer:'模拟非承诺',terminalOriented:true
};

/* ---------- utils ---------- */
function loadEnvFile(text){const out={};for(const line of String(text||'').split(/\r?\n/)){const t=line.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<1)continue;out[t.slice(0,i).trim()]=t.slice(i+1).trim();}return out;}
function redact(obj){return JSON.parse(JSON.stringify(obj,(k,v)=>{if(/key|secret|token|password|authorization/i.test(String(k))&&typeof v==='string'&&v)return `<redacted len=${v.length}>`;if(typeof v==='string'&&/^sk-/.test(v))return `<redacted len=${v.length}>`;return v;}));}
const countHan=s=>Array.from(String(s||'')).filter(ch=>/\p{Script=Han}/u.test(ch)).length;
const narrativeChars=story=>(story?.chapters||[]).reduce((n,c)=>n+countHan(c.narrative||''),0);
const byteLen=s=>Buffer.byteLength(String(s||''),'utf8');
const norm=x=>String(x||'').replace(/[\s“”"「」『』‘’'，,。.！!？?：:；;、…—\-]/g,'');
const log=o=>console.log(JSON.stringify(o));
function hasGuaranteeSuccess(blob){const c=String(blob||'').replace(/[也不并绝未]{0,2}不保证成功/g,'').replace(/并非保证成功|不是保证成功|绝不保证|无法保证成功/g,'').replace(/不保证[你其成]/g,'');return /保证成功|一定能成为|稳赚|包过|注定成为|必然成为世界首富|保证你成为|一定成为世界首富|算命|改命/.test(c);}
function claimsTerminalRichest(blob){const s=String(blob||'');const re=/已成为世界首富|成为了世界首富|成功成为世界首富|已登上世界首富|稳居世界首富|必将成为世界首富|成了世界首富|登上榜首/g;let m;while((m=re.exec(s))){const pre=s.slice(Math.max(0,m.index-14),m.index);if(!/若|如果|假如|假设|冲击|朝|向|设想|是否|还没|没有/.test(pre))return true;}return false;}
const TERMINAL_RE=/世界首富|全球富豪榜|亿万富豪榜|彭博亿万富翁|福布斯|富豪榜|世界级财富|全球首富/;
const AVOID_RE=/不谈首富|不承诺首富|无法成为世界首富|首富只是|放下首富|不追求首富|首富不是目标|与首富无关/;
const quoteStrip=s=>String(s).replace(/“[^”]*”|「[^」]*」|"[^"]*"/g,'');

/* ---------- 文本扫描（plan 用户可见字段 + proj 四段） ---------- */
function planParts(story){const parts=[];for(const c of story?.chapters||[]){parts.push(c.name,c.narrative,c.gate,c.situation,c.action,c.change,c.cost,c.terminalDoor,...(c.highlights||[]),c.dip?.scene,c.dip?.payoff);for(const q of c.quests||[])parts.push(q.title,q.output,q.example,q.tool,q.why,...(q.steps||[]));}parts.push(story?.title);return parts.filter(Boolean);}
const projParts=pu=>(pu?.perNode||[]).flatMap(n=>[n.situation,n.action,n.change,n.cost]).filter(Boolean);
function ledgerLint(story,pu){
  const blob=[...planParts(story),...projParts(pu)].join('\n');
  const hits=[...blob.matchAll(STORY_ARC_BANNED_RE)].map(m=>m[0]);
  const blanks=(blob.match(/_{3,}/g)||[]).length;
  const narrBlob=(story?.chapters||[]).map(c=>c.narrative||'').join('\n');
  const narrLabels=(narrBlob.match(/【\s*(处境|行动|变化|代价)\s*】/g)||[]).length;
  const listLines=(narrBlob.match(/(^|\n)\s*(\d+[.、)]|[-*•])\s*/g)||[]).length;
  const dialogue=(narrBlob.match(/[“「][^”」]{2,80}[”」]/g)||[]).length;
  const forbidden=[...blob.matchAll(STORY_ARC_FORBIDDEN_RE)].map(m=>m[0]);
  return {pass:hits.length===0&&blanks<=2&&narrLabels===0&&listLines===0&&forbidden.length===0,hits,hitCount:hits.length,blanks,narrLabels,listLines,dialogue,forbidden};
}
function metaScan(story,pu){
  const where=[];
  (story?.chapters||[]).forEach((c,i)=>{const t=planParts({chapters:[c]}).join('\n');for(const m of t.matchAll(STORY_ARC_META_RE))where.push({side:'plan',act:i+1,word:m[0]});});
  (pu?.perNode||[]).forEach((n,i)=>{for(const k of ['situation','action','change','cost'])for(const m of String(n[k]||'').matchAll(STORY_ARC_META_RE))where.push({side:'proj',seg:i+1,field:k,word:m[0]});});
  return where;
}

/* ---------- 第四幕专项检查 ---------- */
const BLOCK_CAT={人:/同事|股东|董事|合伙|团队|老员工|投资人|创始|家人|妻|孩子|人心|离开|辞职/,钱:/钱|资金|现金|融资|估值|股价|市值|质押|解禁|套现|回款|账上|利润|成本/,监管:/监管|审批|问询|合规|证监|交易所|审查|政策|牌照|许可|核查|整改/,对手:/对手|同行|竞争|巨头|围堵|压价|抢|挖/};
function act4Check(c,rf){
  const fails=[];const narr=String(c?.narrative||'');const N=norm(narr);
  const han=countHan(narr);if(han<ACT4_MIN)fails.push('第四幕须≥'+ACT4_MIN+'汉字（当前'+han+'）');
  const rows=[];let last=-1;
  for(const g of rf.gateChain.filter(x=>x.act===4&&!x.terminal)){
    const sc=(c.gateScenes||[]).find(x=>String(x?.gateId)===g.id)?.scene||'';
    const b=(c.gateBlocks||[]).find(x=>String(x?.gateId)===g.id)||{};
    const po=N.indexOf(norm(b.obstacle)),pm=N.indexOf(norm(b.move)),ps=N.indexOf(norm(sc));
    const verb=norm(b.obstacle).length>=6&&norm(b.move).length>=6&&norm(sc).length>=6&&po>=0&&pm>=0&&ps>=0;
    const ordered=verb&&po>last&&po<pm&&pm<ps;if(verb)last=ps;
    const cats=Object.entries(BLOCK_CAT).filter(([,re])=>re.test(b.obstacle||'')).map(([k])=>k);
    const noDigit=!/\d/.test(String(b.obstacle||'')+String(b.move||''));
    const moveByMe=/我/.test(b.move||'');
    const ok=verb&&ordered&&cats.length>0&&noDigit&&moveByMe;
    rows.push({gate:g.id,obstacle:b.obstacle||'',category:cats,move:b.move||'',scene:sc,verbatim:verb,ordered,noDigit,moveByMe,ok});
    if(!ok)fails.push(g.id+' 须有逐字的挡路现实(人/钱/监管/对手)→我的动作→场面，按序（verbatim='+verb+' ordered='+ordered+' cat='+cats.join('/')+' me='+moveByMe+'）');
  }
  const hl=(c.highlights||[]).filter(x=>norm(x).length>0);
  const td=c.terminalDoor||'';const ptd=N.indexOf(norm(td));
  const hlPos=hl.map(h=>N.indexOf(norm(h)));
  const quietAfterPeak=hl.length>=1&&hl.length<=2&&hlPos.every(p=>p>=0)&&ptd>Math.max(...hlPos)&&!/[！!]/.test(td);
  if(!quietAfterPeak)fails.push('高光须1–2处且逐字在正文，终局安静场面在最后一处高光之后（无感叹）');
  const digits=(narr.match(/\d+/g)||[]);if(digits.length)fails.push('第四幕正文不得有阿拉伯数字');
  const dipWord=/低谷/.test(planParts({chapters:[c]}).join(''));if(dipWord)fails.push('第四幕不得出现“低谷”');
  const meta=[...planParts({chapters:[c]}).join('\n').matchAll(STORY_ARC_META_RE)].map(m=>m[0]);if(meta.length)fails.push('第四幕元词：'+meta.join(','));
  const obj=rf.__callbackObject||'';const cbOk=!obj||narr.slice(-400).includes(obj);if(!cbOk)fails.push('回扣物件须在第四幕末尾400字内原样出现');
  const fsI=narr.lastIndexOf('这一幕的第一步：');const fs=fsI>=0?narr.slice(fsI+8):'';
  const fsOk=fs.length>0&&narr.length-fsI<=160&&norm(fs)===norm(c.firstStep)&&!/图/.test(fs)&&!/\d/.test(fs);if(!fsOk)fails.push('末句须“这一幕的第一步：”且与 firstStep 一致、不含图/数字');
  const laterRoad=/后来的路和当时想的不太一样/.test(narr);if(laterRoad)fails.push('第四幕不得重复“后来的路…”');
  const opener=/我在你这个年纪时/.test(narr);if(opener)fails.push('第四幕不得重复回望开头');
  const richest=claimsTerminalRichest(narr)||hasGuaranteeSuccess(narr);if(richest)fails.push('不得写成已成/必然成首富');
  const terminal=TERMINAL_RE.test(narr);if(!terminal)fails.push('第四幕须正面写富豪榜/首富');
  const cnQty=[...String(c.narrative||'').matchAll(/几十|十几|几百|几千|[两二三四五六七八九十百千万]+\s*[个趟次位家份行条字回轮遍]/g)].map(m=>m[0]).filter(w=>!/^十$/.test(w));if(cnQty.length)fails.push('第四幕不编汉字数量：'+cnQty.join(','));
  const banned=[...planParts({chapters:[c]}).join('\n').matchAll(STORY_ARC_BANNED_RE)].map(m=>m[0]).concat([...narr.matchAll(STORY_ARC_FORBIDDEN_RE)].map(m=>m[0]));if(banned.length)fails.push('禁词：'+banned.join(','));
  const quadOk=['situation','action','change','cost'].every(k=>countHan(c[k])>=40);if(!quadOk)fails.push('四元提要各≥40汉字');
  const q=c.quests?.[0];const questOk=Boolean(q&&Array.isArray(q.steps)&&q.steps.length===3&&/^(今天|本周)：/.test(q.title||''));if(!questOk)fails.push('任务须1个且3步，标题以今天：/本周：开头');
  return {pass:fails.length===0,fails,han,rows,highlights:hl,terminalDoor:td,quietAfterPeak,firstStep:fs};
}

/* ---------- 全篇 algoCheck（r2） ---------- */
function algoCheck(story,planNear,pu,rf){
  const ch=story?.chapters||[];const fails=[];
  const crossable=rf.gateChain.filter(g=>!g.terminal).map(g=>g.id);
  const crossed=ch.flatMap(c=>Array.isArray(c.gatesCrossed)?c.gatesCrossed.map(String):[]);
  const gatesInOrder=JSON.stringify(crossed)===JSON.stringify(crossable);
  const full=ch.map(c=>c.narrative||'').join('\n');const fullN=norm(full);
  let lastPos=-1,scenesOk=true;const sceneRows=[];
  for(const g of rf.gateChain.filter(x=>!x.terminal)){const c=ch[g.act-1]||{};const sc=(c.gateScenes||[]).find(x=>String(x?.gateId)===g.id)?.scene||'';const n=norm(sc);const inAct=n.length>=6&&norm(c.narrative).includes(n);const pos=n?fullN.indexOf(n):-1;const ordered=pos>lastPos;if(pos>=0)lastPos=pos;sceneRows.push({gate:g.id,scene:sc,inAct,ordered});if(!(inAct&&ordered))scenesOk=false;}
  if(!gatesInOrder)fails.push('gatesCrossed 须按序');if(!scenesOk)fails.push('门场面须逐字且按序');
  const a4=act4Check(ch[3]||{},{...rf,__callbackObject:story?.callbackObject});
  if(!a4.pass)fails.push(...a4.fails.map(x=>'[第四幕] '+x));
  // ⑤ 情绪：规则层落值；第三幕≤-2；第四幕峰后安静收束
  const emos=ch.map(c=>Number(c.emotion));const emoEnd=ch.map(c=>Number(c.emotionEnd));
  const emoFromRule=ch.every((c,i)=>c.emotion===rf.stages[i].emotionValue&&c.emotionEnd===rf.stages[i].emotionEnd&&c.emotionSource==='rule-layer');
  const emoOk=emoFromRule&&emos[2]<=-2&&emos[3]===Math.max(...emos)&&emoEnd[3]<emos[3];
  if(!emoOk)fails.push('emotion 须规则层落值、第三幕≤-2、第四幕峰后收束：'+JSON.stringify({emos,emoEnd}));
  // 低谷：plan 只在第三幕；dip 场面 + 换来的场面（非设问）
  const dip=ch[2]?.dip;const dipSceneOk=Boolean(dip&&norm(dip.scene).length>=6&&norm(ch[2].narrative).includes(norm(dip.scene)));
  const dipPayoffOk=Boolean(dip&&norm(dip.payoff).length>=6&&norm(ch[2].narrative).includes(norm(dip.payoff))&&!/[？?]/.test(dip.payoff)&&!/换来了什么/.test(dip.payoff)&&fullN.indexOf(norm(dip.payoff))>fullN.indexOf(norm(dip.scene)));
  const planDipActs=ch.map((c,i)=>/低谷/.test(planParts({chapters:[c]}).join(''))?i+1:0).filter(Boolean);
  const dipOk=dipSceneOk&&dipPayoffOk&&planDipActs.every(a=>a===rf.dipAct);if(!dipOk)fails.push('低谷须只在第三幕、payoff 为场面非设问；plan 低谷所在幕='+planDipActs.join(','));
  const hl=ch.flatMap(c=>Array.isArray(c.highlights)?c.highlights:[]).filter(x=>norm(x).length>0);const highlightsOk=hl.length>=1&&hl.length<=2;if(!highlightsOk)fails.push('高光 1–2 处');
  const obj=String(story?.callbackObject||'').trim();const callbackOk=obj.length>=2&&String(ch[0]?.narrative||'').includes(obj)&&String(ch[3]?.narrative||'').slice(-400).includes(obj);if(!callbackOk)fails.push('回扣物件');
  const openingOk=/^\s*我在你这个年纪时/.test(ch[0]?.narrative||'');const laterRoadCount=(full.match(/后来的路和当时想的不太一样/g)||[]).length;
  if(!openingOk)fails.push('开头回望');if(laterRoadCount!==1)fails.push('“后来的路…”须1次（'+laterRoadCount+'）');
  const perNarr=ch.map(c=>countHan(c.narrative));const depthOk=perNarr.length===4&&perNarr.every(n=>n>=430)&&perNarr[3]>=ACT4_MIN;if(!depthOk)fails.push('幕深度 '+perNarr.join('/'));
  const firstSteps=ch.map(c=>{const t=String(c.narrative||'');const i=t.lastIndexOf('这一幕的第一步：');return i>=0?t.slice(i+8):'';});
  const planFsMatch=ch.map((c,i)=>firstSteps[i]&&firstSteps[i]===c.firstStep);
  // ① 元词
  const meta=metaScan(story,pu);if(meta.length)fails.push('元词命中 '+meta.length+'：'+JSON.stringify(meta.slice(0,6)));
  const weeklyPlan=(planParts(story).join('\n').match(STORY_ARC_TEMPLATE_RE)||[]).length;
  // ③ 今天卡同源（复合：卡标题缩写“那句转向的话”=例句原文）
  const todayTitle=planNear?.today?.title||'';const todayEx=story?.chapters?.[0]?.quests?.[0]?.example||'';
  const todayComposite=todayTitle.replace(/^今天：/,'今天').replace(/那句转向的话$/,'那句')+'“'+todayEx.replace(/[。！]$/,'')+'”。';
  const todayCardSame=firstSteps[0]===todayComposite;
  const todayBody=norm(todayTitle.replace(/^今天：/,''));let todayCore=false;for(let k=0;k+6<=todayBody.length;k++)if(norm(firstSteps[0]).includes(todayBody.slice(k,k+6))){todayCore=true;break;}
  if(!(todayCardSame&&todayCore))fails.push('第一幕第一步须与今天卡同源');
  // proj
  const pn=pu?.perNode||[];let proj=null;
  if(pn.length){
    const segText=n=>[n.situation,n.action,n.change,n.cost].join('\n');
    const projBlob=pn.map(segText).join('\n');
    const sameSource=pn.map((n,i)=>{const want='这一幕的第一步：'+ch[i]?.firstStep;const a=String(n.action||'');return {seg:i+1,verbatim:a.endsWith(want)&&(a.match(/这一幕的第一步/g)||[]).length===1&&!/这一幕的第一步/.test([n.situation,n.change,n.cost].join('')),projFirstStep:a.slice(a.lastIndexOf('这一幕的第一步：')+8),planFirstStep:ch[i]?.firstStep,bytesProj:byteLen(a.slice(a.lastIndexOf('这一幕的第一步：')+8)),bytesPlan:byteLen(ch[i]?.firstStep)};});
    const sameAll=sameSource.every(r=>r.verbatim&&r.projFirstStep===r.planFirstStep);
    const seg1Today=sameSource[0]?.projFirstStep===todayComposite;
    const weekly=(projBlob.match(STORY_ARC_TEMPLATE_RE)||[]).length;
    const cbPer=pn.map(n=>(segText(n).match(/[那这几一]张[^，。；！？]{0,10}图|没送出去的图/g)||[]).length);const cbTotal=cbPer.reduce((a,b)=>a+b,0);
    const tuCount=(projBlob.match(/图/g)||[]).length;
    const dipSegs=pn.map((n,i)=>/低谷/.test(segText(n))?i+1:0).filter(Boolean);
    const dipSegOk=dipSegs.every(s=>s===rf.dipAct);
    // 人称：去掉引号对白与规则层注入的第一步；第一段处境第一句允许回望“我”，第二句须含“你”过渡
    const person=pn.map((n,i)=>{const fsTxt='这一幕的第一步：'+(ch[i]?.firstStep||'');const parts={situation:n.situation,action:String(n.action||'').replace(fsTxt,''),change:n.change,cost:n.cost};const hits=[];let transition=null;
      for(const [k,v] of Object.entries(parts)){let b=quoteStrip(v);if(i===0&&k==='situation'){const s=b.split(/(?<=[。！？])/);transition=s[1]||'';if(!/你/.test(transition))hits.push('no_transition');b=s.slice(1).join('');}if(/我/.test(b))hits.push(k);}
      return {seg:i+1,ok:hits.length===0,hits,transition};});
    const personOk=person.every(p=>p.ok);
    const opener=(projBlob.match(/我在你这个年纪时/g)||[]).length;const openerOk=opener===1&&/^\s*我在你这个年纪时/.test(pn[0]?.situation||'');
    const residue=(projBlob.match(/按计划推进|具备检验|各项差距/g)||[]);
    proj={sameSource,sameAll,seg1Today,weekly,cbPer,cbTotal,tuCount,dipSegs,dipSegOk,person,personOk,opener,openerOk,residue:residue.length};
    if(!sameAll)fails.push('proj 第一步须逐字=plan 同幕 firstStep');if(!seg1Today)fails.push('proj 第一段第一步须=今天卡');
    if(weekly)fails.push('proj 每周固定='+weekly);if(cbTotal>4)fails.push('proj 回扣物件 '+cbTotal+'>4');if(!dipSegOk)fails.push('proj 低谷出现在段 '+dipSegs.join(','));
    if(!personOk)fails.push('proj 人称：'+JSON.stringify(person.filter(p=>!p.ok)));if(!openerOk)fails.push('proj 回望开头='+opener);if(residue.length)fails.push('proj 状态句残留');
  }
  const L=ledgerLint(story,pu);const bannedOk=L.hitCount===0&&L.forbidden.length===0;if(!bannedOk)fails.push('禁词：'+JSON.stringify([...L.hits,...L.forbidden].slice(0,10)));
  if(weeklyPlan)fails.push('plan 每周固定='+weeklyPlan);
  return {pass:fails.length===0,fails,act4:a4,emos,emoEnd,emoFromRule,emoOk,dip,dipOk,planDipActs,highlights:hl,highlightsOk,callbackObject:obj,callbackOk,openingOk,laterRoadCount,perNarr,depthOk,firstSteps,planFsMatch,meta,metaCount:meta.length,weeklyPlan,todayComposite,todayCardSame,todayCore,proj,sceneRows,crossed,gatesInOrder,scenesOk,bannedOk,lint:L};
}

/* ---------- DeepSeek ---------- */
function dsCall(secrets){
  const base=(secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com').replace(/\/$/,'');const model=secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat';
  const url=/\/chat\/completions$/.test(base)?base:(base+'/chat/completions');
  const once=async(msgs,{max_tokens=8000,temperature=0.85}={})=>{
    const body={model,messages:msgs,response_format:{type:'json_object'},max_tokens,temperature,thinking:{type:'disabled'}};
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+secrets.BUTTERFLY_LLM_API_KEY},body:JSON.stringify(body),signal:AbortSignal.timeout(300000)});
    if(!r.ok)throw Error('upstream '+r.status);const j=await r.json();if(j.choices?.[0]?.finish_reason==='length')throw Error('truncated');return JSON.parse(j.choices?.[0]?.message?.content||'{}');};
  return {model,call:async(msgs,opts)=>{let e0;for(let t=0;t<3;t++){try{return await once(msgs,opts);}catch(e){e0=e;if(!/fetch failed|upstream 5|upstream 429|ECONN|timeout/i.test(String(e?.message||e)))throw e;await new Promise(r=>setTimeout(r,3000*(t+1)));}}throw e0;}};
}

/** 第一到第三幕：只做两处元词句替换（确定性、可审计）。 */
const ACT_PATCHES=[
  {act:2,field:'narrative',from:'第一道门开了以后，麻烦也跟着来了。',to:'那位业主在会上讲完以后，麻烦也跟着来了。',why:'元词「第一道门」'},
  {act:3,field:'narrative',from:'低谷里换来了什么？换来了我看清谁是真愿意一起走的人。',to:'那几个月换来的，是我看清了谁是真愿意一起走的人：有人开始不接我的电话，也有人半夜还在群里改模型。',why:'元词设问「低谷里换来了什么？」→场面'},
  {act:3,field:'dip.payoff',from:'低谷里换来了什么？换来了我看清谁是真愿意一起走的人。',to:'那几个月换来的，是我看清了谁是真愿意一起走的人：有人开始不接我的电话，也有人半夜还在群里改模型。',why:'dip.payoff 同步正文'}
];
function patchActs13(base){
  const s=structuredClone(base);const log=[];
  for(const p of ACT_PATCHES){const c=s.chapters[p.act-1];
    if(p.field==='dip.payoff'){const ok=c.dip?.payoff===p.from;if(ok)c.dip.payoff=p.to;log.push({...p,applied:ok});}
    else{const n=(c[p.field].split(p.from).length-1);if(n===1)c[p.field]=c[p.field].replace(p.from,p.to);log.push({...p,applied:n===1,occurrences:n});}}
  return {story:s,log};
}

function act4Prompt(baseStory,rf,prevFails,prevDraft){
  const ch=baseStory.chapters;const obj=baseStory.callbackObject;
  const gates=rf.gateChain.filter(g=>g.act===4).map(g=>g.id+'「'+g.name+'」证明场面提示：'+g.proof+(g.blockHint?'；挡路现实可选方向：'+g.blockHint:'')).join('；');
  const schema={narrative:'≥'+(ACT4_MIN+300)+'汉字的连贯散文（第一人称“我”=十年后的你），最后一句以“这一幕的第一步：”开头',situation:'70—120个汉字提要',action:'70—120个汉字提要',change:'70—120个汉字提要',cost:'70—120个汉字提要',
    gatesCrossed:['G4','G5','G6'],gateBlocks:[{gateId:'G4',obstacle:'narrative 原文一句：挡路的现实',move:'narrative 原文一句：我亲自做的一个动作'}],gateScenes:[{gateId:'G4',scene:'narrative 原文一句：被旁人看见的场面'}],
    highlights:['G4 场面原文','G6 场面原文'],terminalDoor:'narrative 原文一句：离世界首富还差一步的安静场面',firstStep:'“这一幕的第一步：”之后的原文（今天就能做的生活小事；不含“图”，不含数字）',
    quest:{title:'今天：…（一个场面动作）',steps:['…','…','…'],output:'怎样算做到（本人可控）',tool:'日常工具',example:'一句能直接说出口的话',minutes:20,why:'为什么是现在'}};
  let sys='你是蝴蝶效应应用的中文人生推演作者。只输出一个JSON对象，不要Markdown。你只重写一篇四幕故事的第四幕；第一到第三幕已定稿、一个字都不能改，你的第四幕要接着第三幕最后的场面往下写，语气、人物（小陈、老同事、老业主）、叙述者“我”（十年后的你）对“你”说话的口吻保持一致。\n';
  sys+='【第四幕规则层】'+JSON.stringify({label:rf.stages[3].label,period:ch[3].period,wealthStep:rf.stages[3].wealthStep,gates,terminalGates:rf.terminalGates,callbackObject:obj})+'\n';
  sys+=['【结构（按这个顺序写，不许跳）】',
   '1) 开头一小段：接第三幕，平台开始用资本放大；写想要的画面。',
   '2) G4 上市：先写一个具体的挡路现实（人、钱、监管或对手之一，建议监管/审批），再写“我”亲自做的一个动作（去见谁、说了什么、让出了什么），最后写上市那天被旁人看见的场面——这是第一处最亮的时刻。',
   '3) G5 进福布斯榜：先写一个具体的挡路现实（建议人或钱：比如老股东想套现、股价被质疑），再写“我”亲自做的一个动作，最后写榜单发布那天老同学或老业主发来截图的场面——这一处写得克制，不是最亮的时刻。',
   '4) G6 进前十：先写一个具体的挡路现实（建议对手或监管：比如海外巨头压价围堵、跨境数据审查），再写“我”亲自做的一个动作，最后写财经媒体第一次把我和榜首放在同一张对比图里的场面——这是第二处、也是最后一处最亮的时刻。',
   '5) 然后情绪安静下来：写一个离世界首富还差一步的安静场面（不写成已经是、也不写成必然会是），回扣开头的物件「'+obj+'」——原样写出这几个字，放在全幕最后四百字之内，只写一次。',
   '6) 最后一句以“这一幕的第一步：”开头，写今天就能做的一件生活小事（不超过三十个字；不要提“图”字，不要任何数字，包括“一”“两”）；firstStep 字段与这句冒号后的内容逐字相同。',
   '7) narrative 里必须原样出现“福布斯”“富豪榜”“世界首富”这些词（终局要正面写）。situation/action/change/cost 四个提要每个都要写满六十个汉字以上。quest 与提要里也不许出现“清单”“台账”“模板”这类词。',
   '每道门的挡路现实、我的动作、场面都必须是 narrative 里的原句，逐字摘到 gateBlocks / gateScenes；三道门的挡路现实要各不相同，且都让读者看到“凭什么跨过去”。'].join('\n')+'\n';
  sys+='【硬约束】narrative ≥'+(ACT4_MIN+300)+'个汉字（每道门的挡路、动作、场面各写成一小段，开头和安静收尾也各写一段）（验收线'+ACT4_MIN+'），场面、对话、动作为主。不写任何阿拉伯数字，不编金额、估值、百分比、人数；中文数字只允许“前十”“第一”。也不写“几十个”“十几趟”“四个字”“两行”“三家”这类汉字数量词（“一次”“一家”“几个”可以），用“一趟接一趟”“满满一页”这类说法代替；不写“低谷”二字；不写“后来的路和当时想的不太一样”；不用“我在你这个年纪时”。禁止：清单、台账、文件名、项目编号、书名号、报价；禁止“预测/预言/注定/命运/你失败了”；禁止写成已经成为或必然成为世界首富、保证成功。'+STORY_ARC_META_PROMPT+' 特别注意：正文不得出现“高光”“门前”“道门”“全篇”“之所以可能”“这一幕”（末句“这一幕的第一步：”除外）。\n';
  sys+='【输出结构】'+JSON.stringify(schema);
  if(prevFails?.length)sys+='\n【上一稿未过，必须改正】'+JSON.stringify(prevFails);
  const ctx='【已定稿·第一到第三幕（只读，不要改写，也不要重复里面的句子）】\n'+ch.slice(0,3).map((c,i)=>'第'+(i+1)+'段 '+c.name+'\n'+c.narrative).join('\n\n');
  const prev=prevDraft?('\n\n【上一稿第四幕 JSON（在它的基础上修改：保留已经合格的段落和原句，只改正未过的地方；篇幅不够就在每道门的挡路、动作、场面里加细节和对话；gateBlocks/gateScenes 要和修改后的 narrative 原句逐字对应）】\n'+JSON.stringify(prevDraft)):'';
  return [{role:'system',content:sys},{role:'user',content:ctx+prev+'\n\n请只输出第四幕 JSON。'}];
}
function assembleAct4(baseStory,d,rf){
  const old=baseStory.chapters[3];
  const narr=String(d.narrative||'').trim();const i=narr.lastIndexOf('这一幕的第一步：');const fs=i>=0?narr.slice(i+8).trim():String(d.firstStep||'');
  return {...old,narrative:narr,situation:d.situation,action:d.action,change:d.change,cost:d.cost,
    gatesCrossed:['G4','G5','G6'],gateScenes:d.gateScenes||[],gateBlocks:d.gateBlocks||[],highlights:(d.highlights||[]).slice(0,2),terminalDoor:d.terminalDoor||'',
    firstStep:fs,quests:d.quest?[d.quest]:old.quests,tier:'终局',narrativeMode:'story-arc'};
}
async function genAct4(ds,baseStory,rf,{prevFails=null,prevDraft=null,tag=''}={}){
  const t0=Date.now();const d=await ds.call(act4Prompt(baseStory,rf,prevFails,prevDraft),{max_tokens:6000,temperature:0.85});
  const c4=assembleAct4(baseStory,d,rf);const chk=act4Check(c4,{...rf,__callbackObject:baseStory.callbackObject});
  log({phase:'act4-draft',tag,ms:Date.now()-t0,han:chk.han,pass:chk.pass,fails:chk.fails});
  return {c4,chk,raw:d,ms:Date.now()-t0};
}
function applyRuleEmotion(story,rf){story.chapters=story.chapters.map((c,i)=>({...c,emotion:rf.stages[i].emotionValue,emotionEnd:rf.stages[i].emotionEnd,emotionArc:rf.stages[i].emotion,emotionSource:'rule-layer'}));return story;}

/** 整稿首稿（仅测直过率，不采用）：同一新契约一次调用，无修补/扩写。 */
async function fullPlanFirstDraft(ds,rf,tag){
  const t0=Date.now();
  const schema={title:'故事标题',baseline:'一句话：模拟非承诺',callbackObject:'开头出现、末幕回扣的物件（2—8字）',chapters:[{name:'幕名',period:'阶段范围',narrativeMode:'story-arc',narrative:'≥450汉字散文（第四幕≥'+(ACT4_MIN+150)+'）',situation:'',action:'',change:'',cost:'',gate:'',gatesCrossed:['G1'],gateScenes:[{gateId:'G1',scene:'原文一句'}],gateBlocks:[{gateId:'G4',obstacle:'原文一句',move:'原文一句'}],dip:{scene:'原文一句',payoff:'原文一句（场面，不是问句）'},highlights:[],terminalDoor:'',firstStep:'',quests:[{title:'今天：/本周：',steps:['','',''],output:'',tool:'',example:'',minutes:30,why:''}]}]};
  let ins='你是蝴蝶效应应用的中文人生推演作者。只输出一个JSON对象，不要Markdown。\n【叙事算法·必须遵守】\n'+NARRATIVE_ALGO_PROMPT+'\n';
  ins+=' 用户是 Micheal 本人（42岁），目标原话「成为世界首富」。把约10年写成「十年后的你」用第一人称“我”回望、对现在的你说话的动人故事经过。从真实处境出发（政府预算紧、咨询项目少、急需营收；环保管家赛道拥挤；约5人团队会 SWMM、EFDC、SWAT、HSPF、InfoWorks ICM 等建模；逸泓智能还没有员工）。生成正好4幕，第一幕恰好2个任务（今天/本周），其余每幕1个；每个任务3步，minutes≤45。参考结构：'+JSON.stringify(schema)+storyArcPromptHint(persona);
  ins+=planDepthContractText(rf,{enabled:true,storyArc:true})+' 【规则层只读】'+JSON.stringify(rf);
  ins+=' 【终局】第四幕正面写冲击全球富豪榜直至世界首富；gate 照抄 terminalGates；不写成已成/必然。第三幕是最低处（dip 放第三幕），“低谷”二字只可出现在第三幕。';
  try{
    const d=await ds.call([{role:'system',content:ins},{role:'user',content:JSON.stringify({profile:persona,ruleFacts:rf})}],{max_tokens:8000});
    let story=validateStory(normalizeStoryDraft(d),persona.hours,persona);
    const META=['gatesCrossed','gateScenes','gateBlocks','tier','highlights','firstStep','dip','terminalDoor'];
    story={...story,callbackObject:story.callbackObject||d.callbackObject||'',chapters:story.chapters.map((c,i)=>{const raw=d.chapters?.[i]||{};const m={};for(const k of META)if(c[k]==null&&raw[k]!=null)m[k]=raw[k];return ensureChapterQuad({...c,...m,narrativeMode:'story-arc'});})};
    applyRuleEmotion(story,rf);
    const ac=algoCheck(story,nearTermFromPlanStory(story),null,rf);
    // 今天卡复合同源只适用于既有定稿；整稿首稿用核心片段同源
    const fails=ac.fails.filter(f=>!/第一幕第一步须与今天卡同源/.test(f)||!ac.todayCore);
    log({phase:'fullplan-firstdraft',tag,ms:Date.now()-t0,pass:fails.length===0,perNarr:ac.perNarr,fails});
    return {tag,pass:fails.length===0,fails,perNarr:ac.perNarr,metaCount:ac.metaCount,act4Han:ac.act4.han,ms:Date.now()-t0};
  }catch(e){log({phase:'fullplan-firstdraft',tag,error:String(e?.message||e).slice(0,160)});return {tag,pass:false,fails:['生成/校验异常：'+String(e?.rule||e?.message||e).slice(0,120)],ms:Date.now()-t0};}
}

/* ---------- proj ---------- */
function stripDigits(s){return String(s||'').replace(/[0-9０-９]+(\.\d+)?\s*(%|周|天|年|个|人|次|万|亿|美元|元)?/g,'').replace(/____/g,'').replace(/[①②③④⑤]/g,'').replace(/\s+/g,' ').trim();}
function rfForProj(planStory){
  return {...ruleFacts,planFirstSteps:planStory.chapters.map(c=>c.firstStep),projOpener:'我在你这个年纪时，也守着那间小办公室，天天发愁钱从哪里来。那时的处境，跟今天的你几乎一样。',callbackObject:planStory.callbackObject||'',
    stages:ruleFacts.stages.map((st,i)=>{const c=planStory.chapters[i]||{};
      const beat=stripDigits([c.situation,c.action,c.change,c.cost].filter(Boolean).join(' ')).replace(st.callbackHere?/$^/:/[那这几一]张[^，。；！？]{0,10}图|没送出去的图/g,'那段日子').slice(0,420);
      return {...st,planBeat:st.isDip?beat:beat.replace(/低谷/g,'难处'),wealthStep:stripDigits(st.wealthStep),
        gatesText:ruleFacts.gateChain.filter(g=>g.act===i+1).map(g=>stripDigits(g.name.replace(/（[^）]*）/g,'').replace(/前10/,'前十'))+'（证明场面：'+stripDigits(g.proof)+'）').join('；'),
        emotion:st.projMood};})};
}
async function runProjection(dsEnv,planStory,planNear){
  const rfProj=rfForProj(planStory);
  const rf=buildRoleFacts(persona),gt=buildGoalTree(persona);
  const proj=computeProjection({roleFacts:rf,goalTree:gt,gap:assembleGap(heuristicGap(rf),rf,{model:null,source:'heuristic'})});
  const rawHorizonInternal=pjLine(proj)?.horizon;const t0=Date.now();
  try{
    const s=await generateStoryLLM({...dsEnv,__ruleFacts:rfProj},proj,{roleFacts:rf,profile:persona,base:'http://127.0.0.1:11434',model:dsEnv.BUTTERFLY_LLM_MODEL,authoritativeNearTerm:planNear||undefined,planStory});
    return {rawHorizonInternal,rfProj,projectionUser:{ms:Date.now()-t0,provider:s.provider,providerKind:s.providerKind,model:s.model,source:s.source,chars:s.chars,validation:s.validation?.pass,
      depth:s.depth,depthVersion:s.depthVersion,depthSpine:s.depthSpine,ruleHorizonWeeks:s.ruleHorizonWeeks??ruleFacts.deadlineWeeks,nearTerm:s.nearTerm,nearTermSource:s.nearTermSource,
      firstStepInjected:!!s.firstStepInjected,firstStepNumberExempt:s.firstStepNumberExempt||[],
      perNode:(s.perNode||[]).map(n=>({nodeId:n.nodeId,title:n.title,tRange:n.tRange,depthStage:n.depthStage,source:n.source,fieldSource:n.fieldSource,situation:n.situation,action:n.action,change:n.change,cost:n.cost,firstStep:n.firstStep,firstStepSource:n.firstStepSource,
        fieldChars:{situation:countHan(n.situation),action:countHan(n.action),change:countHan(n.change),cost:countHan(n.cost)}})),
      longForm:s.longForm,attempts:s.attempts||[],fallbackReason:s.fallbackReason||null}};
  }catch(e){return {rawHorizonInternal,rfProj,projectionUser:{ms:Date.now()-t0,error:String(e?.message||e),perNode:[],nearTerm:null,chars:0}};}
}

/* ---------- main ---------- */
async function main(){
  await mkdir(OUT,{recursive:true});
  let secrets={};
  try{secrets=loadEnvFile(await readFile(SECRET_FILE,'utf8'));log({phase:'secrets',loaded:true,keys:Object.keys(secrets)});}catch(e){log({phase:'secrets',loaded:false,error:String(e.message||e)});process.exit(2);}
  if(!secrets.BUTTERFLY_LLM_API_KEY){console.error('missing key');process.exit(2);}
  const ds=dsCall(secrets);
  const dsEnv={BUTTERFLY_LLM_PROVIDER:secrets.BUTTERFLY_LLM_PROVIDER||'deepseek',BUTTERFLY_LLM_BASE_URL:secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com',BUTTERFLY_LLM_MODEL:ds.model,BUTTERFLY_LLM_API_KEY:secrets.BUTTERFLY_LLM_API_KEY,
    AI_PROVIDER:secrets.BUTTERFLY_LLM_PROVIDER||'deepseek',AI_MODEL:ds.model,AI_BASE_URL:secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com',DEEPSEEK_API_KEY:secrets.BUTTERFLY_LLM_API_KEY,AI_DEPTH_CONTRACT:'1',PROJECTION_STORY_LLM:'1'};
  await writeFile(`${OUT}/persona.json`,JSON.stringify({tip:TIP,contractVersion:CV,baseContract:DEPTH_CONTRACT_VERSION,persona,ruleFacts,basePlan:BASE_PLAN,note:'r2 定点修补：第一到第三幕保留（仅两处元词句替换），方案 b 重写第四幕≥900字；emotion 规则层落值；proj 第一步规则层逐字注入'},null,2));

  const base=JSON.parse(await readFile(BASE_PLAN,'utf8'));const baseStory=base.story;
  const {story:patched,log:patchLog}=patchActs13(baseStory);log({phase:'acts13-patch',patchLog:patchLog.map(p=>({act:p.act,field:p.field,applied:p.applied}))});
  if(!patchLog.every(p=>p.applied))throw Error('acts13 patch not applied');

  // 1) 第四幕首稿 N 份（并行）=直过率；另并行跑整稿首稿 N 份（只测率）
  const [drafts,fullDrafts]=await Promise.all([
    Promise.all(Array.from({length:RATE_N},(_,k)=>genAct4(ds,patched,ruleFacts,{tag:'first-'+(k+1)}).catch(e=>({err:String(e?.message||e),chk:{pass:false,fails:['异常 '+String(e?.message||e)]}})))),
    Promise.all(Array.from({length:FULL_PLAN_N},(_,k)=>fullPlanFirstDraft(ds,ruleFacts,'full-'+(k+1))))
  ]);
  let pick=drafts.find(d=>d.chk?.pass);let act4Route='first-draft';const act4PatchMax=4;
  if(!pick){const best=drafts.filter(d=>d.c4).sort((a,b)=>a.chk.fails.length-b.chk.fails.length)[0];
    let cur=best;
    for(let k=1;k<=4&&!pick;k++){const r=await genAct4(ds,patched,ruleFacts,{prevFails:(cur?.chk?.fails)||null,prevDraft:cur?.raw||null,tag:'patch-'+k}).catch(()=>null);if(r?.chk.pass){pick=r;act4Route='patch-'+k;}else if(r?.c4&&(!cur||r.chk.fails.length<=cur.chk.fails.length))cur=r;}
    if(!pick){pick=cur;act4Route='best-unpassed';}}
  const planStory=applyRuleEmotion({...patched,chapters:[...patched.chapters.slice(0,3),pick.c4],depthVersion:CV,narrativeMode:'story-arc',generatedAt:new Date().toISOString()},ruleFacts);
  // app 校验（不改写定稿）：normalize+validate 只验证可被前端接收
  let appValid=true,appValidError=null;try{validateStory(normalizeStoryDraft(structuredClone(planStory)),persona.hours,persona);}catch(e){appValid=false;appValidError=String(e?.rule||'')+':'+String(e?.message||e).slice(0,160);}
  const planNear=nearTermFromPlanStory(planStory);
  // 第一到第三幕保留核对
  const retain=[0,1,2].map(i=>{const o=baseStory.chapters[i],n=planStory.chapters[i];const changed=Object.keys({...o,...n}).filter(k=>!['emotion','emotionEnd','emotionArc','emotionSource'].includes(k)&&JSON.stringify(o[k])!==JSON.stringify(n[k]));return {act:i+1,changedFields:changed,narrativeHanBefore:countHan(o.narrative),narrativeHanAfter:countHan(n.narrative)};});
  const planOnly=algoCheck(planStory,planNear,null,ruleFacts);log({phase:'plan-assembled',act4Route,act4Han:planOnly.act4.han,pass:planOnly.pass,fails:planOnly.fails,appValid});

  // 2) proj 直过率：N 次独立全流程（并行），无外层重试；采用第一份通过的
  const projRuns=await Promise.all(Array.from({length:RATE_N},()=>runProjection(dsEnv,planStory,planNear)));
  const projRate=projRuns.map((pr,k)=>{const ac=algoCheck(planStory,planNear,pr.projectionUser,ruleFacts);const projFails=ac.fails.filter(f=>/^proj|禁词|元词/.test(f));const ok=projFails.length===0&&pr.projectionUser.source==='llm'&&pr.projectionUser.validation!==false;
    log({phase:'proj-run',k:k+1,ok,source:pr.projectionUser.source,validation:pr.projectionUser.validation,chars:pr.projectionUser.chars,projFails,rejected:(pr.projectionUser.attempts||[]).flatMap(a=>a.rejected||[]).slice(0,30)});
    return {run:k+1,ok,source:pr.projectionUser.source,validation:pr.projectionUser.validation,fails:projFails,ac};});
  let pi=projRate.findIndex(r=>r.ok);if(pi<0)pi=projRate.map((r,i)=>[r.fails.length,i]).sort((a,b)=>a[0]-b[0])[0][1];
  const chosenProj=projRuns[pi];const projectionUser=chosenProj.projectionUser;
  const AC=algoCheck(planStory,planNear,projectionUser,ruleFacts);

  const nearTermTitleEqual=Boolean(planNear&&projectionUser?.nearTerm?.today?.title===planNear.today.title&&projectionUser?.nearTerm?.week?.title===planNear.week.title);
  const nearTermOutputEqual=Boolean(planNear&&projectionUser?.nearTerm?.today?.output===planNear.today.output&&projectionUser?.nearTerm?.week?.output===planNear.week.output);
  const fullText=JSON.stringify({plan:planStory,projection:projectionUser});
  const userVisibleExposesRaw40=/rawProjectionHorizon/.test(fullText)||/"hi"\s*:\s*40\b/.test(fullText);
  const projMaxHi=Math.max(0,...(projectionUser?.perNode||[]).map(n=>n.tRange?.hi||0));
  const fix={
    f1_meta:{pass:AC.metaCount===0&&AC.dipOk,metaCount:AC.metaCount,dipPayoff:AC.dip?.payoff,dipPayoffIsScene:!/[？?]/.test(AC.dip?.payoff||'')},
    f2_act4:{pass:AC.act4.pass,option:'b',act4Han:AC.act4.han,gates:AC.act4.rows},
    f3_firstStep:{pass:!!AC.proj?.sameAll&&!!AC.proj?.seg1Today&&AC.todayCardSame,rows:AC.proj?.sameSource,todayComposite:AC.todayComposite,todayCardSame:AC.todayCardSame,seg1Today:AC.proj?.seg1Today},
    f4_residue:{pass:AC.proj&&AC.proj.weekly===0&&AC.weeklyPlan===0&&AC.proj.cbTotal<=4&&AC.proj.dipSegOk&&AC.planDipActs.every(a=>a===3)&&AC.proj.personOk&&AC.proj.openerOk,weekly:AC.proj?.weekly,weeklyPlan:AC.weeklyPlan,cbPer:AC.proj?.cbPer,cbTotal:AC.proj?.cbTotal,tuCount:AC.proj?.tuCount,dipSegs:AC.proj?.dipSegs,planDipActs:AC.planDipActs,person:AC.proj?.person},
    f5_emotion:{pass:AC.emoOk&&AC.highlightsOk&&AC.act4.quietAfterPeak,emotions:AC.emos,emotionEnd:AC.emoEnd,source:'rule-layer',highlights:AC.highlights,terminalDoor:AC.act4.terminalDoor},
    f6_rates:{act4FirstDraft:{n:drafts.length,pass:drafts.filter(d=>d.chk?.pass).length,rows:drafts.map((d,i)=>({run:i+1,pass:!!d.chk?.pass,han:d.chk?.han,fails:d.chk?.fails}))},
      fullPlanFirstDraft:{n:fullDrafts.length,pass:fullDrafts.filter(d=>d.pass).length,rows:fullDrafts},
      proj:{n:projRate.length,pass:projRate.filter(r=>r.ok).length,rows:projRate.map(r=>({run:r.run,pass:r.ok,source:r.source,validation:r.validation,fails:r.fails}))},act4Route,projChosenRun:pi+1}
  };
  const hard={
    planNarr:narrativeChars(planStory),perChapterNarr:AC.perNarr,retain,patchLog,appValid,appValidError,
    nearTermTitleEqual,nearTermOutputEqual,nearTermSource:projectionUser?.nearTermSource,
    planProvider:'deepseek',projProvider:projectionUser?.provider,planDepthVersion:CV,projDepthVersion:projectionUser?.depthVersion,projSource:projectionUser?.source,projValidation:projectionUser?.validation,projMaxHi,
    noGuarantee:!hasGuaranteeSuccess(fullText),noTerminalRichest:!claimsTerminalRichest(fullText),noAvoidance:!AVOID_RE.test(fullText),noRaw40:!userVisibleExposesRaw40,
    planLastTerminal:TERMINAL_RE.test(planStory.chapters[3].narrative),projLastTerminal:/首富|富豪榜/.test(JSON.stringify(projectionUser?.perNode?.[3]||{})),
    lint:AC.lint,algoPass:AC.pass,algoFails:AC.fails,fix
  };
  hard.pass={
    fixes:Object.values(fix).filter(x=>'pass' in x).every(x=>x.pass),
    nearTerm:nearTermTitleEqual&&nearTermOutputEqual,
    sameProvider:/deepseek/i.test(String(projectionUser?.provider))&&projectionUser?.depthVersion===CV&&projectionUser?.source==='llm'&&projMaxHi>0&&projMaxHi<=520,
    compliance:hard.noGuarantee&&hard.noTerminalRichest&&hard.noAvoidance&&hard.noRaw40,
    terminal:hard.planLastTerminal&&hard.projLastTerminal,
    lint:AC.lint.pass,algo:AC.pass,acts13Kept:retain.every(r=>r.changedFields.every(f=>['narrative','dip'].includes(f))),appValid
  };
  hard.readyForProductReview=Object.values(hard.pass).every(Boolean);

  await writeFile(`${OUT}/plan-deepseek.json`,JSON.stringify(redact({id:'plan-deepseek-story-arc-r2',provider:'deepseek',model:ds.model,basePlan:BASE_PLAN,act4Route,patchLog,retain,narr:hard.planNarr,perChapterNarr:AC.perNarr,depthVersion:CV,narrativeMode:'story-arc',emotionSource:'rule-layer',ruleFacts,story:planStory}),null,2));
  await writeFile(`${OUT}/proj-deepseek.json`,JSON.stringify(redact({...projectionUser,chosenRun:pi+1,ruleFactsProj:chosenProj.rfProj,internalNote:'raw horizon 仅内部；每段「这一幕的第一步」由规则层逐字注入 plan 同幕 firstStep（firstStepNumberExempt 列出因此带入的规划原文数量词）'}),null,2));
  await writeFile(`${OUT}/run-rates.json`,JSON.stringify(redact({act4Drafts:drafts.map(d=>({ms:d.ms,chk:d.chk,raw:d.raw})),fullDrafts,projRuns:projRuns.map((p,i)=>({run:i+1,projectionUser:{...p.projectionUser,longForm:undefined},check:projRate[i]}))}),null,2));
  await writeReports({hard,planStory,planNear,projectionUser,AC,fix,rawHorizonInternal:chosenProj.rawHorizonInternal});
  log({done:true,out:OUT,ready:hard.readyForProductReview,pass:hard.pass,algoFails:AC.fails,rates:{act4:fix.f6_rates.act4FirstDraft.pass+'/'+fix.f6_rates.act4FirstDraft.n,full:fix.f6_rates.fullPlanFirstDraft.pass+'/'+fix.f6_rates.fullPlanFirstDraft.n,proj:fix.f6_rates.proj.pass+'/'+fix.f6_rates.proj.n}});
}

async function writeReports({hard,planStory,planNear,projectionUser,AC,fix,rawHorizonInternal}){
  const PF=b=>b?'PASS':'FAIL';const now=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});const ch=planStory.chapters;const R=fix.f6_rates;
  const rateRow=(name,x,def)=>`| ${name} | ${x.n} | ${x.pass} | ${Math.round(100*x.pass/Math.max(1,x.n))}% | ${def} |`;
  const rateTable=`| 口径 | N | 直过 | 直过率 | 定义 |\n|---|---|---|---|---|\n${rateRow('plan 第四幕首稿（本轮采用路径）',R.act4FirstDraft,'第一到第三幕定稿为上下文，第四幕单次调用，不修补；过第四幕全部检查（≥900、G4–G6 挡路+动作+场面、元词0、高光≤2且峰后收束、回扣、第一步）')}\n${rateRow('plan 整稿首稿（参考，未采用）',R.fullPlanFirstDraft,'新契约一次生成四幕，无 repair/扩写/定点修补；过全部 plan 侧 algoCheck')}\n${rateRow('proj 全流程',R.proj,'独立跑 generateStoryLLM（含字段级重试，无外层整段重跑）；过 proj 全部检查（第一步逐字同源、每周固定0、图≤4、低谷只在第3段、人称、元词0、source=llm、validation 过）')}`;
  let sc=`# P0-29 故事经过样 r2 · 定点修补自检（v1.26.59 → r2）\n\n- 时间：${now}（Asia/Shanghai，UTC+8）\n- tip \`${TIP}\`（本地未提交改动）· 契约 \`${CV}\` · DeepSeek plan 第四幕 + proj 本地直调\n- 方案：**b（保留四幕，第四幕扩写≥${ACT4_MIN}）**；第一到第三幕保留（仅两处元词句替换）\n- readyForProductReview：**${hard.readyForProductReview?'YES':'NO'}**\n\n## 产品 6 条\n\n| # | 项 | 结果 | 说明 |\n|---|---|---|---|\n`;
  sc+=`| 1 | 元词禁令 | ${PF(fix.f1_meta.pass)} | 正文元词命中=${fix.f1_meta.metaCount}（plan 全字段 + proj 四段）；低谷换来的写成场面：「${fix.f1_meta.dipPayoff}」 |\n`;
  sc+=`| 2 | 第四幕节奏（方案 b） | ${PF(fix.f2_act4.pass)} | 第四幕 ${fix.f2_act4.act4Han} 汉字；${fix.f2_act4.gates.map(r=>`${r.gate}[${r.category.join('/')}]挡路+动作+场面=${r.ok}`).join('；')} |\n`;
  sc+=`| 3 | proj 第一步同源 | ${PF(fix.f3_firstStep.pass)} | 四段逐字=${(fix.f3_firstStep.rows||[]).map(r=>r.verbatim&&r.projFirstStep===r.planFirstStep).join('/')}；第一段≡今天卡（复合）=${fix.f3_firstStep.seg1Today} |\n`;
  sc+=`| 4 | proj 去模板 | ${PF(fix.f4_residue.pass)} | 每周固定 proj=${fix.f4_residue.weekly} plan=${fix.f4_residue.weeklyPlan}；回扣“那张…图” 各段=${JSON.stringify(fix.f4_residue.cbPer)} 合计=${fix.f4_residue.cbTotal}（≤4；“图”字总数=${fix.f4_residue.tuCount}）；低谷 plan 幕=${JSON.stringify(fix.f4_residue.planDipActs)} proj 段=${JSON.stringify(fix.f4_residue.dipSegs)}；人称一致=${(fix.f4_residue.person||[]).every(p=>p.ok)}（过渡句：「${fix.f4_residue.person?.[0]?.transition||''}」） |\n`;
  sc+=`| 5 | 情绪规则层 | ${PF(fix.f5_emotion.pass)} | emotion=${JSON.stringify(fix.f5_emotion.emotions)} → 幕末 ${JSON.stringify(fix.f5_emotion.emotionEnd)}（source=rule-layer）；高光 ${fix.f5_emotion.highlights.length} 处；峰后安静收束=${AC.act4.quietAfterPeak} |\n`;
  sc+=`| 6 | 直过率表 | 附 | 见下（本轮不卡） |\n\n## 直过率\n\n${rateTable}\n\n`;
  sc+=`## 其他硬条（回归）\n\n| 项 | 结果 | 说明 |\n|---|---|---|\n| 第一到第三幕保留 | ${PF(hard.pass.acts13Kept)} | ${hard.retain.map(r=>`第${r.act}幕 改动字段=${JSON.stringify(r.changedFields)}`).join('；')}（emotion 由规则层覆盖不计） |\n| 近端同源 | ${PF(hard.pass.nearTerm)} | title=${hard.nearTermTitleEqual} output=${hard.nearTermOutputEqual} source=${hard.nearTermSource} |\n| 同 provider 同契约 | ${PF(hard.pass.sameProvider)} | proj=${hard.projProvider}/${hard.projDepthVersion}/${hard.projSource}；maxHi=${hard.projMaxHi} |\n| 合规 | ${PF(hard.pass.compliance)} | 无保证=${hard.noGuarantee} 无已/必然首富=${hard.noTerminalRichest} 无回避=${hard.noAvoidance} 无raw40=${hard.noRaw40} |\n| 终局朝向 | ${PF(hard.pass.terminal)} | plan 第四幕=${hard.planLastTerminal} proj 终段=${hard.projLastTerminal} |\n| 禁清单体 | ${PF(hard.pass.lint)} | 命中=${hard.lint.hitCount} ____=${hard.lint.blanks} 标签=${hard.lint.narrLabels} 列表=${hard.lint.listLines} 宿命词=${hard.lint.forbidden.length} |\n| 前端可接收 | ${PF(hard.appValid)} | ${hard.appValidError||'normalize+validate 通过'} |\n| 全量 algoCheck | ${PF(hard.algoPass)} | ${hard.algoFails.length?hard.algoFails.join('；'):'全部通过'} |\n\n`;
  sc+=`## 第四幕三道门（逐字）\n\n${fix.f2_act4.gates.map(r=>`- **${r.gate}**（${r.category.join('/')}）\n  - 挡路：${r.obstacle}\n  - 我的动作：${r.move}\n  - 场面：${r.scene}`).join('\n')}\n- 安静收束：${AC.act4.terminalDoor}\n\n## 第一步同源（plan ↔ proj，逐字）\n\n| 段 | plan firstStep | proj 注入 | 逐字 | 字节 plan/proj |\n|---|---|---|---|---|\n${(fix.f3_firstStep.rows||[]).map(r=>`| ${r.seg} | ${r.planFirstStep} | ${r.projFirstStep} | ${r.verbatim&&r.projFirstStep===r.planFirstStep} | ${r.bytesPlan}/${r.bytesProj} |`).join('\n')}\n\n- 今天卡：「${planNear?.today?.title}」+ 例句「${ch[0].quests?.[0]?.example}」→ 复合=「${AC.todayComposite}」；= 第一幕第一步：${AC.todayCardSame}；= proj 第一段第一步：${fix.f3_firstStep.seg1Today}\n- 注：今天卡标题是“说出那句转向的话”的缩写，字节不等于第一步；“转向的话”即卡上例句原文，按“标题前半 + 例句”复合比对后逐字相等。proj 注入的第一步来自规划原文，其中的中文数量词（如“四块”）为规划同源文本，numberLock 豁免并记账：${JSON.stringify(projectionUser.firstStepNumberExempt||[])}\n\n## 第一到第三幕的两处替换\n\n${hard.patchLog.map(p=>`- 第${p.act}幕 ${p.field}（${p.why}）：「${p.from}」→「${p.to}」 applied=${p.applied}`).join('\n')}\n\n## raw40\n\n- 用户可见含 raw：${!hard.noRaw40}；内部 raw：${JSON.stringify(rawHorizonInternal)}\n`;
  await writeFile(`${OUT}/self-check.md`,sc);
  await writeFile(`${OUT}/self-check.json`,JSON.stringify(redact({at:new Date().toISOString(),tip:TIP,contractVersion:CV,option:'b',hard,readyForProductReview:hard.readyForProductReview}),null,2));
  let sm=`# Micheal 五维打分卡 · 「成为世界首富」故事经过样 r2\n\n- 契约 \`${CV}\` · DeepSeek · 模拟非承诺、非投资建议\n- 档案：你本人原型（42岁；逸泓水务环境≈5人；逸泓智能无员工）· 周界约10年（520周）\n- 请按 1–5 分打\n\n| 维 | 问法 | 分数 |\n|---|---|---|\n| 详细 | 读起来像不像一条有血肉的轨迹 |  |\n| 可信 | 以你本人条件，经过与代价是否说得通 |  |\n| 可落地 | 今天/本周是否真能动手、知道怎样算做到 |  |\n| 好玩 | 是否想继续往下看 |  |\n| 愿再打开 | 还愿不愿再打开 |  |\n\n---\n\n## 故事：${planStory.title||''}\n\n`;
  for(const c of ch)sm+=`### ${c.name}（${c.period}）\n\n${c.narrative}\n\n`;
  sm+=`## 今天 / 本周（场面）\n\n- **${planNear?.today?.title}**\n  - 怎样算做到：${planNear?.today?.output}\n  - 可以这样说：${ch[0]?.quests?.[0]?.example||''}\n- **${planNear?.week?.title}**\n  - 怎样算做到：${planNear?.week?.output}\n  - 可以这样说：${ch[0]?.quests?.[1]?.example||''}\n\n## 推演（四段）\n\n${projectionUser.perNode.map((n,i)=>`### 第${i+1}段 ${n.title}\n\n${n.situation}\n\n${n.action}\n\n${n.change}\n\n${n.cost}`).join('\n\n')}\n\n## r2 改了什么\n\n1. 正文不再出现“高光 / 第N道门 / 门前 / 全篇 / 之所以可能”等结构词；第三幕“低谷里换来了什么？”的设问改成一个场面。\n2. 第四幕扩到 ${AC.act4.han} 字：上市、进福布斯榜、进前十，每一步先写挡在前面的现实，再写你做了什么，最后才是别人看见的场面；之后安静收住。\n3. 推演四段的“第一步”和规划同一幕一字不差，第一段就是今天那件事。\n4. 推演里去掉了“每周固定”，那张图只在开头、最难那段和结尾出现，“低谷”只在第三段。\n`;
  await writeFile(`${OUT}/SCORECARD.md`,sm);
  await writeFile(`${OUT}/pm-review-facts.md`,`# 故事经过样 r2 · 短摘（产品快查 6 条）\n\n- tip \`${TIP}\`（本地未提交）· 契约 \`${CV}\` · 方案 b · 第一到第三幕保留（两处元词句替换）\n- ① 元词命中=${fix.f1_meta.metaCount} · 低谷换来=场面「${fix.f1_meta.dipPayoff}」\n- ② 第四幕=${fix.f2_act4.act4Han} 汉字 · ${fix.f2_act4.gates.map(r=>`${r.gate}:${r.category.join('/')} 挡路+动作=${r.ok}`).join(' · ')}\n- ③ proj 第一步逐字同源=${(fix.f3_firstStep.rows||[]).map(r=>r.verbatim&&r.projFirstStep===r.planFirstStep).join('/')} · 第一段≡今天卡(复合)=${fix.f3_firstStep.seg1Today}\n- ④ 每周固定=${fix.f4_residue.weekly} · 那张图=${fix.f4_residue.cbTotal}（${JSON.stringify(fix.f4_residue.cbPer)}）· 低谷 plan 幕${JSON.stringify(fix.f4_residue.planDipActs)} / proj 段${JSON.stringify(fix.f4_residue.dipSegs)} · 人称一致=${(fix.f4_residue.person||[]).every(p=>p.ok)}\n- ⑤ emotion=${JSON.stringify(fix.f5_emotion.emotions)}→${JSON.stringify(fix.f5_emotion.emotionEnd)}（规则层）· 高光=${fix.f5_emotion.highlights.length} · 峰后收束=${AC.act4.quietAfterPeak}\n- ⑥ 直过率：第四幕首稿 ${R.act4FirstDraft.pass}/${R.act4FirstDraft.n} · 整稿首稿 ${R.fullPlanFirstDraft.pass}/${R.fullPlanFirstDraft.n} · proj ${R.proj.pass}/${R.proj.n}\n- readyForProductReview=${hard.readyForProductReview}\n- 不热更、不 merge、不开 B、不做 32b、不催 Micheal\n`);
  await writeFile(`${OUT}/PRODUCT-NOTES.md`,`# 故事经过样 r2 · 产品笔记\n\n- 时间：${now}（Asia/Shanghai，UTC+8）\n- 分支 \`feat/p0-29-c-prime-32b\` tip \`${TIP}\`；本地未提交改动（未 commit/merge/热更，未碰 A2·8443，未开 B，未做 32b）\n- 契约：\`${CV}\`（story-arc-2 → 3；仅 ruleFacts.storyArc 路径生效，默认 \`${DEPTH_CONTRACT_VERSION}\` 不变）\n\n## a/b 选择\n\n- **选 b**：保留四幕，第四幕扩写到≥${ACT4_MIN}（本样 ${AC.act4.han} 汉字）；G4/G5/G6 各有一个挡路现实（类别：${fix.f2_act4.gates.map(r=>r.gate+'='+r.category.join('/')).join('，')}）+ 你本人一个动作 + 场面；不编数字。生成路径：${R.act4Route}。\n\n## 第一到第三幕是否保留\n\n- 保留。只做两处确定性替换（第二幕首句“第一道门”、第三幕“低谷里换来了什么？”设问 → 场面；dip.payoff 同步），其余逐字未改；emotion 字段改为规则层落值。\n${hard.patchLog.map(p=>`  - 第${p.act}幕 ${p.field}：「${p.from}」→「${p.to}」`).join('\n')}\n- 改动字段核对：${hard.retain.map(r=>`第${r.act}幕 ${JSON.stringify(r.changedFields)}`).join('；')}\n\n## 直过率表（不卡本轮）\n\n${rateTable}\n\n## 改动文件\n\n- \`worker/depth-contract.js\`：契约 story-arc-3；新增 STORY_ARC_META_RE（元词）/ STORY_ARC_TEMPLATE_RE（每周固定）/ STORY_ARC_META_PROMPT；叙事算法提示去掉诱发“之所以可能/门前”的说法，加入同幕多门“挡路现实→我的动作→场面”与第四幕字数线；proj addon 改为：LLM 不写第一步、低谷只在低谷段、回扣物件按段限次、人称过渡、去“每周固定”\n- \`worker/projection-story.js\`：storyArc 时系统提示去掉“每周固定的时间”示例与“每周具体做的事”口径、删除“生活节奏：每周有固定的投入时间”事实；字段级校验（元词/每周固定/低谷越段/回扣超次/人称/LLM 自写第一步 → 带原因重试）；生成后由规则层把 plan 同幕 firstStep 逐字接在行动末并重算 longForm（firstStepNumberExempt 记账）\n- \`scripts/p0-29-story-arc-r2.mjs\`（新建；旧 sample 脚本未改）\n\n## 已知限制\n\n- 今天卡标题是缩写（“说出那句转向的话”），与第一步字节不等；按“标题前半 + 卡上例句”复合比对逐字相等。若要求字节级相等，需改今天卡标题（属第一幕任务字段，本轮按“第一到第三幕不动”未改）。\n- proj 注入的第一步含规划原文中文数量词（如“四块”“一个业主”），属规划同源文本，豁免 numberLock。\n- worker/index.js（打包产物）未同步；上线需另排构建+热更。\n`);
}

main().catch(e=>{console.error(String(e?.stack||e));process.exit(1);});
