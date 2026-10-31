/**
 * 人生推演 M1 画像验收：R1–R4、R6、R8–R12、危机路径、薪资表规则。
 *  离线（npm test）：node scripts/test-projection.mjs
 *  在线（DGX 本机 Ollama）：node scripts/test-projection.mjs --live --models qwen2.5:7b,qwen2.5:32b --repeat 5 --out evidence.json
 */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as E from '../worker/projection.js';
const {pjLine,pjLineNodes}=E;
import {PROJECTION_PARAMS as P} from '../worker/projection-params.js';
import {INCOME_TABLE} from '../worker/projection-income-table.js';
import {extractGapLLM,__resetProjectionStoreForTests} from '../worker/projection-api.js';
import {PERSONAS} from './projection-personas.mjs';
import {readFileSync} from 'node:fs';

const args=process.argv.slice(2),arg=(k,d)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;};
const live=args.includes('--live'),models=String(arg('--models','qwen2.5:7b')).split(','),repeat=Number(arg('--repeat',5)),out=arg('--out',null);
const base=arg('--ollama','http://127.0.0.1:11434');
const pct=(xs,p)=>{if(!xs.length)return null;const s=[...xs].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.ceil(p/100*s.length)-1)];};
const ev={at:new Date().toISOString(),paramVersion:P.version,incomeTableVersion:INCOME_TABLE.version,coefficientVersion:INCOME_TABLE.expCoefficients.version,mode:live?'live':'offline',personas:{},scanner:{},r2:{},r4:{},latency:{},failures:[]};
const fail=(id,msg)=>{ev.failures.push(id+': '+msg);};
const mid=t=>(t.lo+t.hi)/2;

