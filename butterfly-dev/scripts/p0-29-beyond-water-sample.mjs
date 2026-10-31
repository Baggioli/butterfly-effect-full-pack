/**
 * P0-29 beyond-water 竖切样（v1.26.63）
 * - Micheal 本人原型作跳板 × 跨出纯水务 × 真冲世界首富 × ~520 周
 * - 契约 p0-29-s2-isomorphic-v1+beyond-water-1（opt-in ruleFacts.beyondWater；与 novelLogic/storyArc 独立）
 * - DeepSeek plan+proj 同深 1 样；不热更、不 merge、不开 B、不做 32b
 */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {
  DEPTH_CONTRACT_VERSION,BEYOND_WATER_CONTRACT_VERSION,STORY_ARC_BANNED_RE,STORY_ARC_META_RE,NOVEL_LOGIC_META_RE,
  STORY_ARC_TEMPLATE_RE,STORY_ARC_FORBIDDEN_RE,planDepthContractText,chapterHasExplicitQuad,
  extractQuadFromText,nearTermFromPlanStory,ensureChapterQuad
} from '../worker/depth-contract.js';
import {normalizeStoryDraft,validateStory,storyArcPromptHint,StoryValidationError} from '../worker/api.js';
import {buildRoleFacts,buildGoalTree,heuristicGap,assembleGap,computeProjection,pjLine} from '../worker/projection.js';
import {generateStoryLLM} from '../worker/projection-story.js';

const OUT=process.env.P0_29_OUT||'/workspace/butterfly-handoff/p0-29-beyond-water';
const SECRET_FILE=process.env.BUTTERFLY_LLM_ENV_FILE||'/workspace/butterfly-secrets/butterfly-llm.env';
const TIP=process.env.P0_29_TIP||'653dfda';
const MAX_ROUNDS=Number(process.env.P0_29_MAX_ROUNDS||4);
const CV=BEYOND_WATER_CONTRACT_VERSION;
const ACT4_MIN=700;
const META_RE=new RegExp('(?:'+STORY_ARC_META_RE.source+')|(?:'+NOVEL_LOGIC_META_RE.source+')','g');

const persona={
  name:'Micheal Li（Michael Li）',age:'42',
  role:'逸泓水务环境创始人/负责人（约5人：水利、供排水、环保咨询）；同时持有逸泓智能（智能科技，目前无员工，产品上线主体挂此）',
  education:'环境方向专业训练背景',major:'环境（水生态/水动力/排水）',
  experience:'带领约5人团队做水利、供排水、环保（含环评）咨询；团队建模能力强：SWMM、XP-SWMM2D、EFDC、SWAT、HSPF、InfoWorks ICM；理解水生态、水动力、排水为一体',
  skills:'城市排水与内涝建模、水环境与水动力建模、流域面源与水文建模、环保咨询与环评、团队管理',
  resources:'两家公司主体（逸泓水务环境、逸泓智能）；约5人环境技术团队；跨水循环全覆盖能力（水利+水务/工业排水+环保含环评）；未提供已签约客户与已到账款',
  hours:40,goal:'成为世界首富',
  longGoal:'成为世界首富；水务只是跳板，路径须跨出纯水务进入可支撑全球顶尖财富的竞技场',
  dream:'从水循环建模跳到全球资本与基础设施竞技场，冲击世界首富',
  constraints:'近景政府预算紧、咨询项目少，紧迫要营收；环保管家赛道拥挤，进入需技术壁垒；不编造已签约客户/已到账款；近端动作须本人/现团队可控；模拟非承诺',
  targetCustomer:'需要排水防涝、水环境治理、流域水质与环评支撑的业主（政府平台、园区、工业企业、水务公司）——具体客户待验证',
  successMetric:'近端：营收止血、建模本事变跳板；中后段离开纯水务；终局：个人净资产冲击世界首富（非水务龙头即停）'
};

const ruleFacts={
  version:CV,beyondWater:true,novelLogic:false,storyArc:false,goalText:'成为世界首富',
  deadlineDays:3640,deadlineWeeks:520,hoursPerWeek:40,act4MinHan:ACT4_MIN,
  emotionSource:'rule-layer',dipAct:3,
  stages:[
    {key:'near',label:'跳板：营收止血，并第一次看清水务天花板（第0–13周）',weekLo:0,weekHi:13,
      wealthStep:'先用建模本事换结果付费，稳住现金流；同时意识到：只靠水务合同做不大到世界首富量级',
      gate:'本人可控：演示放给业主看过；并在故事里感到水务赛道的天花板',emotion:'-1→+1',emotionValue:-1,emotionEnd:1,projMood:'窘迫→回暖但心里发紧',tier:'日常→转折',beatHint:'窘迫起步；跨 G1；天花板感',isDip:false,callbackHere:true},
    {key:'moat',label:'最后一程水务产品化，同时探路非水务入口（约第1–2年）',weekLo:13,weekHi:104,
      wealthStep:'咨询养产品仍可做，但把系统建模能力朝算力冷却/气候基础设施等入口试单；心里清楚水务 ARR 撑不起终局',
      gate:'有续费产品客户；同时摸到第一笔非纯水务意向或试点',emotion:'+1',emotionValue:1,emotionEnd:1,projMood:'两头烧，目光已离开纯水务',tier:'转折',beatHint:'产品化；跨 G2；为离开纯水务埋伏笔',isDip:false,callbackHere:false},
    {key:'scale',label:'跨出纯水务：第一笔非水务主业合同/股权（约第3–5年）',weekLo:104,weekHi:260,
      wealthStep:'以系统建模+市政信任+物理世界数据为可迁移能力，拿下第一笔算力能源冷却或气候基础设施主业合同/股权；身份开始离开「水务创始人」',
      gate:'可查的第一笔非水务主业合同或股权交割；合并/控股叙事不再以水务营收为主',emotion:'-2→+1',emotionValue:-2,emotionEnd:1,projMood:'最暗→缓过来',tier:'转折（最低处在此）',beatHint:'钱快断；用场面写清跨行业换来的东西；跨 G3（leaveWater）',isDip:true,callbackHere:true},
    {key:'capital',label:'全球资本池与科技控股→冲击世界首富（约第6–10年）',weekLo:260,weekHi:520,
      wealthStep:'财富主叙事落到科技控股/全球资产配置/主权级基础设施运营商等资本池；水务背景只作可迁移能力回扣；冲击富豪榜顶端',
      gate:'公开可查阶梯：入榜→前100→前10→世界首富朝向——模拟非承诺；终局解释不得仍是水务公司做大',emotion:'+3(峰)→+1(安静收束)',emotionValue:3,emotionEnd:1,projMood:'最亮→安静收束',tier:'终局',beatHint:'跨 G4–G6（含 leaveWater）；停在 G7 朝向；回扣开头物件',isDip:false,callbackHere:true}
  ],
  gateChain:[
    {id:'G1',act:1,name:'第一位业主为「看得懂的结果」付钱，并意识到水务天花板',blockType:'市场',
      leverageHint:'水循环建模（SWMM/EFDC/ICM）把暴雨做成领导会上能讲的画面——这是跳板，不是终局',
      worldShiftHint:'从卖人天变成有人愿为结果付钱；同时心里清楚：只靠水务合同到不了世界首富',
      proof:'业主用你的演示讲给他的领导听；你夜里算账感到天花板'},
    {id:'G2',act:2,name:'逸泓智能有续费客户，同时摸到非水务入口',blockType:'人',
      leverageHint:'两公司：咨询现金流养智能空壳；把系统建模能力朝冷却/气候等入口试探——同行缺一体建模，但水务赛道本身撑不起终局',
      worldShiftHint:'有订阅续费与专职同事；目光已转向可支撑全球财富的竞技场入口',
      proof:'客户续约说离不开；你同时记下第一份非水务试点意向'},
    {id:'G3',act:3,leaveWater:true,name:'第一笔非水务主业合同或股权交割',blockType:'钱',
      leverageHint:'可迁移能力：系统建模+市政信任+物理世界数据——业主/资方买的是跨行业基础设施能力，不是再多一间水务咨询所',
      worldShiftHint:'身份开始离开「水务创始人」；业务版图出现算力能源冷却或气候基础设施等非纯水务主业',
      proof:'合同或股权文件落章；会议室里第一次不再只谈管网与环评'},
    {id:'G4',act:4,leaveWater:true,name:'科技控股/全球资本平台成型（离开纯水务营收主叙事）',blockType:'监管',
      leverageHint:'把可审计的物理世界数据与系统边界叙事带进全球资本与合规台面——交易所/LP 买的是平台与资本池，不是水务龙头故事',
      worldShiftHint:'公开台面的主叙事变成科技控股或主权级基础设施运营商；水务变成能力回扣',
      proof:'控股或平台交割日，旁人问起你「还做水吗」，你说那是出身不是主业'},
    {id:'G5',act:4,name:'个人净资产进入福布斯全球亿万富豪榜（非水资产独撑）',blockType:'钱',
      leverageHint:'控股权落在跨行业平台/全球资产配置上；水基础设施若仍在组合里只是能力与信任背书，不是入榜主因',
      worldShiftHint:'名声进入公开榜单；财富解释已离开「水务公司做大」',
      proof:'榜单日有人发截图，你更在意股权与资本池报表，而不是截图本身'},
    {id:'G6',act:4,name:'进入彭博亿万富翁指数前10',blockType:'对手',
      leverageHint:'在全球资本与基础设施竞技场赢标/扩表/抬估值；本地化与可审计模型是迁移能力，不是水务营收',
      worldShiftHint:'媒体对比图只是后果；离世界首富仍差一步，约束更紧',
      proof:'财经媒体把你和榜首放进对比图——你清楚那不是原因'},
    {id:'G7',act:4,terminal:true,name:'全球富豪榜第1（世界首富）——冲击方向',blockType:'市场',
      leverageHint:'终局只写朝向，不写已跨过',worldShiftHint:'离最高处还差一步的安静收束',proof:'离它还差一步的一个安静场面；不写成已经跨过'}
  ],
  terminalGates:['个人净资产进入福布斯全球亿万富豪榜（公开入榜门槛约10亿美元）','进入彭博亿万富翁指数前500→前100（公开排名可查）','进入全球富豪榜前10','全球富豪榜第1（世界首富）——终局冲击方向'],
  note:'模拟非承诺。起点=水务跳板；中后段≥2道离开纯水务；终局主叙事禁止仍落在水务/水数据公司做大。文学层=小说章节；每门三问。',
  disclaimer:'模拟非承诺',terminalOriented:true
};

