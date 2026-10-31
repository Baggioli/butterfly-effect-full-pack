/**
 * P0-17 PP3（并行上限 + 第一步 ≤15 分钟）、P0-18 R18（来源可点开）、P0-20 W1（周报）离线验收。
 *  node scripts/test-projection-pp3-r18.mjs [--out evidence.json]
 */
import {readFileSync,writeFileSync} from 'node:fs';
import * as E from '../worker/projection.js';
import {PROJECTION_PARAMS as P} from '../worker/projection-params.js';
import {PERSONA_TABLE} from '../worker/projection-persona-table.js';
import {PERSONA_PACKS,GENERIC_PACK,applyPersonaPack,PP_MAX_PARALLEL_DEFAULT} from '../worker/projection-persona.js';
import {parseCSV} from './income-params-lib.mjs';
import {PERSONAS} from './projection-personas.mjs';
const args=process.argv.slice(2),out=args.includes('--out')?args[args.indexOf('--out')+1]:null;
const ev={at:new Date().toISOString(),paramVersion:P.version,engine:E.PJ_ENGINE_VERSION,checks:[]};
const ok=(name,cond,detail)=>{ev.checks.push({name,pass:Boolean(cond),...(detail!==undefined?{detail}:{})});if(!cond)console.error('✗',name,detail!==undefined?JSON.stringify(detail):'');};
const NOW='2026-10-24T00:00:00.000Z';
const mk=(profile,levels={})=>{const rf=E.buildRoleFacts(profile,{confirmedAt:NOW}),gt=E.buildGoalTree(profile);const gap=E.confirmGap(E.assembleGap(E.heuristicGap(rf),rf,{}),levels,NOW);return {rf,gt,gap};};
const proj=(i,o={})=>E.computeProjection({roleFacts:i.rf,goalTree:i.gt,gap:i.gap,now:NOW,planStartedAt:NOW,...o});
const clone=x=>JSON.parse(JSON.stringify(x));
const peakOf=line=>E.pjPeakParallel(line.nodes.map(n=>[n.tRange.lo-n.duration.lo,n.tRange.lo]));

// ---------- PP3 ----------
const want={generic:2,P05_civil_exam:1,P06_cpa_path:2,P07_judicial_exam:1,P08_teacher_path:2,P11_low_hours_side:1,P01_T1_grad_tech:3,P02_NT1_grad_tech:3};
for(const [id,v] of Object.entries(want)){const pk=id==='generic'?GENERIC_PACK:PERSONA_PACKS.find(p=>p.id===id);ok('PP3 产品初值 '+id+' maxParallelNodes='+v,pk?.maxParallelNodes===v,pk?.maxParallelNodes);}
ok('PP3 全部 12 包有并行上限 1–3',PERSONA_PACKS.length===12&&PERSONA_PACKS.every(p=>p.maxParallelNodes>=1&&p.maxParallelNodes<=3),PERSONA_PACKS.map(p=>p.id+':'+p.maxParallelNodes));
ok('PP3 未匹配 → 通用 '+PP_MAX_PARALLEL_DEFAULT,PP_MAX_PARALLEL_DEFAULT===2&&GENERIC_PACK.maxParallelNodes===2);
// 规则层：所有包 × 多组差距 × 多档小时，任一时刻进行中节点 ≤ 上限
const base=PERSONAS.find(p=>p.id==='medium_1');
const gapSets=[{ability:3,credential:3,experience:3,network:3,income:3,time:3},{ability:4,credential:1,experience:2,network:1,income:1},{ability:1,credential:4,experience:3,network:2,income:1,time:2},{ability:2,credential:2,experience:2,network:2,income:2}];
let combos=0,deferredSeen=0;const peakViol=[];
for(const pk of [GENERIC_PACK,...PERSONA_PACKS])for(const lv of gapSets)for(const h of [3,8,20]){
 const i=mk({...base.profile,hours:h},lv);const PP=applyPersonaPack(P,pk);
 const {line}=E.computeLine({roleFacts:i.rf,goalTree:i.gt,gap:i.gap,P:PP});combos++;
 const pk1=peakOf(line);if(pk1>pk.maxParallelNodes||line.parallel.maxNodes!==pk.maxParallelNodes||line.parallel.peak>pk.maxParallelNodes)peakViol.push({pack:pk.id,lv,h,peak:pk1,cap:pk.maxParallelNodes});
 if(line.nodes.some(n=>n.deferred))deferredSeen++;
 if(pk.maxParallelNodes===1&&line.nodes.some((n,j)=>j>0&&n.tRange.lo-n.duration.lo<line.nodes[j-1].tRange.lo))peakViol.push({pack:pk.id,why:'cap=1 仍有重叠'});
}
ok('PP3 '+combos+' 组（13 包 × 4 差距 × 3 档小时）进行中节点 ≤ 上限',!peakViol.length,peakViol.slice(0,5));
ok('PP3 超出上限的节点被顺延（deferred 出现）',deferredSeen>0,deferredSeen);
{const i=mk(base.profile,gapSets[0]);const L=c=>E.computeLine({roleFacts:i.rf,goalTree:i.gt,gap:i.gap,P:{...P,maxParallelNodes:c}}).line;const l1=L(1),l2=L(2),l3=L(3),l9=L(9);
 ok('PP3 上限越小总时长越长（1 ≥ 2 ≥ 3）',l1.horizon.lo>=l2.horizon.lo&&l2.horizon.lo>=l3.horizon.lo&&l1.horizon.lo>l3.horizon.lo,[l1.horizon,l2.horizon,l3.horizon]);
 ok('PP3 上限 1 → 串行（后一节点开始 ≥ 前一节点完成）',l1.nodes.every((n,j)=>!j||n.start.lo>=l1.nodes[j-1].tRange.lo));
 ok('PP3 顺延节点有理由与周数',l1.nodes.filter(n=>n.deferred).every(n=>n.deferred.byWeeks.lo>=0&&n.deferred.reason.includes('上限')));
 ok('PP3 上限足够大 → 与原并行系数排程一致（不顺延）',!l9.nodes.some(n=>n.deferred));}