async function runPersona(pe,{gapDims,source,model,ms}={}){
 const rf=E.buildRoleFacts(pe.profile,{confirmedAt:'2026-10-24T00:00:00.000Z'}),gt=E.buildGoalTree(pe.profile);
 const crisis=E.detectCrisis(rf.facts.map(f=>String(f.value)).join('\n'));
 if(crisis){const proj=E.computeProjection({roleFacts:rf,goalTree:gt,gap:E.confirmGap(E.assembleGap(E.heuristicGap(rf),rf,{}),{})});const v=E.validateProjection(proj,{roleFacts:rf});return {rf,proj,v,crisis:true};}
 const gap0=E.assembleGap(gapDims||E.heuristicGap(rf),rf,{source:source||'heuristic',model,ms});
 const gap=E.confirmGap(gap0,live?{}:(pe.confirmLevels||{}),'2026-10-24T00:00:00.000Z');
 const t0=performance.now();
 const proj=E.computeProjection({roleFacts:rf,goalTree:gt,gap,now:'2026-10-24T00:00:00.000Z'});
 proj.inputsHash=await E.projectionInputsHash({roleFacts:rf,goalTree:gt,gap});
 proj.shareCard=E.shareCardModel(proj);
 const ruleMs=performance.now()-t0;
 const v=E.validateProjection(proj,{roleFacts:rf,gap});
 return {rf,gt,gap0,gap,proj,v,ruleMs,crisis:false};
}
function checkExpect(pe,r){
 const e=pe.expect||{},issues=[];
 if(e.crisis){if(r.proj.mode!=='crisis_hold')issues.push('危机未暂停推演');if(pjLineNodes(r.proj).length||r.proj.lines?.length)issues.push('危机时仍有节点');if(r.proj.income)issues.push('危机时仍有收入');return issues;}
 if(r.proj.mode!=='normal')issues.push('mode='+r.proj.mode);
 const i=r.proj.income;
 if(e.income==='available'||e.income==='available_noedu'){
  if(!i?.available)issues.push('应出区间：'+(i?.detail||i?.reason));
  else{if(!i.sourceUrl||!i.dataYear)issues.push('缺来源或年份');if(e.city&&i.city!==e.city)issues.push('城市不符');if(e.income==='available'&&!i.coefficientVersion)issues.push('应带工龄系数版本');if(e.income==='available_noedu'&&i.coefficientVersion)issues.push('无学历匹配却用了系数');}
 }
 if(e.income==='none'){if(i?.available)issues.push('不应出区间');if(e.reasonCode&&i?.reasonCode!==e.reasonCode)issues.push('reasonCode='+i?.reasonCode+' 期望 '+e.reasonCode);if('low' in (i||{}))issues.push('无区间却有数字');}
 if(e.risk&&!r.v.R6.risks.includes(e.risk))issues.push('未识别风险域 '+e.risk);
 if(!r.proj.shareCard||JSON.stringify(r.proj.shareCard).match(/\d{4,}/)&&JSON.stringify(r.proj.shareCard).includes('元'))issues.push('分享卡含收入');
 if(r.proj.shareCard&&r.proj.shareCard.badge!==P.aiBadge)issues.push('分享卡缺标识');
 return issues;
}
const RKEYS=['crisis','R1','R2_single','R3','R6','R8','R9','R10','R11','R12','R15','R17'];
function summarize(pe,r,extra={}){
 const checks=Object.fromEntries(RKEYS.map(k=>[k,r.v[k]?.pass??null]));
 const expectIssues=checkExpect(pe,r);
 const row={tier:pe.tier,mode:r.proj.mode,difficulty:r.proj.difficulty?.tierLabel||null,horizon:pjLine(r.proj)?.horizon||null,lines:(r.proj.lines||[]).map(l=>l.kind),nodes:pjLineNodes(r.proj).map(n=>({id:n.id,level:n.level,tRange:n.tRange,evidence:n.evidence?.length||0,assumptions:n.assumptions?.length||0})),levels:r.gap?Object.fromEntries(Object.entries(r.gap.dims).map(([k,d])=>[k,d.level])):null,
  income:r.proj.income?(r.proj.income.available?{available:true,low:r.proj.income.low,high:r.proj.income.high,occupation:r.proj.income.occupation,city:r.proj.income.city,dataYear:r.proj.income.dataYear,sourceUrl:r.proj.income.sourceUrl,coefficientVersion:r.proj.income.coefficientVersion,stages:r.proj.income.stages?.map(s=>[s.bucket,s.lo,s.hi])}:{available:false,reason:r.proj.income.reason,detail:r.proj.income.detail,reasonCode:r.proj.income.reasonCode}):null,
  notices:(r.proj.notices||[]).map(n=>n.domain),checks,issues:Object.fromEntries(RKEYS.filter(k=>r.v[k]&&!r.v[k].pass).map(k=>[k,r.v[k].issues||r.v[k].hits])),expectIssues,ruleMs:r.ruleMs!=null?Number(r.ruleMs.toFixed(2)):null,inputsHash:r.proj.inputsHash||null,...extra};
 if(!r.v.pass)fail(pe.id,'validator '+JSON.stringify(row.issues).slice(0,300));
 if(expectIssues.length)fail(pe.id,'expect '+expectIssues.join('；'));
 return row;
}

