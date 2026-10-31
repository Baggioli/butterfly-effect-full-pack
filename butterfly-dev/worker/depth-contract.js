/** P0-29 深度契约：plan（规划你的下一步）与 projection story（推演叙事）共用口径。
 * S2：同构字段（处境·行动·变化·代价显式）+ 规则周界不越出 ruleFacts + 近端今天/本周。
 * 合规不松档：禁算命/保证成功；数字尽量来自规则层注入，模型少编造。
 */
export const DEPTH_CONTRACT_VERSION='p0-29-s2-isomorphic-v1';
/** 叙事层小改（opt-in：ruleFacts.storyArc=true）：同构四元字段不变，narrative 改为「故事经过」散文，禁清单体。 */
export const STORY_ARC_CONTRACT_VERSION='p0-29-s2-isomorphic-v1+story-arc-3';
/** 小说体+逻辑可信（opt-in：ruleFacts.novelLogic=true）：与 storyArc 独立；文学层=小说章节，规则层仍出骨架/门控三问。 */
export const NOVEL_LOGIC_CONTRACT_VERSION='p0-29-s2-isomorphic-v1+novel-logic-2';
/** 本人起点+跨出纯水务冲世界首富（opt-in：ruleFacts.beyondWater=true）：与 novelLogic/storyArc 独立；文学层沿用小说体拼装，门控中后段强制离开纯水务。 */
export const BEYOND_WATER_CONTRACT_VERSION='p0-29-s2-isomorphic-v1+beyond-water-1';
/** 叙事算法最低集提示词草案（竞品-人生推演叙事算法-v0 §② 末，原文照抄）。 */
export const NARRATIVE_ALGO_PROMPT=[
 '你只负责把给定的幕节拍写成场面，不新增任何数字、不跳过任何一道门。',
 '每一幕按「想要的画面→挡路的现实→行动→变化/代价」推进；每跨一道门写一个被旁人看见的具体场面。',
 '全篇至少一个低谷，低谷后写它换来了什么；高光不超过两处；最后一幕回扣开头出现过的物件或场景。',
 '开头用"我在你这个年纪时……"的回望口吻，并在故事里自然说出"后来的路和当时想的不太一样"。',
 '正文禁止出现：清单、台账、文件名、项目编号；禁止"预测/预言/注定/命运/你失败了"。',
 '每幕最后一句写"这一幕的第一步"，要是今天就能做的一件小事。'
].join('\n');
export const STORY_ARC_FORBIDDEN_RE=/预测|预言|注定|命运|你失败了/g;
/** v1.26.59 结构层元词（正文命中须=0）：结构层的自我标注会让读者出戏。 */
export const STORY_ARC_META_RE=/高光|第[一二三四五六七八九十\d]+道门|道门|门前|门槛前|低谷里换来了什么|换来了什么[？?]|之所以可能|全篇|这一幕(?!的第一步)|本幕|幕尾|第[一二三四五六七八九十\d]+幕|那就是.{0,24}的场面|这就是.{0,24}的场面|旁人看着.{0,40}敲钟/g;
/** v1.26.61 小说体说明腔（正文命中须=0；与 STORY_ARC_META_RE 叠加）。 */
export const NOVEL_LOGIC_META_RE=/处境\s*[:：]|行动\s*[:：]|变化\s*[:：]|代价\s*[:：]|证明场面|这一幕的第一步|卡点\s*[:：]|杠杆\s*[:：]|跨门后|答卷|说明书|产品说明/g;
/** v1.26.59 推演模板残留（正文命中须=0）。 */
export const STORY_ARC_TEMPLATE_RE=/每周固定/g;
export const STORY_ARC_META_PROMPT='【元词禁令】“高光”“低谷”“门”“幕”“全篇”是结构层给你的写作骨架，只能用来组织情节，不能写进正文：正文禁止出现「高光」「第N道门」「道门」「门前」「全篇」「第N幕」「本幕」「之所以可能」「低谷里换来了什么」这类自我标注或设问句；禁止「那就是……的场面」「这就是……的场面」；禁止照搬规则层证明场面原文（如「旁人看着……敲钟」）；低谷换来了什么，用一个具体场面（谁做了什么、说了什么）写出来，不要用问句自问自答；“为什么这一步在现实里可能”用人物的动作和对话带出来，不要写成说明句。';
export const NOVEL_LOGIC_META_PROMPT=STORY_ARC_META_PROMPT+'【小说体·说明腔禁令】正文禁止「处境：」「行动：」「变化：」「代价：」作小标题；禁止「证明场面」「这一幕的第一步」这类教程钩子；禁止「卡点：」「杠杆：」答卷体小标题。收束用自然动作（关灯、倒水、出门），不要自我标注。';
export function isProseArc(ruleFacts){return Boolean(ruleFacts?.beyondWater||ruleFacts?.novelLogic||ruleFacts?.storyArc);}
export function contractVersionFor(ruleFacts){if(ruleFacts?.beyondWater)return BEYOND_WATER_CONTRACT_VERSION;if(ruleFacts?.novelLogic)return NOVEL_LOGIC_CONTRACT_VERSION;if(ruleFacts?.storyArc)return STORY_ARC_CONTRACT_VERSION;return DEPTH_CONTRACT_VERSION;}

export const QUAD_FIELDS=[['situation','处境'],['action','行动'],['change','变化'],['cost','代价']];