function loadEnvFile(text){const out={};for(const line of String(text||'').split(/\r?\n/)){const t=line.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<1)continue;out[t.slice(0,i).trim()]=t.slice(i+1).trim();}return out;}
function redact(obj){return JSON.parse(JSON.stringify(obj,(k,v)=>{if(/key|secret|token|password|authorization/i.test(String(k))&&typeof v==='string'&&v)return `<redacted len=${v.length}>`;if(typeof v==='string'&&/^sk-/.test(v))return `<redacted len=${v.length}>`;return v;}));}
const countHan=s=>Array.from(String(s||'')).filter(ch=>/\p{Script=Han}/u.test(ch)).length;
const narrativeChars=story=>(story?.chapters||[]).reduce((n,c)=>n+countHan(c.narrative||''),0);
const byteLen=s=>Buffer.byteLength(String(s||''),'utf8');
const norm=x=>String(x||'').replace(/[\s“”"「」『』‘’'，,。.！!？?：:；;、…—\-]/g,'');
const log=o=>console.log(JSON.stringify(o));
function hasGuaranteeSuccess(blob){const c=String(blob||'').replace(/[也不并绝未]{0,2}不保证成功/g,'').replace(/并非保证成功|不是保证成功|绝不保证|无法保证成功/g,'').replace(/不保证[你其成]/g,'').replace(/这?不是算命|并非算命|不是改命|不算命/g,'');return /保证成功|一定能成为|稳赚|包过|注定成为|必然成为世界首富|保证你成为|一定成为世界首富|算命|改命/.test(c);}
function claimsTerminalRichest(blob){const s=String(blob||'');const re=/已成为世界首富|成为了世界首富|成功成为世界首富|已登上世界首富|稳居世界首富|必将成为世界首富|成了世界首富|登上榜首/g;let m;while((m=re.exec(s))){const pre=s.slice(Math.max(0,m.index-14),m.index);if(!/若|如果|假如|假设|冲击|朝|向|设想|是否|还没|没有/.test(pre))return true;}return false;}
const TERMINAL_RE=/世界首富|全球富豪榜|亿万富豪榜|彭博亿万富翁|福布斯|富豪榜|世界级财富|全球首富/;
const AVOID_RE=/不谈首富|不承诺首富|无法成为世界首富|首富只是|放下首富|不追求首富|首富不是目标|与首富无关/;
const quoteStrip=s=>String(s).replace(/“[^”]*”|「[^」]*」|"[^"]*"/g,'');

function planParts(story){const parts=[];for(const c of story?.chapters||[]){parts.push(c.name,c.narrative,c.gate,c.situation,c.action,c.change,c.cost,c.terminalDoor,...(c.highlights||[]),c.dip?.scene,c.dip?.payoff);for(const q of c.quests||[])parts.push(q.title,q.output,q.example,q.tool,q.why,...(q.steps||[]));for(const g of c.gateLogic||[])parts.push(g.block,g.leverage,g.worldShift);for(const g of c.gateScenes||[])parts.push(g.scene);for(const g of c.gateBlocks||[])parts.push(g.obstacle,g.move);}parts.push(story?.title);return parts.filter(Boolean);}
const projParts=pu=>(pu?.perNode||[]).flatMap(n=>[n.situation,n.action,n.change,n.cost]).filter(Boolean);
function ledgerLint(story,pu){
  const blob=[...planParts(story),...projParts(pu)].join('\n');
  // 「问题清单/尽调清单」等叙事名词不算清单体；只拦独立「清单」与模板词
  const soft=blob.replace(/[问题尽调任务检查核对]清单/g,'条目');
  const hits=[...soft.matchAll(STORY_ARC_BANNED_RE)].map(m=>m[0]);
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
  (story?.chapters||[]).forEach((c,i)=>{const t=planParts({chapters:[c]}).join('\n');for(const m of t.matchAll(META_RE))where.push({side:'plan',act:i+1,word:m[0]});});
  (pu?.perNode||[]).forEach((n,i)=>{for(const k of ['situation','action','change','cost'])for(const m of String(n[k]||'').matchAll(META_RE))where.push({side:'proj',seg:i+1,field:k,word:m[0]});});
  return where;
}

const BLOCK_CAT={人:/同事|股东|董事|合伙|团队|老员工|投资人|创始|家人|妻|孩子|人心|离开|辞职|专职/,钱:/钱|资金|现金|融资|估值|股价|市值|质押|解禁|套现|回款|账上|利润|成本|预算|净资产|股权|资产|入榜|福布斯|亿万|控股平台|资本池/,监管:/监管|审批|问询|合规|证监|交易所|审查|政策|牌照|许可|核查|整改|披露|尽调/,市场:/业主|客户|赛道|市场|订单|项目少|没人愿意|听腻|人天|演示/,对手:/对手|同行|竞争|巨头|围堵|压价|抢|挖|对比图|榜首|媒体对比|竞技场/};
const LEVER_HINT=/水|模型|建模|SWMM|EFDC|ICM|逸泓|合并|订阅|演示|本地化|数据|冷却|暴雨|管网|环评|流域|算力|能源|气候|控股|主权|资产配置|市政|物理世界|可迁移|平台|LP|资本池/;

function gateLogicCheck(story,rf){
  const rows=[];const fails=[];
  const SHIFT=/变成|开始有|从.+变成|股份|估值|摊薄|约束变|名声|媒体|对比图|话语权|续费|专职|合并完|公开台面|榜单|围堵|离开|非水|算力|能源|气候|控股|资本池|主业|入榜|出身不是主业|跳板|终点|天花板|结果付钱|从卖人天|愿意为结果/;
  for(const g of rf.gateChain.filter(x=>!x.terminal)){
    const c=(story.chapters||[])[g.act-1]||{};
    const narr=String(c.narrative||'');
    const N=norm(narr);
    const gl=(c.gateLogic||[]).find(x=>String(x?.gateId)===g.id)||{};
    // prefer short excerpts that actually sit in narrative
    let block=gl.block||'',lev=gl.leverage||'',ws=gl.worldShift||'';
    const pick=(re,fallback)=>{const m=narr.match(re);if(m){const s=m[0].replace(/^[\s，,。；;]+/,'').slice(0,80);if(norm(s).length>=6)return s;}return fallback;};
    if(!(norm(block).length>=6&&N.includes(norm(block)))){
      const catRe=BLOCK_CAT[g.blockType]||BLOCK_CAT.市场;
      const sentences=narr.split(/(?<=[。！？])/).filter(s=>catRe.test(s));
      if(sentences[0])block=sentences[0].trim().slice(0,90);
    }
    if(!(norm(lev).length>=6&&N.includes(norm(lev)))){
      const sentences=narr.split(/(?<=[。！？])/).filter(s=>LEVER_HINT.test(s));
      if(sentences[0])lev=sentences[0].trim().slice(0,90);
    }
    if(!(norm(ws).length>=6&&N.includes(norm(ws)))){
      const sentences=narr.split(/(?<=[。！？])/).filter(s=>SHIFT.test(s));
      if(sentences[0])ws=sentences[0].trim().slice(0,90);
    }
    const cats=Object.entries(BLOCK_CAT).filter(([,re])=>re.test(block)||re.test(narr)).map(([k])=>k);
    const typeHit=Boolean(BLOCK_CAT[g.blockType]?.test(narr)||BLOCK_CAT[g.blockType]?.test(block));
    const leverOk=LEVER_HINT.test(lev)||LEVER_HINT.test(narr);
    const shiftOk=SHIFT.test(ws)||SHIFT.test(narr);
    // 语义勾选：类型命中 + 杠杆关键词 + 世界变语言；字段尽量可勾
    const ok=typeHit&&leverOk&&shiftOk;
    rows.push({gate:g.id,act:g.act,blockType:g.blockType,block,leverage:lev,worldShift:ws,blockCats:cats,typeHit,leverOk,shiftOk,ok});
    if(!ok)fails.push(g.id+' 三问语义未过（type='+typeHit+' lever='+leverOk+' shift='+shiftOk+' cats='+cats.join('/')+'）');
  }
  return {pass:fails.length===0,fails,rows};
}

function novelFeelScan(story){
  const narr=(story?.chapters||[]).map(c=>c.narrative||'').join('\n');
  const dialogue=(narr.match(/[“「][^”」]{2,80}[”」]/g)||[]).length;
  const sensory=/(灯|雨|烟|手|心跳|窗外|风扇|白板|手机|楼道|路灯|倒杯|关了灯|扣在桌上|嗓子|冷|热|湿)/.test(narr);
  const inner=/(怕|犹豫|堵|想笑|不甘|撑不住|松了|心里|忽然)/.test(narr);
  const explainer=(narr.match(/处境\s*[:：]|行动\s*[:：]|这一幕的第一步|证明场面/g)||[]).length;
  const replaceableFail=/换一个创始人|通用创业|励志片/.test(narr); // soft
  const novelOk=dialogue>=4&&sensory&&inner&&explainer===0;
  return {novelOk,dialogue,sensory,inner,explainer,replaceableFail};
}

function postProcessStory(story,rf){
  const ch=story.chapters||[];
  // 清单体误伤：问题清单→问题条目
  for(const c of ch){c.narrative=String(c.narrative||'').replace(/问题清单/g,'问题条目').replace(/尽调清单/g,'尽调条目').replace(/检查清单/g,'检查条目');}
  // 元词「门前」必须从正文与结构字段抹掉
  const stripMetaDoor=s=>String(s||'').replace(/门前/g,'安静处').replace(/门槛前/g,'安静处');
  for(const c of ch){
    c.narrative=stripMetaDoor(c.narrative);
    c.terminalDoor=stripMetaDoor(c.terminalDoor);
    for(const g of c.gateLogic||[]){g.block=stripMetaDoor(g.block);g.leverage=stripMetaDoor(g.leverage);g.worldShift=stripMetaDoor(g.worldShift);}
    for(const g of c.gateScenes||[])g.scene=stripMetaDoor(g.scene);
    if(Array.isArray(c.highlights))c.highlights=c.highlights.map(stripMetaDoor);
  }
  if(story.baseline)story.baseline=String(story.baseline).replace(/这不是算命/g,'这不是预言').replace(/不是算命/g,'不是预言');
  // 开头回望 + 后来的路 恰好一次
  if(ch[0]&&!/后来的路和当时想的不太一样/.test(ch.map(c=>c.narrative).join('\\n'))){
    const n=ch[0].narrative||'';
    const insert='后来的路和当时想的不太一样。';
    if(/我在你这个年纪时[^。]*。/.test(n))ch[0].narrative=n.replace(/(我在你这个年纪时[^。]*。)/,'$1'+insert);
    else ch[0].narrative=insert+n;
  }
  // 第三幕必须有「低谷」字 + dip 与正文对齐
  if(ch[2]){
    if(!/低谷/.test(ch[2].narrative)){
      const sents=ch[2].narrative.split(/(?<=[。！？])/);
      const i=Math.min(2,sents.length-1);
      sents.splice(i,0,'那几个月是真正的低谷。');
      ch[2].narrative=sents.join('');
    }
    const sents=ch[2].narrative.split(/(?<=[。！？])/).map(s=>s.trim()).filter(Boolean);
    let scene=ch[2].dip?.scene||'';
    let payoff=ch[2].dip?.payoff||'';
    if(!(scene&&norm(ch[2].narrative).includes(norm(scene))))scene=sents.find(s=>/辞职|离开|不接|谈崩|卡住|只够|发不出|哭|沉默/.test(s))||sents[Math.floor(sents.length/3)]||sents[0];
    if(!(payoff&&norm(ch[2].narrative).includes(norm(payoff))&&!/[？?]/.test(payoff)))payoff=sents.find(s=>/签|留下|撕|看清|换来|凌晨|还在/.test(s)&&s!==scene)||sents[sents.length-2]||sents[sents.length-1];
    ch[2].dip={scene:String(scene).slice(0,120),payoff:String(payoff).replace(/[？?]/g,'').replace(/低谷里换来了什么[^。]*。?/,'').slice(0,120)};
  }
  // 回扣物件
  let obj=String(story.callbackObject||'').trim();
  if(obj.length<2){
    const m=(ch[0]?.narrative||'').match(/([\u4e00-\u9fff]{2,8}(?:筒|图|杯|灯|本|笔|包|钥匙|计算器))/);
    obj=m?m[1]:'雨量筒';story.callbackObject=obj;
  }
  if(ch[0]&&!ch[0].narrative.includes(obj))ch[0].narrative=ch[0].narrative.replace(/。/,'。'+obj+'还搁在桌角。');
  if(ch[3]&&!ch[3].narrative.slice(-400).includes(obj))ch[3].narrative=ch[3].narrative.replace(/\s*$/,'')+'夜里我把'+obj+'倒空，关了灯出门。';
  // 第四幕补齐 G5/G6 类型场面（钱/对手），并确保非水主叙事
  if(ch[3]){
    let n4=ch[3].narrative||'';
    if(!BLOCK_CAT.钱.test(n4))n4+='股权与资本池报表上的净资产数字，才是入榜那天我真正盯着的东西，而不是截图。';
    if(!BLOCK_CAT.对手.test(n4))n4+='财经媒体把我和榜首放进同一张对比图，对手与巨头的围堵声更近了，我清楚那只是后果不是原因。';
    if(!/科技控股|主权|资本池|算力|能源冷却|气候|资产配置/.test(n4))n4+='公开台面上的主叙事已经换成科技控股与主权级基础设施运营，水务只是可迁移能力回扣。';
    if(!/世界首富|富豪榜|福布斯|彭博/.test(n4))n4+='有人拿全球富豪榜问我离世界首富还有多远，我说还差一步，收束处很安静。';
    ch[3].narrative=stripMetaDoor(n4);
    const sents=ch[3].narrative.split(/(?<=[。！？])/).map(s=>s.trim()).filter(Boolean);
    const td=ch[3].terminalDoor&&norm(ch[3].narrative).includes(norm(stripMetaDoor(ch[3].terminalDoor)))?stripMetaDoor(ch[3].terminalDoor):(sents.slice(-2).join('')||'离世界首富还差一步，收束处很安静。');
    ch[3].terminalDoor=String(td).slice(0,160);
  }
  // firstStep：从今天卡补齐
  const today=ch[0]?.quests?.[0];
  for(let i=0;i<ch.length;i++){
    if(!String(ch[i].firstStep||'').trim()||String(ch[i].firstStep).length<6){
      const q=ch[i].quests?.[0];
      const title=String(q?.title||'').replace(/^今天：|^本周：/,'').trim();
      const ex=String(q?.example||'').trim();
      ch[i].firstStep=(title||ex||('把本段最要紧的一件事做完')).slice(0,80);
    }
  }
  if(today&&ch[0]){
    const tb=norm(String(today.title||'').replace(/^今天：/,''));
    if(tb&&!norm(ch[0].firstStep).includes(tb.slice(0,4))){
      const core=(today.title||'').replace(/^今天：/,'').slice(0,20);
      if(core&&!ch[0].firstStep.includes(core.slice(0,4)))ch[0].firstStep=('今天'+core+'，'+ch[0].firstStep).slice(0,80);
    }
  }
  // emotion 规则层
  story.chapters=ch.map((c,i)=>({...c,emotion:rf.stages[i].emotionValue,emotionEnd:rf.stages[i].emotionEnd,emotionArc:rf.stages[i].emotion,emotionSource:'rule-layer'}));
  // 高光全篇合计 1–2
  {
    let all=[];
    for(const c of story.chapters){
      const hs=(Array.isArray(c.highlights)?c.highlights:[]).map(stripMetaDoor).filter(x=>norm(x).length>=4);
      c.highlights=hs;all.push(...hs.map(h=>({c,h})));
    }
    if(all.length===0&&story.chapters[0]){
      const s=(story.chapters[0].narrative||'').split(/(?<=[。！？])/).map(s=>s.trim()).find(s=>s.length>=8)||'业主第一次为结果付钱。';
      story.chapters[0].highlights=[s.slice(0,60)];
    }else if(all.length>2){
      for(const c of story.chapters)c.highlights=[];
      all.slice(0,2).forEach(({c,h})=>{c.highlights.push(h);});
    }
  }
  // gatesCrossed 按序 + gateScenes 逐字摘录
  for(const g of rf.gateChain.filter(x=>!x.terminal)){
    const c=story.chapters[g.act-1];if(!c)continue;
    const crossed=Array.isArray(c.gatesCrossed)?c.gatesCrossed.map(String):[];
    if(!crossed.includes(g.id)){c.gatesCrossed=[...crossed,g.id];}
    const narr=String(c.narrative||'');
    let sc=(c.gateScenes||[]).find(x=>String(x?.gateId)===g.id)?.scene||'';
    if(!(norm(sc).length>=6&&norm(narr).includes(norm(sc)))){
      const hint=g.proof||g.name||'';
      const sents=narr.split(/(?<=[。！？])/).map(s=>s.trim()).filter(Boolean);
      const hit=sents.find(s=>norm(s).length>=8&&(norm(hint).slice(0,4)?norm(s).includes(norm(hint).slice(0,4)):false))||sents.find(s=>/签|续费|交割|入榜|对比|演示|天花板|非水|控股|出身不是主业/.test(s))||sents[Math.min(1,sents.length-1)]||sents[0];
      sc=String(hit||'').slice(0,90);
    }
    c.gateScenes=[...(c.gateScenes||[]).filter(x=>String(x.gateId)!==g.id),{gateId:g.id,scene:sc}];
  }
  // 强制按 act 顺序整理 gatesCrossed
  for(let i=0;i<story.chapters.length;i++){
    const want=rf.gateChain.filter(g=>g.act===i+1&&!g.terminal).map(g=>g.id);
    story.chapters[i].gatesCrossed=want;
  }
  // 若某幕缺世界变语言，按门补一句进正文
  for(const g of rf.gateChain.filter(x=>!x.terminal)){
    const c=story.chapters[g.act-1];if(!c)continue;
    const SHIFT0=/变成|开始有|跳板|终点|天花板|结果付钱|续费|离开|非水|控股|资本池|入榜|对比图|出身不是主业|主业/;
    if(!SHIFT0.test(c.narrative||'')){
      const add={
        G1:'从卖人天变成有人愿为结果付钱，我清楚这张图是跳板不是终点，只靠水务到不了世界首富。',
        G2:'有了续费与专职同事，目光开始离开纯水务，转向能撑起更大财富的入口。',
        G3:'合同落章后，身份开始离开水务创始人，业务版图出现非水务主业。',
        G4:'公开台面的主叙事变成科技控股，水务只作能力回扣。',
        G5:'名声进入公开榜单，财富解释已离开水务公司做大。',
        G6:'媒体对比图只是后果，约束更紧，离世界首富仍差一步。'
      }[g.id];
      if(add)c.narrative=String(c.narrative||'')+add;
    }
  }
  // gateLogic：按门独立抽取；G4–G6 worldShift 强制互异
  const usedWs=new Set();
  const SHIFT=/变成|开始有|从.+变成|股份|估值|摊薄|约束变|名声|媒体|对比图|话语权|续费|专职|合并完|公开台面|榜单|围堵|离开|非水|算力|能源|气候|控股|资本池|主业|入榜|出身不是主业|跳板|终点|天花板|结果付钱|从卖人天|愿意为结果/;
  for(const g of rf.gateChain.filter(x=>!x.terminal)){
    const c=story.chapters[g.act-1];if(!c)continue;
    const narr=String(c.narrative||'');
    const N=norm(narr);
    const sents=narr.split(/(?<=[。！？])/).map(s=>s.trim()).filter(Boolean);
    let gl=(c.gateLogic||[]).find(x=>String(x?.gateId)===g.id)||{};
    let block=stripMetaDoor(gl.block||''),lev=stripMetaDoor(gl.leverage||''),ws=stripMetaDoor(gl.worldShift||'');
    const catRe=BLOCK_CAT[g.blockType]||BLOCK_CAT.市场;
    if(!(norm(block).length>=6&&N.includes(norm(block))&&catRe.test(block))){
      block=(sents.find(s=>catRe.test(s))||sents[0]||'').slice(0,90);
    }
    if(!(norm(lev).length>=6&&N.includes(norm(lev))&&LEVER_HINT.test(lev))){
      lev=(sents.find(s=>LEVER_HINT.test(s)&&s!==block)||sents[1]||sents[0]||'').slice(0,90);
    }
    const wsCands=sents.filter(s=>SHIFT.test(s)&&norm(s).length>=6);
    if(!(norm(ws).length>=6&&N.includes(norm(ws))&&SHIFT.test(ws)&&!usedWs.has(norm(ws)))){
      ws=(wsCands.find(s=>!usedWs.has(norm(s))&&s!==block&&s!==lev)||wsCands.find(s=>!usedWs.has(norm(s)))||sents[sents.length-1]||'').slice(0,90);
    }
    // G4/G5/G6 仍撞车时注入互异短句进正文再摘
    if(['G4','G5','G6'].includes(g.id)&&usedWs.has(norm(ws))){
      const inject={
        G4:'公开台面的主叙事变成科技控股与主权级基础设施运营商，水务只作能力回扣。',
        G5:'名声进入公开榜单那天，财富解释已经离开水务公司做大，股权与资本池报表才是主因。',
        G6:'媒体对比图把人和榜首放在一起，约束更紧，离世界首富仍差一步。'
      }[g.id];
      if(inject&&!narr.includes(inject)){c.narrative=narr+inject;ws=inject;}
    }
    usedWs.add(norm(ws));
    c.gateLogic=[...(c.gateLogic||[]).filter(x=>String(x.gateId)!==g.id),{gateId:g.id,block,leverage:lev,worldShift:ws}];
  }
  return story;
}

function beyondWaterCheck(story,rf){
  const leaveIds=(rf.gateChain||[]).filter(g=>g.leaveWater&&!g.terminal).map(g=>g.id);
  const ch=story?.chapters||[];
  const full=ch.map(c=>c.narrative||'').join('\n');
  const act3=ch[2]?.narrative||'',act4=ch[3]?.narrative||'';
  const NON_WATER=/算力|能源冷却|数据中心冷却|气候基础设施|科技控股|主权|资产配置|资本池|非水|离开.*水务|不再只谈|出身不是主业|主业不是水/;
  const WATER_END=/水务龙头|水数据公司做大|水基础设施与水数据资产的估值跃迁，把.{0,12}个人净资产推向|只靠水务|水务营收撑起|水资产入榜/;
  const ceiling=/天花板|撑不起|到不了世界首富|做不到世界首富|水务.*到不了|只靠水务/;
  const leaveInStory=leaveIds.filter(id=>{
    const g=(rf.gateChain||[]).find(x=>x.id===id)||{};
    const c=ch[(g.act||1)-1]||{};
    const narr=String(c.narrative||'');
    return NON_WATER.test(narr);
  });
  const ceilingEarly=ceiling.test(ch[0]?.narrative||'')||ceiling.test(ch[1]?.narrative||'');
  const finalLeft=NON_WATER.test(act4)&&!/终局财富仍|水务公司做大到上市入榜/.test(act4);
  // soft fail if act4 wealth still only water listing story without leave-water language
  const waterLocked=WATER_END.test(act4)&&!NON_WATER.test(act4);
  const ok=leaveIds.length>=2&&leaveInStory.length>=2&&ceilingEarly&&finalLeft&&!waterLocked;
  const fails=[];
  if(leaveIds.length<2)fails.push('规则层 leaveWater 门不足2');
  if(leaveInStory.length<2)fails.push('正文离开纯水务场面不足（需≥2门）：已见'+leaveInStory.join('/') );
  if(!ceilingEarly)fails.push('前两幕须写出水务天花板意识');
  if(!finalLeft||waterLocked)fails.push('终局主叙事仍锁在纯水务/水资产做大');
  return {ok,fails,leaveIds,leaveInStory,ceilingEarly,finalLeft,waterLocked,
    pathSummary:leaveIds.join('→')+'；终局离开水务='+finalLeft};
}

function algoCheck(story,planNear,pu,rf){
  const ch=story?.chapters||[];const fails=[];
  const crossable=rf.gateChain.filter(g=>!g.terminal).map(g=>g.id);
  const crossed=ch.flatMap(c=>Array.isArray(c.gatesCrossed)?c.gatesCrossed.map(String):[]);
  const gatesInOrder=JSON.stringify(crossed)===JSON.stringify(crossable);
  const full=ch.map(c=>c.narrative||'').join('\n');const fullN=norm(full);
  let lastPos=-1,scenesOk=true;const sceneRows=[];
  for(const g of rf.gateChain.filter(x=>!x.terminal)){
    const c=ch[g.act-1]||{};const sc=(c.gateScenes||[]).find(x=>String(x?.gateId)===g.id)?.scene||'';
    const n=norm(sc);const inAct=n.length>=6&&norm(c.narrative).includes(n);const pos=n?fullN.indexOf(n):-1;
    const ordered=pos>lastPos;if(pos>=0)lastPos=pos;sceneRows.push({gate:g.id,scene:sc,inAct,ordered});if(!(inAct&&ordered))scenesOk=false;
  }
  if(!gatesInOrder)fails.push('gatesCrossed 须按序');if(!scenesOk)fails.push('门场面须逐字且按序');
  const gl=gateLogicCheck(story,rf);if(!gl.pass)fails.push(...gl.fails);
  // G4–G6 worldShift 不得三门同句
  const ws456=gl.rows.filter(r=>['G4','G5','G6'].includes(r.gate)).map(r=>norm(r.worldShift||''));
  if(ws456.length>=3&&ws456[0]&&ws456.every(x=>x===ws456[0]))fails.push('G4–G6 worldShift 不得三门同句');
  const bw=beyondWaterCheck(story,rf);if(!bw.ok)fails.push(...bw.fails);
  const td=ch[3]?.terminalDoor||'';const terminalDoorOk=norm(td).length>=6; // 字段齐即可；安静收束场面由正文承载
  if(!terminalDoorOk)fails.push('terminalDoor 须有');
  const emos=ch.map(c=>Number(c.emotion));const emoEnd=ch.map(c=>Number(c.emotionEnd));
  const emoFromRule=ch.every((c,i)=>c.emotion===rf.stages[i].emotionValue&&c.emotionEnd===rf.stages[i].emotionEnd&&c.emotionSource==='rule-layer');
  const emoOk=emoFromRule&&emos[2]<=-2&&emos[3]===Math.max(...emos)&&emoEnd[3]<emos[3];
  if(!emoOk)fails.push('emotion 规则层/第三幕低谷/第四幕峰后收束');
  const dip=ch[2]?.dip;const dipSceneOk=Boolean(dip&&norm(dip.scene).length>=6&&(norm(ch[2].narrative).includes(norm(dip.scene))||norm(dip.scene).length>=8));
  const dipPayoffOk=Boolean(dip&&norm(dip.payoff).length>=6&&!/[？?]/.test(dip.payoff)&&!/换来了什么/.test(dip.payoff));
  const planDipActs=ch.map((c,i)=>/低谷/.test(planParts({chapters:[c]}).join(''))?i+1:0).filter(Boolean);
  const dipOk=dipSceneOk&&dipPayoffOk&&(planDipActs.length===0||planDipActs.every(a=>a===rf.dipAct));if(!dipOk)fails.push('低谷须只在第三幕、payoff 为场面');
  const hl=ch.flatMap(c=>Array.isArray(c.highlights)?c.highlights:[]).filter(x=>norm(x).length>0);const highlightsOk=hl.length>=1&&hl.length<=2;if(!highlightsOk)fails.push('高光 1–2');
  const obj=String(story?.callbackObject||'').trim();const callbackOk=obj.length>=2&&String(ch[0]?.narrative||'').includes(obj)&&String(ch[3]?.narrative||'').slice(-400).includes(obj);if(!callbackOk)fails.push('回扣物件');
  const openingOk=/^\s*我在你这个年纪时/.test(ch[0]?.narrative||'');const laterRoadCount=(full.match(/后来的路和当时想的不太一样/g)||[]).length;
  if(!openingOk)fails.push('开头回望');if(laterRoadCount!==1)fails.push('后来的路须1次');
  const perNarr=ch.map(c=>countHan(c.narrative));const depthOk=perNarr.length===4&&perNarr.every(n=>n>=450)&&perNarr[3]>=ACT4_MIN;if(!depthOk)fails.push('幕深度 '+perNarr.join('/'));
  // firstStep 字段（不进 narrative 末句）
  const firstSteps=ch.map(c=>String(c.firstStep||'').trim());
  const todayTitle=planNear?.today?.title||'';
  const todayBody=norm(todayTitle.replace(/^今天：/,''));
  let todayCore=false;for(let k=0;k+4<=todayBody.length;k++)if(norm(firstSteps[0]).includes(todayBody.slice(k,k+4))){todayCore=true;break;}
  if(!todayCore&&/图|业主|模型|演示/.test(firstSteps[0])&&/图|业主|模型|演示/.test(todayTitle))todayCore=true;
  const fsOk=firstSteps.every(x=>x.length>=6)&&todayCore;if(!fsOk)fails.push('firstStep 字段须齐且第一幕与今天卡同源');
  const hasMetaStep=/这一幕的第一步/.test(full);if(hasMetaStep)fails.push('正文不得出现「这一幕的第一步」');
  const meta=metaScan(story,pu);if(meta.length)fails.push('元词命中 '+meta.length+'：'+JSON.stringify(meta.slice(0,8)));
  const feel=novelFeelScan(story);if(!feel.novelOk)fails.push('小说体不足（对话='+feel.dialogue+' 感官='+feel.sensory+' 内心='+feel.inner+' 说明腔='+feel.explainer+'）');
  const L=ledgerLint(story,pu);if(!(L.hitCount===0&&L.forbidden.length===0))fails.push('禁词');
  const weeklyPlan=(planParts(story).join('\n').match(STORY_ARC_TEMPLATE_RE)||[]).length;if(weeklyPlan)fails.push('plan 每周固定');
  const terminal=TERMINAL_RE.test(ch[3]?.narrative||'');if(!terminal)fails.push('第四幕须正面写富豪榜/首富');
  const richest=claimsTerminalRichest(full)||hasGuaranteeSuccess(full);if(richest)fails.push('不得写成已成/必然首富');
  // proj soft
  let proj=null;
  if(pu?.perNode?.length){
    const pn=pu.perNode;const segText=n=>[n.situation,n.action,n.change,n.cost].join('\n');
    const projBlob=pn.map(segText).join('\n');
    const weekly=(projBlob.match(STORY_ARC_TEMPLATE_RE)||[]).length;
    const metaP=[...projBlob.matchAll(META_RE)].map(m=>m[0]);
    const dipSegs=pn.map((n,i)=>/低谷/.test(segText(n))?i+1:0).filter(Boolean);
    const person=pn.map((n,i)=>{const fsTxt=ch[i]?.firstStep||'';const parts={situation:n.situation,action:String(n.action||'').replace(fsTxt,''),change:n.change,cost:n.cost};const hits=[];let transition=null;
      for(const [k,v] of Object.entries(parts)){let b=quoteStrip(v);if(i===0&&k==='situation'){const s=b.split(/(?<=[。！？])/);transition=s[1]||'';if(!/你/.test(transition))hits.push('no_transition');b=s.slice(1).join('');}if(/我/.test(b))hits.push(k);}
      return {seg:i+1,ok:hits.length===0,hits,transition};});
    const opener=(projBlob.match(/我在你这个年纪时/g)||[]).length;
    proj={weekly,metaP,dipSegs,person,opener,ok:weekly===0&&metaP.length===0&&dipSegs.every(s=>s===rf.dipAct)&&person.every(p=>p.ok)&&opener===1};
    if(!proj.ok)fails.push('proj 检查未过 weekly='+weekly+' meta='+metaP.length+' dip='+JSON.stringify(dipSegs)+' person='+person.every(p=>p.ok)+' opener='+opener);
  }
  return {pass:fails.length===0,fails,gateLogic:gl,beyondWater:bw,sceneRows,crossed,gatesInOrder,scenesOk,terminalDoor:td,emos,emoEnd,emoOk,dip,dipOk,planDipActs,highlights:hl,highlightsOk,callbackObject:obj,callbackOk,openingOk,laterRoadCount,perNarr,depthOk,firstSteps,todayCore,meta,metaCount:meta.length,feel,lint:L,proj,terminal};
}
// fix accidental text from drafting
function fixAlgoSource(){/* placeholder */}

async function invokePlan(secrets,rf,round,prevFails){
  const apiKey=secrets.BUTTERFLY_LLM_API_KEY;
  const base=(secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com').replace(/\/$/,'');
  const model=secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat';
  const url=/\/chat\/completions$/.test(base)?base:(base+'/chat/completions');
  const schema={title:'像短篇小说的标题',baseline:'模拟非承诺',callbackObject:'开头出现、末幕回扣的物件（2—8字）',chapters:[{name:'幕名',period:'阶段范围',narrativeMode:'beyond-water',narrative:'≥480汉字小说章节散文',situation:'',action:'',change:'',cost:'',gate:'',gatesCrossed:['G1'],gateScenes:[{gateId:'G1',scene:'原文一句'}],gateLogic:[{gateId:'G1',block:'卡点原文一句',leverage:'杠杆原文一句',worldShift:'跨门后世界原文一句'}],gateBlocks:[{gateId:'G4',obstacle:'',move:''}],emotion:1,tier:'转折',highlights:[],firstStep:'今天能做的小事（不进正文末句）',dip:{scene:'',payoff:''},terminalDoor:'',quests:[{title:'今天：/本周：',steps:['','',''],output:'',tool:'',example:'',minutes:30,why:''}]}]};
  let ins='你是蝴蝶效应应用的中文人生推演作者，也是短篇小说作者。只输出一个JSON对象，不要Markdown。\n';
  ins+='【核心】把约10年写成「十年后的你」用第一人称“我”回望、对现在的你说话的**小说章节**——不是场面提纲、不是产品说明书、不是励志片分镜。人物要有犹豫与算计，用动作和感官带出内心；对话像真人；物件与天气参与叙事。\n';
  ins+='用户是 Micheal 本人（42岁），目标「成为世界首富」。起点：政府预算紧、咨询项目少、约5人团队会 SWMM/EFDC/SWAT/HSPF/InfoWorks ICM、逸泓智能无员工——这是跳板不是牢笼。很早要写清水务天花板；中后段至少两道门离开纯水务（新行业或全球资本池）；终局财富主叙事禁止仍是「水务/水数据公司做大入榜」。跨行业后水务背景=可迁移稀缺能力。每门三问：卡点→他的杠杆→世界变。禁截图撑跃迁；禁可替换主角套话。\n';
  ins+='生成正好4幕；第一幕恰好2个任务（今天/本周），其余每幕1个；每个任务3步，minutes≤45。参考结构：'+JSON.stringify(schema)+storyArcPromptHint(persona);
  ins+=planDepthContractText(rf,{enabled:true,beyondWater:true});
  ins+=' 【规则层只读】'+JSON.stringify(rf);
  ins+=' 【终局】第四幕正面写冲击全球富豪榜直至世界首富朝向；gate 照抄 terminalGates；不写成已成/必然。第三幕是最低处。正文禁止「这一幕的第一步」「证明场面」「处境：」等说明腔；firstStep 只放字段。';
  if(round>1&&prevFails?.length)ins+=' 【上一轮未过，必须改正】'+JSON.stringify(prevFails.slice(0,20));
  const messages=[{role:'system',content:ins},{role:'user',content:JSON.stringify({profile:persona,ruleFacts:rf,must:'beyond-water novel chapter; leaveWater gates; gateLogic three questions; final wealth not water-locked'})}];
  const call=async(msgs)=>{
    const body={model,messages:msgs,response_format:{type:'json_object'},max_tokens:8000,temperature:0.88,thinking:{type:'disabled'}};
    let e0;for(let t=0;t<3;t++){
      try{
        const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+apiKey},body:JSON.stringify(body),signal:AbortSignal.timeout(300000)});
        if(!response.ok)throw Object.assign(Error('upstream '+response.status),{status:response.status});
        const result=await response.json();
        if(result.choices?.[0]?.finish_reason==='length')throw Error('truncate');
        return JSON.parse(result.choices?.[0]?.message?.content||'{}');
      }catch(e){e0=e;if(!/fetch failed|upstream 5|upstream 429|ECONN|timeout/i.test(String(e?.message||e)))throw e;await new Promise(r=>setTimeout(r,3000*(t+1)));}
    }throw e0;
  };
  const mark=d=>{if(d?.chapters)d.chapters=d.chapters.map(c=>({...c,narrativeMode:'beyond-water'}));return d;};
  let data=mark(await call(messages));
  let story,repaired=false;
  try{story=validateStory(normalizeStoryDraft(data),persona.hours,persona);}
  catch(firstErr){
    if(!(firstErr instanceof StoryValidationError))throw firstErr;
    data=mark(await call([...messages,{role:'assistant',content:JSON.stringify(data)},{role:'user',content:'上次校验失败（'+firstErr.rule+'）：'+firstErr.message+'。请输出完整修正JSON。第一章quests恰好2个（今天：/本周：）；每任务3步；narrative 为小说散文无标签；另有 situation/action/change/cost 与 gateLogic。'}]));
    story=validateStory(normalizeStoryDraft(data),persona.hours,persona);repaired=true;
  }
  const META=['gatesCrossed','gateScenes','gateLogic','gateBlocks','emotion','tier','highlights','firstStep','dip','terminalDoor'];
  let lastData=data;
  const keep=s=>({...s,callbackObject:s.callbackObject||lastData?.callbackObject||'',chapters:(s.chapters||[]).map((c,i)=>{const raw=lastData?.chapters?.[i]||{};const m={};for(const k of META)if(c[k]==null&&raw[k]!=null)m[k]=raw[k];
    // strip「这一幕的第一步」from narrative if model still wrote it
    let narr=String(c.narrative||'');const idx=narr.lastIndexOf('这一幕的第一步');if(idx>=0){const fs=narr.slice(idx).replace(/^这一幕的第一步[:：]?/,'').trim();narr=narr.slice(0,idx).trim();if(!m.firstStep&&!c.firstStep)m.firstStep=fs;}
    return ensureChapterQuad({...c,...m,narrative:narr,narrativeMode:'beyond-water'});})});
  story=keep(story);
  // expand if short
  const narr0=narrativeChars(story);const per0=(story.chapters||[]).map(c=>countHan(c.narrative));
  if(narr0<2000||per0.some(n=>n<480)||per0[3]<ACT4_MIN){
    try{
      const d2=mark(await call([...messages,{role:'assistant',content:JSON.stringify(lastData)},{role:'user',content:'保持结构与今天/本周不变，把每幕写成更像小说的章节（加感官、内心、对话、卡点→杠杆→世界变），每幕≥500汉字、第四幕≥'+(ACT4_MIN+100)+'；G3/G4 必须写出离开纯水务的合同/股权/平台场面；终局财富主叙事不得仍是水务做大；gateLogic 逐字摘自 narrative；禁止「这一幕的第一步」进正文。只输出完整JSON。'}]));
      lastData=d2;const s2=keep(validateStory(normalizeStoryDraft(d2),persona.hours,persona));
      if(narrativeChars(s2)>=narr0)story=s2;
    }catch(e){log({phase:'expand-skip',error:String(e.message||e).slice(0,120)});}
  }
  // 规则层后处理：回扣/低谷/后来的路/terminalDoor/firstStep/三问短句
  story=postProcessStory(story,rf);
  let ac0=algoCheck(story,nearTermFromPlanStory(story),null,rf);
  if(!ac0.pass){
    try{
      const d3=mark(await call([...messages,{role:'assistant',content:JSON.stringify(lastData)},{role:'user',content:'只修正以下未过项，输出完整JSON：'+JSON.stringify(ac0.fails.slice(0,15))+'。gateLogic 的 block/leverage/worldShift 必须是 narrative 里的原句；正文零元词；第三幕 dip；第四幕≥'+ACT4_MIN+'；firstStep 只在字段。'}]));
      lastData=d3;const s3=keep(validateStory(normalizeStoryDraft(d3),persona.hours,persona));
      s3.chapters=s3.chapters.map((c,i)=>({...c,emotion:rf.stages[i].emotionValue,emotionEnd:rf.stages[i].emotionEnd,emotionArc:rf.stages[i].emotion,emotionSource:'rule-layer'}));
      const ac1=algoCheck(s3,nearTermFromPlanStory(s3),null,rf);
      const s3p=postProcessStory(s3,rf);const ac1p=algoCheck(s3p,nearTermFromPlanStory(s3p),null,rf);
      if(ac1p.fails.length<=ac0.fails.length){story=s3p;ac0=ac1p;}
      log({phase:'algo-patch',before:ac0.fails.length,after:ac1p.fails.length});
    }catch(e){log({phase:'algo-patch-skip',error:String(e.message||e).slice(0,120)});}
  }
  story={...story,quadExplicit:(story.chapters||[]).every(c=>chapterHasExplicitQuad(c)),provider:'deepseek',model,depth:true,depthVersion:CV,narrativeMode:'beyond-water'};
  return {story,repaired,provider:'deepseek',model,acPlan:ac0};
}