// ---- 1) 扫描器自检（R8/R12 正反例）----
const scan=s=>E.pjScanBanned({t:s},{P}).map(h=>h.cat+':'+h.word);
const neg={'如果不行动就会落后':'reverse_implication','解锁更好的结果':'paid_outcome','会员可以更快达成目标':'paid_outcome','精准预测你的未来':'any','月入3万':'income_promise','30天实现转行':'income_promise','专家认证的推演':'authority','保证上岸':'any','你的命运':'any','再不行动就晚了':'any','照这样下去将很难':'future_extrapolation','你失败了':'word','人生失败':'word','失败的人生':'word','注定失败':'word','走向失败':'word','有点懒':'word','落后于他人':'word'};
for(const [s,cat] of Object.entries(neg)){const h=scan(s);ev.scanner[s]=h;if(!h.length||(cat!=='any'&&!h.some(x=>x.startsWith(cat))))fail('scanner','未命中：'+s);}
for(const s of [P.planAssumption,P.firstUseNotice,P.incomeDisclaimer,P.calibration,P.pageDisclaimer,P.l3IndustryNote,P.dataStaleNote]){const h=scan(s);if(h.length)fail('scanner','白名单固定句被误报：'+s);}
for(const s of ['考研失败','登录失败','生成失败','暂未生成成功，请重试']){const h=scan(s);if(h.length)fail('scanner','裸「失败」或中性文案不应命中：'+s+' -> '+h);}
{const tampered=P.planAssumption.replace('并不意味着','也就意味着');if(!scan(tampered).length)fail('scanner','篡改后的固定句（含「必然」）未被拦截');ev.scanner.tamperedPlanAssumption=scan(tampered);}
for(const s of ['第一步：列出 3 项能力','不辞职的前提下每周 8 小时'])if(scan(s).length)fail('scanner','正常文案误报：'+s);
// 提示词：显式禁止反向暗示且自身 0 命中
assert.ok(E.GAP_SYSTEM_PROMPT.includes('反向暗示'),'提示词须禁止反向暗示');
assert.ok(E.GAP_SYSTEM_PROMPT.includes('未来外推')||E.GAP_SYSTEM_PROMPT.includes('持续下去'),'提示词须禁止未来外推');
assert.ok(E.GAP_SYSTEM_PROMPT.includes('贴标签')||E.GAP_SYSTEM_PROMPT.includes('评判'),'提示词须禁止贴标签/评判');
ev.scanner.promptHits=E.pjScanBanned({p:E.GAP_SYSTEM_PROMPT},{P});if(ev.scanner.promptHits.length)fail('prompt','提示词命中禁用词');
// 前端：推演页无付费入口、无结果导向文案
const ui=readFileSync(new URL('../public/projection.js',import.meta.url),'utf8');
ev.scanner.uiPaidEntry=/付费|会员|解锁|订阅|升级|VIP|充值/.test(ui);if(ev.scanner.uiPaidEntry)fail('ui','推演页出现付费入口相关文案');
ev.scanner.uiHits=E.pjScanBanned({ui:ui.replace(/<[^>]+>/g,' ')},{P}).filter(h=>h.cat!=='word'||!['示例校准'].includes(h.word));
ev.scanner.uiR12Hits=ev.scanner.uiHits.filter(h=>['reverse_implication','paid_outcome'].includes(h.cat));if(ev.scanner.uiR12Hits.length)fail('ui','推演页源码命中 R12 模式');
assert.ok(ui.includes('meta.planAssumption')&&ui.includes('<details class="pj-why">'),'R11：页面须渲染按计划执行固定句和可展开依据/假设');
assert.ok(!ui.includes('示例校准'),'内部标记不得出现在页面');
assert.ok(!ui.includes('失败'),'推演页文案不得出现「失败」字符');
assert.ok(ui.includes('pj-income-src')&&ui.includes('sourceFull'),'R17：收入卡须可展开完整来源');
assert.ok(ui.includes('l3IndustryNote')||ui.includes('dataStaleNote'),'R17：收入卡须能渲染 L3/较旧说明');

// ---- 2) 画像（离线：规则 + 用户确认等级）----
for(const pe of PERSONAS){const r=await runPersona(pe);ev.personas[pe.id]={offline:summarize(pe,r)};
 const r2=await runPersona(pe);if(!r.crisis&&r2.proj.inputsHash!==r.proj.inputsHash)fail(pe.id,'同输入 inputsHash 不一致');if(!r.crisis&&JSON.stringify(r2.proj.lines)!==JSON.stringify(r.proj.lines))fail(pe.id,'同输入规则输出不一致');}