/** 从目标文案解析中期期限（天）；解析失败返回 null。 */
export function parseGoalDeadlineDays(goal=''){
 const s=String(goal||'');
 let m=s.match(/(\d+)\s*天/);if(m)return Math.min(730,Math.max(7,Number(m[1])));
 m=s.match(/(\d+)\s*周/);if(m)return Math.min(730,Math.max(7,Number(m[1])*7));
 m=s.match(/(\d+)\s*个?月/);if(m)return Math.min(730,Math.max(7,Number(m[1])*30));
 m=s.match(/半年/);if(m)return 180;
 m=s.match(/一年|1年/);if(m)return 365;
 return null;
}

/** 规则层事实：期限、阶段骨架、可用时间——注入提示词，禁止模型另编周数/金额。 */
export function buildRuleFacts(profile={}){
 const days=parseGoalDeadlineDays(profile.goal||profile.longGoal||'');
 const weeks=days!=null?Math.max(1,Math.round(days/7)):null;
 const hours=Number.isFinite(Number(profile.hours))?Number(profile.hours):null;
 const stages=weeks==null?null:[
  {key:'near',label:'近期（今天/本周/本阶段起步）',weekLo:0,weekHi:Math.min(2,weeks)},
  {key:'build',label:'能力与证据积累',weekLo:Math.min(2,weeks),weekHi:Math.min(Math.max(4,Math.round(weeks*0.45)),weeks)},
  {key:'mid',label:'中期目标验证前夜',weekLo:Math.min(Math.max(4,Math.round(weeks*0.45)),weeks),weekHi:weeks},
  {key:'verify',label:'阶段目标验证（不越界）',weekLo:Math.max(0,weeks-Math.min(4,Math.round(weeks*0.2))),weekHi:weeks}
 ];
 return {
  version:DEPTH_CONTRACT_VERSION,
  goalText:String(profile.goal||'').slice(0,200),
  deadlineDays:days,
  deadlineWeeks:weeks,
  hoursPerWeek:hours,
  stages,
  note:'下列周数/期限仅供叙事对齐；模型不得另编天数、周数、收入或成功概率。期限合计不得越界。'
 };
}

/** 从正文抽取固定标签分块；缺任一标签则返回 null。 */
export function extractQuadFromText(text=''){
 const s=String(text||'');
 const found=QUAD_FIELDS.map(([k,zh])=>{
  const m=s.match(new RegExp('【\\s*'+zh+'\\s*】'));
  return m?{k,zh,at:m.index,len:m[0].length}:null;
 });
 if(found.some(x=>!x))return null;
 const sorted=[...found].sort((a,b)=>a.at-b.at);
 const out={};
 for(let i=0;i<sorted.length;i++){
  const start=sorted[i].at+sorted[i].len;
  const end=i+1<sorted.length?sorted[i+1].at:s.length;
  out[sorted[i].k]=s.slice(start,end).replace(/^\s+|\s+$/g,'');
 }
 return out;
}

/** 四元 → 固定标签叙事（plan / 推演同构可读）。 */
export function assembleNarrativeFromQuad(q={}){
 return QUAD_FIELDS.map(([k,zh])=>'【'+zh+'】'+String(q[k]||'').trim()).join('\n');
}

/** 章节是否具备可逐项验收的显式四元（字段或标签分块）。 */
export function chapterHasExplicitQuad(c={}){
 if(c&&['situation','action','change','cost'].every(k=>String(c[k]||'').trim().length>=8))return true;
 const q=extractQuadFromText(c?.narrative||'');
 return !!(q&&['situation','action','change','cost'].every(k=>String(q[k]||'').trim().length>=8));
}

/** 归一：抽出/回填四元字段，并保证 narrative 含固定标签（便于同构验收）。 */
export function ensureChapterQuad(chapter={}){
 const c={...chapter};
 // story-arc：四元走字段，narrative 保留为散文故事经过（不回填标签块）。
 const keepProse=c.narrativeMode==='story-arc'||c.narrativeMode==='novel-logic'||c.narrativeMode==='beyond-water';
 let q=null;
 if(['situation','action','change','cost'].every(k=>String(c[k]||'').trim())){
  q={situation:String(c.situation).trim(),action:String(c.action).trim(),change:String(c.change).trim(),cost:String(c.cost).trim()};
 }else{
  q=extractQuadFromText(c.narrative||'');
 }
 if(q){
  c.situation=q.situation;c.action=q.action;c.change=q.change;c.cost=q.cost;
  if(!keepProse&&!extractQuadFromText(c.narrative||''))c.narrative=assembleNarrativeFromQuad(q);
 }
 return c;
}

/**
 * 推演叙事用同构脊柱：恰好 4 段，周界落在 ruleFacts.deadlineWeeks 内。
 * 不改动 computeProjection 算法（不开 B）；只在故事层对齐规划四幕。
 */