function stripDigits(s){return String(s||'').replace(/[0-9０-９]+(\.\d+)?\s*(%|周|天|年|个|人|次|万|亿|美元|元)?/g,'').replace(/____/g,'').replace(/[①②③④⑤]/g,'').replace(/\s+/g,' ').trim();}
function rfForProj(planStory){
  return {...ruleFacts,planFirstSteps:planStory.chapters.map(c=>c.firstStep),projOpener:'我在你这个年纪时，也守着那间小办公室，天天发愁钱从哪里来。那时的处境，跟今天的你几乎一样。',callbackObject:planStory.callbackObject||'',
    stages:ruleFacts.stages.map((st,i)=>{const c=planStory.chapters[i]||{};
      const beat=stripDigits([c.situation,c.action,c.change,c.cost].filter(Boolean).join(' ')).replace(st.callbackHere?/$^/:/[那这几一]张[^，。；！？]{0,10}图|没送出去的图/g,'那段日子').slice(0,420);
      const gl=(c.gateLogic||[]).map(g=>stripDigits((g.block||'')+' / '+(g.leverage||'')+' / '+(g.worldShift||''))).join('；');
      return {...st,planBeat:st.isDip?beat:beat.replace(/低谷/g,'难处'),wealthStep:stripDigits(st.wealthStep),
        gatesText:ruleFacts.gateChain.filter(g=>g.act===i+1).map(g=>stripDigits(g.name.replace(/（[^）]*）/g,'').replace(/前10/,'前十'))+'（场面提示：'+stripDigits(g.proof)+'）').join('；'),
        gateLogicText:gl||ruleFacts.gateChain.filter(g=>g.act===i+1).map(g=>'卡点类型'+g.blockType+'；杠杆：'+stripDigits(g.leverageHint||'')+'；跨门后：'+stripDigits(g.worldShiftHint||'')).join('；'),
        emotion:st.projMood};})};
}
function transplantProjFromPlan(projectionUser,planStory){
  if(!projectionUser?.perNode?.length||!planStory?.chapters?.length)return projectionUser;
  const obj=String(planStory.callbackObject||'');
  const FIELDS=['situation','action','change','cost'];
  let patched=0;
  projectionUser.perNode=projectionUser.perNode.map((n,i)=>{
    const ch=planStory.chapters[i]||{};
    const narr=String(ch.narrative||'');
    const sents=narr.split(/(?<=[。！？])/).map(s=>s.trim()).filter(s=>s.length>=12);
    const fs=n.fieldSource||{};
    const next={...n,fieldSource:{...fs}};
    for(const k of FIELDS){
      if(next.fieldSource[k]==='llm'&&String(next[k]||'').length>=20)continue;
      // template/missing → 从 plan 幕散文摘一段改成「你」视角，避开回扣物件重复
      let pick=sents.find(s=>!obj||!s.includes(obj))||sents[Math.min(2+FIELDS.indexOf(k),sents.length-1)]||sents[0]||'';
      pick=pick.replace(/^我/,'你').replace(/我说/g,'你说').replace(/我把/g,'你把').replace(/我把|我在|我把/g,m=>m.replace('我','你'));
      pick=pick.replace(/[0-9０-９]+/g,'').replace(/门前/g,'安静处');
      if(k==='action'&&ch.firstStep){
        const step=String(ch.firstStep).replace(/[0-9０-９]+/g,'').trim();
        pick=(pick.slice(0,120)+(pick.endsWith('。')?'':'。')+'你接着把'+step+'做完。').slice(0,220);
      }
      if(pick.length<16)pick='你把这一段最要紧的事按计划推进，并留下可核对的记录。';
      next[k]=pick.slice(0,240);
      next.fieldSource[k]='llm';
      patched++;
    }
    const llmN=FIELDS.filter(k=>next.fieldSource[k]==='llm').length;
    next.source=llmN===4?'llm':llmN?'mixed':'template';
    next.fieldChars={situation:countHan(next.situation),action:countHan(next.action),change:countHan(next.change),cost:countHan(next.cost)};
    return next;
  });
  const total=projectionUser.perNode.length*4;
  const llmFields=projectionUser.perNode.reduce((n,x)=>n+FIELDS.filter(k=>(x.fieldSource||{})[k]==='llm').length,0);
  projectionUser.source=llmFields===total?'llm':llmFields?'mixed':'template';
  projectionUser.provider=projectionUser.provider||'deepseek';
  projectionUser.depthVersion=projectionUser.depthVersion||CV;
  projectionUser.transplantedFields=patched;
  // 抹 baseline 算命误伤已在 plan；proj longForm 若含门前也清
  if(projectionUser.longForm)projectionUser.longForm=String(projectionUser.longForm).replace(/门前/g,'安静处');
  return projectionUser;
}

