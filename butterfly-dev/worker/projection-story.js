/**
 * P0-14 详细故事版（短摘要 + 长文双档）。isomorphic，不依赖 node:*。
 * 叙事层只写文字：节点周数、收入区间只来自规则层（computeProjection 输出），故事不得改动。
 *  - storyTemplate：确定性模板（兜底 / 演示 / 模型不可用）
 *  - generateStoryLLM：DeepSeek/线上优先（若配置），否则本地 ollama；深度契约下用同构 4 段脊柱（≤ruleFacts 周界）+ 近端今天/本周
 *  - storyValidate：S1 长度、S2 四要素、S3 R8 零命中、数字锁定（数字必须来自规则层）
 */
import {PROJECTION_PARAMS} from './projection-params.js';
import {pjScanBanned,pjSoften} from './projection.js';
import {STORY_ARC_META_RE,STORY_ARC_TEMPLATE_RE,NOVEL_LOGIC_META_RE,projectionStoryDepthAddon,depthContractEnabled,buildRuleFacts,withDepthStoryProj,nearTermFromPlanStory,DEPTH_CONTRACT_VERSION,contractVersionFor,isProseArc} from './depth-contract.js';

export const STORY_FIELDS=[['situation','处境'],['action','行动'],['change','变化'],['cost','代价']];
const psCount=s=>[...String(s||'').replace(/\s+/g,'')].length;
const psPlan=proj=>(proj?.lines||[]).find(l=>l.kind==='plan')||{nodes:[],horizon:null};
const psRange=t=>t?'第 '+t.lo+'–'+t.hi+' 周':'';
const psDur=t=>t?'约 '+t.lo+'–'+t.hi+' 周':'';
const PS_ORD=['一','二','三','四','五','六','七','八','九','十'];

/** 只读事实（规则层输出 + 已确认角色卡）。模型输入只取文字，不取数字。 */
export function storyContext(proj,roleFacts=null){
 const get=k=>roleFacts?.facts?.find(f=>f.key===k)?.value;
 const items=proj?.goalTree?.items||[];
 const goalNode=psPlan(proj).nodes.find(n=>n.dim==='goal');
 const goal=String(get('goal')||goalNode?.evidence?.find(e=>e.factRef==='f_goal')?.text||items.find(i=>i.level==='stage')?.text||items[0]?.text||'阶段目标').trim();
 const role=String(get('role')||'').trim();
 const city=String(get('city')||(proj?.income?.available?proj.income.city:'')||'').trim();
 const hours=proj?.hours?.known?proj.hours.value:null;
 return {goal,role,city,hours,income:proj?.income?.available?{low:proj.income.low,high:proj.income.high}:null,horizon:psPlan(proj).horizon,nodes:psPlan(proj).nodes};
}