export function depthStoryNodes(planNodes=[],ruleFacts=null){
 const nodes=Array.isArray(planNodes)?planNodes:[];
 const maxW=ruleFacts?.deadlineWeeks;
 const stages=Array.isArray(ruleFacts?.stages)?ruleFacts.stages:[];
 if(!maxW||!nodes.length)return nodes;
 const work=nodes.filter(n=>n&&n.dim!=='goal');
 const goal=nodes.find(n=>n&&n.dim==='goal')||work.at(-1)||nodes.at(-1);
 const picks=[
  work[0]||nodes[0],
  work[1]||work[0]||nodes[0],
  work[2]||work[1]||work[0]||nodes[0],
  goal
 ];
 const spineStages=stages.length>=4?stages.slice(0,4):[
  {key:'near',label:'近期起步',weekLo:0,weekHi:Math.min(2,maxW)},
  {key:'build',label:'能力积累',weekLo:Math.min(2,maxW),weekHi:Math.min(Math.max(4,Math.round(maxW*0.45)),maxW)},
  {key:'mid',label:'中期推进',weekLo:Math.min(Math.max(4,Math.round(maxW*0.45)),maxW),weekHi:maxW},
  {key:'verify',label:'阶段验证',weekLo:Math.max(0,maxW-Math.min(4,Math.round(maxW*0.2))),weekHi:maxW}
 ];
 return spineStages.map((st,i)=>{
  const src=picks[i]||picks[0];
  const lo=Math.max(1,Number(st.weekLo)||1);
  const hi=Math.max(lo+1,Math.min(maxW,Number(st.weekHi)||maxW));
  const title=(String(st.label||'').replace(/（[^）]*）/g,'').trim())||src.title||('阶段'+(i+1));
  return {
   ...src,
   id:'d_'+st.key,
   title,
   dim:src.dim||(i===3?'goal':['time','ability','experience','goal'][i]),
   tRange:{lo,hi},
   duration:{lo:Math.max(1,hi-lo),hi:Math.max(1,hi-lo)},
   depthStage:st.key,
   sourceNodeId:src.id,
   state:src.state||{gap:'按规则层阶段推进',role:'具备本阶段条件',life:'保持每周可投入节奏'},
   evidence:src.evidence||[]
  };
 });
}

/** 返回仅故事层使用的 proj 浅拷贝（plan line 换成同构脊柱）。 */
export function withDepthStoryProj(proj,ruleFacts){
 if(!proj||!ruleFacts?.deadlineWeeks)return proj;
 const plan=(proj.lines||[]).find(l=>l.kind==='plan')||{nodes:[],horizon:null};
 const nodes=depthStoryNodes(plan.nodes||[],ruleFacts);
 if(!nodes.length)return proj;
 const horizon={lo:Math.min(...nodes.map(n=>n.tRange.lo)),hi:Math.max(...nodes.map(n=>n.tRange.hi))};
 const lines=(proj.lines||[]).map(l=>l.kind==='plan'?{...l,nodes,horizon,depthSpine:true,ruleHorizonWeeks:ruleFacts.deadlineWeeks}:l);
 return {...proj,lines,depthContract:true,ruleFacts};
}

/** 以 plan 第一章 quests（或显式 nearTerm）为权威，抽出与推演同构的 nearTerm 对（今天/本周）。 */
export function nearTermFromPlanStory(planStory){
 if(!planStory||typeof planStory!=='object')return null;
 const nt=planStory.nearTerm;
 if(nt&&typeof nt==='object'){
  const today=nt.today&&typeof nt.today==='object'?nt.today:{title:nt.todayTitle,output:nt.todayOutput,minutes:nt.todayMinutes};
  const week=nt.week&&typeof nt.week==='object'?nt.week:{title:nt.weekTitle,output:nt.weekOutput,minutes:nt.weekMinutes};
  const tTitle=String(today?.title||'').trim(),wTitle=String(week?.title||'').trim();
  if(tTitle.startsWith('今天：')&&wTitle.startsWith('本周：')){
   return {
    today:{title:tTitle,output:String(today?.output||'').trim(),minutes:Number(today?.minutes)||20},
    week:{title:wTitle,output:String(week?.output||'').trim(),minutes:Number(week?.minutes)||30},
    source:'plan'
   };
  }
 }
 const q=planStory?.chapters?.[0]?.quests;
 if(!Array.isArray(q)||q.length<2)return null;
 const today=q[0],week=q[1];
 const tTitle=String(today?.title||'').trim(),wTitle=String(week?.title||'').trim();
 if(!tTitle.startsWith('今天：')||!wTitle.startsWith('本周：'))return null;
 return {
  today:{title:tTitle,output:String(today?.output||'').trim(),minutes:Number(today?.minutes)||20},
  week:{title:wTitle,output:String(week?.output||'').trim(),minutes:Number(week?.minutes)||30},
  source:'plan'
 };
}