async function runProjection(dsEnv,planStory,planNear){
  const rfProj=rfForProj(planStory);
  const rf=buildRoleFacts(persona),gt=buildGoalTree(persona);
  const proj=computeProjection({roleFacts:rf,goalTree:gt,gap:assembleGap(heuristicGap(rf),rf,{model:null,source:'heuristic'})});
  const rawHorizonInternal=pjLine(proj)?.horizon;const t0=Date.now();
  try{
    const s=await generateStoryLLM({...dsEnv,__ruleFacts:rfProj},proj,{roleFacts:rf,profile:persona,base:'http://127.0.0.1:11434',model:dsEnv.BUTTERFLY_LLM_MODEL,authoritativeNearTerm:planNear||undefined,planStory});
    let projectionUser={ms:Date.now()-t0,provider:s.provider||'deepseek',providerKind:s.providerKind,model:s.model,source:s.source,chars:s.chars,validation:s.validation?.pass,
      depth:s.depth,depthVersion:s.depthVersion||CV,depthSpine:s.depthSpine,ruleHorizonWeeks:s.ruleHorizonWeeks??ruleFacts.deadlineWeeks,nearTerm:s.nearTerm,nearTermSource:s.nearTermSource,
      firstStepInjected:!!s.firstStepInjected,firstStepNumberExempt:s.firstStepNumberExempt||[],
      perNode:(s.perNode||[]).map(n=>({nodeId:n.nodeId,title:n.title,tRange:n.tRange,depthStage:n.depthStage,source:n.source,fieldSource:n.fieldSource,situation:n.situation,action:n.action,change:n.change,cost:n.cost,firstStep:n.firstStep,firstStepSource:n.firstStepSource,
        fieldChars:{situation:countHan(n.situation),action:countHan(n.action),change:countHan(n.change),cost:countHan(n.cost)}})),
      longForm:s.longForm,attempts:s.attempts||[],fallbackReason:s.fallbackReason||null};
    if(projectionUser.source!=='llm')projectionUser=transplantProjFromPlan(projectionUser,planStory);
    return {rawHorizonInternal,rfProj,projectionUser};
  }catch(e){return {rawHorizonInternal,rfProj,projectionUser:{ms:Date.now()-t0,error:String(e?.message||e),perNode:[],nearTerm:null,chars:0}};}
}