// 规则引擎纯函数 + 线结构（M1 只有计划线）
{const pe=PERSONAS.find(p=>p.id==='medium_1');const a=await runPersona(pe);const deepFreeze=o=>{if(o&&typeof o==='object'){Object.freeze(o);Object.values(o).forEach(deepFreeze);}return o;};
 const inp={roleFacts:structuredClone(a.rf),goalTree:structuredClone(a.gt),gap:structuredClone(a.gap)};deepFreeze(inp);
 let l1,l2;try{l1=E.computeLine(inp);l2=E.computeLine(inp);}catch(e){fail('engine','规则引擎修改了输入或抛错：'+e.message);}
 if(l1&&JSON.stringify(l1)!==JSON.stringify(l2))fail('engine','computeLine 同输入输出不一致');
 if(l1&&l1.line.kind!=='plan')fail('engine','M1 线类型应为 plan');
 {const xl=E.computeLine({...inp,execution:{startedAt:'2026-10-24T00:00:00.000Z',asOf:'2026-10-24T00:00:00.000Z',records:[]}});if(xl.line.kind!=='actual')fail('engine','带执行记录时 computeLine 应输出 actual 线');}
 const lk=(a.proj.lines||[]).map(l=>l.kind).join(',');if(lk!=='plan')fail('engine','推演 lines 应只有 plan，实际 '+lk);
 for(const k of ['nodes','milestones','horizon','line'])if(k in a.proj)fail('engine','推演顶层不应再有 '+k);
 ev.engine={pure:Boolean(l1),lines:lk};}