/** plan / adjust 追加的深度契约（短篇感 + 显式四元 + 近端可执行）。 */
export function planDepthContractText(ruleFacts,{enabled=true,storyArc=false,novelLogic=false,beyondWater=false}={}){
 if(!enabled)return '';
 const rf=ruleFacts||{};
 if(beyondWater||rf.beyondWater)return beyondWaterPlanContractText(rf);
 if(novelLogic||rf.novelLogic)return novelLogicPlanContractText(rf);
 if(storyArc||rf.storyArc)return storyArcPlanContractText(rf);
 const horizon=rf.deadlineDays!=null
  ?(`中期期限已由规则层锁定为约 ${rf.deadlineDays} 天（约 ${rf.deadlineWeeks} 周）；四幕 period 合计覆盖到该中期，不得擅自缩短为数周完成，也不得越界。`)
  :('目标未给出明确天数时，仍按中长期人生阶段写四幕，近端具体、远期有条件；不得编造精确周数。');
 const stageHint=Array.isArray(rf.stages)
  ?('建议阶段骨架（仅供对齐，可微调措辞不可改周界）：'+JSON.stringify(rf.stages)+'。')
  :'';
 return [
  ' 【P0-29 S2 深度契约·与推演叙事同构】',
  '1) 主路径须写成连贯短篇人生轨迹：每幕 narrative 汉字≥400，四幕合计≥1600（验收硬门槛≥1500，请留余量）；短篇感而非条目表。',
  '2) 每幕必须输出显式四元字段 situation/action/change/cost（各≥40汉字），且 narrative 用固定标签分块书写：【处境】…【行动】…【变化】…【代价】…（标签不可省略，便于逐项验收）。禁止只在散文里点到「变化/代价」而无标签/字段。',
  '3) '+horizon+stageHint,
  '4) 近端：第一章quests恰好2个（今天：/本周：），写明时限、交付物、验收标准；gate 只写本人可控证据，不要求他人回复/成交/录取。',
  '5) 具名或可查动作细节（工具名、表格列、话术模板用____占位）；阿拉伯数字的周数/天数/小时尽量只用规则层已给出的值，禁止编造收入、成功率、涨薪幅度。',
  '6) 合规：禁止算命、改命、保证成功、包过、稳赚、一定能、命运预测等表述；计划是有条件路线。',
  '7) 与导航推演故事同一深度：禁止只出薄草案提纲；读者应能在5分钟内复述本周第一步与过关标准。'
 ].join('');
}