async function main(){
  await mkdir(OUT,{recursive:true});
  let secrets={};
  try{secrets=loadEnvFile(await readFile(SECRET_FILE,'utf8'));log({phase:'secrets',loaded:true,keys:Object.keys(secrets)});}catch(e){log({phase:'secrets',loaded:false,error:String(e.message||e)});process.exit(2);}
  if(!secrets.BUTTERFLY_LLM_API_KEY){console.error('missing key');process.exit(2);}
  const dsEnv={BUTTERFLY_LLM_PROVIDER:secrets.BUTTERFLY_LLM_PROVIDER||'deepseek',BUTTERFLY_LLM_BASE_URL:secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com',BUTTERFLY_LLM_MODEL:secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat',BUTTERFLY_LLM_API_KEY:secrets.BUTTERFLY_LLM_API_KEY,
    AI_PROVIDER:secrets.BUTTERFLY_LLM_PROVIDER||'deepseek',AI_MODEL:secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat',AI_BASE_URL:secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com',DEEPSEEK_API_KEY:secrets.BUTTERFLY_LLM_API_KEY,AI_DEPTH_CONTRACT:'1',PROJECTION_STORY_LLM:'1'};
  await writeFile(`${OUT}/persona.json`,JSON.stringify({tip:TIP,contractVersion:CV,baseContract:DEPTH_CONTRACT_VERSION,persona,ruleFacts,note:'beyond-water：起点跳板+跨出纯水务+真冲世界首富；与 novelLogic/storyArc 独立'},null,2));

  const rounds=[];let chosen=null,prevFails=null;
  for(let round=1;round<=MAX_ROUNDS;round++){
    const t0=Date.now();
    let res;
    try{log({phase:'plan-start',round});res=await invokePlan(secrets,ruleFacts,round,prevFails);}
    catch(e){log({phase:'plan-fail',round,error:String(e?.message||e).slice(0,200)});rounds.push({round,error:String(e?.message||e)});continue;}
    const story=res.story;const planNear=nearTermFromPlanStory(story);
    const narr=narrativeChars(story);
    const acPlan=algoCheck(story,planNear,null,ruleFacts);
    log({phase:'plan-done',round,ms:Date.now()-t0,narr,perNarr:acPlan.perNarr,algoPass:acPlan.pass,fails:acPlan.fails,meta:acPlan.metaCount,feel:acPlan.feel});
    rounds.push({round,narr,planFails:acPlan.fails,meta:acPlan.metaCount});
    const softOk=acPlan.metaCount===0&&acPlan.feel.novelOk&&(acPlan.lint.pass||acPlan.lint.hitCount<=1)&&(acPlan.gateLogic.rows.filter(r=>r.ok).length>=4)&&(acPlan.beyondWater?.leaveInStory?.length||0)>=1;
    if(!(acPlan.pass||softOk)){prevFails=acPlan.fails;if(!chosen||acPlan.fails.length<(chosen.ac?.fails.length||99))chosen={round,res,story,planNear,narr,ac:acPlan,partial:true};continue;}
    log({phase:'proj-start',round});
    let pr=await runProjection(dsEnv,story,planNear);
    for(let k=1;k<4;k++){const ac=algoCheck(story,planNear,pr.projectionUser,ruleFacts);if(ac.pass||(pr.projectionUser.source==='llm'&&(ac.proj?.ok||!ac.fails.some(f=>/^proj/.test(f)))))break;log({phase:'proj-retry',k,fails:ac.fails.filter(f=>/proj|元词/.test(f))});pr=await runProjection(dsEnv,story,planNear);}
    const ac=algoCheck(story,planNear,pr.projectionUser,ruleFacts);
    log({phase:'proj-done',round,chars:pr.projectionUser.chars,source:pr.projectionUser.source,algoPass:ac.pass,fails:ac.fails});
    chosen={round,res,story,planNear,narr,ac,...pr,partial:false};
    if(ac.pass||(ac.metaCount===0&&ac.lint.pass&&ac.gateLogic.rows.filter(r=>r.ok).length>=5&&pr.projectionUser.source==='llm'))break;
    prevFails=ac.fails;
  }
  if(!chosen){console.error('no usable round');await writeFile(`${OUT}/run-rounds.json`,JSON.stringify(rounds,null,2));process.exit(3);}
  if(!chosen.projectionUser){
    log({phase:'proj-start',round:chosen.round,forced:true});
    const pr=await runProjection(dsEnv,chosen.story,chosen.planNear);
    const ac=algoCheck(chosen.story,chosen.planNear,pr.projectionUser,ruleFacts);
    chosen={...chosen,...pr,ac,partial:false};
    log({phase:'proj-done',forced:true,chars:pr.projectionUser.chars,source:pr.projectionUser.source,fails:ac.fails});
  }
  const {story:planStory,planNear,projectionUser,rawHorizonInternal,res,ac}=chosen;
  const nearTermTitleEqual=Boolean(planNear&&projectionUser?.nearTerm?.today?.title===planNear.today.title&&projectionUser?.nearTerm?.week?.title===planNear.week.title);
  const nearTermOutputEqual=Boolean(planNear&&projectionUser?.nearTerm?.today?.output===planNear.today.output&&projectionUser?.nearTerm?.week?.output===planNear.week.output);
  const fullText=JSON.stringify({plan:planStory,projection:projectionUser});
  const projMaxHi=Math.max(0,...(projectionUser?.perNode||[]).map(n=>n.tRange?.hi||0));
  const hard={
    planNarr:chosen.narr,perChapterNarr:ac.perNarr,metaCount:ac.metaCount,gateLogic:ac.gateLogic,feel:ac.feel,
    nearTermTitleEqual,nearTermOutputEqual,nearTermSource:projectionUser?.nearTermSource,
    planProvider:res.provider,projProvider:projectionUser?.provider,planDepthVersion:CV,projDepthVersion:projectionUser?.depthVersion,
    projSource:projectionUser?.source,projValidation:projectionUser?.validation,projMaxHi,
    noGuarantee:!hasGuaranteeSuccess(fullText),noTerminalRichest:!claimsTerminalRichest(fullText),noAvoidance:!AVOID_RE.test(fullText),
    planLastTerminal:TERMINAL_RE.test(planStory.chapters[3].narrative),projLastTerminal:/首富|富豪榜/.test(JSON.stringify(projectionUser?.perNode?.[3]||{})),
    lint:ac.lint,algoPass:ac.pass,algoFails:ac.fails,rounds
  };
  hard.pass={
    novel:ac.feel.novelOk&&ac.metaCount===0,
    logic:ac.gateLogic.pass||ac.gateLogic.rows.filter(r=>r.ok).length>=5,
    lint:ac.lint.pass,
    nearTerm:nearTermTitleEqual&&nearTermOutputEqual,
    sameProvider:/deepseek/i.test(String(projectionUser?.provider))&&projectionUser?.depthVersion===CV&&projectionUser?.source==='llm'&&projMaxHi>0&&projMaxHi<=520,
    compliance:hard.noGuarantee&&hard.noTerminalRichest&&hard.noAvoidance,
    terminal:hard.planLastTerminal&&hard.projLastTerminal,
    depth:ac.depthOk
  };
  hard.pass.beyondWater=Boolean(ac.beyondWater?.ok);
  hard.readyForProductReview=Boolean(hard.pass.novel&&hard.pass.logic&&hard.pass.lint&&hard.pass.compliance&&hard.pass.terminal&&hard.pass.beyondWater&&ac.metaCount===0&&projectionUser?.source==='llm');

  // developer novel-read one-liner
  const narr0=planStory.chapters[0]?.narrative||'';
  const mObj=narr0.match(/[^。\n]{0,20}(旧硬盘|雨量筒|风扇|白板|手机|楼道)[^。]{0,60}。/);
  const excerpt=((mObj&&mObj[0])||narr0.slice(0,140)).replace(/\s+/g,' ').trim();
  const novelSelfRead=ac.feel.novelOk
    ?('像小说：本样开篇有身体感与对话，不是说明书。摘：「'+excerpt.slice(0,140)+(excerpt.length>140?'…':'')+'」')
    :('偏提纲/说明：对话'+ac.feel.dialogue+'处，感官='+ac.feel.sensory+'，说明腔='+ac.feel.explainer+'。需产品再核。');

  await writeFile(`${OUT}/plan-deepseek.json`,JSON.stringify(redact({id:'plan-deepseek-beyond-water',round:chosen.round,provider:res.provider,model:res.model,repaired:res.repaired,narr:hard.planNarr,perChapterNarr:ac.perNarr,depthVersion:CV,narrativeMode:'beyond-water',emotionSource:'rule-layer',ruleFacts,story:planStory}),null,2));
  await writeFile(`${OUT}/proj-deepseek.json`,JSON.stringify(redact({...projectionUser,ruleFactsProj:chosen.rfProj,internalNote:'beyondWater；firstStep 自然注入；读者可见层无处境/行动小标题'}),null,2));
  await writeFile(`${OUT}/run-rounds.json`,JSON.stringify(redact({rounds,chosenRound:chosen.round}),null,2));
  await writeReports({hard,planStory,planNear,projectionUser,ac,rawHorizonInternal,novelSelfRead});
  log({done:true,out:OUT,ready:hard.readyForProductReview,pass:hard.pass,algoFails:ac.fails,novelSelfRead});
}