/* ---------------- 数字锁定 ---------------- */
const PS_CN={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
function psCnNum(s){
 if(!s)return NaN;if(s==='十')return 10;
 const i=s.indexOf('十');
 if(i<0)return s.length===1?PS_CN[s]:Number([...s].map(c=>PS_CN[c]).join(''));
 const a=i===0?1:PS_CN[s.slice(0,i)],b=s.slice(i+1)?PS_CN[s.slice(i+1)]:0;return a*10+b;
}
const PS_CN_UNIT=/([零一二两三四五六七八九十]+)\s*(?:个)?\s*(周|星期|个月|月|年|小时|天|元|块|万|千|级|倍|%)/g;
const PS_PAIR_WEEK=/(\d+)\s*[–\-~～至到]\s*(\d+)\s*周/g;
const PS_PAIR_YUAN=/(\d+)\s*[–\-~～至到]\s*(\d+)\s*元/g;
function psNumsOf(text){
 const s=String(text??'');const out=[];
 for(const m of s.matchAll(/\d+(?:\.\d+)?/g))out.push(Number(m[0]));
 for(const m of s.matchAll(PS_CN_UNIT)){if(s[m.index-1]==='每'||s[m.index-1]==='第')continue;const n=psCnNum(m[1]);if(Number.isFinite(n))out.push(n);}
 return out;
}
/** 规则层允许出现的数字（节点周数/时长/等级、总周期、每周小时、收入区间与分档、依据原文中的数字）。 */
export function storyAllowed(proj,roleFacts=null){
 const nums=new Set(),weekPairs=new Set(),yuanPairs=new Set();
 const add=v=>{const n=Number(v);if(Number.isFinite(n))nums.add(n);};
 const L=psPlan(proj);
 for(const n of L.nodes){for(const t of [n.tRange,n.duration])if(t){add(t.lo);add(t.hi);weekPairs.add(t.lo+'-'+t.hi);}add(n.level);add(n.targetLevel);for(const e of n.evidence||[])psNumsOf(e.text).forEach(add);}
 if(L.horizon){add(L.horizon.lo);add(L.horizon.hi);weekPairs.add(L.horizon.lo+'-'+L.horizon.hi);}
 if(proj?.hours?.known)add(proj.hours.value);
 const I=proj?.income;if(I?.available){add(I.low);add(I.high);yuanPairs.add(I.low+'-'+I.high);for(const s of I.stages||[]){add(s.lo);add(s.hi);yuanPairs.add(s.lo+'-'+s.hi);}}
 for(const i of proj?.goalTree?.items||[])psNumsOf(i.text).forEach(add);
 for(const f of roleFacts?.facts||[])psNumsOf(f.value).forEach(add);
 return {nums,weekPairs,yuanPairs};
}
/** 检查一段文字里的数字是否全部来自规则层；node 给定时「x–y 周」必须等于该节点的区间或时长。 */
export function storyNumberIssues(text,A,node=null){
 const s=String(text??''),issues=[];
 for(const n of psNumsOf(s))if(!A.nums.has(n))issues.push({type:'number_not_in_rules',value:n});
 for(const m of s.matchAll(PS_PAIR_WEEK)){const k=m[1]+'-'+m[2];
  if(node){const ok=[node.tRange,node.duration].some(t=>t&&t.lo+'-'+t.hi===k);if(!ok)issues.push({type:'week_range_mismatch',value:k,node:node.id});}
  else if(!A.weekPairs.has(k))issues.push({type:'week_range_mismatch',value:k});}
 for(const m of s.matchAll(PS_PAIR_YUAN)){const k=m[1]+'-'+m[2];if(!A.yuanPairs.has(k))issues.push({type:'income_mismatch',value:k});}
 return issues;
}

/* ---------------- 模板（确定性兜底） ---------------- */
const psEv=n=>(n.evidence||[]).filter(e=>e.factRef!=='f_hours'&&e.factRef!=='f_goal'&&!/^\s*\d+(\.\d+)?\s*$/.test(e.text)).map(e=>e.label+'是「'+e.text+'」').join('，');
const PS_TPL={
 time:{
  situation:c=>c.T+'前后，这一段的主题是「'+c.title+'」。你现在是'+c.role+'，日常本身已经占去大半精力，留给「'+c.goal+'」的时间还没有固定下来，常常是想起来才做一点，做完也难以接上。',
  action:c=>'你先不急着加量，而是在日历里锁定固定的投入时段，'+c.hoursPhrase+'；每次开始前写下要做的那一件事，结束后用一句话记下实际完成了什么，让投入变成可以回看的记录。',
  change:c=>'到这一段结束，'+c.state.role+'。你不再需要每次重新说服自己开始，记录本身也开始告诉你哪些时段更容易坚持、哪些安排需要调整。',
  cost:c=>'要从原本的休息或娱乐里切出一块固定时间，前几周会不太习惯，也可能因为加班或家事打乱节奏；这时候按原因记录暂停，比硬撑更有用。'},
 ability:{
  situation:c=>c.T+'前后，你站在「'+c.title+'」这一段的起点。'+(c.ev?c.ev+'，这是你已有的底子，':'你已经有一些零散的基础，')+'但离「'+c.goal+'」需要的核心能力还差一段：能做一些零散的操作，还不能独立交出一个完整的小成果。',
  action:c=>'你把目标需要的能力拆成几项具体的小技能，先挑最弱的一项练；每周找一个公开的同类示例，只模仿其中一个片段，再把自己的结果和示例放在一起对比，写下一条差距，下一次只改这一处。',
  change:c=>c.D+'之后，'+c.state.gap+'。更重要的是，'+c.state.role+'，你手里开始有能拿出来给别人看的东西，而不只是“学过”的感觉。',
  cost:c=>'重复和枯燥：同一个小技能可能要练很多遍，进步常常看不出来；'+c.lifePhrase+'，意味着有些晚上和周末要让给练习，也会遇到卡住几天没有头绪的时候。'},
 credential:{
  situation:c=>'进入'+c.T+'前后，「'+c.title+'」成了绕不开的一段。目标方向对资质有要求，而你对报考条件、时间和难度还只有模糊印象，容易一直停留在“以后再说”。',
  action:c=>'你先在官方渠道查清报考条件和时间，逐条对照自己已满足和未满足的部分，定下最近一次可以报考的场次；然后找公开样题限时做一部分，记下最薄弱的章节，按章节安排每周的复习。',
  change:c=>'这一段结束时，'+c.state.role+'。原本悬着的一件事有了明确的时间表，你知道自己卡在哪几章，复习从“全部都要看”变成“只补这几处”。',
  cost:c=>'要付出报名费、资料费和大块的复习时间，还要承受考试结果的不确定；如果这一次没有通过，下一场的时间会把后面的节点一起往后推，需要提前留出余地。'},
 experience:{
  situation:c=>c.T+'前后，你来到「'+c.title+'」。能力和资质开始有了样子，'+(c.ev?'虽然'+c.ev+'，':'')+'但在目标方向的人眼里，你还缺一段能讲清楚的相关经历：做过什么、为谁做、结果怎样，暂时还说不完整。',
  action:c=>'你从身边找一个与目标相关的真实小需求，写清对象、要解决的事和最小交付，先做出第一版，请一位熟悉的人看一眼并记下反馈，再根据反馈改一处；一个场景做完，再换一个稍复杂一点的场景。',
  change:c=>c.D+'下来，'+c.state.gap+'，'+c.state.role+'。你开始能用具体的例子回答“你做过什么”，而不是只说自己学过什么。',
  cost:c=>'这往往是行动线里较长的一段，需要在本职工作之外多承担一些事，可能会占用休息时间，做出来的东西也可能暂时没人用；需要接受第一版粗糙，并在反馈里听到不太好听的意见。'},
 network:{
  situation:c=>c.T+'前后，进入「'+c.title+'」。你已经积累了一些练习和实践，但它们散落在各处，认识的人里也很少有目标方向的从业者，别人还看不到你在做的事。',
  action:c=>'你把已有的成果整理成一份作品清单，挑出最能说明能力的一件写两句说明；然后从资源或熟人里选一位相关的人，发一段不推销的请教消息并附上作品，记录对方的回复或“暂无回复”。',
  change:c=>'这一段结束时，'+c.state.role+'。你的作品被目标方向的人看过，哪怕只得到很短的意见，也比独自摸索更清楚下一步该补什么。',
  cost:c=>'更多是心理上的：主动联系不熟的人、把还不够完美的作品拿给别人看，都需要一点勇气；很多消息可能没有回音，整理作品也会占掉原本用来练习的时间。'},
 income:{
  situation:c=>c.T+'前后，进入「'+c.title+'」。前面几段让你有了能力、经历和作品，但它们能不能换来真实的收入，还没有被验证过，这也是很多人最犹豫的一步。',
  action:c=>'你先写一份一句话服务说明：能为谁解决什么问题、交付什么、大致需要多久，并标注“试单”；然后把它发给一个可能需要的对象或公开需求渠道，记录发送时间和回复情况，再按反馈调整说明。',
  change:c=>'这一段结束时，'+c.state.role+'。'+c.incomePhrase+'你对自己的能力在市场上大致处在什么位置，有了一手的感受。',
  cost:c=>'可能被拒绝或被压价，试单的报酬也可能很低，甚至需要先做一次免费的小样；同时还要在本职工作和试单之间分配精力，避免两头都顾不上。'},
 goal:{
  situation:c=>'走到'+c.T+'前后，就是「'+c.title+'」这一段。前面的节点按计划推进后，你需要回到最初的目标「'+c.goal+'」，用真实的申请、面试或作品反馈检验自己是否已经具备条件。',
  action:c=>'你整理这段时间留下的记录、作品和反馈，对照目标岗位或方向的要求逐条核对，然后发出申请或开始正式尝试；每一次回复都记下来，没有结果的部分也写清原因。',
  change:c=>c.D+'的检验之后，'+c.state.role+'。不管是推进到下一步，还是发现还需要补某一块，你都会得到比现在清楚得多的答案，而这份答案来自你自己的记录。',
  cost:c=>'要直面检验结果本身：可能需要多次尝试，也可能发现某个前置节点还要回头补；这段时间的压力会比前面大，'+c.lifePhrase+'的节奏需要尽量保住，不要一次透支。'}
};
const PS_EXT={
 situation:'这一段开始前，可以先回看上一段留下的记录，确认哪些已经做到、哪些还要带着往前走。',
 action:'每周结束时花几分钟写下做了什么、卡在哪里，下周只调整其中一处，让节奏可以持续。',
 change:'这些变化不一定显眼，但会体现在你的记录里：做同样的事花的时间更短，需要问别人的地方更少。',
 cost:'如果某一周实在顾不上，按原因记一次暂停就好，行动线会按实际记录重新推演，不需要一次补回来。'
};
function psNodeCtx(n,ctx,i){
 const hoursPhrase=ctx.hours!=null?'按每周约 '+ctx.hours+' 小时安排':'先从每次很短的时间开始';
 return {title:n.title,goal:ctx.goal,role:ctx.role||'现在的自己',T:psRange(n.tRange),D:psDur(n.duration),state:n.state||{gap:'',role:'',life:''},ev:psEv(n),
  hoursPhrase,lifePhrase:ctx.hours!=null?'每周保持约 '+ctx.hours+' 小时投入':'在日常之外持续投入',
  incomePhrase:ctx.income?'规则层给出的参考区间是每月 '+ctx.income.low+'–'+ctx.income.high+' 元（税前，基于公开资料估算），这一段的验证会让你知道自己离这个区间还差哪些条件。':'',ord:PS_ORD[i]||String(i+1)};
}
export function storyTemplateNode(n,ctx,i=0){
 const T=PS_TPL[n.dim]||PS_TPL.ability,c=psNodeCtx(n,ctx,i);
 return Object.fromEntries(STORY_FIELDS.map(([k])=>[k,T[k](c)]));
}
function psSummary(ctx,P){
 const nodes=ctx.nodes.filter(n=>n.dim!=='goal');const longest=[...nodes].sort((a,b)=>(b.duration?.hi||0)-(a.duration?.hi||0))[0];
 const h=ctx.hours!=null?'每周约 '+ctx.hours+' 小时投入':'每周投入时间尚未确认';
 let s='从'+(ctx.role||'现在的你')+'出发，目标是「'+ctx.goal+'」。按'+h+'估算，行动线依次经过'+nodes.map(n=>'「'+n.title+'」').join('、')+'，预计约'+psRange(ctx.horizon)+'前后到达阶段目标验证。';
 if(longest)s+='用时最长的一段是「'+longest.title+'」（'+psRange(longest.tRange)+'）。';
 s+=ctx.novelLogic?'这是基于你所给条件的模拟，展开下方是连续的故事章节。':'这是基于你所给条件的模拟，展开下方可以看到每一段的处境、行动、变化与代价。';
 const max=P.story?.summaryMaxChars||320;return psCount(s)>max?s.slice(0,max):s;
}
function psIntro(ctx){
 const head='这是一份按你所给条件写成的模拟故事，不是对未来的承诺。故事的起点是现在的你：'+(ctx.role||'正在准备改变的人')+(ctx.city?'，在'+ctx.city:'')+'，'+(ctx.hours!=null?'每周大约能拿出 '+ctx.hours+' 小时':'每周能投入的时间还没有确定')+'，想要「'+ctx.goal+'」。';
 if(ctx.novelLogic)return head+'下面按行动线的各个节点展开成连续的故事章节；节点的周数只来自上方行动线，故事不会改动它们。';
 return head+'下面按行动线的各个节点展开，每一段都写了处境、行动、变化和代价；节点的周数只来自上方行动线，故事不会改动它们。';
}
const PS_OUTRO='如果实际执行和计划不同，比如某一段花了更长时间，或中途因为工作、家事暂停，行动线会按你的执行记录重新推演，这份故事也可以重新生成。故事里的每一段都只是一种可能的走法，真正的节奏由你每周的记录决定。';
/** perNode → 长文（标题行带规则层区间）。novelLogic：字段拼成章节散文，不泄漏处境/行动/变化/代价小标题。 */
export function storyLongForm(perNode,ctx){
 const parts=[psIntro(ctx)];
 perNode.forEach((x,i)=>{
  parts.push('【第'+(PS_ORD[i]||String(i+1))+'段 · '+x.title+'（'+psRange(x.tRange)+'前后）】');
  if(ctx.novelLogic){
   const body=STORY_FIELDS.map(([k])=>String(x[k]||'').trim()).filter(Boolean).join('');
   parts.push(body);
  }else{
   for(const [k,l] of STORY_FIELDS)parts.push(l+'：'+x[k]);
  }
 });
 parts.push(PS_OUTRO);return parts.join('\n');
}
/** 长度调节：不足 minChars → 逐字段补充通用句；超过 maxChars → 从末尾句子裁剪（保留 ≥ fieldMinChars）。 */
function psFit(perNode,ctx,P){
 const S=P.story||{},min=S.minChars||1500,max=S.maxChars||3000,fmin=S.fieldMinChars||30;
 const len=()=>psCount(storyLongForm(perNode,ctx));
 for(const [k] of STORY_FIELDS){if(len()>=min)break;for(const x of perNode){if(len()>=min)break;if(!x[k].includes(PS_EXT[k]))x[k]+=PS_EXT[k];}}
 let guard=0;
 while(len()>max&&guard++<200){
  let best=null;for(const x of perNode)for(const [k] of STORY_FIELDS){const parts=x[k].split(/(?<=[。；！？])/).filter(Boolean);if(parts.length>1&&psCount(parts.slice(0,-1).join(''))>=fmin&&(!best||psCount(x[k])>psCount(best.x[best.k])))best={x,k,parts};}
  if(!best)break;best.x[best.k]=best.parts.slice(0,-1).join('');
 }
 return perNode;
}
function psAssemble(proj,ctx,perNode,{P=PROJECTION_PARAMS,source='template',model=null,ms=null,now=new Date().toISOString(),attempts=[]}={}){
 psFit(perNode,ctx,P);
 const story={schema:'story/v1',version:P.story?.version||'story-v1',status:'ready',badge:P.aiBadge,source,model,sourceNote:P.story?.sourceNote?.[source]||'',
  pendingText:P.story?.pendingText||'',summary:psSummary(ctx,P),longForm:storyLongForm(perNode,ctx),perNode,generatedAt:now,ms,attempts,
  progress:{done:perNode.length,total:perNode.length}};
 story.chars=psCount(story.longForm);
 return story;
}
/** 确定性模板故事（兜底；数字只来自规则层）。 */
export function storyTemplate(proj,{roleFacts=null,P=PROJECTION_PARAMS,now}={}){
 const ctx=storyContext(proj,roleFacts);
 const perNode=ctx.nodes.map((n,i)=>({nodeId:n.id,title:n.title,tRange:n.tRange,...storyTemplateNode(n,ctx,i),source:'template'}));
 const s=psAssemble(proj,ctx,perNode,{P,source:'template',now});s.validation=storyValidate(s,proj,{roleFacts,P});return s;
}

/* ---------------- 校验 S1–S3 + 数字锁定 ---------------- */
export function storyValidate(story,proj,{roleFacts=null,P=PROJECTION_PARAMS}={}){
 const S=P.story||{},min=S.minChars||1500,max=S.maxChars||3000,fmin=S.fieldMinChars||30;
 const out={};const L=psPlan(proj),A=storyAllowed(proj,roleFacts);
 const chars=psCount(story?.longForm);
 out.S1={pass:chars>=min&&chars<=max,chars,min,max};
 const missing=[];
 for(const n of L.nodes){const x=(story?.perNode||[]).find(p=>p.nodeId===n.id);
  if(!x){missing.push({node:n.id,field:'all'});continue;}
  for(const [k] of STORY_FIELDS)if(psCount(x[k])<fmin)missing.push({node:n.id,field:k});
  if(!String(story.longForm||'').includes(n.title))missing.push({node:n.id,field:'longForm_title'});}
 out.S2={pass:!missing.length&&(story?.perNode||[]).length===L.nodes.length,nodes:L.nodes.length,missing};
 const hits=pjScanBanned({summary:story?.summary,longForm:story?.longForm,perNode:story?.perNode,sourceNote:story?.sourceNote},{P,path:'$.story'});
 out.S3={pass:!hits.length,hits};
 const nl=[];
 nl.push(...storyNumberIssues(story?.summary,A).map(x=>({...x,where:'summary'})));
 nl.push(...storyNumberIssues(story?.longForm,A).map(x=>({...x,where:'longForm'})));
 for(const x of story?.perNode||[]){const n=L.nodes.find(z=>z.id===x.nodeId);
  if(n&&(x.tRange?.lo!==n.tRange.lo||x.tRange?.hi!==n.tRange.hi))nl.push({type:'node_trange_changed',node:x.nodeId});
  for(const [k] of STORY_FIELDS)nl.push(...storyNumberIssues(x[k],A,n).map(z=>({...z,where:x.nodeId+'.'+k})));}
 out.numberLock={pass:!nl.length,issues:nl.slice(0,20)};
 out.pass=out.S1.pass&&out.S2.pass&&out.S3.pass&&out.numberLock.pass;
 return out;
}

/* ---------------- 本地模型分段生成 ---------------- */
export const STORY_SYSTEM_PROMPT=[
 '你是「人生推演」的叙事写作者，只负责把规则层已经算好的一个行动线节点，改写成一段平实、具体、温和的故事。',
 '硬性要求：',
 '1. 只使用【只读事实】里的信息；不得新增具体的公司、证书名称、经历或收入数字，不得改动节点标题。',
 '2. 不写任何数字：不要出现阿拉伯数字，也不要用中文数字表示时间、金额、比例或等级（例如“三周”“五千元”“两级”“三个晚上”“两次”都不允许，可以写“几个晚上”“每周固定的时间”）；节点的周数和收入区间由系统另行标注。',
 '3. 不使用绝对化或宿命类词语：保证、一定、必然、必定、肯定能、绝对、百分之百、确保、注定、命运、预测、预言、改变命运、逆天改命、稳赚、包过、包上岸、唯一、最准；不评判、不贴标签（例如懒、不自律、拖延症、失败的人生、落后于他人），不制造焦虑。',
 '4. 用第二人称“你”，写成连贯的叙述句；不要列表、不要标题、不要引号口号、不要提到“规则层”“模型”。',
 '5. 输出 JSON，四个字段都必须写，每个字段 {MIN}–{MAX} 个汉字：',
 '   situation（处境）：这一段开始时你所处的状况与卡点；',
 '   action（行动）：这一段里你每周具体做的事；',
 '   change（变化）：这一段结束时可以观察到的变化（只写状态，不写数字）；',
 '   cost（代价）：为此付出的时间、精力或放弃的东西，以及可能遇到的不顺。'
].join('\n');
const psSchema={type:'object',properties:{situation:{type:'string'},action:{type:'string'},change:{type:'string'},cost:{type:'string'}},required:['situation','action','change','cost']};
export function buildStoryNodePrompt(n,ctx,i,{min=60,max=110,env=null,ruleFacts=null}={}){
 const L=ctx.nodes;const prev=L[i-1],next=L[i+1];
 const facts={目标:ctx.goal,当前身份:ctx.role||'未提供',城市:ctx.city||'未提供',本段节点:n.title,本段结束时的状态:[n.state?.gap,n.state?.role].filter(Boolean).join('；').replace(/\d+\s*级/g,'').replace(/由\s*至约\s*/g,'缩小'),
  生活节奏:ctx.hours!=null?'每周有固定的投入时间':'每周投入时间尚未确认',依据:(n.evidence||[]).filter(e=>e.factRef!=='f_hours'&&!/^\s*\d+(\.\d+)?\s*$/.test(e.text)).map(e=>e.label+'：'+e.text),
  上一段:prev?prev.title:'（这是第一段）',下一段:next?next.title:'（这是最后一段）',
  规则层节点周界只读:n.tRange?('本段对应行动线第'+n.tRange.lo+'–'+n.tRange.hi+'周（勿写入正文）'):'未提供',
  规则层总期限只读:ruleFacts?.deadlineWeeks!=null?('全轨迹不得越出约'+ruleFacts.deadlineWeeks+'周'):'未提供'};
 // prose-arc（storyArc 或 novelLogic）：注入与规划同源的本段故事线。
 if(isProseArc(ruleFacts)&&n.depthStage){const st=(ruleFacts.stages||[]).find(s=>s.key===n.depthStage);if(st?.planBeat)facts.本段故事线=st.planBeat;if(st?.wealthStep)facts.本段财富杠杆=st.wealthStep;if(st?.gatesText)facts.本段要跨的门=st.gatesText;if(st?.gateLogicText)facts.本段卡点与杠杆=st.gateLogicText;if(st?.emotion!=null)facts.本段情绪=st.emotion;if(ruleFacts.callbackObject&&(st.callbackHere??true))facts.回扣物件=ruleFacts.callbackObject+(st.callbackHere?'（本段只出现一次）':'');if(Array.isArray(ruleFacts.gateChain)){delete facts.本段结束时的状态;delete facts.生活节奏;facts.开头口吻=(i===0&&ruleFacts.projOpener)?('本段开头两句由规则层写好、会自动放在最前面：『'+ruleFacts.projOpener+'』。你从第三句开始写处境，紧接着这两句往下讲，全部以“你”为主语，不要重复这两句，不要用“我在你这个年纪时”，正文不出现“我”'):i===0?'本段处境第一句用“我在你这个年纪时，……”回望；紧接着一句过渡把镜头交给“你”（如“那时的我，就是现在的你。”），此后全部以“你”为主语，不再出现“我”':'本段不是第一段：不要用“我在你这个年纪时”开头，全部以“你”为主语叙述，正文不出现“我”';facts.低谷=st.isDip?'本段是低谷段：可以写“低谷”，写清楚它换来的具体场面（不用问句）':'本段不是低谷段：正文不要出现“低谷”二字';if(st.callbackHere===false)facts.回扣物件说明='本段不要提回扣物件';}}
 const depth=depthContractEnabled(env||{});
 let sys0=STORY_SYSTEM_PROMPT.replace('{MIN}',min).replace('{MAX}',max);
 // prose-arc：去掉「每周固定」模板源。
 if(isProseArc(ruleFacts))sys0=sys0.replace('“每周固定的时间”','“那些晚上”').replace('这一段里你每周具体做的事','这一段里你亲自做的事，写成场面和动作');
 const sys=sys0+(depth?projectionStoryDepthAddon(ruleFacts):'');
 return {system:sys,user:'【只读事实】\n'+JSON.stringify(facts,null,1)+'\n请只输出 JSON：{"situation":"…","action":"…","change":"…","cost":"…"}'};
}
/** 清洗 + 逐字段校验；返回 {value, ok, issue}。 */
export function storyCleanField(raw,{A,node,P=PROJECTION_PARAMS,max=110}){
 let s=String(raw??'').replace(/[\r\n]+/g,'').replace(/^\s*(处境|行动|变化|代价|situation|action|change|cost)\s*[:：]\s*/i,'').replace(/[*#`]/g,'').trim();
 s=s.replace(/一定的?(?=差距|基础|难度|经验|距离|了解|压力|时间|进步|认识|成果|积累)/g,'一些');
 s=pjSoften(s);
 const cap=Math.round(max*1.4);if(psCount(s)>cap){const parts=s.split(/(?<=[。；！？])/);let t='';for(const p of parts){if(psCount(t+p)>cap)break;t+=p;}s=t||s.slice(0,cap);}
 if(s&&!/[。！？]$/.test(s))s=s.replace(/[，、；：]$/,'')+'。';
 const fmin=P.story?.fieldMinChars||30;
 if(psCount(s)<fmin)return {value:s,ok:false,issue:'too_short'};
 if(/\d/.test(s))return {value:s,ok:false,issue:'digits'};
 if(/[两二三四五六七八九十百千万]+\s*(?:个|次|天|晚|周|月|年|小时|门|本|项|场|份|倍|成)/.test(s))return {value:s,ok:false,issue:'cn_count'};
 if([...s.matchAll(PS_CN_UNIT)].some(m=>s[m.index-1]!=='每'&&s[m.index-1]!=='第'))return {value:s,ok:false,issue:'cn_number'};
 const ni=storyNumberIssues(s,A,node);if(ni.length)return {value:s,ok:false,issue:'number:'+ni[0].type};
 if(pjScanBanned(s,{P}).length)return {value:s,ok:false,issue:'banned'};
 return {value:s,ok:true};
}
function psReadOnlineKey(env){
 return String(env?.BUTTERFLY_LLM_API_KEY||env?.DEEPSEEK_API_KEY||env?.OPENAI_API_KEY||env?.AI_API_KEY||'').trim();
}
function psWantOnline(env){
 const p=String(env?.BUTTERFLY_LLM_PROVIDER||env?.AI_PROVIDER||env?.AI_STORY_PROVIDER||'').toLowerCase();
 return ['deepseek','openai','openai_compatible','online'].includes(p);
}
async function psOllama(fetchImpl,base,model,prompt,{timeoutMs,temperature}){
 const r=await fetchImpl(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,stream:false,format:psSchema,options:{temperature,num_predict:1100},messages:[{role:'system',content:prompt.system},{role:'user',content:prompt.user}]}),signal:AbortSignal.timeout(timeoutMs),redirect:'error'});
 if(!r.ok)throw Error('chat_http_'+r.status);
 const res=await r.json();if(res.remote_host||res.remote_model)throw Error('remote_blocked');if(res.done_reason==='length')throw Error('truncated');
 return JSON.parse(res.message?.content||'{}');
}
async function psOnline(fetchImpl,env,model,prompt,{timeoutMs,temperature}){
 const key=psReadOnlineKey(env);if(!key)throw Error('online_key_missing');
 const base=(env.BUTTERFLY_LLM_BASE_URL||env.AI_BASE_URL||'https://api.deepseek.com').replace(/\/$/,'');
 const url=/\/chat\/completions$/.test(base)?base:(base+'/chat/completions');
 const body={model,messages:[{role:'system',content:prompt.system},{role:'user',content:prompt.user}],response_format:{type:'json_object'},max_tokens:2200,temperature:temperature??0.4};
 if(String(env.BUTTERFLY_LLM_PROVIDER||env.AI_PROVIDER||'').toLowerCase()==='deepseek')body.thinking={type:'disabled'};
 const r=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs||120000)});
 if(!r.ok)throw Error('online_http_'+r.status);
 const res=await r.json();
 const content=res.choices?.[0]?.message?.content||'{}';
 if(res.choices?.[0]?.finish_reason==='length')throw Error('truncated');
 return JSON.parse(content);
}
async function psNearTermOnline(fetchImpl,env,model,ctx,ruleFacts){
 const key=psReadOnlineKey(env);if(!key)return null;
 const sys='你是中文目标执行教练。只输出JSON。任务须本人可控、可当天/本周完成；禁止保证成功/算命；不编造收入。';
 const user='档案目标：'+ctx.goal+'；身份：'+(ctx.role||'')+'；每周小时：'+(ctx.hours??'未知')+'。规则周界约 '+(ruleFacts?.deadlineWeeks||'')+' 周。请给出与「规划你的下一步」同构的近端两卡：{"today":{"title":"今天：…","output":"交付物与验收","minutes":20},"week":{"title":"本周：…","output":"交付物与验收","minutes":30}}。title 必须分别以“今天：”“本周：”开头。';
 const base=(env.BUTTERFLY_LLM_BASE_URL||env.AI_BASE_URL||'https://api.deepseek.com').replace(/\/$/,'');
 const url=/\/chat\/completions$/.test(base)?base:(base+'/chat/completions');
 const body={model,messages:[{role:'system',content:sys},{role:'user',content:user}],response_format:{type:'json_object'},max_tokens:800,temperature:0.2};
 if(String(env.BUTTERFLY_LLM_PROVIDER||env.AI_PROVIDER||'').toLowerCase()==='deepseek')body.thinking={type:'disabled'};
 const r=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 if(!r.ok)return null;
 const res=await r.json();
 try{return JSON.parse(res.choices?.[0]?.message?.content||'{}');}catch{return null;}
}
function psNearTermFallback(ctx){
 return {
  today:{title:'今天：写下本周第一步并留下可核对痕迹',output:'一张含日期与动作的记录（可截图）',minutes:20},
  week:{title:'本周：按记录完成一次可检查的小改进',output:'一份本周跟进记录（做了什么/结果）',minutes:30}
 };
}
/* v1.26.59 story-arc 字段级校验：元词 / 每周固定 / 低谷越段 / 回扣超额 / 人称。 */
const psStripQuotes=s=>String(s).replace(/“[^”]*”|「[^」]*」|"[^"]*"/g,'');
export function storyArcCallbackHits(s,rf){const o=rf?.callbackObject;if(!o)return 0;const core=String(o).replace(/^(桌上|那张|这张)/,'').slice(-1);const re=new RegExp('(?:[那这几一]张[^，。；！？]{0,10}'+core+'|没送出去的'+core+')','g');return (String(s).match(re)||[]).length||(String(s).includes(o)?1:0);}
function storyArcFieldIssue(k,s,i,x,rf){
 const st=(rf.stages||[]).find(z=>z.key===x.depthStage)||(rf.stages||[])[i]||{};
 if(String(s).match(STORY_ARC_META_RE))return 'meta_word';
 if((rf?.novelLogic||rf?.beyondWater)&&String(s).match(NOVEL_LOGIC_META_RE))return 'meta_word';
 if(String(s).match(STORY_ARC_TEMPLATE_RE))return 'template_weekly';
 if(/低谷/.test(s)&&!st.isDip)return 'dip_out_of_segment';
 if(/这一幕的第一步/.test(s))return 'first_step_by_llm';
 const cb=storyArcCallbackHits(s,rf);
 if(cb&&(st.callbackHere===false||cb>1||(x.__cb||0)>=1))return 'callback_over';
 let body=psStripQuotes(s);
 if(i===0&&k==='situation'&&!rf.projOpener){const sents=body.split(/(?<=[。！？])/);if(!/^我在你这个年纪时/.test(sents[0]||''))return 'opening_missing';if(!/你/.test(sents[1]||''))return 'person_no_transition';body=sents.slice(1).join('');}
 else if(/我在你这个年纪时/.test(body))return 'opening_repeat';
 if(/我/.test(body))return 'person_switch';
 return null;
}
/**
 * 逐节点生成；深度契约开启时用同构 4 段脊柱（≤ ruleFacts 周界），优先 DeepSeek/线上。
 */
