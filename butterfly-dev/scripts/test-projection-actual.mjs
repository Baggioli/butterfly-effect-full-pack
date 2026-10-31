/**
 * 实际线（R13 子集 / R15）+ 演示路径 + 人群参数包（PP1/PP2）离线验收。
 *  node scripts/test-projection-actual.mjs [--out evidence.json]
 */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as E from '../worker/projection.js';
import {PROJECTION_PARAMS as P} from '../worker/projection-params.js';
import {PERSONA_TABLE} from '../worker/projection-persona-table.js';
import {resolvePersonaKey,selectPersonaPack} from '../worker/projection-persona.js';
import {PERSONAS} from './projection-personas.mjs';
const args=process.argv.slice(2),out=args.includes('--out')?args[args.indexOf('--out')+1]:null;
const ev={at:new Date().toISOString(),paramVersion:P.version,personaTable:PERSONA_TABLE.version,checks:[]};
const ok=(name,cond,detail)=>{ev.checks.push({name,pass:Boolean(cond),...(detail!==undefined?{detail}:{})});if(!cond)console.error('✗',name,detail!==undefined?JSON.stringify(detail):'');};
const NOW='2026-10-24T00:00:00.000Z';
const mk=(profile,levels={})=>{const rf=E.buildRoleFacts(profile,{confirmedAt:NOW}),gt=E.buildGoalTree(profile);const gap=E.confirmGap(E.assembleGap(E.heuristicGap(rf),rf,{}),levels,NOW);return {rf,gt,gap};};
const proj=(i,o={})=>E.computeProjection({roleFacts:i.rf,goalTree:i.gt,gap:i.gap,now:NOW,planStartedAt:NOW,...o});
const pe=PERSONAS.find(p=>p.id==='medium_1');const I=mk(pe.profile,pe.confirmLevels);
const base=proj(I);const plan=E.pjLine(base,'plan');
const demoEx=(scenario,days=21)=>E.demoExecution({planLine:plan,startedAt:NOW,scenario,days});