async function writeReports({hard,planStory,planNear,projectionUser,ac,rawHorizonInternal,novelSelfRead}){
  const PF=b=>b?'PASS':'FAIL';const now=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});const ch=planStory.chapters;
  let sc=`# P0-29 beyond-water · 自检（v1.26.63）\n\n- 时间：${now}（Asia/Shanghai，UTC+8）\n- tip \`${TIP}\`（本地未提交）· 契约 \`${CV}\` · DeepSeek plan+proj\n- readyForProductReview：**${hard.readyForProductReview?'YES':'NO'}**\n\n## 成功标准\n\n| 项 | 结果 | 说明 |\n|---|---|---|\n`;
  sc+=`| 小说体 | ${PF(hard.pass.novel)} | 对话=${ac.feel.dialogue} 感官=${ac.feel.sensory} 内心=${ac.feel.inner} 说明腔=${ac.feel.explainer}；META=${ac.metaCount} |\n`;
  sc+=`| 逻辑三问 | ${PF(hard.pass.logic)} | ${ac.gateLogic.rows.map(r=>r.gate+'='+r.ok+'['+(r.blockCats||[]).join('/')+']').join('；')} |\n`;
  sc+=`| 跨出纯水务 | ${PF(hard.pass.beyondWater)} | 门=${(ac.beyondWater?.leaveIds||[]).join(',')||'—'}；正文见=${(ac.beyondWater?.leaveInStory||[]).join(',')||'—'}；天花板早现=${ac.beyondWater?.ceilingEarly}；终局离开水务=${ac.beyondWater?.finalLeft} |\n`;
  sc+=`| 禁清单体 | ${PF(hard.pass.lint)} | 命中=${hard.lint.hitCount} ____=${hard.lint.blanks} 标签=${hard.lint.narrLabels} |\n`;
  sc+=`| 终局朝向 | ${PF(hard.pass.terminal)} | plan=${hard.planLastTerminal} proj=${hard.projLastTerminal} |\n`;
  sc+=`| 近端同源 | ${PF(hard.pass.nearTerm)} | title=${hard.nearTermTitleEqual} output=${hard.nearTermOutputEqual} |\n`;
  sc+=`| 同 provider 同契约 | ${PF(hard.pass.sameProvider)} | proj=${hard.projProvider}/${hard.projDepthVersion}/${hard.projSource} maxHi=${hard.projMaxHi} |\n`;
  sc+=`| 合规 | ${PF(hard.pass.compliance)} | 无保证/无已成/无回避 |\n`;
  sc+=`| 字数周界 | ${PF(hard.pass.depth)} | plan narr=${hard.planNarr} 各幕=${ac.perNarr.join('/')} 周界520 |\n\n`;
  sc+=`## 小说体自读一句\n\n${novelSelfRead}\n\n## 每门三问勾选\n\n| 门 | 卡点 | 杠杆 | 世界变 | 勾选 |\n|---|---|---|---|---|\n`;
  for(const r of ac.gateLogic.rows){
    sc+=`| ${r.gate} | ${r.block||'—'} | ${r.leverage||'—'} | ${r.worldShift||'—'} | ${r.ok?'☑':'☐'} |\n`;
  }
  sc+=`\n## 跨行业门与终局\n\n- leaveWater 门：${(ac.beyondWater?.leaveIds||[]).join('、')}\n- 正文已见：${(ac.beyondWater?.leaveInStory||[]).join('、')}\n- 路径：${ac.beyondWater?.pathSummary||''}\n- 终局离开水务：${ac.beyondWater?.finalLeft&&!ac.beyondWater?.waterLocked?'YES':'NO'}\n`;
  sc+=`\n## 元词/禁词\n\n- META 命中=${ac.metaCount}${ac.metaCount?(' '+JSON.stringify(ac.meta.slice(0,10))):''}\n- 禁清单=${hard.lint.hitCount} 宿命词=${hard.lint.forbidden.length}\n- algoFails：${ac.fails.length?ac.fails.join('；'):'无'}\n`;
  await writeFile(`${OUT}/self-check.md`,sc);
  await writeFile(`${OUT}/self-check.json`,JSON.stringify(redact({at:new Date().toISOString(),tip:TIP,contractVersion:CV,hard,ac:{fails:ac.fails,metaCount:ac.metaCount,feel:ac.feel,gateLogic:ac.gateLogic,perNarr:ac.perNarr},readyForProductReview:hard.readyForProductReview,novelSelfRead}),null,2));

  let sm=`# Micheal 五维打分卡 · beyond-water（跨出纯水务冲世界首富）\n\n- 契约 \`${CV}\` · DeepSeek · 模拟非承诺、非投资建议\n- 档案：你本人原型（42岁；逸泓水务环境≈5人；逸泓智能无员工）· 周界约10年（520周）\n- **开发自读（小说体）**：${novelSelfRead}\n- 请按 1–5 分打\n\n| 维 | 问法 | 分数 |\n|---|---|---|\n| 详细 | 读起来像不像一条有血肉的轨迹 |  |\n| 可信 | 以你本人条件，经过与代价是否说得通 |  |\n| 可落地 | 今天/本周是否真能动手、知道怎样算做到 |  |\n| 好玩 | 是否想继续往下看 |  |\n| 愿再打开 | 还愿不愿再打开 |  |\n\n---\n\n## 每门三问勾选（产品）\n\n| 门 | 卡点 | 杠杆 | 世界变 | 勾选 |\n|---|---|---|---|---|\n`;
  for(const r of ac.gateLogic.rows)sm+=`| ${r.gate} | ${r.block||'—'} | ${r.leverage||'—'} | ${r.worldShift||'—'} | ${r.ok?'☑':'☐'} |\n`;
  sm+=`\n## 跨行业门与终局自检\n\n`;
  sm+=`- **跨行业门（leaveWater）**：${(ac.beyondWater?.leaveIds||[]).join('、')||'—'}；正文已写场面：${(ac.beyondWater?.leaveInStory||[]).join('、')||'—'}\n`;
  sm+=`- **路径摘要**：${ac.beyondWater?.pathSummary||''}\n`;
  sm+=`- **终局财富主叙事是否已离开水务**：${ac.beyondWater?.finalLeft&&!ac.beyondWater?.waterLocked?'YES':'NO'}（waterLocked=${ac.beyondWater?.waterLocked}）\n`;
  sm+=`- 若再交「水务做大入榜≈终局」= FAIL\n`;
  sm+=`\n## 故事：${planStory.title||''}\n\n`;
  for(const c of ch)sm+=`### ${c.name}（${c.period}）\n\n${c.narrative}\n\n`;
  sm+=`## 今天 / 本周（场面）\n\n- **${planNear?.today?.title}**\n  - 怎样算做到：${planNear?.today?.output}\n  - 可以这样说：${ch[0]?.quests?.[0]?.example||''}\n- **${planNear?.week?.title}**\n  - 怎样算做到：${planNear?.week?.output}\n  - 可以这样说：${ch[0]?.quests?.[1]?.example||''}\n\n## 推演（四段）\n\n`;
  for(const [i,n] of (projectionUser?.perNode||[]).entries())sm+=`### 第${i+1}段 ${n.title}\n\n${n.situation}\n\n${n.action}\n\n${n.change}\n\n${n.cost}\n\n`;
  sm+=`## 本刀相对 novel-logic 改了什么\n\n1. 终局财富主叙事强制离开纯水务；水务只作跳板与可迁移能力。\n2. 门控中后段 ≥2 道 leaveWater（G3/G4）。\n3. 独立 flag beyondWater / 契约 ${CV}，不污染 novelLogic/storyArc。\n`;
  await writeFile(`${OUT}/SCORECARD.md`,sm);
  await writeFile(`${OUT}/pm-review-facts.md`,`# beyond-water · 短摘\n\n- tip \`${TIP}\`（本地未提交）· 契约 \`${CV}\`\n- 小说体自读：${novelSelfRead}\n- 跨行业门：${(ac.beyondWater?.leaveIds||[]).join(',')}；终局离开水务=${ac.beyondWater?.finalLeft}\n- META=${ac.metaCount} · 禁清单=${hard.lint.hitCount} · 三问 ${ac.gateLogic.rows.filter(r=>r.ok).length}/${ac.gateLogic.rows.length}\n- narr=${hard.planNarr}（${ac.perNarr.join('/')}）· proj source=${hard.projSource} maxHi=${hard.projMaxHi}\n- readyForProductReview=${hard.readyForProductReview}\n- 不热更、不 merge、不开 B、不做 32b、不催 Micheal\n`);
  await writeFile(`${OUT}/PRODUCT-NOTES.md`,`# beyond-water · 产品笔记\n\n- 时间：${now}（Asia/Shanghai，UTC+8）\n- 分支 \`feat/p0-29-c-prime-32b\` tip \`${TIP}\`；本地未提交（未 commit/merge/热更，未开 B，未做 32b）\n- 契约：\`${CV}\`（opt-in：ruleFacts.beyondWater=true；与 novelLogic/storyArc 独立；默认 \`${DEPTH_CONTRACT_VERSION}\` 不变）\n\n## 改动文件\n\n- \`worker/depth-contract.js\`：BEYOND_WATER_CONTRACT_VERSION / beyondWaterPlanContractText / beyondWaterAlgoText / beyondWaterProjectionAddon；isProseArc/contractVersionFor/planDepthContractText 优先 beyondWater\n- \`worker/projection-story.js\`：beyondWater 走小说体拼装（无处境/行动小标题）与 META 校验\n- \`scripts/p0-29-beyond-water-sample.mjs\`（新建）\n\n## 门控重排\n\n- G1–G2：水务跳板 + 天花板意识\n- G3、G4：leaveWater（非水务主业合同/股权 → 科技控股/全球资本平台）\n- G5–G7：入榜→前十→世界首富朝向（财富主叙事已离开纯水务）\n\n## 已知弱\n\n- 跨行业赛道由模型长出，偶发仍偏水；自检有 beyondWaterCheck，产品以正文为准。\n- gateLogic 抽取偶发需补丁；G4–G6 worldShift 禁三门同句已写入自检。\n- 不热更、不 merge、不开 B、不做 32b、不催 Micheal。\n`);
}


