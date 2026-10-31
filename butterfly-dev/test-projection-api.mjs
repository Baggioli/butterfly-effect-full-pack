import assert from 'node:assert/strict';
import {api,__resetAccountStoreForTests} from './worker/api.js';
import {__resetProjectionStoreForTests} from './worker/projection-api.js';
import {PROJECTION_PARAMS as P} from './worker/projection-params.js';
const origin='https://example.test';
// 指向不存在的本地端口：模型不可用时应走规则估算，不得外连
const env={SMS_PROVIDER:'mock',AUTH_OTP_COOLDOWN_SEC:'1',OLLAMA_BASE_URL:'http://127.0.0.1:9',AI_GAP_MODEL:'qwen2.5:7b',AI_GAP_FALLBACK_MODEL:'qwen2.5:32b'};
const id={'oai-authenticated-user-id':'dgx-owner'};
const H=(x={})=>({'Content-Type':'application/json',Origin:origin,...id,...x});
const post=(p,b,x={})=>api(new Request(origin+p,{method:'POST',headers:H(x),body:JSON.stringify(b)}),env);
const get=(p,x={})=>api(new Request(origin+p,{headers:H(x)}),env);
__resetAccountStoreForTests();__resetProjectionStoreForTests();
const profile={name:'合成C',age:'27',education:'本科',city:'深圳',role:'行政专员',skills:'Excel 数据透视表',hours:8,goal:'一年内转岗做数据分析师'};
let r=await post('/api/projection/gap',{profile});assert.equal(r.status,401,'未登录拒绝');
await post('/api/auth/send-code',{phone:'13900139000',agreedTerms:true,agreedPrivacy:true});
const s=await (await post('/api/auth/verify-code',{phone:'13900139000',code:'000000'})).json();const A={Authorization:'Bearer '+s.token};
r=await post('/api/projection/gap',{profile},A);assert.equal(r.status,403,'未同意敏感信息拒绝');
assert.equal((await post('/api/auth/sensitive-consent',{agreed:true},A)).status,200);
r=await api(new Request(origin+'/api/projection/gap',{method:'POST',headers:{...H(A),Origin:'https://evil.test'},body:JSON.stringify({profile})}),env);assert.equal(r.status,403,'跨来源拒绝');
r=await api(new Request(origin+'/api/projection/gap',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...A},body:JSON.stringify({profile})}),env);assert.equal(r.status,401,'缺私人空间头拒绝');
r=await post('/api/projection/gap',{profile},A);assert.equal(r.status,200);const g=await r.json();
assert.equal(g.mode,'normal');assert.equal(Object.keys(g.gap.dims).length,6);assert.equal(g.gap.status,'draft');assert.equal(g.gap.source,'heuristic','模型不可用时规则兜底');
r=await post('/api/projection/skeleton',{},A);assert.equal(r.status,400,'未确认差距不可推演');
r=await post('/api/projection/gap/confirm',{gapId:g.gap.id,levels:{ability:2,credential:1,experience:3,network:2,income:2,time:9}},A);const c=await r.json();assert.equal(c.gap.status,'confirmed');assert.equal(c.gap.dims.time.level,g.gap.dims.time.level,'非法等级不得写入');assert.equal(c.gap.dims.experience.level,3);
r=await post('/api/projection/skeleton',{gapId:c.gap.id},A);const k=await r.json();assert.equal(r.status,200);
const p=k.projection;assert.deepEqual(p.lines.map(l=>l.kind),['plan'],'M1 只有计划线');assert.ok(!('nodes' in p));assert.equal(p.version,1);assert.ok(p.inputsHash);assert.equal(p.meta.badge,P.aiBadge);assert.equal(p.meta.planAssumption,P.planAssumption);assert.ok(p.validation.pass,JSON.stringify(p.validation));
assert.ok(p.income.available&&p.income.sourceUrl);assert.ok(!JSON.stringify(p.shareCard).includes(String(p.income.low)),'分享卡无收入');
r=await post('/api/projection/skeleton',{gapId:c.gap.id},A);assert.equal((await r.json()).reused,true,'同输入复用同版本');
r=await post('/api/projection/gap/confirm',{gapId:g.gap.id,levels:{ability:1,credential:1,experience:3,network:2,income:2}},A);const c2=await r.json();
r=await post('/api/projection/skeleton',{gapId:c2.gap.id},A);const k2=await r.json();assert.equal(k2.projection.version,2);assert.ok(k2.projection.diffFromPrev.changes.length);
r=await post('/api/projection/log',{taskId:'t_today_1',nodeId:'n_ability',status:'done',actualMinutes:20},A);assert.equal(r.status,200);
r=await get('/api/projection/latest',A);const l=await r.json();assert.equal(l.projection.version,2);assert.equal(l.logs.at(-1).status,'done');
r=await get('/api/projection/params',A);assert.equal((await r.json()).params.firstUseNotice,P.firstUseNotice);
// 危机：先走危机流程，整页暂停，不调用模型、不保存内容
r=await post('/api/projection/gap',{profile:{...profile,goal:'最近觉得活着没意思'}},A);const cr=await r.json();assert.equal(cr.mode,'crisis_hold');assert.ok(cr.crisis.hotlines.length>=2);assert.equal(cr.gap,undefined);