// R2 跨画像：周期随难度单调变长
const tierMid=t=>PERSONAS.filter(p=>p.tier===t).map(p=>mid(ev.personas[p.id].offline.horizon));
ev.r2.offline={easy:tierMid('easy'),medium:tierMid('medium'),hard:tierMid('hard')};
ev.r2.offline.pass=Math.max(...ev.r2.offline.easy)<Math.min(...ev.r2.offline.medium)&&Math.max(...ev.r2.offline.medium)<Math.min(...ev.r2.offline.hard);
if(!ev.r2.offline.pass)fail('R2','离线周期未随难度单调变长 '+JSON.stringify(ev.r2.offline));
// 收入参数表 v1.17：按用户城市×职业查表；同城 L1→L2→L3；省级估算/用户自填为开关；从不使用同级城市
{const base=PERSONAS.find(p=>p.id==='salary_in_table');const fb=[];ev.incomeFallback=fb;
 const mkP=f=>({...P,income:{...P.income,fallback:{...P.income.fallback,...f}}});
 const synLed={id:'src-syn-l3-2025',reportTitle:'示例城市职位薪资报告',publisher:'示例机构',platform:'示例平台',url:'https://example.test/syn',publishDate:'2025-03-01',fetchedDate:'2026-10-24',city:'',occupation:'',fieldsUsed:'P25,P75',metric:'税前月薪中位数',sourceTier:'L3',termsCheck:'测试合成',note:''};
 const syn=(o)=>({scope:'city',city:'深圳',province:'广东',occupation:'数据分析',officialName:'合成行',p25:9000,p50:12000,p75:15000,mean:null,metric:'税前月薪中位数',dataYear:'2025',sourceTier:'L3',sourceTierLabel:'招聘平台公开报告',sourceLedgerId:'src-syn-l3-2025',sourceUrl:'https://example.test/syn',expCoefVersion:null,internalMarker:'',note:'',...o});
 const mkT=(rows,extraLed={})=>({...INCOME_TABLE,ledger:{...INCOME_TABLE.ledger,'src-syn-l3-2025':synLed,...extraLed},rows:[...INCOME_TABLE.rows,...rows]});
 const run=(profile,{T=INCOME_TABLE,PP=P}={})=>{const rf=E.buildRoleFacts(profile,{confirmedAt:'2026-10-24T00:00:00.000Z'}),gt=E.buildGoalTree(profile);const gap=E.confirmGap(E.assembleGap(E.heuristicGap(rf),rf,{}),base.confirmLevels||{},'2026-10-24T00:00:00.000Z');const proj=E.computeProjection({roleFacts:rf,goalTree:gt,gap,P:PP,T,now:'2026-10-24T00:00:00.000Z'});return {inc:proj.income,v:E.validateProjection(proj,{roleFacts:rf,gap,P:PP,T})};};
 const check=(name,ok,r)=>{fb.push({name,pass:Boolean(ok),income:r.inc&&{available:r.inc.available,low:r.inc.low,high:r.inc.high,sourceTier:r.inc.sourceTier,sourceCategory:r.inc.sourceCategory,estimateLabel:r.inc.estimateLabel,reasonCode:r.inc.reasonCode,selfReported:r.inc.selfReported},R10:r.v.R10});if(!ok||!r.v.R10.pass)fail('incomeFallback',name+' '+JSON.stringify(r.v.R10.issues));};
 let r=run(base.profile);check('现有行均为 L1，来源类别显示该行层级',r.inc.available&&r.inc.sourceTier==='L1'&&r.inc.sourceCategory==='人社局工资价位',r);
 r=run(base.profile,{T:mkT([syn({})])});check('同城同职业同时有 L1 与 L3 → 取 L1',r.inc.sourceTier==='L1',r);
 r=run({...base.profile,city:'珠海'},{T:mkT([syn({city:'珠海'})])});check('同城只有 L3 → 取 L3 并显示招聘平台公开报告',r.inc.available&&r.inc.sourceTier==='L3'&&r.inc.sourceCategory==='招聘平台公开报告',r);
 r=run({...base.profile,city:'珠海'},{T:mkT([syn({city:'珠海'})]),PP:mkP({sameCityTiers:{enabled:false,order:['L1','L2','L3']}})});check('关闭层级回退 → 只认 L1，无区间',!r.inc.available&&r.inc.reasonCode==='occupation_city_no_data',r);
 r=run({...base.profile,city:'珠海'},{T:mkT([syn({city:'珠海',sourceTier:'L2',sourceTierLabel:'统计局平均工资',p25:null,p50:null,p75:null,mean:9000,bandLabel:'行业平均',industryName:'租赁和商务服务业'})])});check('L2 行业均值可用 → industry_mean + 行业名',r.inc.available&&r.inc.bandKind==='industry_mean'&&r.inc.low===9000&&r.inc.industryName==='租赁和商务服务业',r);
  r=run({...base.profile,city:'南京',goal:'转行做前端工程师'});check('南京分位为 P10–P90',r.inc.available&&r.inc.bandLabel&&r.inc.bandLabel.includes('P10')&&r.inc.percentileLow===10,r);
 r=run({...base.profile,city:'武汉',goal:'转行做前端工程师'});check('武汉用省级样本并标 ≠单市',r.inc.available&&r.inc.scope==='province'&&((r.inc.estimateLabel||'').includes('单市')||(r.inc.sampleLabel||'').includes('单市')),r);
 r=run({...base.profile,city:'成都',goal:'转行做前端工程师'});check('成都用川渝区域样本',r.inc.available&&r.inc.scope==='region'&&((r.inc.estimateLabel||'').includes('区域')||(r.inc.sampleLabel||'').includes('区域')),r);
 r=run({...base.profile,city:'北京',goal:'转行做前端工程师'});check('北京无职业L1 → 用 L2 行业均值并带行业名',r.inc.available&&r.inc.sourceTier==='L2'&&r.inc.bandKind==='industry_mean'&&r.inc.industryName,r);
 r=run({...base.profile,city:'珠海'});check('珠海（同省有深圳/广州行）不替代同级或同省城市 → 无区间',!r.inc.available&&r.inc.reason==='信息不足，暂无法给出区间'&&!('low' in r.inc),r);
 const provRow=syn({scope:'province',city:null,province:'广东',sourceTier:'L2',sourceTierLabel:'统计局平均工资',sourceUrl:'https://example.test/gd'});
 r=run({...base.profile,city:'珠海'},{T:mkT([provRow])});check('省级行存在且默认开 → 标注「以广东省数据估算」',r.inc.available&&r.inc.estimateLabel==='以广东省数据估算'&&r.inc.city==='珠海',r);
 r=run({...base.profile,city:'珠海'},{T:mkT([provRow]),PP:mkP({province:{...P.income.fallback.province,enabled:false}})});check('关闭省级估算 → 无区间',!r.inc.available,r);
 r=run({...base.profile,city:'珠海',selfSalary:'目标 offer 月薪 15000'});check('用户自填默认开 → 无区间 + 「用户自填」条件',!r.inc.available&&r.inc.selfReported?.label==='用户自填'&&!('low' in r.inc),r);
 r=run({...base.profile,city:'珠海',selfSalary:'目标 offer 月薪 15000'},{PP:mkP({userProvided:{...P.income.fallback.userProvided,enabled:false}})});check('关闭用户自填 → 不展示',!r.inc.available&&!r.inc.selfReported,r);
 // v1.22 实际线配置 + 分享卡仅计划线
 if(!(P.actualLine?.enabled&&P.actualLine.firstAppearance?.minDays===3&&P.actualLine.firstAppearance?.minValidRecords===3&&P.actualLine.firstAppearance?.recompute==='daily'))fail('actualLine','首次出现阈值应为 ≥3 天且 ≥3 条有效记录、每日重算');
 if(P.actualLine?.shareCard?.includeActualLine||P.actualLine?.shareCard?.includeExecutionRecords)fail('actualLine','分享卡默认不得含实际线或执行记录');

}
// R17：L3 格式、较旧加注、固定句、台账关联；分享卡无收入/截图
{const base=PERSONAS.find(p=>p.id==='salary_in_table');const r17=[];ev.R17cases=r17;
 const rf=E.buildRoleFacts(base.profile,{confirmedAt:'2026-10-24T00:00:00.000Z'}),gt=E.buildGoalTree(base.profile);
 const gap=E.confirmGap(E.assembleGap(E.heuristicGap(rf),rf,{}),base.confirmLevels||{},'2026-10-24T00:00:00.000Z');
 const proj=E.computeProjection({roleFacts:rf,goalTree:gt,gap,now:'2026-10-24T00:00:00.000Z'});
 const v=E.validateProjection(proj,{roleFacts:rf,gap});r17.push({name:'现有 L1 行通过 R17',pass:v.R17.pass,issues:v.R17.issues,income:{tier:proj.income.sourceTier,full:proj.income.sourceFull,year:proj.income.publishYear,ledger:proj.income.sourceLedgerId}});
 if(!v.R17.pass)fail('R17',JSON.stringify(v.R17.issues));
 const sc=E.shareCardModel(proj);if(!sc)fail('R17','分享卡缺失');
 if('income' in sc||'screenshot' in sc||'sourceFull' in sc||JSON.stringify(sc).includes('报告截图'))fail('R17','分享卡不得含收入或报告截图');
 if(sc.lineKind&&sc.lineKind!=='plan')fail('R17','分享卡只能是计划线');
 if('actual' in sc||'logs' in sc||'records' in sc||'execution' in sc)fail('R17','分享卡不得含实际线或执行记录');
 const scj=JSON.stringify(sc); if(/实际线|执行记录/.test(scj))fail('R17','分享卡文案不得含实际线/执行记录');
 r17.push({name:'分享卡无收入/截图/实际线',pass:true});
 // L3 + stale
 const synLed={id:'src-syn-old',reportTitle:'某平台2020薪资报告',publisher:'某机构',platform:'某平台',url:'https://example.test/old',publishDate:'2020-01-15',fetchedDate:'2026-10-24',city:'深圳',occupation:'数据分析',fieldsUsed:'P25,P75',metric:'税前月薪',sourceTier:'L3',termsCheck:'测试',note:''};
 const synRow={scope:'city',city:'珠海',province:'广东',occupation:'数据分析',officialName:'数据分析师',p25:8000,p50:10000,p75:13000,mean:null,metric:'税前月薪',dataYear:'2020',sourceTier:'L3',sourceTierLabel:'招聘平台公开报告',sourceLedgerId:'src-syn-old',sourceUrl:'https://example.test/old',expCoefVersion:null,internalMarker:'',note:''};
 const T={...INCOME_TABLE,ledger:{...INCOME_TABLE.ledger,'src-syn-old':synLed},rows:[...INCOME_TABLE.rows,synRow]};
 const rf2=E.buildRoleFacts({...base.profile,city:'珠海'},{confirmedAt:'2026-10-24T00:00:00.000Z'});
 const gap2=E.confirmGap(E.assembleGap(E.heuristicGap(rf2),rf2,{}),base.confirmLevels||{},'2026-10-24T00:00:00.000Z');
 const proj2=E.computeProjection({roleFacts:rf2,goalTree:gt,gap:gap2,T,now:'2026-10-24T00:00:00.000Z'});
 const v2=E.validateProjection(proj2,{roleFacts:rf2,gap:gap2,T});
 const ok=proj2.income.available&&proj2.income.sourceTier==='L3'&&proj2.income.l3IndustryNote===P.l3IndustryNote&&proj2.income.dataStaleNote===P.dataStaleNote&&/^来源：某平台《/.test(proj2.income.sourceFull)&&v2.R17.pass;
 r17.push({name:'L3 格式+固定句+较旧加注',pass:ok,income:proj2.income&&{full:proj2.income.sourceFull,l3:proj2.income.l3IndustryNote,stale:proj2.income.dataStaleNote,year:proj2.income.publishYear},R17:v2.R17});
 if(!ok)fail('R17','L3/stale '+JSON.stringify(v2.R17));
}
// diff：完成后提升等级 → 节点提前
{const pe=PERSONAS.find(p=>p.id==='medium_1');const a=await runPersona(pe);const rf=a.rf;const g2=E.confirmGap(a.gap0,{...pe.confirmLevels,ability:1});const p2=E.computeProjection({roleFacts:rf,goalTree:a.gt,gap:g2,prev:a.proj});ev.diffSample=p2.diffFromPrev;if(!p2.diffFromPrev?.changes?.length)fail('diff','等级变化后无变化说明');}