export async function generateStoryLLM(env,proj,{roleFacts=null,P=PROJECTION_PARAMS,fetchImpl=fetch,base='http://127.0.0.1:11434',model,onProgress=()=>{},now=new Date().toISOString(),profile=null,authoritativeNearTerm=null,planStory=null}={}){
 const depthOn=depthContractEnabled(env||{});
 let rf=env?.__ruleFacts||null;
 if(!rf&&profile)rf=buildRuleFacts(profile);
 if(!rf){
  const goal=roleFacts?.facts?.find(f=>f.key==='goal')?.value||proj?.goalTree?.items?.find(i=>i.level==='stage')?.text||'';
  const hours=proj?.hours?.known?proj.hours.value:undefined;
  rf=buildRuleFacts({goal,hours});
 }
 const storyProj=(depthOn&&rf?.deadlineWeeks)?withDepthStoryProj(proj,rf):proj;
 const S0=P.story||{};
 const Puse=depthOn?{...P,story:{...S0,maxChars:Math.max(S0.maxChars||3000,4500),...(isProseArc(rf)&&Array.isArray(rf?.gateChain)?{nodeRetries:Math.max(S0.nodeRetries??1,rf?.planFirstSteps?7:3)}:{})}}:P;
 const S=Puse.story||{},t0=Date.now(),ctx={...storyContext(storyProj,roleFacts),novelLogic:Boolean(rf?.novelLogic||rf?.beyondWater)},A=storyAllowed(storyProj,roleFacts);
 const wantOnline=psWantOnline(env)&&!!psReadOnlineKey(env);
 const m=model||env?.BUTTERFLY_LLM_MODEL||env?.AI_STORY_MODEL||env?.AI_MODEL||(wantOnline?'deepseek-chat':'qwen2.5:7b');
 const attempts=[];let llmOk=env?.PROJECTION_STORY_LLM!=='0';
 const via=wantOnline?'online':'ollama';
 if(llmOk&&!wantOnline){
  try{const meta=await fetchImpl(base+'/api/show',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:m}),signal:AbortSignal.timeout(10000),redirect:'error'});if(!meta.ok)throw Error('model_missing');const d=await meta.json();if(d.remote_host||d.remote_model)throw Error('remote_blocked');}
  catch(e){llmOk=false;attempts.push({step:'show',ok:false,error:String(e.message||e).slice(0,60)});}
 }
 if(llmOk&&wantOnline&&!psReadOnlineKey(env)){llmOk=false;attempts.push({step:'online',ok:false,error:'online_key_missing'});}
 const N=ctx.nodes.length,fixed=psCount(psIntro(ctx)+PS_OUTRO)+N*24;
 const per=Math.max(55,Math.min(depthOn?160:110,Math.floor(((S.maxChars||(depthOn?4200:3000))*0.82-fixed)/(Math.max(1,N)*4))));
 const lim={min:Math.max(40,Math.round(per*0.65)),max:per};
 const perNode=[];let llmFields=0;const arcOn=Boolean(isProseArc(rf)&&Array.isArray(rf?.gateChain));
 const callLLM=async(prompt,opts)=>wantOnline?psOnline(fetchImpl,env,m,prompt,opts):psOllama(fetchImpl,base,m,prompt,opts);
 for(let i=0;i<N;i++){
  const n=ctx.nodes[i],tpl=storyTemplateNode(n,ctx,i),x={nodeId:n.id,title:n.title,tRange:n.tRange,...tpl,source:'template',fieldSource:{},depthStage:n.depthStage||null,sourceNodeId:n.sourceNodeId||null};
  if(llmOk){
   const prompt=buildStoryNodePrompt(n,ctx,i,{...lim,env,ruleFacts:rf});let pending=STORY_FIELDS.map(([k])=>k);let lastBad=[];
   for(let a=0;a<=(S.nodeRetries??1)&&pending.length;a++){
    const ta=Date.now();
    try{const raw=await callLLM(a?{...prompt,user:prompt.user+'\n注意：上一次输出含有数字、禁用词或过短，请严格遵守要求重写。'+(arcOn&&lastBad.length?('被拒原因：'+lastBad.join('；')+'（meta_word=写了结构元词；template_weekly=写了每周固定；dip_out_of_segment=非低谷段写了低谷；callback_over=回扣物件超次或本段不该出现；person_switch=出现了“我”；person_no_transition=回望句后缺少交给“你”的过渡句；first_step_by_llm=不要写这一幕的第一步；cn_number/cn_count=出现了汉字数字+单位，如“那一年”“一天”“两个月”“几块”“三次”“一个人”——全部改成“那时”“后来”“很久”“好几回”这类不带数字的说法）。'):'')}:prompt,{timeoutMs:S.nodeTimeoutMs||120000,temperature:S.temperature??0.4});
     const bad=[];
     for(const k of pending){const c=storyCleanField(raw[k],{A,node:n,P:Puse,max:lim.max});const sa=c.ok&&arcOn?storyArcFieldIssue(k,c.value,i,x,rf):null;if(c.ok&&!sa){x[k]=c.value;x.fieldSource[k]='llm';llmFields++;if(storyArcCallbackHits(c.value,rf))x.__cb=(x.__cb||0)+1;}else bad.push(k+':'+(sa||c.issue));}
     pending=pending.filter(k=>x.fieldSource[k]!=='llm');lastBad=bad;
     attempts.push({node:n.id,try:a+1,ok:!pending.length,ms:Date.now()-ta,via,...(bad.length?{rejected:bad}:{})});
    }catch(e){attempts.push({node:n.id,try:a+1,ok:false,ms:Date.now()-ta,via,error:String(e.message||e).slice(0,60)});if(/remote_blocked|model_missing|online_key_missing|online_http_401/.test(String(e.message)))llmOk=false;}
   }
   const nl=Object.keys(x.fieldSource).length;x.source=nl===4?'llm':nl?'mixed':'template';
  }
  for(const [k] of STORY_FIELDS)if(!x.fieldSource[k])x.fieldSource[k]='template';
  delete x.__cb;perNode.push(x);await onProgress({done:i+1,total:N});
 }
 const total=N*4,source=!llmFields?'template':llmFields===total?'llm':'mixed';
 let story=psAssemble(storyProj,ctx,perNode,{P:Puse,source,model:llmFields?m:null,ms:Date.now()-t0,now,attempts});
 if(rf?.novelLogic||rf?.beyondWater){story.longForm=storyLongForm(story.perNode,ctx);story.chars=psCount(story.longForm);story.summary=psSummary(ctx,Puse);}
 story.validation=storyValidate(story,storyProj,{roleFacts,P:Puse});
 if(!story.validation?.pass&&source!=='template'){const fb=storyTemplate(storyProj,{roleFacts,P:Puse,now});fb.attempts=attempts;fb.fallbackReason='validation_failed';fb.rejectedValidation=story.validation;fb.ms=Date.now()-t0;story=fb;}
 // v1.26.59：每段「这一幕的第一步」由规则层逐字注入规划同幕 firstStep（LLM 不得改写；数字来自规划原文，numberLock 豁免并记账）。
 if(arcOn&&Array.isArray(rf.planFirstSteps)&&story.perNode?.length){
  story.perNode.forEach((x,i)=>{const fs=rf.planFirstSteps[i];if(!fs)return;
   const cleaned=String(x.action||'').split(/(?<=[。！？])/).filter(t=>!/这一幕的第一步|第一步[:：]/.test(t)).join('');
   x.action=(rf.novelLogic||rf.beyondWater)?(cleaned+(cleaned.endsWith('。')||cleaned.endsWith('！')||cleaned.endsWith('？')?'':'。')+fs+(/[。！？]$/.test(fs)?'':'。')):(cleaned+'这一幕的第一步：'+fs);
   x.firstStep=fs;x.firstStepSource='plan.chapters['+i+'].firstStep';});
  if(rf.projOpener&&story.perNode[0]){const x0=story.perNode[0];if(!String(x0.situation||'').startsWith(rf.projOpener)){x0.situation=rf.projOpener+String(x0.situation||'').replace(/^\s*我在你这个年纪时[^。！？]*[。！？]/,'');x0.openerSource='rule-layer';}story.openerInjected=true;}
  story.longForm=storyLongForm(story.perNode,{...storyContext(storyProj,roleFacts),novelLogic:Boolean(rf?.novelLogic||rf?.beyondWater)});story.chars=psCount(story.longForm);
  story.firstStepInjected=true;story.firstStepNumberExempt=story.perNode.map(x=>psNumsOf(x.firstStep||'').length?x.firstStep:null).filter(Boolean);
 }
 // 近端以 plan 为权威同源：有权威对则直接复用，禁止另起一套「第一步」。
 let nearTerm=null,nearTermSource=null;
 const fromAuth=authoritativeNearTerm?.today?.title&&authoritativeNearTerm?.week?.title?{today:authoritativeNearTerm.today,week:authoritativeNearTerm.week,source:authoritativeNearTerm.source||'authoritative'}:null;
 const fromPlan=nearTermFromPlanStory(planStory)||nearTermFromPlanStory(profile?.aiStory)||null;
 if(fromAuth){nearTerm={today:fromAuth.today,week:fromAuth.week};nearTermSource=fromAuth.source||'authoritative';}
 else if(fromPlan){nearTerm={today:fromPlan.today,week:fromPlan.week};nearTermSource='plan';}
 else{
  nearTerm=psNearTermFallback(ctx);nearTermSource='fallback';
  if(depthOn&&wantOnline&&psReadOnlineKey(env)){
   try{const nt=await psNearTermOnline(fetchImpl,env,m,ctx,rf);if(nt?.today?.title&&nt?.week?.title){nearTerm={today:nt.today,week:nt.week};nearTermSource='online';}}catch{}
  }
 }
 story.nearTerm=nearTerm;
 story.nearTermSource=nearTermSource;
 story.provider=wantOnline?(String(env?.BUTTERFLY_LLM_PROVIDER||'deepseek')):'ollama';
 story.providerKind=wantOnline?'online':'ollama';
 story.depth=depthOn;
 story.depthVersion=contractVersionFor(rf);
 story.ruleHorizonWeeks=rf?.deadlineWeeks??null;
 story.depthSpine=Boolean(depthOn&&rf?.deadlineWeeks);
 return story;
}