// 第一步 ≤15 分钟（生成）
const hi=mk({...base.profile,hours:40},base.confirmLevels);const ph=proj(hi);
ok('PP3 每周 40 小时：第一个今日任务 ≤15 分钟',ph.tasks.today[0].minutes<=15,ph.tasks.today[0].minutes);
ok('PP3 每周 40 小时：第一个本周任务 ≤15 分钟',ph.tasks.week[0].minutes<=15,ph.tasks.week[0].minutes);
// 校验器（反例）
{const v=E.validateProjection(ph,{roleFacts:hi.rf,gap:hi.gap});ok('PP3 validator 正例通过',v.PP3.pass&&v.pass,v.PP3);}
{const bad=clone(ph);bad.tasks.today[0].minutes=20;const v=E.validateProjection(bad,{roleFacts:hi.rf,gap:hi.gap});ok('PP3 validator 反例：今日第一步 20 分钟 → 不通过',!v.PP3.pass&&!v.pass,v.PP3.issues);}
{const bad=clone(ph);bad.tasks.week[0].minutes=30;const v=E.validateProjection(bad,{roleFacts:hi.rf,gap:hi.gap});ok('PP3 validator 反例：本周第一步 30 分钟 → 不通过',!v.PP3.pass,v.PP3.issues);}
{const h1=PERSONAS.find(p=>p.id==='hard_1');const i=mk(h1.profile,h1.confirmLevels);const p=proj(i);const bad=clone(p);const pl=E.pjLine(bad);pl.nodes[1].tRange={lo:pl.nodes[0].tRange.lo,hi:pl.nodes[0].tRange.hi+1};pl.nodes[1].duration={lo:pl.nodes[0].duration.lo,hi:pl.nodes[0].duration.hi};
 const v=E.validateProjection(bad,{roleFacts:i.rf,gap:i.gap});ok('PP3 validator 反例：低投入包（上限 1）出现两个并行节点 → 不通过',p.persona.maxParallelNodes===1&&!v.PP3.pass,v.PP3.issues);}
// 全部画像：PP3 通过 + 5 次 0 偏差
for(const pe of PERSONAS){const i=mk(pe.profile,pe.confirmLevels);const p=proj(i);const v=E.validateProjection(p,{roleFacts:i.rf,gap:i.gap});
 ok('PP3 画像 '+pe.id+(p.persona?'（'+p.persona.packId+'，上限 '+p.persona.maxParallelNodes+'）':'（危机）'),v.PP3.pass&&v.pass,Object.fromEntries(Object.entries(v).filter(([k,x])=>x&&x.pass===false)));
 const rs=new Set([...Array(5)].map(()=>JSON.stringify(proj(i).lines)));ok('PP3 '+pe.id+' 5 次 0 偏差',rs.size===1);
 if(p.mode==='normal')ev['PP3_'+pe.id]={pack:p.persona.packId,cap:E.pjLine(p).parallel.maxNodes,peak:E.pjLine(p).parallel.peak,deferred:E.pjLine(p).parallel.deferredNodes,today:p.tasks.today[0].minutes,week:p.tasks.week[0].minutes};
}