/** 「故事经过」叙事层规则（plan 侧）。只改写法，不改周界/同构字段/近端同源。 */
export const STORY_ARC_BANNED_RE=/《[^》]{1,30}》|清单|文件名|项目编号|报价单|报价模板|发出记录|合并清单|前置清单|观察小结|空白模板|台账|表格列|列名|\.xlsx|打分表|阶梯表|准备清单/g;
export function storyArcPlanContractText(ruleFacts){
 const rf=ruleFacts||{};
 const horizon=rf.deadlineWeeks!=null
  ?('规则周界约 '+rf.deadlineWeeks+' 周（'+rf.deadlineDays+' 天）；四幕 period 对齐规则层 stages 的周界，不得缩短或越界。')
  :'按中长期人生阶段写四幕。';
 return [
  ' 【P0-29 深度契约·故事经过版（'+STORY_ARC_CONTRACT_VERSION+'）与推演叙事同构】',
  '1) 主路径是一篇读完想往下翻的短篇：起点处境→关键选择与转折→变化与代价→朝终局的跃迁。每幕 narrative 是连贯散文（≥450汉字，四幕合计≥1800，验收≥1500），要有场面（时间地点人物）、一两句对话、人物的犹豫与情绪、一个让局面翻转的转折点；幕与幕之间用因果衔接（上一幕的结果逼出下一幕的选择）。',
  '2) narrative 内不要写【处境】【行动】【变化】【代价】标签，也不要小标题、编号、列表。四元另以字段 situation/action/change/cost 输出（各60—120汉字，是该幕故事的提要），供逐项验收。每个对象输出 narrativeMode:"story-arc"。',
  '3) '+horizon,
  '4) 「怎么达成」写进故事因果：能力→产品→规模→资本→榜单，每一步说清为什么这一步能把财富放大一个量级、靠的是什么杠杆、谁在反对、付出了什么。',
  '5) 【禁清单体·一票否决】正文（narrative/四元/gate/任务）禁止出现文件名书名号《…》、服务清单、报价单/报价模板、发出记录、合并清单/前置清单、观察小结、空白模板、台账、表格列/列名等交付物规格书写法；不要讲具体项目细节或项目名。近端写成生活动作/对话/场面。',
  '6) 近端：第一章 quests 恰好2个，标题以“今天：”“本周：”开头，标题本身就是一个具体场面动作（和谁、在哪、说什么/做什么），5分钟能复述；output 写「怎样算做到」——一个本人可控、当天/当周可确认的结果（例如一句对方原话被记住、一段演示真的放给某人看了），不要求对方成交；example 写一句可以直接说出口的话；tool 写日常工具（电话、白板、手机、笔记本电脑）。',
  '7) 数字：不编造收入、估值、客户数、概率；需要的门槛只用规则层已给的；宁可用定性描述，也不要堆____占位。',
  '8) 合规：模拟非承诺；禁止算命、保证成功、必然成为；但「模拟」不是回避终局的理由——轨迹必须一路朝终局收敛。'
 ].join('')+(Array.isArray(rf.gateChain)&&rf.gateChain.length?storyArcAlgoText(rf):'');
}
/** 叙事算法最低集（结构层≠文学层）：门控链/情绪曲线/回望开头/幕尾第一步。规则层给骨架，正文只写场面。 */
export function storyArcAlgoText(rf){
 const gates=(rf.gateChain||[]).map(g=>g.id+'「'+g.name+'」→证明场面提示：'+g.proof+'（第'+g.act+'幕'+(g.terminal?'；终局门：只写离它还差一步的安静场面，不得写成已跨过':'')+'）').join('；');
 const beats=(rf.stages||[]).map((st,i)=>'第'+(i+1)+'幕 情绪'+st.emotion+' 层级'+st.tier+(st.beatHint?'：'+st.beatHint:'')).join('；');
 return [
  ' 【叙事算法·最低集（结构层≠文学层）】',
  NARRATIVE_ALGO_PROMPT.replace(/\n/g,' '),
  ' 门控链（规则层，从世界首富倒推，按序跨越，禁跳门）：'+gates+'。',
  ' 幕节拍（规则层）：'+beats+'。',
  ' 全篇 narrative 用「未来的你」第一人称“我”回望、对现在的你说话；第一幕 narrative 第一句以“我在你这个年纪时”开头（开头段≤150字，点到一个转折、一个低谷、一个人生项目）。',
  ' “后来的路和当时想的不太一样”全篇只说一次（放在开头段或第一幕里）。每幕 narrative ≥450汉字，第四幕≥'+(rf.act4MinHan||600)+'汉字：第四幕要跨的每一道门各写一个独立场面，这一步在现实里靠什么杠杆跨过去，用人物的动作和对话带出来（不要写成说明句），不要一句话连跨几道门。叙述者“我”是十年后的你，对读者“你”说话；提到当年的团队时用“大家”“他们”。'+
  ' 同一幕要跨不止一道门时：每道门先写一个具体的挡路现实（人、钱、监管或对手之一，不编数字），再写“我”亲自做的一个动作，最后才是被旁人看见的场面——每道门都要让读者看到“凭什么跨过去”。'+(rf.act4MinHan?(' 第四幕 narrative ≥'+rf.act4MinHan+'汉字。'):'')+' '+STORY_ARC_META_PROMPT+
  ' 每幕 narrative 最后一句以“这一幕的第一步：”开头，写今天就能做的一件生活小事；第一幕的第一步必须与第一章“今天：”任务是同一件事（同一个动作、同一个人/物）。',
  ' 另输出结构字段（供规则层校验，不进正文）：顶层 callbackObject（开头出现、末幕回扣的那个物件或场景，2—8字，须原样出现在第一幕和第四幕 narrative）；每章 gatesCrossed（本幕跨过的门 id 数组，按序）、gateScenes（[{gateId, scene}]，scene 为该门证明场面在 narrative 中的一句原文，逐字摘录）、emotion（本幕收尾情绪 -3..+3）、tier（日常|转折|高光|终局）、highlights（本幕高光场面原文句子数组，全篇合计≤2）、firstStep（本幕最后一句“这一幕的第一步：”之后的原文）；低谷所在章另输出 dip（{scene:低谷原文一句, payoff:写“换来了什么”的原文一句，须含“换来”}）。第四幕另输出 terminalDoor（站在终局门前的场面原文一句）；同幕跨多门时另输出 gateBlocks（[{gateId, obstacle:挡路现实原文一句, move:你本人动作原文一句}]，逐字摘自 narrative，顺序 obstacle→move→scene）。emotion 字段由规则层落值，你填的值会被覆盖。'
 ].join('');
}
/** 「小说体+逻辑可信」叙事层规则（plan 侧）。独立于 storyArc。 */
export function novelLogicPlanContractText(ruleFacts){
 const rf=ruleFacts||{};
 const horizon=rf.deadlineWeeks!=null
  ?('规则周界约 '+rf.deadlineWeeks+' 周（'+rf.deadlineDays+' 天）；四幕 period 对齐规则层 stages 的周界，不得缩短或越界。')
  :'按中长期人生阶段写四幕。';
 return [
  ' 【P0-29 深度契约·小说体+逻辑可信（'+NOVEL_LOGIC_CONTRACT_VERSION+'）与推演叙事同构】',
  '1) 主路径是一篇短篇/中篇小说的连续章节：人物视角与内心（犹豫、怕、算计、松一口气）用动作和感官带出；对话像真人；物件、天气、身体反应参与叙事；时间有质感（一夜/一季/几年后某天下午）。读完一幕想翻下一幕。每幕 narrative ≥480汉字，四幕合计≥2000（验收≥1800）；第四幕≥'+(rf.act4MinHan||900)+'汉字。',
  '2) narrative 内不要写【处境】【行动】【变化】【代价】标签，也不要「处境：」「行动：」等说明书小标题、编号、列表。四元另以字段 situation/action/change/cost 输出（各60—120汉字，是该幕故事的提要）。每个对象输出 narrativeMode:"novel-logic"。',
  '3) '+horizon,
  '4) 【逻辑三问·文学层必须用故事写清，不要答卷体】对规则层给出的每一道门，正文里要同时让读者看见：①卡点——钱/人/监管/市场/对手里具体哪一个在挡（不编假精确数字，可用量级与关系）；②他的杠杆——为什么是「水循环建模 + 两公司合并 + 某类客户/资本」能撬，而不是换一个通用创业套路也能写的句子；③跨门之后世界怎么变——所有权、现金流、名声、约束各变了什么，并为下一门埋下真实阻碍。禁只堆感人场面；可替换主角=FAIL。',
  '5) 【禁清单体·一票否决】正文禁止文件名书名号《…》、服务清单、报价单/报价模板、发出记录、合并清单/前置清单、观察小结、空白模板、台账、表格列等；不要讲具体项目细节或项目名。近端写成生活动作/对话/场面。',
  '6) 近端：第一章 quests 恰好2个，标题以“今天：”“本周：”开头，标题本身就是一个具体场面动作；output 写「怎样算做到」——本人可控结果；example 写一句能说出口的话；tool 写日常工具。',
  '7) 数字：不编造收入、估值、客户数、概率；需要的门槛只用规则层已给的。',
  '8) 合规：模拟非承诺；禁止算命、保证成功、必然成为；但「模拟」不是回避终局的理由——轨迹必须一路朝终局收敛；终局只写到门前或朝向。'
 ].join('')+(Array.isArray(rf.gateChain)&&rf.gateChain.length?novelLogicAlgoText(rf):'');
}
export function novelLogicAlgoText(rf){
 const gates=(rf.gateChain||[]).map(g=>{
  const bits=[g.id+'「'+g.name+'」'];
  if(g.blockType)bits.push('卡点类型：'+g.blockType);
  if(g.leverageHint)bits.push('杠杆提示：'+g.leverageHint);
  if(g.worldShiftHint)bits.push('跨门后世界：'+g.worldShiftHint);
  bits.push('场面提示（消化进故事，禁止照搬原文）：'+g.proof);
  bits.push('第'+g.act+'幕'+(g.terminal?'；终局门：只写离它还差一步的安静场面，不得写成已跨过':''));
  return bits.join(' · ');
 }).join('；');
 const beats=(rf.stages||[]).map((st,i)=>'第'+(i+1)+'幕 情绪'+st.emotion+' 层级'+st.tier+(st.beatHint?'：'+st.beatHint:'')).join('；');
 return [
  ' 【小说体·结构层≠文学层】结构层的门/幕/高光/情绪只给你组织情节，禁止写进正文。',
  ' 门控链（规则层，从世界首富倒推，按序跨越，禁跳门；每门已给卡点类型+杠杆提示，你只消化成小说叙事）：'+gates+'。',
  ' 幕节拍（规则层）：'+beats+'。',
  ' 全篇 narrative 用「未来的你」第一人称“我”回望、对现在的你说话；第一幕 narrative 第一句以“我在你这个年纪时”开头（开头段≤150字）。',
  ' “后来的路和当时想的不太一样”全篇只说一次。每幕 narrative ≥480汉字；第四幕≥'+(rf.act4MinHan||900)+'汉字：第四幕要跨的每一道门各写一个独立小说段落——先让读者感到卡点，再写“我”凭稀缺杠杆做的动作，再写跨门后世界（所有权/现金流/名声/约束）怎么变，最后才是旁人看见的余波；不要一句话连跨几道门，不要只堆敲钟/截图/对比图。',
  ' 【第四幕财富阶梯·硬】上市前后须用故事写清规模如何靠水循环建模+两公司长出来；个人净资产逼近公开入榜门槛须写清控股权与水数据/水基础设施资产关系（量级即可）；回购锁定是守榜不是入榜原因；禁止「截图=真正的转折」；彭博爬升禁止只靠对比图。第四幕建议≥900汉字。',
    ' '+NOVEL_LOGIC_META_PROMPT,
  ' 每幕用一个自然收束动作结束（关灯、倒水、出门、把手机扣在桌上），不要写“这一幕的第一步”；另在字段 firstStep 写今天就能做的一件生活小事（与第一章“今天：”任务同源），供规则层校验，不进 narrative 末句。',
  ' 另输出结构字段（供规则层校验，不进正文）：顶层 callbackObject；每章 gatesCrossed、gateScenes（[{gateId, scene}] 逐字摘录）、gateLogic（[{gateId, block:卡点原文一句, leverage:杠杆原文一句, worldShift:跨门后世界原文一句}]，均逐字摘自 narrative）、emotion、tier、highlights（全篇合计≤2）、firstStep、dip（低谷章）、terminalDoor（第四幕）；同幕跨多门时另输出 gateBlocks（[{gateId, obstacle, move}]）。emotion 字段由规则层落值。'
 ].join('');
}
export function novelLogicProjectionAddon(){
 return [
  '',
  '【小说体版·r2】四段要连成第二人称小说章节：内心、感官、对话、选择；字段 situation/action/change/cost 只是内部分块，读者可见长文由系统拼成连续散文——你写的每个字段正文里都不得出现「处境：」「行动：」「变化：」「代价：」字样或小标题。',
  '禁止出现书名号文件名、清单、报价单、模板、台账；禁止「证明场面」「这一幕的第一步」「真正的转折」套话；禁止用榜单截图/媒体对比图代替财富因果。',
  '若只读事实里给了「本段故事线」「本段卡点与杠杆」，必须沿着它写：卡点→他的水循环建模/两公司杠杆→跨门后世界怎么变。终局段写清控股权与水数据/水基础设施资产如何把个人净资产推向公开入榜门槛；回购锁定是守榜，不是入榜原因；彭博爬升要靠可审计模型赢标与资产扩表，不能只写“一点点往上爬”+对比图。',
  NOVEL_LOGIC_META_PROMPT,
  '【人称】只有第一段处境的第一句用“我在你这个年纪时，……”回望；紧接着必须有一句把镜头交给“你”的过渡句，此后全部以“你”为主语。其余各段一律以“你”为主语。',
  '【低谷/回扣】“低谷”二字只允许出现在只读事实标明「本段是低谷段」的那一段；回扣物件只在给了「回扣物件」的段里出现，且每段最多一次。',
  '【收束】不要写“这一幕的第一步”；系统会把规划里同一幕的 firstStep 自然接在行动字段末尾。',
  '【去模板】不要写“每周固定”；行动写这一段里你亲自做的几个场面动作。',
  '- 正文不写任何中文数量词，用“这些”“那家”“好几位”等不带数字字的说法代替。',
 ].join('\n');
}
/** 「故事经过」叙事层规则（projection 侧追加）。 */
export function storyArcProjectionAddon(){
 return [
  '',
  '【故事经过版】这四段要连成一个动人的故事：写场面、人物的选择与情绪、转折，因果上承接上一段、引出下一段；行动写成生活里看得见的动作和对话，不写交付物规格书。',
  '禁止出现书名号文件名、清单、报价单、模板、台账、记录表、观察小结等字样；不讲具体项目细节。',
  '若只读事实里给了「本段故事线」，必须沿着它写，与规划同源同深；终局段要正面写朝世界级财富冲刺的局面，但不写成已经实现或必然实现。',
  '【叙事算法·最低集】'+NARRATIVE_ALGO_PROMPT.replace(/\n/g,' ').replace('每幕最后一句写"这一幕的第一步"，要是今天就能做的一件小事。',''),
  '若只读事实里给了「本段要跨的门」，变化字段里必须写出跨门时被旁人看见的那个具体场面，按顺序，不跳过；终局只写站到它跟前的安静场面。',
  STORY_ARC_META_PROMPT,
  '【人称】只有第一段处境的第一句用“我在你这个年纪时，……”回望；紧接着必须有一句把镜头交给“你”的过渡句（例如“那时的我，就是现在的你。”），此后全部以“你”为主语，正文不再出现“我”“我们”（引号里的对白除外）。其余各段一律以“你”为主语。',
  '【低谷/回扣】“低谷”二字只允许出现在只读事实标明「本段是低谷段」的那一段；其他段不要写“低谷”。回扣物件只在只读事实给了「回扣物件」的段里出现，且每段最多出现一次。',
  '【第一步】不要写“这一幕的第一步”，系统会把规划里同一幕的第一步原文接在行动字段末尾。',
  '【去模板】不要写“每周固定”“每周固定的时间”“每周固定拿出时间”之类句式；行动写这一段里你亲自做的几个场面动作。',
 '- 正文不写任何中文数量词（如“两家”“三个”“一次”“几十年”“十几人”），用“这些”“那家”“好几位”等不带数字字的说法代替。',
 ].join('\n');
}