// R15：无记录 → 无实际线、灰色占位固定句
ok('R15 无执行记录 → lines 只有 plan',base.lines.map(l=>l.kind).join()==='plan');
ok('R15 无执行记录 → 占位固定句',base.actual.status==='placeholder'&&base.actual.placeholder===P.actualLine.placeholder);
// R15：门槛（2 天 / 2 条 → 不出线；3 天 3 条 → 出线）
const rec=(i,d,st='done')=>({id:'r'+i,taskId:'t_week_1',nodeId:plan.nodes[0].id,status:st,at:new Date(Date.parse(NOW)+d*86400000).toISOString()});
const two=proj(I,{execution:{startedAt:NOW,asOf:'2026-10-27T00:00:00.000Z',records:[rec(1,0),rec(2,1),rec(3,1.1)]}});
ok('R15 3 条但只 2 天 → 不出实际线',!E.pjLine(two,'actual')&&two.actual.gate.days===2&&two.actual.status==='placeholder',two.actual.gate);
const paused3=proj(I,{execution:{startedAt:NOW,asOf:'2026-10-27T00:00:00.000Z',records:[rec(1,0),rec(2,1),{...rec(3,2,'paused'),pauseReason:'health',pauseDays:2}]}});
ok('R15 暂停不计有效记录',!E.pjLine(paused3,'actual')&&paused3.actual.gate.records===2);
const three=proj(I,{execution:{startedAt:NOW,asOf:'2026-10-27T00:00:00.000Z',records:[rec(1,0),rec(2,1),rec(3,2)]}});
ok('R15 3 天 3 条 → 出实际线 + 固定句',Boolean(E.pjLine(three,'actual'))&&three.actual.notice===P.actualLine.notice);
// R13 子集：同一执行记录重算 5 次 0 偏差
for(const sc of P.actualLine.demo.scenarios){
 const ex=demoEx(sc);const runs=[...Array(5)].map(()=>JSON.stringify(E.pjLine(proj(I,{execution:ex}),'actual')));
 ok('R13 '+sc+' 同执行记录重算 5 次 0 偏差',new Set(runs).size===1&&runs[0]!=='null');
}
const on=proj(I,{execution:demoEx('on_plan',42)}),behind=proj(I,{execution:demoEx('behind',42)}),ahead=proj(I,{execution:demoEx('ahead',42)}),pz=proj(I,{execution:demoEx('paused',42)});
const al=p=>E.pjLine(p,'actual');
ok('全部按节奏完成 → 实际线与计划线重合',al(on).nodes.every((n,i)=>n.tRange.lo===plan.nodes[i].tRange.lo&&n.tRange.hi===plan.nodes[i].tRange.hi),al(on).nodes.map(n=>n.deltaWeeks));
ok('部分完成/未完成 → 只推迟（目标节点 delta>0）',al(behind).deltaWeeks>0&&al(behind).nodes.every(n=>n.deltaWeeks>=0),al(behind).deltaWeeks);
ok('超出节奏 → 提前（目标节点 delta<0）',al(ahead).deltaWeeks<0,al(ahead).deltaWeeks);
ok('暂停区间不计落后（按节奏+暂停 1 周 → 与计划重合）',al(pz).deltaWeeks===0&&pz.actual.pauses.length===1&&pz.actual.pauses[0].label==='家庭事务',al(pz).deltaWeeks);
// 单调：完成率越低越晚
const pat=st=>({startedAt:NOW,asOf:new Date(Date.parse(NOW)+28*86400000).toISOString(),records:[...Array(12)].map((_,i)=>({id:'m'+i,taskId:'t_week_1',nodeId:plan.nodes[0].id,status:st(i),at:new Date(Date.parse(NOW)+i*7/3*86400000).toISOString()}))});
const d1=al(proj(I,{execution:pat(()=> 'done')})).deltaWeeks,d2=al(proj(I,{execution:pat(i=>i%2?'partial':'done')})).deltaWeeks,d3=al(proj(I,{execution:pat(i=>i%2?'skipped':'done')})).deltaWeeks;
ok('完成率单调：全完成 ≤ 半数部分完成 ≤ 半数未完成',d1<=d2&&d2<=d3&&d1<d3,[d1,d2,d3]);
// 归因
const at=behind.actual.attribution;
ok('归因 ≤3 件、主语为任务、带调整计划 1/2/4 周',at.length>0&&at.length<=3&&at.every(a=>a.text.startsWith('「')&&a.options.filter(o=>/^调整计划：.*延后 [124] 周$/.test(o)).length===3),at);
ok('提前同样给出归因（对等）',ahead.actual.attribution.some(a=>a.direction==='earlier'&&a.options.some(o=>o.startsWith('调整计划'))),ahead.actual.attribution);
ok('归因不含收入/金额/外推',[...at,...ahead.actual.attribution].every(a=>!/元|收入|将会|未来/.test(a.text)));
// 校验器全通过（含 R15、R8 白名单、R10 内部标记）
for(const [n,p] of Object.entries({on,behind,ahead,pz,three})){const v=E.validateProjection(p,{roleFacts:I.rf,gap:I.gap});ok('validator '+n+' 全通过',v.pass,Object.fromEntries(Object.entries(v).filter(([k,x])=>x&&x.pass===false)));}
// 危机 → 实际线暂停
{const c=PERSONAS.find(p=>p.id==='crisis');const ci=mk(c.profile);const cp=proj(ci,{execution:demoEx('on_plan')});ok('危机 → 无任何线、实际线暂停',cp.mode==='crisis_hold'&&!cp.lines.length&&cp.actual.status==='paused');ok('危机 validator R15',E.validateProjection(cp,{roleFacts:ci.rf}).R15.pass);}
// 分享卡仍只含计划线
{const sc=E.shareCardModel(behind);ok('分享卡只含计划线',sc.lineKind==='plan'&&!/实际线|执行记录/.test(JSON.stringify(sc)));}
// 故事骨架
ok('story 骨架 pending + perNode',base.story?.status==='pending'&&base.story.perNode.length===plan.nodes.length&&base.story.perNode.every(x=>'situation' in x&&'action' in x&&'change' in x&&'cost' in x));