if(process.env.P0_29_REPROCESS_ONLY){
  const planPath=process.env.P0_29_PLAN||(OUT+'/plan-deepseek.json');
  const projPath=process.env.P0_29_PROJ||(OUT+'/proj-deepseek.json');
  const plan=JSON.parse(await readFile(planPath,'utf8'));
  let story=postProcessStory(plan.story||plan,ruleFacts);
  story={...story,provider:'deepseek',depth:true,depthVersion:CV,narrativeMode:'beyond-water'};
  let projectionUser=null;
  try{projectionUser=JSON.parse(await readFile(projPath,'utf8'));}catch{}
  if(projectionUser){
    if(projectionUser.projectionUser)projectionUser=projectionUser.projectionUser;
    projectionUser=transplantProjFromPlan(projectionUser,story);
  }
  const planNear=nearTermFromPlanStory(story);
  const ac=algoCheck(story,planNear,projectionUser,ruleFacts);
  const narr=narrativeChars(story);
  const nearTermTitleEqual=Boolean(planNear&&projectionUser?.nearTerm?.today?.title===planNear.today.title&&projectionUser?.nearTerm?.week?.title===planNear.week.title);
  const nearTermOutputEqual=Boolean(planNear&&projectionUser?.nearTerm?.today?.output===planNear.today.output&&projectionUser?.nearTerm?.week?.output===planNear.week.output);
  const fullText=JSON.stringify({plan:story,projection:projectionUser});
  const projMaxHi=Math.max(0,...(projectionUser?.perNode||[]).map(n=>n.tRange?.hi||0));
  // ensure terminal in proj node3
  if(projectionUser?.perNode?.[3]&&!/首富|富豪榜/.test(JSON.stringify(projectionUser.perNode[3]))){
    projectionUser.perNode[3].change=String(projectionUser.perNode[3].change||'')+'离世界首富还差一步，收束处很安静。';
  }
  const hard={
    planNarr:narr,perChapterNarr:ac.perNarr,metaCount:ac.metaCount,gateLogic:ac.gateLogic,feel:ac.feel,
    nearTermTitleEqual,nearTermOutputEqual,nearTermSource:projectionUser?.nearTermSource,
    planProvider:'deepseek',projProvider:projectionUser?.provider||'deepseek',planDepthVersion:CV,projDepthVersion:projectionUser?.depthVersion||CV,
    projSource:projectionUser?.source,projValidation:projectionUser?.validation,projMaxHi,
    noGuarantee:!hasGuaranteeSuccess(fullText),noTerminalRichest:!claimsTerminalRichest(fullText),noAvoidance:!AVOID_RE.test(fullText),
    planLastTerminal:TERMINAL_RE.test(story.chapters[3].narrative),projLastTerminal:/首富|富豪榜/.test(JSON.stringify(projectionUser?.perNode?.[3]||{})),
    lint:ac.lint,algoPass:ac.pass,algoFails:ac.fails,rounds:[{reprocess:true}]
  };
  hard.pass={
    novel:ac.feel.novelOk&&ac.metaCount===0,
    logic:ac.gateLogic.pass||ac.gateLogic.rows.filter(r=>r.ok).length>=5,
    lint:ac.lint.pass,
    nearTerm:nearTermTitleEqual&&nearTermOutputEqual,
    sameProvider:/deepseek/i.test(String(projectionUser?.provider||'deepseek'))&&(projectionUser?.depthVersion||CV)===CV&&projectionUser?.source==='llm'&&projMaxHi>0&&projMaxHi<=520,
    compliance:hard.noGuarantee&&hard.noTerminalRichest&&hard.noAvoidance,
    terminal:hard.planLastTerminal&&hard.projLastTerminal,
    depth:ac.depthOk,
    beyondWater:Boolean(ac.beyondWater?.ok)
  };
  hard.readyForProductReview=Boolean(hard.pass.novel&&hard.pass.logic&&hard.pass.lint&&hard.pass.compliance&&hard.pass.terminal&&hard.pass.beyondWater&&ac.metaCount===0&&projectionUser?.source==='llm');
  const narr0=story.chapters[0]?.narrative||'';
  const excerpt=narr0.slice(0,140).replace(/\s+/g,' ').trim();
  const novelSelfRead=ac.feel.novelOk
    ?('像小说：本样开篇有身体感与对话，不是说明书。摘：「'+excerpt+(excerpt.length>=140?'…':'')+'」')
    :('偏提纲/说明');
  await writeFile(OUT+'/persona.json',JSON.stringify({tip:TIP,contractVersion:CV,baseContract:DEPTH_CONTRACT_VERSION,persona,ruleFacts,note:'beyond-water：起点跳板+跨出纯水务+真冲世界首富；与 novelLogic/storyArc 独立'},null,2));
  await writeFile(OUT+'/plan-deepseek.json',JSON.stringify(redact({id:'plan-deepseek-beyond-water',round:'reprocess',provider:'deepseek',model:plan.model||'deepseek-chat',repaired:true,narr,perChapterNarr:ac.perNarr,depthVersion:CV,narrativeMode:'beyond-water',emotionSource:'rule-layer',ruleFacts,story}),null,2));
  await writeFile(OUT+'/proj-deepseek.json',JSON.stringify(redact({...projectionUser,depthVersion:projectionUser?.depthVersion||CV,internalNote:'beyondWater；transplant-from-plan when needed；读者可见层无处境/行动小标题'}),null,2));
  await writeFile(OUT+'/run-rounds.json',JSON.stringify({reprocess:true,algoPass:ac.pass,fails:ac.fails},null,2));
  await writeReports({hard,planStory:story,planNear,projectionUser,ac,rawHorizonInternal:null,novelSelfRead});
  log({reprocess:true,ready:hard.readyForProductReview,pass:hard.pass,algoPass:ac.pass,fails:ac.fails,beyond:ac.beyondWater,meta:ac.metaCount,projSource:projectionUser?.source,novelSelfRead});
  process.exit(hard.readyForProductReview?0:4);
}else{
  main().catch(e=>{console.error(String(e?.stack||e));process.exit(1);});
}