/** projection-story 系统提示追加：与 plan 同深度口径 + 周界。 */
export function projectionStoryDepthAddon(ruleFacts=null){
 const rf=ruleFacts||{};
 const bound=rf.deadlineWeeks!=null
  ?(`本条推演叙事周界锁定为约 ${rf.deadlineWeeks} 周（${rf.deadlineDays||''}天），不得写到更远的几十周。`)
  :('周界由规则层节点标注；正文仍不得出现数字。');
 const prose=isProseArc(rf);
 return [
  '',
  '【P0-29 S2 深度口径·与规划同构】四要素写细、可信、可照做；'+(prose?'行动写这一段里你亲自做的场面动作；':'行动写每周具体做法；')+'代价写真实取舍；变化只写可观察状态。',
  '整条行动线连读应有短篇人生轨迹感（中长期阶段为主轴，近端可执行），不是条目摘要。',
  bound,
  '禁止算命/保证成功；周数与收入数字由系统标注，正文仍不得出现数字。'
 ].join('\n')+(rf.beyondWater?beyondWaterProjectionAddon():rf.novelLogic?novelLogicProjectionAddon():rf.storyArc?storyArcProjectionAddon():'');
}


/** 「本人起点+跨出纯水务」叙事层规则（plan 侧）。独立于 novelLogic / storyArc。 */
export function beyondWaterPlanContractText(ruleFacts){
 const rf=ruleFacts||{};
 const horizon=rf.deadlineWeeks!=null
  ?('规则周界约 '+rf.deadlineWeeks+' 周（'+rf.deadlineDays+' 天）；四幕 period 对齐规则层 stages 的周界，不得缩短或越界。')
  :'按中长期人生阶段写四幕。';
 const leave=(rf.gateChain||[]).filter(g=>g.leaveWater).map(g=>g.id+'「'+g.name+'」').join('、')||'中后段至少两道 leaveWater 门';
 return [
  ' 【P0-29 深度契约·本人起点+跨出纯水务冲世界首富（'+BEYOND_WATER_CONTRACT_VERSION+'）与推演叙事同构】',
  '1) 文学层沿用小说章节标准：人物内心用动作与感官带出；对话像真人；物件/天气参与叙事。每幕 narrative ≥480汉字，四幕合计≥2000；第四幕≥'+(rf.act4MinHan||900)+'汉字。narrative 内禁止「处境：」「行动：」「变化：」「代价：」小标题与清单体；四元另放字段。每个对象输出 narrativeMode:"beyond-water"。',
  '2) '+horizon,
  '3) 【起点≠牢笼】开篇用逸泓水务≈5人+逸泓智能空壳、水循环建模作第一级杠杆/跳板；很早（第一或第二幕）须写出他意识到「纯水务营收做不到世界首富量级」的天花板感——用场面与内心，不要口号。',
  '4) 【终局≠水务做大】终局财富主叙事禁止仍落在「把水务/水数据公司做大到上市入榜」。门控链中 leaveWater 门（'+leave+'）必须写清离开纯水务：新行业或全球资本池；跨行业后，水务背景变成可迁移稀缺能力（系统建模、市政信任、物理世界数据），不是财富来源本身。赛道由故事长出（算力能源冷却/气候基础设施/全球资产配置/科技控股/主权级基础设施运营商等均可）。',
  '5) 【逻辑三问】每道门（含跨行业门）文学层写清：卡点→他的杠杆（为何从这个人的水务原点能跨）→世界变（业务版图/资本池/身份从水务创始人变成什么）。跨行业门须有可感知的第一笔非水务主业合同/股权/平台控制权场面。禁止榜单截图撑跃迁；禁止说明体/答卷体小标题。',
  '6) 近端：第一章 quests 恰好2个（今天：/本周：），场面动作；本人可控验收。',
  '7) 合规：模拟非承诺；禁止算命、保证成功、必然成为；「模拟」不是缩成水务龙头/入榜即停的借口——轨迹须一路朝世界首富收敛；终局只写到门前或朝向。'
 ].join('')+(Array.isArray(rf.gateChain)&&rf.gateChain.length?beyondWaterAlgoText(rf):'');
}
export function beyondWaterAlgoText(rf){
 const gates=(rf.gateChain||[]).map(g=>{
  const bits=[g.id+'「'+g.name+'」'];
  if(g.leaveWater)bits.push('【离开纯水务】');
  if(g.blockType)bits.push('卡点类型：'+g.blockType);
  if(g.leverageHint)bits.push('杠杆提示：'+g.leverageHint);
  if(g.worldShiftHint)bits.push('跨门后世界：'+g.worldShiftHint);
  bits.push('场面提示（消化进故事，禁止照搬）：'+g.proof);
  bits.push('第'+g.act+'幕'+(g.terminal?'；终局门：只写离它还差一步的安静场面，不得写成已跨过':''));
  return bits.join(' · ');
 }).join('；');
 const beats=(rf.stages||[]).map((st,i)=>'第'+(i+1)+'幕 情绪'+st.emotion+' 层级'+st.tier+(st.beatHint?'：'+st.beatHint:'')).join('；');
 return [
  ' 【beyond-water·结构层≠文学层】门/幕/高光/情绪只组织情节，禁止写进正文。',
  ' 门控链（按序跨越；标【离开纯水务】的门必须写出非水务主业合同/股权/平台控制权场面）：'+gates+'。',
  ' 幕节拍：'+beats+'。',
  ' 全篇用「未来的你」第一人称“我”回望；第一幕第一句以“我在你这个年纪时”开头；“后来的路和当时想的不太一样”全篇只一次。',
  ' 第四幕≥'+(rf.act4MinHan||900)+'汉字：G4–G6 各写独立段落；财富因果不得靠截图/对比图；终局主叙事须已离开纯水务（控股平台/全球资本/算力能源/气候基础设施等），水务只作可迁移能力回扣。',
  ' '+NOVEL_LOGIC_META_PROMPT,
  ' 每幕自然动作收束；firstStep 只放字段。另输出 callbackObject、gatesCrossed、gateScenes、gateLogic（block/leverage/worldShift 逐字摘自 narrative，G4–G6 的 worldShift 不得三门同句）、emotion、tier、highlights、dip、terminalDoor、gateBlocks。'
 ].join('');
}
export function beyondWaterProjectionAddon(){
 return [
  '',
  '【beyond-water·读者可见层】四段连成第二人称小说章节；字段 situation/action/change/cost 内部分块，长文由系统拼成连续散文——字段正文不得出现「处境：」「行动：」「变化：」「代价：」小标题。',
  '【起点跳板】前两段可用水务建模/两公司作杠杆，但须写出天花板意识；禁止整条轨迹用漏损/水合同解释全球首富量级。',
  '【跨行业硬】中后段（约第三、四段）必须出现离开纯水务的场面：第一笔非水务主业合同，或非水务股权/平台控制权；跨过后财富来源是新赛道或全球资本池，水务背景只作系统建模/市政信任/物理世界数据等可迁移能力。',
  '【终局禁令】禁止「终局财富解释仍落在水务/水数据公司做大到上市入榜」；禁止截图=转折；对比图只可作媒体后果。',
  '禁止书名号文件名、清单、报价单、模板、台账；禁止「证明场面」「这一幕的第一步」。',
  NOVEL_LOGIC_META_PROMPT,
  '【人称】第一段处境首句可用“我在你这个年纪时…”回望，紧接过渡到“你”；其余段一律“你”。',
  '【低谷/回扣】“低谷”只在标明低谷段出现；回扣物件按只读事实。',
  '【收束】不要写“这一幕的第一步”；系统会把 firstStep 接在行动末尾。',
  '【去模板】不要写“每周固定”。正文不写中文数量词，用“这些”“那家”“好几位”等代替。',
 ].join('\n');
}

/** 环境开关：默认开启深度契约；设 AI_DEPTH_CONTRACT=0 可回退旧基线便于对照。 */
export function depthContractEnabled(env={}){
 const v=String(env.AI_DEPTH_CONTRACT??'1').trim().toLowerCase();
 return !(v==='0'||v==='false'||v==='off'||v==='no');
}