// ---------- R18 ----------
const ledgerIds=new Set(parseCSV(readFileSync(new URL('../data/salary_source_ledger.csv',import.meta.url),'utf8').replace(/^\uFEFF/,'')).slice(1).map(r=>String(r[0]).trim()).filter(Boolean));
const all=[];
for(const pe of PERSONAS){const i=mk(pe.profile,pe.confirmLevels);const p=proj(i);if(p.mode!=='normal')continue;all.push([pe.id,p,i]);
 const v=E.validateProjection(p,{roleFacts:i.rf,gap:i.gap});const pl=E.pjLine(p);
 ok('R18 '+pe.id+' 节点/里程碑/收入均有「来源」',v.R18.pass&&pl.nodes.every(n=>n.source?.lines?.length)&&pl.milestones.every(m=>m.source?.lines?.length)&&p.income?.source?.lines?.length,v.R18.issues);
 if(p.income.available){ok('R18 '+pe.id+' 收入来源指向 salary_source_ledger（'+p.income.source.ledgerId+'）',ledgerIds.has(p.income.source.ledgerId)&&p.income.source.ledgerFile==='data/salary_source_ledger.csv');}
 else ok('R18 '+pe.id+' 无区间 → 来源标注兜底',p.income.source.fallback&&p.income.source.kind==='none');
 if(p.persona.generic)ok('R18 '+pe.id+' 通用参数兜底已标注',pl.nodes.every(n=>n.source.fallback&&n.source.lines.some(l=>l.includes('通用参数'))));
 ev['R18_'+pe.id]={income:p.income.source,node0:pl.nodes[0].source};
}
// 人群包 meta 引用键
{const h2=all.find(x=>x[0]==='hard_2')[1];const cn=E.pjLine(h2).nodes.find(n=>n.dim==='credential');
 ok('R18 CPA 包：证书节点来源引用 C01–C03 台账条目',cn&&['C01','C02','C03'].every(k=>cn.source.personaRefs.includes(k))&&cn.source.lines.some(l=>l.includes('C01《')),cn?.source);}
{const e2=all.find(x=>x[0]==='easy_2')[1];ok('R18 人群包收入对照键（'+(e2.income.source.personaRefs||[]).join('/')+'）存在于人群包台账',e2.income.source.personaRefs.length>0&&e2.income.source.personaRefs.every(k=>PERSONA_TABLE.ledgerIndex[k]),e2.income.source);}
// 省级 / 区域兜底须标注
for(const [city,label,goal] of [['武汉','省级',null],['成都','区域','一年内转行做前端开发']]){const i=mk({...base.profile,city,...(goal?{goal}:{})},base.confirmLevels);const p=proj(i);const v=E.validateProjection(p,{roleFacts:i.rf,gap:i.gap});
 ok('R18 '+city+'（'+label+'兜底）来源标注「兜底·'+label+'估算」',p.income.available&&p.income.scope!=='city'&&p.income.source.fallback&&p.income.source.lines.some(l=>l.includes('兜底·'+label+'估算'))&&v.R18.pass,p.income.source);
 const bad=clone(p);bad.income.source.lines=bad.income.source.lines.filter(l=>!l.includes('兜底'));ok('R18 反例：'+city+' 去掉兜底标注 → 不通过',!E.validateProjection(bad,{roleFacts:i.rf,gap:i.gap}).R18.pass);
 ev['R18_'+city]=p.income.source;}
{const [,p,i]=all[0];const bad=clone(p);delete E.pjLine(bad).nodes[0].source;ok('R18 反例：节点缺来源 → 不通过',!E.validateProjection(bad,{roleFacts:i.rf,gap:i.gap}).R18.pass);
 const bad2=clone(p);E.pjLine(bad2).milestones[0].source.lines.push('示例校准');const v2=E.validateProjection(bad2,{roleFacts:i.rf,gap:i.gap});ok('R18 反例：来源含内部标记 → 不通过',!v2.R18.pass&&!v2.R10.pass);}
