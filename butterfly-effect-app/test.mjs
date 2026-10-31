import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import ChatOnboarding from './public/onboarding.js';
import InterviewCore from './public/onboarding-core.js';
const el={innerHTML:'',style:{setProperty(){}},classList:{add(){},remove(){}},focus(){}};
const context=vm.createContext({ChatOnboarding,InterviewCore,document:{querySelector:()=>el,querySelectorAll:()=>[],documentElement:el,body:{classList:{add(){},remove(){}}},addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},window:{innerHeight:900,addEventListener(){}},requestAnimationFrame:fn=>fn(),crypto:globalThis.crypto,structuredClone,Date,Math,setTimeout(){},console});
vm.runInContext(fs.readFileSync('public/story.js','utf8'),context);
vm.runInContext(fs.readFileSync('public/app.js','utf8').replace(/^import .*;$/gm,'')+'\nglobalThis.api={initialTasks,stages,presets,makeUser,stats,today,chapterTasks,focusedTask,periodResults,totalActual,acceptDraft,undoDraft,advanceCycle,adjustment,getDraft:()=>draft,setUser:n=>{db.users[n.id]=n;db.active=n.id;}}',context);
const a=context.api;
const pa={...a.presets.A},pb={...a.presets.B};
assert.notEqual(a.initialTasks(pa)[0].title,a.initialTasks(pb)[0].title,'技能背景应改变任务');
for(const hours of [.5,1,2,4,10,80]){const ts=a.initialTasks({...pa,hours});assert.ok(ts.reduce((s,t)=>s+t.minutes,0)<=hours*60*.7,'排程必须符合预算');}
const user=a.makeUser(pa,'test');a.setUser(user);
assert.equal(a.stats().unknown,3,'未反馈保持未知');
user.tasks[0].status='missed';user.tasks[0].reason='时间不足';
a.adjustment();assert.equal(a.getDraft().reason,'时间不足');assert.equal(a.getDraft().tasks[0].minutes,15);
assert.ok(user.tasks.every(t=>!t.archived),'未接受草案前不应修改任务');
user.observations.push({text:'近期“时间不足”可能影响任务执行。',state:'不准确'});
a.adjustment();assert.equal(a.getDraft().reason,'信息不足','纠正后不得继续使用被否定的推断');
user.week=2;user.tasks.push(...a.initialTasks(pa,2));
assert.equal(a.stats().ts.length,3);assert.equal(a.stats(true).ts.length,6,'月复盘应包含周期内多周数据');
user.tasks[0].archived=true;assert.equal(a.stats(true).ts.length,5,'归档任务不重复进入统计');
const newcomer=a.initialTasks({...pa,experience:'',skills:'写作'});assert.ok(!newcomer[0].why.includes('已有行业经验'),'不可虚构客户资源');


const original=a.makeUser(pa,'transactions');a.setUser(original);
const proposed={...pa,hours:1,name:'待确认的新资料'};
a.adjustment(true,proposed);
assert.equal(original.profile.name,pa.name,'生成档案草案不应提前保存资料');
a.acceptDraft();assert.equal(original.profile.name,proposed.name);assert.equal(original.versions.length,1);
a.undoDraft();assert.equal(original.profile.name,pa.name,'撤销须恢复原档案');
const task=original.tasks.find(t=>!t.archived);task.status='done';task.result='完成资料整理';task.actual=12;
assert.notEqual(a.focusedTask()?.id,task.id,'今日应自动展示下一待办');
original.results.push({week:1,date:'2026-10-21',text:'本周成果'});
original.week=2;original.tasks.push(...a.initialTasks(pa,2));
assert.equal(a.periodResults().length,0,'新周不得显示上周成果');assert.equal(a.periodResults(true).length,1,'月汇总需包含同月成果');
const t2=a.stats().ts[0];t2.status='partial';t2.actual=7;t2.reason='时间不足';
a.adjustment();a.acceptDraft();assert.equal(a.totalActual(),7,'调整不得丢失已归档的用时');
a.undoDraft();assert.equal(a.totalActual(),7,'撤销不得重复计算用时');
original.observations=[];original.learn=false;
const past=original.tasks.find(t=>t.week===1);past.reason='能力不足';
a.adjustment();assert.equal(a.getDraft().reason,'时间不足','关闭观察后仅使用本周直接反馈');
const blank=a.makeUser({...pa,kind:'custom'},'empty');a.setUser(blank);blank.tasks=[];
assert.equal(a.focusedTask(),null);assert.equal(a.stats().unknown,0);
console.log('通过：个性化差异、6档时间预算、未知状态、推断纠正、周期统计、归档去重、资料确认/撤销、任务推进、成果归属、历史用时及空任务。');

assert.doesNotThrow(()=>a.today(),'空任务首页不能崩溃');
const phaseUser=a.makeUser(pa,'phase');a.setUser(phaseUser);phaseUser.chapter=1;
a.adjustment(true,{...pa,hours:2});assert.equal(a.getDraft().proposedChapter,1);assert.equal(a.getDraft().tasks[0].chapter,1,'仅改时间不应重置阶段');
a.adjustment(true,{...pa,kind:'reading',goal:'读书并完成4篇输出'});assert.equal(a.getDraft().proposedChapter,0,'换目标应使用新路线起点');
const newer=a.makeUser(pa,'undo-feedback');a.setUser(newer);newer.tasks[0].status='done';newer.tasks[0].result='已有产出';newer.tasks[1].reason='时间不足';
a.adjustment();a.acceptDraft();newer.tasks[0].updated='2099-01-01T00:00:00Z';newer.tasks[0].result='接受调整后补充的新反馈';a.undoDraft();assert.equal(newer.tasks[0].result,'接受调整后补充的新反馈','撤销不能覆盖较新反馈');
console.log('补充通过：空首页、改资料保留阶段、更换目标重置阶段、撤销保留新反馈。');
const engine=context.ButterflyStory;
for(const kind of ['business','portfolio','reading','custom']){
 const p={...pa,kind,hours:.5,focusMinutes:10,timeSlot:'周二晚20:30',longGoal:'三年方向'};
 const story=engine.buildStory(p);assert.equal(story.chapters.length,4);assert.ok(story.chapters.every(c=>c.quests.length>=2&&c.branches.length===3&&c.gate));
 for(let chapter=0;chapter<4;chapter++)for(const task of (chapter===0?a.initialTasks(p):a.chapterTasks(p,chapter,1))){const details=engine.details(p,task);assert.ok(details.output&&details.example&&details.tool&&details.when===p.timeSlot);assert.ok(details.steps.length>=1&&details.steps.every(s=>s.text.trim()));assert.ok(details.steps.reduce((sum,s)=>sum+s.minutes,0)<=task.minutes);}
}
const adapted=engine.buildStory(pa,{chapter:0,storyChoices:{0:2},results:[{text:'已保存一条真实反馈'}]});assert.ok(adapted.chapters[0].narrative.includes('时间或条件变化'));assert.ok(adapted.chapters[0].narrative.includes('已保存一条真实反馈'));
console.log('V0.3通过：四类目标的4幕剧情、事件/分支/推进门槛、具体步骤与示例、极小预算下的任务拆分、真实反馈进入叙事。');

const branchUser=a.makeUser(pa,'branch');branchUser.storyChoices={0:2};a.setUser(branchUser);a.adjustment();assert.equal(a.getDraft().reason,'时间不足');assert.ok(a.getDraft().tasks[0].questSteps?.length);assert.ok(a.getDraft().tasks[0].title.startsWith('只做：'));console.log('剧情分支确实改变任务草案，并保留具体执行步骤。');