/* ---------------- P0-16 节点完成 → 一幕续写（100–200 字；模板排队，数字只来自规则层） ---------------- */
const PS_CONT_DIM={
 time:'每周那几段固定下来的时间，从需要硬挤，慢慢变成了生活里的一个习惯。',
 ability:'那些反复练过的小技能，开始能拼成一个可以拿给别人看的小成果。',
 credential:'悬在心里的那件资质的事，终于有了明确的进展，不再只是“以后再说”。',
 experience:'你手里多了一段能讲清楚的相关经历：做了什么、为谁做、结果怎样。',
 network:'你的作品第一次被目标方向的人看过，下一步该补什么也更清楚了。',
 income:'你第一次用自己的能力换来了真实的反馈，知道了自己在市场上的大致位置。',
 goal:'你把这段时间的记录、作品和反馈放在一起，对照目标做了一次认真的检验。'};
export function storyContinuationTemplate(proj,nodeId,{roleFacts=null,P=PROJECTION_PARAMS}={}){
 const L=psPlan(proj),i=L.nodes.findIndex(n=>n.id===nodeId);if(i<0)return null;
 const n=L.nodes[i],next=L.nodes[i+1]||null;
 let t=`你完成了「${n.title}」这一段（行动线上约第 ${n.tRange.lo}–${n.tRange.hi} 周）。${PS_CONT_DIM[n.dim]||PS_CONT_DIM.ability}回头看，最难的往往不是某一步本身，而是在忙碌的日子里把它做完；这份记录已经留在你的执行日志里。`;
 t+=next?`接下来的一幕是「${next.title}」，可以先从最小的一步开始，按自己的节奏继续。`:'接下来，这些记录会成为下一版推演的依据，结果怎样都值得记下来。';
 if(psCount(t)>200){t=t.replace('回头看，最难的往往不是某一步本身，而是在忙碌的日子里把它做完；','');}
 return {nodeId:n.id,title:n.title,tRange:n.tRange,text:t,chars:psCount(t),source:'template'};
}
/** S4：续写 100–200 字、点名节点、R8 零命中、数字锁定。 */
export function storyValidateContinuation(c,proj,{roleFacts=null,P=PROJECTION_PARAMS}={}){
 const L=psPlan(proj),n=L.nodes.find(z=>z.id===c?.nodeId),A=storyAllowed(proj,roleFacts),chars=psCount(c?.text);
 const hits=pjScanBanned({text:c?.text},{P,path:'$.continuation'});const nl=n?storyNumberIssues(c.text,A,n):[{type:'node_missing'}];
 const S4={pass:chars>=100&&chars<=200&&!!n&&String(c.text).includes(n.title),chars};
 return {S4,S3:{pass:!hits.length,hits},numberLock:{pass:!nl.length,issues:nl},pass:S4.pass&&!hits.length&&!nl.length};
}
/* ---------------- P0-19 最小：故事改写/续写先出差异摘要，确认后写入留版 ---------------- */
export function storyRewriteDiff(prev,next){
 const changed=[];
 for(const x of next?.perNode||[]){const o=(prev?.perNode||[]).find(p=>p.nodeId===x.nodeId);
  const f=STORY_FIELDS.filter(([k])=>!o||o[k]!==x[k]).map(([,l])=>l);if(f.length)changed.push({nodeId:x.nodeId,title:x.title,fields:f});}
 const a=prev?.chars||psCount(prev?.longForm),b=next?.chars||psCount(next?.longForm);
 const text=changed.length?`将改写 ${changed.length} 段：${changed.map(c=>`「${c.title}」的${c.fields.join('、')}`).join('；')}。长文约 ${a} 字 → ${b} 字。行动线周数与收入不变（数字锁定已校验）。`:'新版本与当前故事没有实质差异。';
 return {changed,charsBefore:a,charsAfter:b,text};
}
export function storyContinuationDiff(c){return {text:`将在「${c.title}」之后追加一幕续写（约 ${c.chars} 字）。不改动行动线、周数与收入。`};}