// ---- 人群参数包 ----
ok('参数表来自 CSV 且 12 包',PERSONA_TABLE.sourceFile.endsWith('persona_param_sources.csv')&&Object.keys(PERSONA_TABLE.packs).length===12&&!PERSONA_TABLE.buildIssues.length,PERSONA_TABLE.buildIssues);
// 匹配优先级回归：职业实体 > 备考动作（产品 2026-10-25）
const rfGoal=g=>({facts:[{key:'goal',value:g},{key:'role',value:''},{key:'age',value:28},{key:'education',value:'本科'},{key:'city',value:'广州'},{key:'hours',value:10}]});
const packOf=g=>selectPersonaPack(resolvePersonaKey(rfGoal(g))).id;
for(const [g,id] of [['考编小学教师','P08_teacher_path'],['国考公务员','P05_civil_exam'],['考公','P05_civil_exam'],['民办小学教师','P08_teacher_path'],['考编','P05_civil_exam'],['事业编','P05_civil_exam'],['考编成为公办在编小学教师','P08_teacher_path'],['考公务员还是考教师','P05_civil_exam'],['考编中学教师','P08_teacher_path']]){
  ok('匹配 '+g+' → '+id,packOf(g)===id,packOf(g));
}
const kTeach=resolvePersonaKey(rfGoal('考编小学教师'));
ok('考编小学教师 civilTarget=true/公办 仍走 P08',kTeach.occupation==='teacher'&&kTeach.civilTarget===true&&kTeach.institution==='public'&&kTeach.occupationVia==='entity'&&packOf('考编小学教师')==='P08_teacher_path',kTeach);
const kPriv=resolvePersonaKey(rfGoal('民办小学教师'));ok('民办小学教师 institution=private、civilTarget=false',kPriv.institution==='private'&&kPriv.civilTarget===false,kPriv);
const kExam=resolvePersonaKey(rfGoal('考编'));ok('考编单独 → 备考动作兜底 civil',kExam.occupation==='civil'&&kExam.occupationVia==='action',kExam);
{const r={facts:[{key:'goal',value:'考编'},{key:'role',value:'培训机构老师'},{key:'age',value:24}]};const k=resolvePersonaKey(r);ok('目标考编 + 角色老师 → P08（实体优先）',selectPersonaPack(k).id==='P08_teacher_path',k);}
// PP1：同 PersonaKey + 同包 5 次 0 偏差
for(const id of ['easy_2','medium_2','hard_1','hard_2']){const pp=PERSONAS.find(p=>p.id===id);const ii=mk(pp.profile,pp.confirmLevels);const rs=[...Array(5)].map(()=>{const p=proj(ii);return JSON.stringify({persona:p.persona,lines:p.lines,assumptions:p.assumptions});});ok('PP1 '+id+' 5 次 0 偏差（'+JSON.parse(rs[0]).persona.packId+'）',new Set(rs).size===1);}
// PP2：同职业、不同年龄段 → 至少一处可解释差异
const pp2=(label,prof,ageA,ageB,levels)=>{const a=proj(mk({...prof,age:ageA},levels)),b=proj(mk({...prof,age:ageB},levels));
 const pa=a.persona,pb=b.persona,ha=E.pjLine(a,'plan').horizon,hb=E.pjLine(b,'plan').horizon;
 const diff=pa.packId!==pb.packId&&(ha.lo!==hb.lo||ha.hi!==hb.hi)&&a.assumptions.some(x=>x.text.includes(pa.packId==='generic'?'通用参数':pa.packName))&&b.assumptions.some(x=>x.text.includes(pb.packId==='generic'?'通用参数':pb.packName));
 const d={occupation:pa.key.occupation,a:{age:ageA,band:pa.key.ageBand,pack:pa.packId,durationFactor:pa.durationFactor,weights:pa.dimWeightsPct,horizon:ha},b:{age:ageB,band:pb.key.ageBand,pack:pb.packId,durationFactor:pb.durationFactor,weights:pb.dimWeightsPct,horizon:hb}};
 ok('PP2 '+label,diff,d);ev['PP2_'+label]=d;};
pp2('数据分析转行 27 vs 30（通用 vs P04）',pe.profile,'27','30',pe.confirmLevels);
{const e1=PERSONAS.find(p=>p.id==='easy_1');pp2('一线互联网技术 24 vs 28（P01 vs 通用）',e1.profile,'24','28',e1.confirmLevels);}
// 未匹配 → 通用参数标注
ok('未匹配 → 「通用参数」标注',base.persona.packId==='generic'&&base.persona.label==='通用参数'&&base.assumptions.some(a=>a.text.includes('通用参数')));
// 内部标记不外泄
ok('输出不含「示例校准」',![base,on,behind].some(p=>JSON.stringify(p).includes('示例校准')));

if(out)writeFileSync(out,JSON.stringify(ev,null,1));
const f=ev.checks.filter(c=>!c.pass);
console.log('实际线/人群包：'+(ev.checks.length-f.length)+'/'+ev.checks.length+' 通过');
if(f.length)process.exit(1);