ok('R18 所有输出不含「示例校准」',!all.some(([,p])=>JSON.stringify(p).includes('示例校准')));
ok('R18 前端页面不含「示例校准」',!readFileSync(new URL('../public/projection.js',import.meta.url),'utf8').includes('示例校准'));
ok('R18 前端渲染「来源」入口（节点/里程碑/收入）',(s=>s.includes('srcChip(')&&(s.match(/srcChip\(/g)||[]).length>=4)(readFileSync(new URL('../public/projection.js',import.meta.url),'utf8')));

// ---------- W1 周报（纯函数） ----------
{const i=mk(base.profile,base.confirmLevels);const b=proj(i);const pl=E.pjLine(b);const d=86400000,t0=Date.parse(NOW);
 const recs=n=>Array.from({length:n},(_,k)=>({at:new Date(t0+(k+0.5)*d).toISOString(),nodeId:pl.nodes[0].id,taskId:'t_today_1',status:'done',actualMinutes:15}));
 const ex=(r,days)=>({startedAt:NOW,asOf:new Date(t0+days*d).toISOString(),records:r});
 const g6=E.weeklyReportGate(ex(recs(6),7));ok('W1 6 天有效记录 → 未达门槛',!g6.met&&g6.days===6&&g6.text.includes('6/7'),g6);
 const pz=recs(6).concat([{at:new Date(t0+6.5*d).toISOString(),status:'paused',pauseReason:'health',pauseDays:1}]);ok('W1 暂停不计入有效天数',!E.weeklyReportGate(ex(pz,7)).met);
 const nr=E.buildWeeklyReport({proj:b,execution:ex(recs(6),7),now:NOW});ok('W1 未达门槛 → WEEKLY_NOT_READY',!nr.ok&&nr.code==='WEEKLY_NOT_READY');
 const e7=ex(recs(7),7),p7=proj(i,{execution:e7});
 const r0=E.buildWeeklyReport({proj:p7,execution:e7,story:null,now:e7.asOf});
 ok('W1 7 天 → 固定模板周报（进展句 + 占位）',r0.ok&&r0.report.source==='template'&&/^第 1 周（.+～.+）：记录 7 次，完成 7 次/.test(r0.report.progress)&&r0.report.story.kind==='placeholder'&&r0.report.story.text===E.PJ_WEEKLY.storyPlaceholder&&r0.report.validation.W1.pass,r0.report&&r0.report.text);
 ok('W1 下一步 ≤15 分钟',r0.report.next&&r0.report.next.minutes<=15);
 const st={status:'ready',summary:'摘要',continuations:[{nodeId:pl.nodes[0].id,title:pl.nodes[0].title,text:'第一段续写'.repeat(30)},{nodeId:pl.nodes[1].id,title:pl.nodes[1].title,text:'第二段续写'}]};
 const r1=E.buildWeeklyReport({proj:p7,execution:e7,story:st,now:e7.asOf});
 ok('W1 有续写 → 摘录续写（≤60 字 + 省略）',r1.report.story.kind==='continuations'&&r1.report.story.items.length===2&&r1.report.story.items[0].excerpt.length<=61&&r1.report.text.includes('第二段续写'),r1.report.story);
 ok('W1 确定性：同输入同输出',JSON.stringify(E.buildWeeklyReport({proj:p7,execution:e7,story:st,now:e7.asOf}))===JSON.stringify(r1));
 const bad=E.buildWeeklyReport({proj:p7,execution:e7,story:{continuations:[{title:'x',text:'示例校准'}]},now:e7.asOf});ok('W1 反例：摘录含内部标记 → W1 不通过',!bad.report.validation.W1.pass);
 ok('W1 §13 一句话命名 + 日期范围 + ≤5 条关键变化',Object.values(E.PJ_WEEKLY.headlines).includes(r1.report.headline)&&/^\d\d月\d\d日～\d\d月\d\d日$/.test(r1.report.rangeLabel)&&r1.report.highlights.length>=1&&r1.report.highlights.length<=5&&r1.report.text.startsWith(r1.report.headline),{h:r1.report.headline,r:r1.report.rangeLabel,n:r1.report.highlights.length});
 ok('W1 §13 命名句不用警示词（落后/失败）',Object.values(E.PJ_WEEKLY.headlines).every(h=>!/落后|失败|警告/.test(h)));
 { const pjs=readFileSync(new URL('../public/projection.js',import.meta.url),'utf8'),css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
  ok('§13 前端：本步↑↓ / 当前阶段卡 / 前3项归因（追回绿·晚约灰）/ 调整计划 / 任务难度+对应里程碑 / 周报命名',['本步变了哪几项 ↑↓','pj-stage','当前阶段','追回约 ','晚约 ','A.attribution.slice(0,3)','>调整计划<','难度：','对应：','一句话给本周命名','r.highlights'].every(k=>pjs.includes(k)));
  ok('§13 中性色：晚约/阶段卡非警示红',/\.pj-attr-open \.pj-attr-chip\{background:#eceeed;color:#5f6863\}/.test(css)&&/\.pj-late\{color:#6b7570/.test(css)&&!/\.pj-stage\{[^}]*#c4553d/.test(css));
  ok('§13 前端无「示例校准」',!pjs.includes('示例校准')); }
 ok('W1 前端有周报入口',readFileSync(new URL('../public/projection.js',import.meta.url),'utf8').includes('/api/projection/weekly-report'));
 ev.W1=r1.report.text;}

if(out)writeFileSync(out,JSON.stringify(ev,null,1));
const f=ev.checks.filter(c=>!c.pass);
console.log('PP3/R18/W1：'+(ev.checks.length-f.length)+'/'+ev.checks.length+' 通过');
if(f.length)process.exit(1);