// confirm + generate 单次往返（浏览器预览路径用，减少一次易断的 POST）
__resetProjectionStoreForTests();
r=await post('/api/projection/gap',{profile},A);const g3=await r.json();
r=await post('/api/projection/gap/confirm',{gapId:g3.gap.id,levels:{ability:2,credential:2,experience:2,network:2,income:2},generate:true},A);
const cg=await r.json();assert.equal(r.status,200);assert.equal(cg.gap.status,'confirmed');
assert.ok(cg.projection,'generate:true 须同响应返回骨架');assert.ok(cg.projection.validation.pass);
assert.deepEqual(cg.projection.lines.map(l=>l.kind),['plan']);
assert.ok(cg.dimLabels&&cg.dimLabels.ability==='能力','确认响应须带维度中文标签');
// 阶段 A：暂停原因枚举、演示模式（不落库）、真实记录不足 → 占位
// P0-14 详细故事版：骨架先返回，故事异步 generating → ready（模型不可用 → 模板兜底，数字锁定）
assert.equal(cg.projection.story.status,'generating','骨架先返回，故事异步生成');assert.ok(cg.projection.story.progress.total>=3);
let st;for(let i=0;i<100;i++){st=(await (await get('/api/projection/story',A)).json()).story;if(st.status!=='generating')break;await new Promise(r=>setTimeout(r,50));}
assert.equal(st.status,'ready','故事生成完成');assert.equal(st.badge,P.aiBadge);assert.equal(st.source,'template');
assert.ok(st.validation.S1.pass&&st.validation.S2.pass&&st.validation.S3.pass&&st.validation.numberLock.pass,'S1–S3 + 数字锁定');
assert.ok(st.chars>=P.story.minChars&&st.chars<=P.story.maxChars);assert.ok(st.summary.length<=P.story.summaryMaxChars);
r=await get('/api/projection/latest',A);assert.equal((await r.json()).projection.story.status,'ready','latest 合并故事');
r=await post('/api/projection/story/generate',{},A);assert.equal((await r.json()).started,false,'已 ready 不重复生成');
assert.equal(st.storyVersion,1,'首版留版号 1');
// P0-19：AI 改写不直接覆盖 → 草稿 + 差异摘要，确认后写入留版
r=await post('/api/projection/story/generate',{force:true,wait:true},A);const rg=await r.json();assert.equal(rg.started,true);assert.equal(rg.story.status,'ready','改写期间原故事保持可见');
assert.equal(rg.story.storyVersion,1);const rd=rg.story.drafts.at(-1);assert.equal(rd.kind,'rewrite');assert.ok(rd.diff.text.includes('数字锁定')||rd.diff.text.includes('没有实质差异'));
r=await post('/api/projection/story/confirm',{draftId:rd.id},A);let cf=await r.json();assert.equal(cf.accepted,true);assert.equal(cf.story.storyVersion,2);assert.equal(cf.story.history.length,1,'旧版留存');assert.equal(cf.story.drafts.length,0);
r=await post('/api/projection/story/confirm',{draftId:rd.id},A);assert.equal(r.status,404,'草稿只能确认一次');
// P0-16：完成节点 → 一幕续写草稿（S4：100–200 字、点名节点、R8=0、数字锁定），确认后写入
const n0=cg.projection.lines[0].nodes[0];
r=await post('/api/projection/log',{taskId:'t_today_1',nodeId:n0.id,status:'done',nodeComplete:true},A);const lg=await r.json();assert.ok(lg.storyDraft,'完成节点出续写草稿');
const cd=lg.storyDraft;assert.equal(cd.kind,'continuation');assert.ok(cd.continuation.validation.S4.pass&&cd.continuation.validation.pass,'S4');assert.ok(cd.continuation.chars>=100&&cd.continuation.chars<=200);assert.ok(cd.diff.text.includes(n0.title));
r=await post('/api/projection/story/continue',{nodeId:n0.id},A);assert.equal((await r.json()).draft.id,cd.id,'同节点不重复出草稿');
r=await post('/api/projection/story/confirm',{draftId:cd.id},A);cf=await r.json();assert.equal(cf.story.continuations.length,1);assert.equal(cf.story.storyVersion,3);assert.equal(cf.story.history.length,2);
r=await post('/api/projection/story/continue',{nodeId:n0.id},A);assert.equal((await r.json()).draft,null,'已写入的续写不再出草稿');
const n1=cg.projection.lines[0].nodes[1];r=await post('/api/projection/story/continue',{nodeId:n1.id},A);const d1=(await r.json()).draft;
r=await post('/api/projection/story/confirm',{draftId:d1.id,accept:false},A);cf=await r.json();assert.equal(cf.accepted,false);assert.equal(cf.story.continuations.length,1,'放弃不写入');
r=await post('/api/projection/story/continue',{nodeId:'nope'},A);assert.equal(r.status,400);
r=await post('/api/projection/log',{status:'paused',pauseReason:'随便写'},A);assert.equal(r.status,400,'暂停原因须为枚举');
r=await post('/api/projection/log',{status:'paused',pauseReason:'家庭事务',pauseDays:3},A);assert.equal(r.status,200);assert.equal((await r.json()).log.pauseReason,'family');
r=await post('/api/projection/log',{taskId:'t_today_1',nodeId:'n_ability',status:'done'},A);assert.equal(r.status,200);
r=await get('/api/projection/latest',A);let lt=await r.json();assert.deepEqual(lt.projection.lines.map(l=>l.kind),['plan'],'记录不足不出实际线');assert.equal(lt.projection.actual.status,'placeholder');assert.equal(lt.projection.actual.placeholder,P.actualLine.placeholder);
const before=JSON.stringify(lt.projection.lines)+lt.logs.length;
// P0-25: demo/actual works without login (synthetic, no persist)
r=await post('/api/projection/demo/actual',{scenario:'behind',days:28});assert.equal(r.status,200,'未登录演示须放行');
{const d=await r.json();assert.equal(d.demo,true);assert.equal(d.projection.demo.source,'synthetic');assert.deepEqual(d.projection.lines.map(l=>l.kind),['plan','actual']);}
r=await api(new Request(origin+'/api/projection/demo/actual',{method:'POST',headers:{...H(),Origin:'https://evil.test'},body:JSON.stringify({scenario:'behind'})}),env);assert.equal(r.status,403,'未登录演示仍校验 Origin');
for(const sc of ['on_plan','behind','ahead','paused']){
 r=await post('/api/projection/demo/actual',{scenario:sc,days:28},A);const d=await r.json();assert.equal(r.status,200);
 assert.equal(d.projection.demo.label,'演示数据');assert.equal(d.projection.story.status,'ready','演示故事同步模板');assert.ok(d.projection.story.validation.pass);assert.deepEqual(d.projection.lines.map(l=>l.kind),['plan','actual'],sc+' 演示出实际线');
 assert.equal(d.projection.actual.notice,P.actualLine.notice);assert.ok(d.projection.validation.pass,sc+' 校验通过 '+JSON.stringify(Object.entries(d.projection.validation).filter(([k,v])=>v&&v.pass===false)));
 if(sc==='behind')assert.ok(d.projection.actual.deltaWeeks>0&&d.projection.actual.attribution.length);
 if(sc==='on_plan')assert.equal(d.projection.actual.deltaWeeks,0);
}
r=await get('/api/projection/latest',A);lt=await r.json();assert.equal(JSON.stringify(lt.projection.lines)+lt.logs.length,before,'演示不污染真实会话');assert.ok(!lt.projection.demo);
// P0-20 W1：周报 —— 不足 7 天 → 409；造 7 天有效记录 → 固定模板周报并留存；演示快进同样有周报
{
 const {projectionStore}=await import('./worker/projection-api.js');const {pjSha256}=await import('./worker/projection.js');
 r=await get('/api/projection/weekly-report',A);let w=await r.json();assert.equal(r.status,200);assert.equal(w.gate.met,false,'无 7 天记录 → 未达门槛');assert.equal(w.report,null);
 r=await post('/api/projection/weekly-report',{},A);assert.equal(r.status,409,'不足 7 天 → 409');assert.equal((await r.json()).code,'WEEKLY_NOT_READY');
 const store=projectionStore(env);const uk=(await pjSha256('pj:13900139000')).slice(0,24);const doc=await store.load(uk);const pj=doc.projections.at(-1);
 const t0=Date.now()-8*86400000;pj.createdAt=new Date(t0).toISOString();
 for(let i=0;i<7;i++)doc.logs.push({id:'wl'+i,type:'task',projectionId:pj.id,taskId:'t_today_1',nodeId:pj.lines[0].nodes[0].id,status:i%3===2?'partial':'done',actualMinutes:15,at:new Date(t0+(i+0.5)*86400000).toISOString()});
 doc.logs.push({id:'wlp',type:'pause',projectionId:pj.id,taskId:'',nodeId:'',status:'paused',pauseReason:'health',pauseDays:1,at:new Date(t0+7.5*86400000).toISOString()});
 await store.save(uk,doc);
 r=await get('/api/projection/weekly-report',A);w=await r.json();assert.equal(w.gate.met,true,'7 天有效记录 → 达门槛 '+JSON.stringify(w.gate));
 r=await post('/api/projection/weekly-report',{},A);w=await r.json();assert.equal(r.status,200,JSON.stringify(w));
 const wr=w.report;assert.equal(wr.source,'template');assert.equal(wr.badge,P.aiBadge);assert.ok(wr.validation.W1.pass,'W1 扫描通过');
 assert.match(wr.progress,/^第 \d+ 周（.+～.+）：记录 \d+ 次，完成 \d+ 次、部分完成 \d+ 次、未完成 \d+ 次/,'进展句固定模板');
 assert.ok(['continuations','summary','placeholder'].includes(wr.story.kind),'故事更新：续写摘录 / 摘要 / 占位');assert.ok(wr.next&&wr.next.minutes<=15,'下一步 ≤15 分钟');
 assert.ok(wr.text.includes('故事更新：'));assert.ok(!JSON.stringify(wr).includes('示例校准'));
 r=await get('/api/projection/weekly-report',A);w=await r.json();assert.equal(w.report.id,wr.id,'周报留存可再读');
 r=await post('/api/projection/weekly-report',{},A);w=await r.json();r=await get('/api/projection/weekly-report',A);assert.equal((await r.json()).reports.length,1,'同一天重复生成覆盖同一份');
 r=await post('/api/projection/demo/actual',{scenario:'behind',days:21},A);const dm=await r.json();assert.ok(dm.weeklyReport&&dm.weeklyReport.validation.W1.pass,'演示快进 21 天 → 周报');assert.equal(dm.weeklyGate.met,true);
}
console.log('通过：推演 API 登录/敏感同意/来源/私人空间头门禁、差距生成→确认→骨架、同输入复用、版本与变化说明、执行记录、详细故事版异步生成/改写草稿确认留版/节点续写 S4、危机暂停（模型不可用时规则兜底）、W1 周报门槛/模板/留存。');