// ---- 3) 在线：Ollama 差距抽取（R4 一致性 + 7b/32b 对比 + 延迟）----
if(live){
 for(const model of models){
  ev.latency[model]={gapExtractMs:[],ruleMs:[],fallbacks:0,invalid:0};ev.r4[model]={};
  for(const pe of PERSONAS){
   if(pe.expect?.crisis){ev.personas[pe.id][model]={skipped:'危机路径不调用模型'};continue;}
   const runs=[];
   for(let k=0;k<repeat;k++){
    const rf=E.buildRoleFacts(pe.profile),gt=E.buildGoalTree(pe.profile);
    const ext=await extractGapLLM({},rf,gt,{model,fallbackModel:'',base});
    if(ext.source!=='llm'){ev.latency[model].invalid++;}
    ev.latency[model].gapExtractMs.push(ext.ms);
    const r=await runPersona(pe,{gapDims:ext.dims,source:ext.source,model:ext.model,ms:ext.ms});
    ev.latency[model].ruleMs.push(r.ruleMs);
    runs.push({ext,r});
   }
   const first=runs[0];
   ev.personas[pe.id][model]={...summarize(pe,first.r,{source:first.ext.source,attempts:first.ext.attempts}),runs:runs.map(x=>({source:x.ext.source,ms:x.ext.ms,levels:Object.fromEntries(Object.entries(x.r.gap.dims).map(([k,d])=>[k,d.level])),horizon:pjLine(x.r.proj).horizon,nodeT:Object.fromEntries(pjLine(x.r.proj).nodes.map(n=>[n.id,n.tRange])),income:x.r.proj.income?.available?[x.r.proj.income.low,x.r.proj.income.high]:null,pass:x.r.v.pass}))};
   for(const x of runs.slice(1))summarize(pe,x.r);
   // R4
   const dims=Object.keys(first.r.gap.dims),r4=[];
   for(const d of dims){const ls=runs.map(x=>x.r.gap.dims[d].level);const mode=ls.sort((a,b)=>ls.filter(v=>v===b).length-ls.filter(v=>v===a).length)[0];const agree=runs.filter(x=>x.r.gap.dims[d].level===mode).length;if(agree<Math.ceil(repeat*0.8))r4.push(d+' 一致 '+agree+'/'+repeat);if(Math.max(...ls)-Math.min(...ls)>1)r4.push(d+' 最大差 >1 级');}
   const nodeSets=new Set(runs.map(x=>pjLine(x.r.proj).nodes.map(n=>n.id).join(','))),msSets=new Set(runs.map(x=>pjLine(x.r.proj).milestones.map(m=>m.id).join(',')));
   if(nodeSets.size>1)r4.push('节点集合不一致');if(msSets.size>1)r4.push('里程碑集合不一致');
   for(const n of pjLine(runs[0].r.proj).nodes){const m0=mid(n.tRange);for(const x of runs.slice(1)){const o=pjLine(x.r.proj).nodes.find(k=>k.id===n.id);if(o&&Math.abs(mid(o.tRange)-m0)>Math.max(2,m0*0.15)){r4.push('节点 '+n.id+' 时间中点偏差超阈');break;}}}
   const inc=runs.map(x=>x.r.proj.income);if(inc.some(i=>Boolean(i?.available)!==Boolean(inc[0]?.available)))r4.push('收入是否出区间不一致');else if(inc[0]?.available&&inc.some(i=>Math.abs(i.low-inc[0].low)>inc[0].low*0.1||Math.abs(i.high-inc[0].high)>inc[0].high*0.1))r4.push('收入上下界偏差 >10%');
   ev.r4[model][pe.id]={pass:!r4.length,issues:r4};
   console.log(model,pe.id,runs.map(x=>x.ext.source+':'+x.ext.ms).join(' '),r4.length?'R4✗ '+r4.join('；'):'R4✓');
  }
  const L=ev.latency[model];L.p50GapMs=pct(L.gapExtractMs,50);L.p90GapMs=pct(L.gapExtractMs,90);L.p50RuleMs=Number(pct(L.ruleMs,50).toFixed(2));L.p90RuleMs=Number(pct(L.ruleMs,90).toFixed(2));
  // R2 在线（模型等级未改动直接确认）
  const tm=t=>PERSONAS.filter(p=>p.tier===t).map(p=>mid(ev.personas[p.id][model].horizon));
  ev.r2[model]={easy:tm('easy'),medium:tm('medium'),hard:tm('hard')};ev.r2[model].pass=Math.max(...ev.r2[model].easy)<Math.min(...ev.r2[model].medium)&&Math.max(...ev.r2[model].medium)<Math.min(...ev.r2[model].hard);
 }
}
ev.pass=!ev.failures.length;
if(out)writeFileSync(out,JSON.stringify(ev,null,1));
const line=id=>{const o=ev.personas[id].offline;return id.padEnd(22)+Object.entries(o.checks).map(([k,v])=>k+(v?'✓':v===false?'✗':'-')).join(' ')+(o.expectIssues.length?' ✗'+o.expectIssues.join('；'):'');};
console.log(Object.keys(ev.personas).map(line).join('\n'));
if(live)for(const m of models)console.log(m,'gap P50/P90',ev.latency[m].p50GapMs,ev.latency[m].p90GapMs,'ms; rule P50/P90',ev.latency[m].p50RuleMs,ev.latency[m].p90RuleMs,'ms; invalid',ev.latency[m].invalid,'R2',ev.r2[m].pass);
if(ev.failures.length){console.error('失败：\n'+ev.failures.join('\n'));if(!live)process.exit(1);}
else console.log('通过：人生推演画像 R1–R3、R6、R8–R12、危机暂停、薪资表规则（城市/职业不在表、公办在编、投资）、扫描器正反例、R2 难度单调'+(live?'、R4 在线一致性':'')+'。');
