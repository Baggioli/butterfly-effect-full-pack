import ChatOnboarding from './onboarding.js';
import InterviewCore from './onboarding-core.js';
import {createProjectionUI} from './projection.js?v=pj-m2a';
let chatOnboarding=null;
const Story=globalThis.ButterflyStory;
const statusNames={unknown:"未反馈",started:"进行中",done:"已完成",partial:"部分完成",missed:"未完成"};
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='butterfly-v1', NAV=[['today','◷','今日'],['route','⌁','路线'],['projection','⋈','推演'],['plan','▦','计划'],['review','◴','复盘'],['profile','♧','我的']];

const AUTH_KEY='butterfly-session-v1';
let authSession=null;try{authSession=JSON.parse(sessionStorage.getItem(AUTH_KEY)||'null')}catch{authSession=null}
function authHeaders(extra={}){const h={'Content-Type':'application/json',...extra};if(authSession?.token){h.Authorization='Bearer '+authSession.token;h['X-Butterfly-Session']=authSession.token}return h}
function saveAuth(){try{if(authSession)sessionStorage.setItem(AUTH_KEY,JSON.stringify(authSession));else sessionStorage.removeItem(AUTH_KEY)}catch{}}
function clearAuth(){authSession=null;saveAuth()}
async function authFetch(path,opts={}){const {timeoutMs=20000,...rest}=opts;const r=await fetch(path,{...rest,headers:{...authHeaders(rest.headers||{}),...(rest.headers||{})},signal:rest.signal||AbortSignal.timeout(timeoutMs)});let body=null;try{body=await r.json()}catch{}return {ok:r.ok,status:r.status,body}}
async function syncJourneyToServer(){
 if(!authSession?.token||!u())return;
 const n=u();
 const journey={id:n.id,profile:n.profile,week:n.week,chapter:n.chapter,tasks:n.tasks,versions:n.versions,observations:n.observations,results:n.results,notes:n.notes,learn:n.learn,questChecks:n.questChecks,storyChoices:n.storyChoices,events:n.events,profileEvidence:n.profileEvidence,profileInterpretations:n.profileInterpretations,lastConversationAt:n.lastConversationAt,contentVersion:n.contentVersion};
 try{await authFetch('/api/account/journey',{method:'PUT',body:JSON.stringify({journey})})}catch{/* offline stub */}
}
async function loadJourneyFromServer(){
 if(!authSession?.token)return false;
 const {ok,body}=await authFetch('/api/account/journey');
 if(!ok||!body?.journey)return false;
 const j=body.journey;if(!j.id||!j.profile)return false;
 db.users[j.id]=j;db.active=j.id;db.lastOwn=j.id;save();return true;
}
let db;try{db=JSON.parse(localStorage.getItem(KEY))||{active:null,users:{}};if(!db.users||typeof db.users!=='object')throw Error()}catch{db={active:null,users:{}};setTimeout(()=>toast('本地记录无法读取，请重新建立档案'),100)}
let page='today',period='week',planPeriod='week',reviewPeriod='week',draft=null,wizardStep=0,formDraft={},editing=false,previewWidth='390',selectedStory=0;
const now=()=>new Date().toISOString(),day=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}),uid=()=>crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,u=()=>db.users[db.active];
for(const [id,n] of Object.entries(db.users)){
 if(!n||!n.profile||!Array.isArray(n.tasks)){delete db.users[id];continue}
 for(const k of ['versions','observations','results','notes'])if(!Array.isArray(n[k]))n[k]=[];
 n.questChecks??={};n.storyChoices??={};n.events??=[];n.ignoredReasons??=[];n.week=Math.max(1,Number(n.week)||1);n.chapter=Math.min(3,Math.max(0,Number(n.chapter)||0));
 n.profile.name=String(n.profile.name||'朋友');if(n.profile.hours!==undefined&&n.profile.hours!==null&&n.profile.hours!=='')n.profile.hours=Math.max(.5,Number(n.profile.hours)||.5);else delete n.profile.hours;n.conversationStartedAt??=new Date().toISOString();
 n.profile.kind??='custom';n.learn??=true;n.tasks.forEach(t=>{t.week??=1;t.chapter??=0;t.actual=Number(t.actual)||0;t.status??='unknown'});
}if(!db.users[db.active])db.active=null;
for(const n of Object.values(db.users)){
 if(!n.contentVersion){
  const fresh=n.chapter?chapterTasks(n.profile,n.chapter,n.week):initialTasks(n.profile,n.week);let cursor=0;n.tasks=n.tasks.map(t=>t.week===n.week&&!t.archived&&t.status==='unknown'&&!t.result?{...t,...fresh[cursor++%fresh.length],id:t.id,date:t.date,legacyTitle:t.title}:t);
  n.contentVersion=3;
 }
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(db))}catch{toast('本地存储不可用，请导出记录备份')}if(authSession?.token)syncJourneyToServer()}
const projectionUI=createProjectionUI({esc,modal:(...x)=>modal(...x),close:()=>close(),toast:t=>toast(t),authHeaders:x=>authHeaders(x),getProfile:()=>u()?.profile,render:()=>render()});
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',3000)}
const butterfly=`<svg viewBox="0 0 220 170" fill="none" aria-hidden="true"><path d="M108 88C67 1 4 8 23 64c8 26 38 40 77 33C45 83 36 142 72 143c23 1 35-30 38-49m4-6c41-87 104-80 85-24-8 26-38 40-77 33 55-14 64 45 28 46-23 1-35-30-38-49" fill="currentColor" opacity=".8"/><path d="m105 91 7 39 6-39m-7 0-8-24m10 24 8-24" stroke="currentColor" stroke-width="2"/><path d="M24 159c60-17 88 22 156-4" stroke="currentColor" stroke-dasharray="3 6" opacity=".6"/></svg>`;
const presets={A:{name:'林予',age:'35',education:'本科',role:'行业咨询顾问',experience:'10年行业经验，交付过多个项目，有3位可以联系的潜在客户。',skills:'行业咨询、项目交付',hours:4,budget:500,constraints:'不辞职，保留周末陪伴家人的时间',preference:'通过实际沟通和案例学习',dream:'拥有更自主的工作，也有时间陪伴家人',goal:'90天内验证一个可收费的副业服务',kind:'business'},B:{name:'小禾',age:'23',education:'大专',role:'新媒体运营助理',experience:'工作1年，掌握视频剪辑，没有现成客户资源。',skills:'视频剪辑',hours:10,budget:200,constraints:'预算有限，暂不辞职',preference:'看示例后直接动手',dream:'让自己的技能产生收入，拥有更多选择',goal:'90天内验证一个可收费的副业服务',kind:'business'}};
Object.assign(presets.A,{city:'广州',major:'环境工程',workYears:'10',skillLevel:'能独立交付',proof:'完成过咨询报告与方案比选',resources:'3位熟悉的潜在客户、电脑、专业软件',timeSlot:'周二、周四晚20:30—21:00',workSchedule:'工作日白天在岗',family:'周末陪伴家人',obstacles:'工作消息打断，容易反复完善方案',pastAttempts:'过去做过方案，但没有验证收费服务',focusMinutes:25,support:'一位愿意提供反馈的同行',longGoal:'三年内形成更自主、可持续的专业服务事业',motivation:'获得更多时间自主权',targetCustomer:'有数据整理与方案比选需求的项目团队',successMetric:'完成1次明确范围的试单，并取得真实反馈'});
Object.assign(presets.B,{city:'杭州',major:'数字媒体',workYears:'1',skillLevel:'完成过练习作品',proof:'做过3条剪辑练习',resources:'电脑、剪辑工具、公开需求平台',timeSlot:'工作日晚21:00—21:30',workSchedule:'周一到周五白天工作',family:'周末保留半天陪伴家人',obstacles:'不敢主动联系客户',pastAttempts:'做过样例，尚未向目标客户展示',focusMinutes:30,support:'同事可以看样例',longGoal:'三年内成为能稳定交付的独立创作者',motivation:'让技能带来更多选择',targetCustomer:'需要短视频内容的本地小店',successMetric:'完成1次明确范围的剪辑试单'});
function stages(p){return Story.buildStory(p).chapters.map(c=>c.name)}

function initialTasks(p,week=1){
 const chapter=0,qs=Story.quests(p,chapter),cap=Math.max(3,Math.floor(Number(p.hours??.5)*60*.7/qs.length));
 return qs.map((q,i)=>{const minutes=Math.min(q.minutes,cap,Number(p.focusMinutes)||45),tiny=minutes<10;return {id:uid(),title:tiny?'先做：'+q.steps[0]:q.title,standard:tiny?'保存第1步的一条真实记录；剩余步骤保留到后续。':q.output,minutes,status:'unknown',actual:0,result:'',reason:'',date:day(),week,chapter,questIndex:i,questSteps:q.steps,questOutput:tiny?'保存第1步的一条真实记录；剩余步骤保留到后续。':q.output,minimum:'只完成第1步并保存记录，不要求一次做完整张任务卡。',why:'结合你的'+(p.skills||'现有基础')+'，每周'+p.hours+'小时的时间预算，先验证“'+(p.successMetric||p.goal)+'”所需的现实条件。'};});
}

function makeUser(p,id){return {id,profile:p,lastConversationAt:p.conversationConfirmedAt||now(),profileEvidence:p.conversationEvidence||{},profileInterpretations:p.conversationInterpretations||[],week:1,tasks:initialTasks(p),versions:[],observations:[],results:[],notes:[],learn:true,chapter:0,contentVersion:3,questChecks:{},storyChoices:{},events:[]}}
function sample(which='A',scene='normal'){const id='demo-'+which+'-'+scene;if(!db.users[id]){let n=makeUser(structuredClone(presets[which]),id);n.demo=true;n.scene=scene;if(scene==='busy')n.tasks.forEach((t,i)=>{if(i<2){t.status='missed';t.reason='时间不足';t.result='临时工作占用了计划时段'}});if(scene==='noresult')n.tasks.forEach(t=>{t.status='done';t.actual=t.minutes;t.result='完成准备，但尚未获得客户反馈'});if(scene==='restart')n.notes.push({date:day(),week:1,text:'演示情境：中断一周，尚未补充这段时间的记录。'});db.users[id]=n}db.active=id;draft=null;page='today';save();render()}
function stats(month=false){let ts=u().tasks.filter(t=>!t.archived&&(month?Math.floor((t.week-1)/4)===Math.floor((u().week-1)/4):t.week===u().week)),known=ts.filter(t=>t.status!=='unknown');return {ts,known,done:ts.filter(t=>t.status==='done').length,partial:ts.filter(t=>t.status==='partial').length,missed:ts.filter(t=>t.status==='missed').length,unknown:ts.filter(t=>t.status==='unknown').length}}
function focusedTask(){const ts=stats().ts;return ts.find(t=>['unknown','started'].includes(t.status))||ts.find(t=>t.status==='partial')||ts.find(t=>t.status==='missed')||null}
function inPeriod(r,month=false){const week=Number(r.week||1);return month?Math.floor((week-1)/4)===Math.floor((u().week-1)/4):week===u().week}
function periodResults(month=false){return u().results.filter(r=>inPeriod(r,month))}
function totalActual(month=false){return u().tasks.filter(t=>inPeriod(t,month)).reduce((a,t)=>a+Number(t.actual||0),0)}
function previewTools(){return `<div class="preview-tools"><span>蝴蝶效应 · 小程序版面预览</span><label>宽度 <select id="preview-width" aria-label="预览宽度">${[375,390,430].map(w=>`<option value="${w}" ${String(w)===previewWidth?'selected':''}>${w} px</option>`).join('')}</select></label></div>`}
function render(){
 if(!u()){renderWelcome();return}
 const n=u(),p=n.profile;
 $('#app').innerHTML=previewTools()+`<div class="layout"><aside class="sidebar"><nav>${NAV.map(([id,,t])=>`<button aria-label="${id==='route'?'人生剧本':id==='profile'?'角色':t}" class="nav ${page===id?'active':''}" data-action="nav" data-value="${id}">${icon(id)}<span>${id==='route'?'人生剧本':id==='profile'?'角色':' '+t}</span></button>`).join('')}</nav></aside><main class="main"><header class="top"><div class="wordmark"><span class="brand-symbol">⋈</span><div><b>蝴蝶效应</b><small>让每一小步，长成向往</small></div></div><button class="avatar" data-action="nav" data-value="profile" aria-label="我的档案">${esc(p.name.slice(0,1))}</button></header>${({today,route,plan,review,profile,projection:()=>projectionUI.page()}[page])()}<footer class="bottom"><span>${n.profile.aiStory?'定制草案 · 已由你确认':'示例路线 · 尚未定制'}</span><span>记录本地保存</span><button class="link" data-action="ai-plan">展开故事 / 调整路线</button><button class="link" data-action="ai-status">服务状态</button><button class="link" data-action="references">产品参考与演示说明</button></footer></main></div>`;
}

function icon(name){const paths={today:'M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2 2m8.8 8.8 2 2M5.6 18.4l2-2m8.8-8.8 2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',route:'M5 19V5l7-2 7 2v14l-7-2-7 2m7-16v14',projection:'M3 20h18M5 17l4-6 4 3 6-9~M19 5v4h-4',plan:'M5 5h14v15H5zm3-3v6m8-6v6M5 10h14',review:'M4 19h16M7 15v-4m5 4V6m5 9V9',profile:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M5 21v-2a7 7 0 0 1 14 0v2',clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2',flag:'M5 21V3m0 1c6-4 9 4 15 0v9c-6 4-9-4-15 0',leaf:'M19 4C8 2 2 8 6 16c8 4 14-2 13-12M5 20l9-10',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7',arrow:'M5 12h14m-5-5 5 5-5 5',tool:'m14 4 6 6-10 10-6-6L14 4M5 4l15 16'};return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(paths[name]||paths.spark).split('~').map(d=>`<path d="${d}"/>`).join('')}</svg>`}
function activityXP(n){return n.tasks.reduce((xp,t)=>xp+(t.status==='done'?20:t.status==='partial'?5:0),0)}
function showQuest(id){
 const t=u().tasks.find(t=>t.id===id);if(!t)return;
 const d=Story.details(u().profile,t),checks=u().questChecks?.[id]||[];
 modal('任务操作指引',`<span class="tag peach">第${t.chapter+1}幕 · ${t.minutes}分钟</span><h3 class="quest-detail-title">${esc(t.title)}</h3><div class="quest-context"><p><b>何时：</b>${esc(d.when)}</p><p><b>在哪：</b>${esc(d.where)}</p><p><b>用什么：</b>${esc(d.tool)}</p></div><div class="sectionhead"><h3>照着这几步做</h3><small>勾选只记步骤，完成状态另行确认</small></div><div class="quest-steps">${d.steps.map((step,i)=>`<label class="check-step"><input type="checkbox" data-quest="${id}" data-step="${i}" ${checks[i]?'checked':''}><span><b>0${i+1} · ${step.minutes} 分钟</b><span>${esc(step.text)}</span></span></label>`).join('')}</div><div class="quest-output"><small>完成标准 / 交付物</small><p>${esc(d.output)}</p></div><details open><summary>可直接改写的示例 / 话术</summary><div class="copy-example">${esc(d.example)}</div><button class="btn light tiny" data-action="copyquest" data-value="${id}">复制示例</button></details><div class="minibox"><b>状态不好时的最低版本</b><br>${esc(d.minimum)}<br>保存反馈时记为部分完成，剩余工作不会被伪装成已完成。</div>`,`<button class="btn outline" data-action="minimum" data-value="${id}">只做最低版本</button><button class="btn" data-action="feedback" data-value="${id}">记录实际进展</button>`);
}
function heading(en,title,desc,button=''){return `<div class="heading"><div><div class="eyebrow">${en}</div><h1>${title}</h1><small>${desc}</small></div>${button}</div>`}
function today(){
 const n=u(),p=n.profile,s=stats(),task=focusedTask(),world=Story.buildStory(p,n),chapter=world.chapters[n.chapter],xp=activityXP(n),level=Math.floor(xp/100)+1;
 return `<div class="greeting"><div><span class="eyebrow">YOUR LIFE, YOUR NEXT CHAPTER</span><h1>${esc(p.name)}，今天也有新可能。</h1></div><button class="round-btn" data-action="scenes" aria-label="切换示例">${icon('spark')}</button></div><section class="world-card"><div class="world-top"><span class="tag">第 ${n.chapter+1} 幕 · ${esc(chapter.scene)}</span><span class="xp-chip">✦ Lv.${level} · ${xp} 行动经验</span></div><img src="assets/life-world-v3.png" class="world-art" alt="连接起点小屋、创作工坊、交流街角和远方花园的生活岛屿"><div class="world-caption"><small>我正在走向</small><h2>${esc(p.dream)}</h2><button class="world-link" data-action="nav" data-value="route">打开我的人生剧本 ${icon('arrow')}</button></div></section><div class="resource-strip"><span>${icon('clock')}本周 ${p.hours===undefined?'时间待补充':esc(p.hours)+' 小时'}</span><span>${icon('flag')}第 ${n.week} 周</span><span>${icon('leaf')}${s.done}/${s.ts.length} 任务</span></div><section class="daily-section"><div class="sectionhead"><div><span class="eyebrow">TODAY'S MAIN QUEST</span><h2>先让这一小步发生</h2></div><span class="tag peach">主线任务</span></div>${task?taskCard(task):'<div class="card empty">这一轮行动已完成。<br>记录真实成果，让下一幕有据可依。<button class="btn" data-action="outcome">记录成果</button></div>'}</section><section class="insight-card"><div class="insight-icon">${icon('spark')}</div><div><b>这条路，为什么适合你？</b><p>${esc(task?.why||world.baseline)}</p><button class="link" data-action="nav" data-value="profile">查看我的角色档案 →</button></div></section>${n.scene==='restart'?'<div class="minibox">欢迎回来，不必补齐欠账。<button class="link" data-action="restart">从5分钟重新开始 →</button></div>':''}<div class="sectionhead" style="margin-top:22px"><h2>已经留下的足迹</h2><button class="link" data-action="nav" data-value="review">去复盘 →</button></div><div class="milestone-row"><div><b>${s.done}</b><small>本周完整行动</small></div><div><b>${periodResults().length}</b><small>本周真实成果</small></div><div><b>${n.versions.length}</b><small>路线调整记录</small></div></div><p class="microcopy">行动经验只记录使用足迹，不代表能力评分或成功概率。</p>`;
}

function taskCard(t){
 if(!t)return '<p>当前没有任务。</p>';
 const d=Story.details(u().profile,t),checks=u().questChecks?.[t.id]||[],doneChecks=checks.filter(Boolean).length;
 return `<article class="quest-card ${t.status==='done'?'done':''}"><div class="tasktop"><span class="quest-chapter">第 ${t.chapter+1} 幕 · 任务 ${Number(t.questIndex||0)+1}</span><span class="status">${statusNames[t.status]}</span></div><h3>${esc(t.title)}</h3><div class="quest-meta"><span>${icon('clock')}${t.minutes}分钟</span>${t.horizon?'<span>'+esc(t.horizon)+'</span>':''}<span>${icon('tool')}${esc(d.tool)}</span></div><div class="quest-output"><small>这次要留下什么</small><p>${esc(t.standard)}</p></div><button class="step-preview" data-action="quest" data-value="${t.id}"><span>${doneChecks}/${d.steps.length} 个步骤 · 点击查看操作指引</span>${icon('arrow')}</button><div class="row quest-actions"><button class="btn light" data-action="quest" data-value="${t.id}">查看具体步骤</button><button class="btn" data-action="feedback" data-value="${t.id}">${t.status==='unknown'?'记录进展':'更新反馈'} ${icon('arrow')}</button></div></article>`;
}

function route(){
 const n=u(),p=n.profile,world=Story.buildStory(p,n),c=world.chapters[Math.min(3,selectedStory)];
 return `<div class="page-title"><span class="eyebrow">A LIFE IN THE MAKING</span><h1>你的人生，正在展开。</h1><p>故事可以改写，每次转折都有现实依据。</p></div><section class="story-prologue"><span class="tag lilac">我的人生主线</span><h2>${esc(world.title)}</h2><p>${esc(world.baseline)}</p><div class="goal-link"><small>这一季 · 90天成果</small><b>${esc(p.goal)}</b></div></section><section class="story-map"><img src="assets/life-world-v3.png" alt="原创生活模拟场景" loading="lazy"><div class="map-nodes">${world.chapters.map((ch,i)=>`<button class="map-node ${i===n.chapter?'current':''} ${i===selectedStory?'selected':''}" data-action="storychapter" data-value="${i}" aria-label="查看第${i+1}幕 ${esc(ch.name)}"><span>${i<n.chapter?'✓':i+1}</span><small>${esc(ch.scene)}</small></button>`).join('')}</div></section><div class="chapter-tabs">${world.chapters.map((ch,i)=>`<button data-action="storychapter" data-value="${i}" class="${i===selectedStory?'active':''}">第${i+1}幕${i===n.chapter?' · 现在':''}</button>`).join('')}</div><article class="story-panel"><div class="row between"><span class="eyebrow">CHAPTER 0${selectedStory+1}</span><span class="tag">${selectedStory===n.chapter?'正在经历':selectedStory<n.chapter?'已确认成果':'可能的未来'}</span></div><h2>${esc(c.name)}</h2><p class="narrative">${esc(c.narrative)}</p><div class="scene-period">${esc(c.period)} · 节奏随现实调整</div><h3>这一幕，会发生什么？</h3>${c.quests.map((q,i)=>`<button class="event-row" data-action="storyevent" data-value="${selectedStory}|${i}"><span class="event-no">${i+1}</span><span><b>${esc(q.title)}</b><small>${esc(q.output)}</small></span>${icon('arrow')}</button>`).join('')}<div class="stage-gate"><span>${icon('flag')}</span><div><b>进入下一幕的条件</b><p>${esc(c.gate)}</p></div></div><h3>故事可能出现的分支</h3><div class="branch-list">${c.branches.map((b,i)=>`<button data-action="storybranch" data-value="${selectedStory}|${i}" class="branch ${n.storyChoices?.[selectedStory]===i?'chosen':''}"><span>${['↗','↔','↘'][i]}</span><div><b>${b.label}</b><small>${b.text}</small></div></button>`).join('')}</div>${selectedStory===n.chapter?'<div class="row"><button class="btn" data-action="chaptercheck">确认阶段成果</button><button class="btn light" data-action="adjust">根据现实改写</button></div>':'<p class="microcopy">这是条件式预览，不会自动将未来任务加入今日清单。</p>'}</article><section class="far-future"><span class="eyebrow">BEYOND THIS SEASON</span><h3>更远处的生活</h3><p>${esc(p.longGoal||'先用90天的证据，逐步澄清一年与三年的方向。')}</p><div class="future-beats"><div><b>半年 · 把一次成果变成可重复的方法</b><small>如果这一季取得支持性证据，下一季优先复现；若证据不足，返回验证。</small></div><div><b>一年 · 用真实积累重新选择</b><small>回看作品、反馈与投入，决定扩大、保持小规模，还是更换路线。</small></div><div><b>三年 · 向理想生活靠近</b><small>由你确认生活是否更接近最初的向往，不以任务数量替代生活质量。</small></div></div><small>远景是条件式方向，不是既定的结局。</small></section><button class="btn outline full" data-action="versions">查看改写历史（${n.versions.length}）</button>`;
}

function plan(){let period=planPeriod,n=u(),s=stats(),budget=Number(n.profile.hours??.5)*60*.7,total=s.ts.reduce((a,t)=>a+t.minutes,0);return heading('MAKE SPACE FOR WHAT MATTERS','为重要的事，留一点时间。','近处安排动作，远处保留方向。')+`<div class="tabs">${[['day','日'],['week','周'],['month','月']].map(([k,t])=>`<button class="${period===k?'active':''}" data-action="period" data-value="${k}">${t}计划</button>`).join('')}</div><div class="card"><div class="sectionhead"><h2>${period==='month'?'本月的阶段成果':period==='day'?'今日行动':'第 '+n.week+' 周 · 关键行动'}</h2><span class="tag">${n.profile.hours===undefined?'每周时间待确认':'每周 '+n.profile.hours+' 小时'}</span></div><div class="budget">已安排 ${total} 分钟 / 排程预算 ${Math.floor(budget)} 分钟 · 预留30%缓冲</div>${total>budget?'<p class="error">当前任务超过预算，请在路线评估中降低负荷。</p>':''}${period==='month'?`<h3>${esc(stages(n.profile)[n.chapter])}</h3><p>本月需取得可验证的阶段成果，而非仅完成学习清单。</p><p class="muted">验收：${esc(s.ts.map(t=>t.standard).join('；'))}</p><button class="btn light" data-action="outcome">记录实际成果</button>`:(period==='day'?(focusedTask()?taskCard(focusedTask()):'<div class="empty">本周行动已完成，先记录成果并复盘。</div>'):s.ts.map(taskCard).join(''))}</div><div class="minibox">周期模拟仅用于Demo，不改变真实日期或替你确认章节完成。</div><div class="row"><button class="btn outline" data-action="nextweek">演示下一周</button><button class="btn outline" data-action="nextmonth">演示下一月</button>${n.lastAdvance?'<button class="link" data-action="undoCycle">撤销周期模拟</button>':''}</div>`}
function review(){let period=reviewPeriod,n=u(),s=stats(period==='month'),actual=totalActual(period==='month'),outcomes=periodResults(period==='month'),notes=n.notes.filter(r=>inPeriod(r,period==='month'));return heading('REFLECT, THEN RECONNECT','回头看看，是为了更好地向前。','有记录的地方看证据，没有记录的地方保留未知。')+`<div class="tabs">${[['week','周'],['month','月']].map(([k,t])=>`<button class="${period===k?'active':''}" data-action="period" data-value="${k}">${t}复盘</button>`).join('')}</div><div class="grid" style="margin-top:0"><section class="card"><h2>${period==='month'?'月度':'本周'}执行与结果</h2>${(period==='month'?['按当前演示月的4周汇总；不足一月时不推断月度趋势。']:[]).map(t=>`<small>${t}</small>`).join('')}<div class="stats"><div><div class="number">${s.done}</div><small>完整完成</small></div><div><div class="number">${s.partial}</div><small>部分完成</small></div><div><div class="number">${s.unknown}</div><small>未反馈</small></div></div><div class="listrow"><span>未完成</span><b>${s.missed} 项</b></div><div class="listrow"><span>反馈覆盖</span><b>${s.known.length} / ${s.ts.length} 项</b></div><div class="listrow"><span>当前计划 / 实际投入</span><b>${s.ts.reduce((a,t)=>a+t.minutes,0)} / ${actual} 分钟</b></div><small>实际投入包含本周期已归档的反馈；撤销计划不会删除执行事实。</small><div class="listrow"><span>完整完成比例（全部计划任务）</span><b>${s.ts.length?Math.round(s.done/s.ts.length*100):0}%</b></div><div class="note">${s.unknown?'目前仍有未反馈记录，不能据此判断是否按原节奏推进。':'执行记录已补充，需要结合实际成果评估路线。'}</div><button class="btn" style="margin-top:18px" data-action="adjust">生成调整建议 →</button></section><section class="card"><div class="sectionhead"><h2>真正发生的改变</h2><button class="link" data-action="outcome">＋ 记录成果</button></div>${outcomes.length?outcomes.map(r=>`<div class="listrow"><div><b>${esc(r.text)}</b><br><small>${esc(r.date)} · 用户记录，尚未经外部核验</small></div></div>`).join(''):'<div class="empty">还没有记录实际成果。<br><small>一条客户反馈、一份作品，<br>都比一排勾选更能说明进展。</small></div>'}<div class="label" style="margin-top:20px">复盘笔记</div>${notes.map(r=>`<p class="muted" style="font-size:12px">${esc(r.text)} <small>· ${esc(r.date)}</small></p>`).join('')}<button class="btn light tiny" data-action="note">补充复盘说明</button></section></div>`}
function profile(){
 const n=u(),p=n.profile,sections=[['身份与背景',[['年龄',p.age],['城市',p.city],['学历 / 专业',[p.education,p.major].filter(Boolean).join(' / ')],['岗位 / 工作年限',[p.role,p.workYears?p.workYears+'年':''].filter(Boolean).join(' / ')]]],['经历与能力',[['重要经历',p.experience],['技能与熟练程度',[p.skills,p.skillLevel].filter(Boolean).join(' / ')],['成果证据',p.proof],['可用资源',p.resources]]],['现实生活与边界',[['工作安排',p.workSchedule],['家庭责任',p.family],['每周时间 / 常用时段',p.hours+'小时 / '+(p.timeSlot||'未补充')],['单次专注',p.focusMinutes?p.focusMinutes+'分钟':'未补充'],['预算',p.budget!==undefined&&p.budget!==''?p.budget+'元':''],['不能牺牲的条件',p.constraints]]],['行动方式',[['主要障碍',p.obstacles],['过去尝试',p.pastAttempts],['有效方法',p.preference],['可获得的支持',p.support]]],['向往与目标',[['理想生活',p.dream],['一年 / 三年方向',p.longGoal],['90天成果',p.goal],['目标对象 / 场景',p.targetCustomer],['验收证据',p.successMetric],['为什么重要',p.motivation]]]];
 return `<div class="page-title"><span class="eyebrow">YOUR CHARACTER DOSSIER</span><h1>先懂你，再陪你走。</h1><p>有经历的人，不该从同一个起点出发。</p></div><section class="character-card"><div class="portrait">${icon('profile')}</div><h2>${esc(p.name)}</h2><p>${esc(p.role)}${p.city?' · '+esc(p.city):''}</p><div class="row"><span class="tag lilac">Lv.${Math.floor(activityXP(n)/100)+1} 旅程记录</span><span class="tag">档案覆盖 ${Story.coverage(p)}%</span></div><button class="btn" data-action="quick-edit">聊聊近况，补充资料</button><button class="link" data-action="role-card">查看和编辑我的角色卡</button><button class="link" data-action="edit">完整档案（选填）</button><small>覆盖率只表示填写情况，不是对你的评分。</small></section>${sections.map(([title,items])=>`<section class="card profile-section"><h2>${title}</h2>${items.map(([k,v])=>`<div class="listrow"><small>${k}</small><span>${esc(v||'尚未补充，平台不会自行猜测')}</span></div>`).join('')}</section>`).join('')}<section class="card profile-section"><h2>平台逐渐了解到的你</h2><label class="learning-toggle"><input type="checkbox" id="learn" ${n.learn?'checked':''}>根据使用记录优化计划</label><p class="microcopy">事实、偏好和推测分开记录；你可以纠正它。</p>${n.observations.length?n.observations.map((o,i)=>`<div class="observation"><span class="tag">${esc(o.state)}</span><p>${esc(o.text)}</p><small>依据：${esc(o.source)} · ${esc(o.date)}</small><div class="row">${['准确','不准确','仅暂时如此'].map(t=>`<button class="btn light tiny" data-action="obs" data-value="${i}|${t}">${t}</button>`).join('')}<button class="link" data-action="deleteobs" data-value="${i}">删除</button></div></div>`).join(''):'<div class="empty">还在认识你的过程中。<br>执行反馈会逐渐形成可纠正的观察。</div>'}</section><div class="profile-actions"><button class="btn outline" data-action="journeys">切换我的旅程</button><button class="btn outline" data-action="export">导出本地记录</button><button class="btn outline" data-action="export-server">导出我的数据</button><button class="btn light" data-action="new">建立新旅程</button><button class="btn light" data-action="scenes">体验示例</button><button class="btn light" data-action="delete-account">注销账号 / 删除全部数据</button></div><p class="microcopy">本期不收费。协议与隐私政策链接见登录页（当前为草稿，非正式生效）。</p>`;
}

function renderWelcome(){
 const logged=Boolean(authSession?.token);
 $('#app').innerHTML=previewTools()+`<main class="welcome voice-welcome"><div class="welcome-brand"><span class="brand-symbol">⋈</span><b>蝴蝶效应</b></div><div class="chat-intro"><span class="tag">先听你说</span><div class="chat-avatar">⋈</div><h1>最近，最想改变的<br>一件事是什么？</h1><p>想做什么、擅长什么、遇到了什么难处，<br>像和朋友说话一样，慢慢告诉我。</p><p class="microcopy">本期不收费。正式协议生效前，页面链接的用户协议与隐私政策均为<strong>草稿，非正式生效</strong>。</p></div>${logged?`<button class="voice-start" data-action="new"><span>◉</span>开始语音聊天</button><button class="link" data-action="new-text">现在不方便说话，用文字聊</button><p class="microcopy">已登录 ${esc(authSession.phone||'')}</p>`:`<button class="voice-start" data-action="login"><span>◇</span>手机号登录后开始</button><button class="link" data-action="login">登录 / 注册</button>`}<button class="link" data-action="sample" data-value="A">先看看一段示例人生</button></main>`;
}
function showLogin(){
 const body=`<p class="microcopy">本期不收费。登录即表示你将使用手机号验证码创建或进入账号（首发方式）。</p>
<label class="consent-row"><input type="checkbox" id="agree-terms">我已阅读并同意 <a href="/legal/terms.html" target="_blank" rel="noopener">《用户协议》</a>（草稿，非正式生效）</label>
<label class="consent-row"><input type="checkbox" id="agree-privacy">我已阅读并同意 <a href="/legal/privacy.html" target="_blank" rel="noopener">《隐私政策》</a>（草稿，非正式生效）</label>
<label for="login-phone">手机号</label><input id="login-phone" type="tel" inputmode="numeric" maxlength="11" placeholder="11 位手机号" autocomplete="tel">
<label for="login-code">验证码</label><div class="row"><input id="login-code" type="text" inputmode="numeric" maxlength="6" placeholder="6 位验证码" style="flex:1"><button class="btn light" type="button" data-action="send-code" id="send-code-btn">获取验证码</button></div>
<p class="microcopy" id="login-hint">开发期 mock：验证码固定为 000000（SMS_PROVIDER=mock）。</p>
<div id="login-error" class="error" role="alert"></div>`;
 modal('手机号登录',body,`<button class="btn outline" data-action="close">取消</button><button class="btn" data-action="verify-code">登录</button>`);
}
function showSensitiveConsent(next){
 const body=`<p>为生成更贴合你的角色卡与故事，我们可能处理以下<strong>敏感个人信息</strong>：年龄、学历，以及你主动开启的语音建档内容（转写文本）。</p>
<label class="consent-row"><input type="checkbox" id="agree-sensitive">我同意处理上述敏感信息用于建档与任务规划（可随时在「我的」撤回并注销）</label>
<p class="microcopy">默认不勾选。不同意仍可先体验示例路线；正式建档需要同意。</p><div id="sensitive-error" class="error" role="alert"></div>`;
 modal('敏感信息处理同意',body,`<button class="btn outline" data-action="close">先看看示例</button><button class="btn" data-action="confirm-sensitive" id="confirm-sensitive-btn" disabled aria-disabled="true">同意并继续</button>`);
 window.__afterSensitive=next;
 const box=$('#agree-sensitive'),btn=$('#confirm-sensitive-btn'),err=$('#sensitive-error');
 // sync only gates the button. Do NOT clear #sensitive-error here — busyAI finally
 // calls __syncSensitive after API fail and would wipe the visible failure message (P0-23 c4).
 const sync=()=>{const on=!!box?.checked;if(btn){btn.disabled=!on;btn.setAttribute('aria-disabled',on?'false':'true');btn.classList.toggle('is-gated',!on)}};
 const onBoxChange=()=>{const wasOff=err&&err.textContent;sync();if(box?.checked&&err)err.textContent=''};
 window.__syncSensitive=sync;
 box?.addEventListener('change',onBoxChange);box?.addEventListener('input',onBoxChange);box?.addEventListener('click',sync);sync();
}


function modal(title,body,foot='',wide=false){
 document.body.classList.remove('conversation-home');
 $('#modal').innerHTML=`<div class="modalback"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sectionhead"><h2>${title}</h2><button class="close" data-action="close" aria-label="关闭">×</button></div><div class="modalbody">${body}</div><footer>${foot}</footer></section></div>`;
 $('#app').inert=true;document.body.classList.add('dialog-open');$('#modal button')?.focus();syncViewport();
}
function close(){if(chatOnboarding&&!chatOnboarding.beforeClose())return; $('#modal').innerHTML='';$('#app').inert=false;document.body.classList.remove('dialog-open'); }
function field(k,t,type='text',required=false){
 const val=formDraft[k]??'',placeholders={name:'你希望平台怎样称呼你',city:'例如：广州',role:'例如：项目经理 / 待业 / 学生',major:'例如：环境工程',experience:'写1—3件对你影响最大的事：做过什么、遇到什么、结果如何',skills:'例如：方案编制、视频剪辑、英语写作',proof:'作品、项目、证书或曾经解决的问题',resources:'例如：电脑、专业软件、可触达的同行',timeSlot:'例如：周二周四晚20:30—21:00',family:'例如：接送孩子、照顾家人；可不填',constraints:'哪些事不能为了目标而牺牲？',obstacles:'例如：被消息打断、不知从哪里开始、害怕被拒绝',pastAttempts:'之前尝试过什么？卡在哪里？',preference:'哪些方法曾帮你真正行动起来？',dream:'描述你希望过的一天，而不仅是一串数字',longGoal:'一年或三年后，希望生活发生什么变化？',goal:'例如：90天内完成一份可演示作品集',successMetric:'用什么产出或反馈证明目标取得进展？',targetCustomer:'例如：需要短视频内容的本地小店',motivation:'为什么这个目标对你重要？'};
 const attrs=`id="f-${k}" name="${k}" ${required?'required':''} placeholder="${esc(placeholders[k]||'可暂时跳过，之后补充')}"`;
 return `<div class="form-field"><label for="f-${k}">${t}${required?'<em>必填</em>':'<span>选填</span>'}</label>${type==='textarea'?`<textarea ${attrs} maxlength="2000">${esc(val)}</textarea>`:`<input ${attrs} type="${type}" value="${esc(val)}" ${type==='text'?'maxlength="200"':''} ${k==='hours'?'min="0.5" max="80" step="0.5"':k==='budget'?'min="0"':k==='age'?'min="1" max="120"':k==='workYears'?'min="0" max="80"':k==='focusMinutes'?'min="5" max="180"':''}>`}</div>`;
}

function wizard(edit=false){
 const titles=['认识现在的你','你的经历与底牌','现实生活与时间','怎样更容易行动','你想走向的生活','确认属于你的起点'],sub=['身份是背景，不是你的能力上限。','具体经历，比一个标签更能说明你。','计划要适应生活，而不是挤满生活。','了解卡点，才能找到可持续的方法。','远景给方向，近期成果给行动依据。','这些信息将实际影响任务难度、路径和节奏。'];
 let body='';
 if(wizardStep===0)body=field('name','如何称呼你','text',true)+`<div class="two">${field('age','年龄','number')}${field('city','常住城市')}</div>`+field('education','最高学历')+field('major','专业 / 学习领域')+field('role','工作岗位 / 当前身份','text',true)+field('workYears','相关工作年限','number');
 if(wizardStep===1)body=field('experience','重要经历与转折','textarea')+field('skills','已有技能与优势','textarea')+`<div class="form-field"><label for="f-skillLevel">当前熟练程度<span>选填</span></label><select id="f-skillLevel" name="skillLevel">${['尚未填写','刚开始接触','完成过练习作品','能独立完成小项目','能稳定对外提供服务'].map(t=>`<option ${formDraft.skillLevel===t?'selected':''}>${t}</option>`).join('')}</select></div>`+field('proof','可以证明能力的成果','textarea')+field('resources','可用设备、人脉与其他资源','textarea');
 if(wizardStep===2)body=field('workSchedule','工作或学习的固定安排')+field('family','需要照顾的家庭责任','textarea')+field('hours','每周真正可投入的小时','number',true)+field('timeSlot','具体可用时段')+field('workspace','通常在哪里完成任务？')+field('focusMinutes','单次舒适专注时长（分钟）','number')+field('budget','当前可投入预算（元）','number',true)+field('constraints','不能牺牲的条件','textarea');
 if(wizardStep===3)body=field('obstacles','最常遇到的行动障碍','textarea')+field('pastAttempts','过去尝试与中断原因','textarea')+field('preference','已经验证有效的行动方式','textarea')+field('support','可以获得谁的支持')+'<div class="minibox">不需要给自己贴上“自律”或“懒惰”的标签。平台会结合真实反馈逐渐修正认识。</div>';
 if(wizardStep===4)body=field('dream','你向往什么样的生活','textarea',true)+field('longGoal','一年 / 三年的方向','textarea')+`<div class="form-field"><label for="f-kind">这一季的目标类型<em>必填</em></label><select id="f-kind" name="kind">${[['business','验证一个可收费的副业服务'],['portfolio','完成一份技能作品集'],['reading','阅读与四篇主题输出'],['custom','其他目标 · 通用验证模板']].map(([v,t])=>`<option value="${v}" ${formDraft.kind===v?'selected':''}>${t}</option>`).join('')}</select></div>`+field('goal','90天想取得的具体成果','textarea',true)+field('targetCustomer','目标受众 / 实际使用场景')+field('successMetric','成果如何验收？','textarea')+field('motivation','为什么这个目标对你重要？','textarea');
 if(wizardStep===5){const story=Story.buildStory(formDraft);body=`<div class="summary-character"><div class="portrait">${icon('profile')}</div><h3>${esc(formDraft.name)}的角色卡</h3><p>${esc(formDraft.role)} · ${esc(formDraft.city||'城市待补充')}</p></div><div class="summary-block"><small>向往的生活</small><p>${esc(formDraft.dream)}</p><small>这一季的成果</small><p>${esc(formDraft.goal)}</p><small>真实的边界</small><p>${esc(story.baseline)}</p><small>平台将优先利用</small><p>${esc(formDraft.skills||'先确认能力起点，不假设已有技能')}；${esc(formDraft.resources||'先梳理可用资源')}</p></div><div class="minibox">将生成4幕条件式故事线与具体任务。未填写的信息保持未知。这里先展示示例路线，可稍后根据你的真实资料定制。</div>`;}
 modal(edit?'完善角色档案':'创建你的人生角色',`<div class="onboarding-progress"><div class="onboarding-bar"><i style="width:${(wizardStep+1)/6*100}%"></i></div><span>${wizardStep+1} / 6</span></div><h3 class="onboarding-title">${titles[wizardStep]}</h3><p class="onboarding-sub">${sub[wizardStep]}</p><form id="wizard">${body}</form>`,` ${wizardStep?'<button class="btn outline" data-action="wizardback">上一步</button>':''}<button class="btn" data-action="wizardnext" data-value="${edit?'edit':'new'}">${wizardStep===5?(edit?'生成更新草案':'确认角色，生成故事'):'保存并继续 →'}</button>`);
 $('.modal').classList.add('onboarding');syncViewport();
}

function feedback(id,min=false){let t=u().tasks.find(t=>t.id===id);if(!t)return toast('任务不存在，请刷新重试');if(min&&t.status==='done')return toast('任务已完成，无需改成最低版本');modal(min?'先做一点，也值得记录':'记录真实进展',`<h3>${esc(t.title)}</h3><div class="quest-output"><small>完成标准</small><p>${esc(t.standard)}</p></div><form id="feedback"><input type="hidden" name="id" value="${t.id}"><label for="feedback-status">当前状态</label><select id="feedback-status" name="status">${Object.entries(statusNames).map(([k,v])=>`<option value="${k}" ${(min?k==='partial':k===t.status)?'selected':''}>${v}</option>`).join('')}</select><label for="feedback-actual">实际用时（分钟）</label><input id="feedback-actual" name="actual" type="number" min="0" max="10000" value="${min?Math.max(5,t.actual):t.actual}"><label for="feedback-result">实际结果 / 情况说明</label><textarea id="feedback-result" name="result">${esc(t.result)}</textarea><label for="feedback-reason">主要障碍</label><select id="feedback-reason" name="reason">${['无','不知道怎么开始','能力不足','时间不足','害怕被拒绝或做错','等待他人','做了但没有效果','目标意愿改变'].map(r=>`<option ${t.reason===r?'selected':''}>${r}</option>`).join('')}</select></form><div class="minibox">${min?'最低版本记为部分完成，剩余工作会保留。':'未反馈表示未知；完成状态由你确认。'}</div>`,`<button class="btn" data-action="savefeedback">保存反馈</button>`)}
function observe(t){let n=u();if(!n.learn||n.ignoredReasons?.includes(t.reason)||!t.reason||t.reason==='无'||t.status==='unknown')return;let text=`近期“${t.reason}”可能影响任务执行。`;let existing=n.observations.find(o=>o.text===text);if(existing){existing.source='任务「'+t.title+'」的用户反馈';existing.date=day();return;}n.observations.push({text,source:'任务「'+t.title+'」的用户反馈',date:day(),state:'待确认',taskId:t.id})}
function adjustment(profileChange=false,proposed=null){let n=u(),s=stats(),profileChapter=profileChange&&proposed&&(proposed.goal!==n.profile.goal||proposed.kind!==n.profile.kind)?0:n.chapter;let denied=n.observations.filter(o=>o.state==='不准确').map(o=>o.text),reasons=s.ts.map(t=>t.reason).filter(r=>r&&!n.ignoredReasons?.includes(r)&&!denied.some(text=>text.includes(r))),confirmed=n.learn?n.observations.find(o=>o.state==='准确'):null,reason=reasons.find(r=>r&&r!=='无')||(confirmed?['时间不足','能力不足','不知道怎么开始','害怕被拒绝或做错','等待他人','做了但没有效果','目标意愿改变'].find(r=>confirmed.text.includes(r)):null)||'信息不足';if(profileChange)reason='个人条件变化';let map={'时间不足':['减少近期任务负荷，将任务拆成更短的动作。','关键里程碑可能需要延后，先保持原90天目标供你评估。'],'能力不足':['先增加一次必要的基础练习，再继续依赖该能力的任务。','阶段成果暂不提前确认。'],'不知道怎么开始':['把下一步缩成一个5分钟动作，并写明第一笔产出。','减少开始成本，保留原成果标准。'],'害怕被拒绝或做错':['先向一位熟悉的人做低风险沟通，收集反馈。','先验证沟通方式，不承诺获得订单。'],'等待他人':['标记外部依赖，先整理可独立完成的材料。','等待事项保留，不自动判断失败。'],'做了但没有效果':['检查关键假设，优先收集一条外部反馈。','暂不增加同类任务数量。'],'目标意愿改变':['暂停加量，先写下继续或调整目标的理由。','目标与期限保持原值，等待你重新确认。'],'信息不足':['先补充最近一次行动的结果，再评估是否需要改变路线。','记录不足，暂不能判断目标是否按期可达。'],'个人条件变化':['根据最新档案重新生成近期任务，历史记录保留。','新方案需要你确认后才生效；更换目标会从新路线第一阶段开始。']};if(s.ts.length&&s.done===s.ts.length&&!periodResults().length&&!profileChange)reason='做了但没有效果';if(n.scene==='restart'&&!profileChange)reason='不知道怎么开始';if(!profileChange&&reason==='信息不足'&&n.storyChoices?.[n.chapter]===2)reason='时间不足';if(!profileChange&&reason==='信息不足'&&n.storyChoices?.[n.chapter]===1)reason='做了但没有效果';let [change,impact]=map[reason]||map['信息不足'];draft={reason,change,impact,tasks:profileChange?(profileChapter?chapterTasks(proposed||n.profile,profileChapter,n.week):initialTasks(proposed||n.profile,n.week)):structuredClone(s.ts.filter(t=>!['done','missed'].includes(t.status))).map(t=>({...t,id:uid(),status:'unknown',actual:0,result:'',reason:''})),at:now(),before:structuredClone(n.tasks),beforeProfile:structuredClone(n.profile),beforeChapter:n.chapter,proposedChapter:profileChange?profileChapter:undefined,proposedProfile:proposed?structuredClone(proposed):null};if(!draft.tasks.length)draft.tasks=initialTasks(n.profile,n.week).slice(0,1);if(!['个人条件变化','信息不足'].includes(reason))draft.tasks=draft.tasks.slice(0,2).map((t,i)=>({...t,id:uid(),minutes:Math.min(15,t.minutes),title:i===0?({'时间不足':t.minimum+'（原任务：'+t.title+'）','不知道怎么开始':'用5分钟写下第一步及一个产出','能力不足':'选一个相关示例，完成一次最小练习','害怕被拒绝或做错':'向一位熟悉的人询问一个具体问题','等待他人':'整理不依赖他人即可完成的材料','做了但没有效果':'收集一条真实反馈，检查原先假设','目标意愿改变':'写下是否仍想推进目标及理由'}[reason]||t.title):t.title,standard:i===0?'保存本次小行动的产出，并记录原任务剩余工作':t.standard,status:'unknown',actual:0,result:'',reason:''}));draft.tasks=concretizeDraft(draft,n.profile);showAdjustment()}
function concretizeDraft(d,p){
 if(['个人条件变化','阶段推进','信息不足'].includes(d.reason))return d.tasks;
 const recipes={
 '能力不足':{title:'照着一个相关示例，做出最小练习',steps:['找到一个与你当前任务直接相关的公开示例，保存来源','只模仿其中一个小片段，不要求完成整个项目','保存练习文件，写下一个仍不会的具体问题'],output:'一个练习文件或截图＋一个具体问题'},
 '不知道怎么开始':{title:'为当前目标写一张三行起步卡',steps:['打开备忘录，在第一行写下当前目标','第二行写一个今天能做的最小动作，包含工具和对象','第三行写完成后会留下什么，再做这个动作'],output:'一张目标、动作、产出三行卡与一次尝试记录'},
 '害怕被拒绝或做错':{title:'向一位熟悉的人发出低压力反馈邀请',steps:['选择一位愿意提供反馈的熟人，只记代号','把问题缩成一件具体的小事，并写明不是推销','发出邀请，记录回复或等待状态'],output:'一条已发送的邀请＋真实回复状态'},
 '等待他人':{title:'先整理一份不依赖对方的准备清单',steps:['列出当前在等待谁提供什么信息，不填写无关隐私','把现有材料集中到一个文件夹或文档','写下缺失项与下一次跟进时间，不替对方编造回复'],output:'一份现有材料、缺失项和跟进时间清单'},
 '做了但没有效果':{title:'用一条真实反馈检查原先假设',steps:['写下你原先期待发生的一个具体结果','找出一条已有的外部反馈，缺失时发出一次具体询问','在文档中分列事实、原假设和下一次要验证的问题'],output:'一张事实—假设—验证问题对照卡'},
 '目标意愿改变':{title:'写下继续、调整或暂停目标的理由',steps:['分别写下这个目标对你有何意义，以及你不愿付出的代价','从继续、调整、暂停中选一个当前倾向','写明理由，保存后在复盘中确认，不立即增加新任务'],output:'一条由你确认的目标意愿及理由'}
 };
 return d.tasks.map((t,i)=>{if(i>0)return {...t,title:'本次只执行这一步：'+(t.questSteps?.[0]||t.title),questSteps:[t.questSteps?.[0]||t.title,'保存一条真实记录','注明剩余工作，留待后续安排'],questOutput:'保存这一小步的记录，其余不标为完成。',standard:'保存这一小步的记录，其余不标为完成。'};
 const recipe=recipes[d.reason]||{title:'只做：'+(t.questSteps?.[0]||t.title),steps:[t.questSteps?.[0]||'打开备忘录，写下当前任务的第一个动作','保存本次的小片段，记录实际用时','把剩余工作写成下一条待办，不假装全部完成'],output:'一条带日期的记录：已完成的具体动作、产出位置与尚未完成的下一步。'};
 return {...t,title:recipe.title,questSteps:recipe.steps,questOutput:recipe.output,standard:recipe.output,why:'你已记录“'+d.reason+'”。先缩小为一项具体行动，再依据真实反馈更新路线。'};});
}
function showAdjustment(){let n=u(),old=stats().ts;modal('路线调整草案',`<span class="tag">${esc(draft.reason)}</span><p style="margin-top:15px">${esc(draft.change)}</p><small>依据：第 ${n.week} 周反馈 ${stats().known.length}/${stats().ts.length} 项；档案可用时间 ${(draft.proposedProfile||n.profile).hours} 小时/周。${n.storyChoices?.[n.chapter]!==undefined?' 当前幕已记录：'+['支持性反馈','效果未达预期','时间或条件变化'][n.storyChoices[n.chapter]]+'。':''}${draft.reason==='做了但没有效果'?'尚未记录关键成果，不能仅凭任务勾选判定进展。':''}</small><div class="two" style="margin-top:20px"><div class="compare"><h3>调整前</h3>${old.map(t=>`<p>${esc(t.title)}<br><small>${t.minutes} 分钟 · ${statusNames[t.status]}</small></p>`).join('')}</div><div class="compare"><h3>调整后 · 待接受</h3>${draft.tasks.map(t=>`<p>${esc(t.title)}<br><small>${t.minutes} 分钟</small></p>`).join('')}</div></div><div class="minibox">${esc(draft.impact)}${draft.evidence?'<br>阶段证据：'+esc(draft.evidence):''}<br>原目标：${esc(n.profile.goal)}${draft.proposedProfile?'<br>拟更新目标：'+esc(draft.proposedProfile.goal):''}<br>不会更改历史任务与复盘。</div>`,`<button class="btn outline" data-action="reject">保留原计划</button><button class="btn light" data-action="tweak">再减轻一点</button><button class="btn" data-action="accept">接受调整</button>`,true)}
function scenes(){modal('换一个视角，体验成长',`<p class="muted">示例档案独立保存，不会覆盖你创建的个人旅程。</p><div class="two">${[['normal','正常推进'],['busy','时间不足'],['noresult','做完了，尚无成果'],['restart','中断一周后回来']].map(([k,t])=>`<button class="btn light" data-action="scene" data-value="${k}">${t}</button>`).join('')}</div><div class="minibox">当前示例均为虚构用户；重置只影响示例数据。</div>`,`<button class="btn outline" data-action="restore">回到我的旅程</button><button class="btn light" data-action="resetdemo">重置示例</button>`)}
function compare(){modal('同一个目标，两条自己的路',`<small>共同目标：90天内验证一个可收费的副业服务。差异依据是经历、技能、资源和时间。</small><div class="two" style="margin-top:20px">${Object.entries(presets).map(([k,p])=>`<div class="compare"><h3>${p.name} · ${p.age}岁</h3><p>${p.education} · ${p.role}</p><p>${p.experience}</p><span class="tag">每周 ${p.hours} 小时</span><h3 style="margin-top:18px">${stages(p)[0]}</h3>${initialTasks(p).map(t=>`<p>→ ${t.title} <small>${t.minutes}分钟</small></p>`).join('')}<button class="btn tiny" data-action="sample" data-value="${k}">体验这条路线</button></div>`).join('')}</div>`, '',true)}
function acceptDraft(){
 const n=u();if(!draft)return;
 if(draft.reason==='信息不足'){close();draft=null;toast('记录不足，原计划保持不变');return}
 const completed=new Set(stats().ts.filter(t=>t.status==='done').map(t=>t.title));
 const tasks=draft.tasks.filter(t=>!completed.has(t.title));
 n.versions.push({id:uid(),at:now(),reason:draft.reason,before:draft.before,beforeProfile:draft.beforeProfile,beforeChapter:draft.beforeChapter??n.chapter,after:structuredClone(tasks),week:n.week});
 n.tasks=[...n.tasks.map(t=>t.week===n.week&&!t.archived&&t.status!=='done'?{...t,archived:true}:t),...tasks];
 if(draft.proposedChapter!==undefined){n.chapter=draft.proposedChapter;if(draft.evidence)n.notes.push({text:'已确认上一阶段成果：'+draft.evidence,date:day(),week:n.week})}
 if(draft.proposedProfile){n.profile=structuredClone(draft.proposedProfile);n.profileUpdated=now()}
 selectedStory=n.chapter;draft=null;save();close();render();toast('已应用调整，历史反馈保留');
}
function undoDraft(){
 const n=u(),r=n.versions.at(-1);if(!r)return;
 if(r.week!==n.week)return toast('已进入新周期，旧周期调整仅供回看');
 const current=new Map(n.tasks.map(t=>[t.id,t]));
 n.tasks=[...r.before.map(t=>{const latest=current.get(t.id);return latest?.updated&&latest.updated>r.at?{...t,status:latest.status,actual:latest.actual,result:latest.result,reason:latest.reason,updated:latest.updated}:t}),...n.tasks.filter(t=>!r.before.some(old=>old.id===t.id)).map(t=>({...t,archived:true}))];
 if(r.beforeProfile)n.profile=structuredClone(r.beforeProfile);if(r.beforeChapter!==undefined)n.chapter=r.beforeChapter;
 n.versions.pop();selectedStory=n.chapter;save();close();render();toast('已恢复原计划，执行反馈保留');
}
function advanceCycle(count){
 const n=u(),carry=stats().ts.filter(t=>t.status!=='done');n.week+=count;
 if(carry.length)n.tasks.push(...carry.map(t=>({...t,id:uid(),originId:t.originId||t.id,week:n.week,status:'unknown',actual:0,result:'',reason:'',updated:null,archived:false})));
 else n.tasks.push({...initialTasks(n.profile,n.week)[0],chapter:n.chapter,title:'核对阶段成果，决定是否进入下一章节',standard:'写明成果证据及继续或调整的理由'});
 save();close();render();toast('已进入演示第 '+n.week+' 周');
}
function showJourneys(){
 const own=Object.values(db.users).filter(n=>!n.demo);
 modal('我的旅程',own.length?own.map(n=>`<div class="journey-item"><b>${esc(n.profile.name)} · ${esc(n.profile.goal)}</b><small>第 ${n.week} 周</small><button class="btn light" data-action="journey" data-value="${esc(n.id)}">${db.active===n.id?'当前旅程':'进入旅程'}</button></div>`).join(''):'<p class="muted">还没有个人旅程，可以先建立档案。</p>','<button class="btn" data-action="new">建立新旅程</button>');
}
function chapterTasks(p,chapter,week){
 const qs=Story.quests(p,chapter),cap=Math.max(3,Math.floor(Number(p.hours??.5)*60*.7/qs.length));
 return qs.map((q,i)=>{const minutes=Math.min(q.minutes,cap,Number(p.focusMinutes)||45),tiny=minutes<10;return {id:uid(),chapter,questIndex:i,questSteps:q.steps,questOutput:tiny?'保存第1步的一条记录，其余保留。':q.output,title:tiny?'先做：'+q.steps[0]:q.title,standard:tiny?'保存第1步的一条记录，其余保留。':q.output,minutes,week,date:day(),status:'unknown',actual:0,result:'',reason:'',minimum:'只完成第1步并留下记录。',why:'上一幕已由你确认成果。结合每周'+p.hours+'小时，先完成“'+stages(p)[chapter]+'”所需的最小行动。'};});
}

document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b)return;
 const a=b.dataset.action,v=b.dataset.value,n=u();
 if(a.startsWith('pj-')&&projectionUI.handle(a,v))return;
 if(a==='nav'){page=v;if(v==='route')selectedStory=n.chapter;period=page==='review'?reviewPeriod:planPeriod;render();window.scrollTo(0,0)}
 if(a==='close')close();
 if(a==='new'){editing=false;formDraft=structuredClone(db.onboarding?.profile||{hours:4,budget:0,focusMinutes:25,kind:'business'});wizardStep=db.onboarding?.step||0;wizard()}
 if(a==='edit'){editing=true;formDraft=structuredClone(n.profile);wizardStep=0;wizard(true)}
 if(a==='wizardback'){Object.assign(formDraft,Object.fromEntries(new FormData($('#wizard'))));wizardStep--;wizard(editing)}
 if(a==='wizardnext'){
  const f=$('#wizard');if(!f.reportValidity())return;
  Object.assign(formDraft,Object.fromEntries(new FormData(f)));
  for(const k of ['name','role','dream','goal'])if(k in formDraft)formDraft[k]=formDraft[k].trim();
  if((wizardStep===0&&(!formDraft.name||!formDraft.role))||(wizardStep===4&&(!formDraft.dream||!formDraft.goal)))return toast('请填写必填内容，不能仅输入空格');
  if(wizardStep<5){wizardStep++;if(!editing){db.onboarding={profile:structuredClone(formDraft),step:wizardStep};save()}wizard(editing)}else{
   if(editing){delete formDraft.aiStory;close();adjustment(true,formDraft)}
   else{const id=uid();db.users[id]=makeUser(structuredClone(formDraft),id);db.active=id;db.lastOwn=id;delete db.onboarding;save();close();page='route';selectedStory=0;render();toast('你的第一季人生故事已展开')}
  }
 }
 if(a==='quest')showQuest(v);
 if(a==='copyquest'){const t=n.tasks.find(t=>t.id===v),text=Story.details(n.profile,t).example;if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>toast('示例已复制，请按实际情况改写')).catch(()=>toast('复制不可用，可长按示例文字复制'));else toast('可长按示例文字复制')}
 if(a==='storychapter'){selectedStory=Number(v);render();document.querySelector('.chapter-tabs')?.scrollIntoView({block:'start',behavior:'smooth'})}
 if(a==='storyevent'){const [ch,index]=v.split('|').map(Number),q=Story.quests(n.profile,ch)[index];modal('剧情事件 · '+(ch+1)+'-'+(index+1),`<h3>${esc(q.title)}</h3><ol class="event-steps">${q.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><div class="quest-output"><small>应当留下的产出</small><p>${esc(q.output)}</p></div><div class="copy-example">${esc(q.example)}</div><p class="microcopy">未来事件仅作条件式预览，不会自动加入今日任务。</p>`,'<button class="btn" data-action="close">我知道了</button>')}
 if(a==='storybranch'){const [ch,index]=v.split('|').map(Number),branch=Story.buildStory(n.profile,n).chapters[ch].branches[index];if(ch!==n.chapter)return toast('未来分支可以预览，当前幕才可记录现实选择');modal('记录现实中的分支',`<h3>${branch.label}</h3><p>${branch.text}</p><p class="microcopy">记录分支不代表自动完成任务或修改目标。路线变化仍需审核草案。</p>`,`<button class="btn light" data-action="close">返回</button><button class="btn" data-action="branchconfirm" data-value="${v}">记录这个情况</button>`)}
 if(a==='branchconfirm'){const [ch,index]=v.split('|').map(Number);n.storyChoices??={};n.storyChoices[ch]=index;n.events??=[];n.events.push({date:day(),week:n.week,chapter:ch,branch:index});save();close();render();toast('已记录这一幕的真实情况')}
 if(a==='references'){modal('我们参考了什么？','<div class="reference-item"><b>LifePilot · 行动拆解</b><p>从目标拆为周计划、每日动作，根据实际执行调整节奏。</p><a href="https://getlifepilot.org/ai-goal-planner/" target="_blank" rel="noopener">官方介绍 ↗</a></div><div class="reference-item"><b>TheGreatMe · 主线与复盘</b><p>保持长期目标、阶段成果与日常行动的关联，用进展和障碍形成复盘。</p><a href="https://www.thegreatme.app/" target="_blank" rel="noopener">官方介绍 ↗</a></div><div class="reference-item"><b>Habitica · 成长反馈</b><p>把行动变成可见的旅程经验和章节反馈，不采用断签惩罚。</p><a href="https://habitica.com/" target="_blank" rel="noopener">官方介绍 ↗</a></div><div class="minibox">本产品采用原创场景与剧情模板。生活模拟的章节、事件、分支是本产品设计，不声称为上述产品已有功能。示例路线和根据本人资料定制的草案会分别标明，草案需由本人审核后采用。</div>','<button class="btn" data-action="close">继续旅程</button>')}
 if(a==='sample'){close();sample(v)}
 if(a==='compare')compare();if(a==='scenes')scenes();
 if(a==='scene'){close();sample('A',v)}
 if(a==='restore'){const own=db.users[db.lastOwn]||Object.values(db.users).find(x=>!x.demo);if(own){db.active=own.id;save();close();render()}else showJourneys()}
 if(a==='resetdemo'){modal('重置示例数据','<p>仅清除虚构示例的反馈与进度；你创建的旅程会完整保留。</p>','<button class="btn outline" data-action="close">取消</button><button class="btn" data-action="confirmreset">确认重置示例</button>')}
 if(a==='confirmreset'){Object.keys(db.users).filter(k=>k.startsWith('demo-')).forEach(k=>delete db.users[k]);close();sample('A');toast('示例已重置，个人旅程保留')}
 if(a==='journeys')showJourneys();
 if(a==='journey'){db.active=v;db.lastOwn=v;save();close();page='today';render()}
 if(a==='period'){if(page==='review')reviewPeriod=v;else planPeriod=v;period=v;render()}
 if(a==='feedback')feedback(v);if(a==='minimum')feedback(v,true);
 if(a==='savefeedback'){
  const f=$('#feedback');if(!f.reportValidity())return;const d=Object.fromEntries(new FormData(f)),t=n.tasks.find(t=>t.id===d.id);
  if(d.status==='done'&&!d.result.trim())return toast('请简短记录实际产出，作为完成依据');
  if(d.status==='unknown'&&(Number(d.actual)>0||d.result.trim()||d.reason!=='无'))return toast('已填写进展，请选择进行中、部分完成或其他实际状态');
  Object.assign(t,{status:d.status,actual:Number(d.actual),result:d.result.trim(),reason:d.reason==='无'?'':d.reason,updated:now()});observe(t);save();close();render();toast('已记录真实进展');
 }
 if(a==='adjust')adjustment();
 if(a==='restart'){const task=focusedTask();if(task)feedback(task.id,true);else toast('本周已完成，可先记录成果')}
 if(a==='reject'){draft=null;close();toast('已保留原档案与计划')}
 if(a==='tweak'&&draft){draft.tasks=draft.tasks.slice(0,1).map(t=>({...t,minutes:5,title:'先做：'+(t.questSteps?.[0]||t.title),standard:'保存第1步的一条记录，其他步骤保留。',questOutput:'保存第1步的一条记录，其他步骤保留。'}));draft.change+=' 仅保留1项5分钟行动。';showAdjustment()}
 if(a==='accept')acceptDraft();
 if(a==='versions'){modal('路线历史',n.versions.length?n.versions.map(r=>`<div class="history-item"><b>${esc(r.reason)}</b><small>${new Date(r.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</small><small>调整前 ${r.before.filter(t=>!t.archived&&t.week===r.week).length} 项 / 新增 ${r.after.length} 项</small><details><summary>查看当时的任务与反馈</summary>${r.before.filter(t=>t.week===r.week&&!t.archived).map(t=>`<p>${esc(t.title)}<br><small>${statusNames[t.status]} · ${t.actual||0} 分钟 · ${esc(t.result||'尚无说明')}</small></p>`).join('')}</details></div>`).join(''):'<p class="muted">尚无已接受的调整。</p>',n.versions.length?'<button class="btn outline" data-action="undo">撤销最近一次调整</button>':'')}
 if(a==='undo')undoDraft();
 if(a==='chaptercheck'){
  if(!n.results.length)modal('先补充一条成果','<p>阶段推进应有实际依据。请先记录作品、客户反馈或其他可检查的结果。</p>','<button class="btn" data-action="outcome">记录实际成果</button>');
  else modal('确认阶段成果',`<p>当前：${esc(stages(n.profile)[n.chapter])}</p><p class="muted">${esc(n.results.at(-1).text)}</p><label for="chapter-evidence">上述成果如何满足当前阶段标准？ *</label><textarea id="chapter-evidence" required maxlength="2000"></textarea><small>生成下一章草案后，仍需你确认才会生效。</small>`,'<button class="btn" data-action="chapterdraft">生成下一章草案</button>');
 }
 if(a==='chapterdraft'){
  const evidence=$('#chapter-evidence').value.trim();if(!evidence)return toast('请说明阶段成果的依据');
  const chapter=Math.min(3,n.chapter+1);
  draft={reason:'阶段推进',change:'根据你确认的阶段成果，建议进入“'+stages(n.profile)[chapter]+'”。',impact:'已有任务和反馈保留；接受后才切换当前章节。',evidence,proposedChapter:chapter,beforeChapter:n.chapter,beforeProfile:structuredClone(n.profile),tasks:chapterTasks(n.profile,chapter,n.week),before:structuredClone(n.tasks),at:now()};showAdjustment();
 }
 if(a==='note'||a==='outcome'){modal(a==='note'?'补充复盘说明':'记录一个实际成果',`<label for="entry">${a==='note'?'这段时间发生了什么？':'取得了什么变化？可填写作品链接或反馈摘要。'}</label><textarea id="entry" maxlength="2000"></textarea>`,`<button class="btn" data-action="saveentry" data-value="${a}">保存</button>`)}
 if(a==='saveentry'){const text=$('#entry').value.trim();if(!text)return toast('请填写内容');(v==='note'?n.notes:n.results).push({text,date:day(),week:n.week,chapter:n.chapter});save();close();render()}
 if(a==='obs'){const [i,state]=v.split('|');n.observations[i].state=state;save();render()}
 if(a==='deleteobs'){const o=n.observations[Number(v)],reason=['时间不足','能力不足','不知道怎么开始','害怕被拒绝或做错','等待他人','做了但没有效果','目标意愿改变'].find(r=>o.text.includes(r));if(reason)(n.ignoredReasons??=[]).push(reason);n.observations.splice(Number(v),1);save();render()}
 if(a==='nextweek'||a==='nextmonth'){modal('模拟进入下一周期','<p>保留本周期记录。未完成事项将带入下一周期供你确认，不会自动判断章节完成。</p><p class="muted">这是演示周期，不改变真实日期；本次操作可撤销。</p>',`<button class="btn outline" data-action="close">取消</button><button class="btn" data-action="advance" data-value="${a==='nextmonth'?4:1}">确认模拟</button>`)}
 if(a==='advance'){n.lastAdvance={week:n.week,taskIds:n.tasks.map(t=>t.id)};advanceCycle(Number(v))}
 if(a==='undoCycle'&&n.lastAdvance){const newer=n.tasks.filter(t=>!n.lastAdvance.taskIds.includes(t.id));if(newer.some(t=>t.status!=='unknown')||n.results.some(r=>r.week===n.week)||n.notes.some(r=>r.week===n.week))return toast('新周期已有记录，保留当前进度以免丢失反馈');n.tasks=n.tasks.filter(t=>n.lastAdvance.taskIds.includes(t.id));n.week=n.lastAdvance.week;delete n.lastAdvance;save();render();toast('已回到模拟前周期')}
 if(a==='export'){const blob=new Blob([JSON.stringify(n,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='蝴蝶效应-我的记录.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 if(a==='login'){showLogin();return}
 if(a==='send-code'){
  const terms=$('#agree-terms')?.checked,privacy=$('#agree-privacy')?.checked,phone=$('#login-phone')?.value?.trim()||'';
  const err=$('#login-error');if(err)err.textContent='';
  if(!terms||!privacy){if(err)err.textContent='请先勾选《用户协议》和《隐私政策》';return}
  busyAI(b,async()=>{
   const {ok,body}=await authFetch('/api/auth/send-code',{method:'POST',body:JSON.stringify({phone,agreedTerms:true,agreedPrivacy:true})});
   if(!ok){if(err)err.textContent=body?.error||'发送失败';return}
   toast(body?.mock?'验证码已就绪（mock：000000）':'验证码已发送');
  });return}
 if(a==='verify-code'){
  const phone=$('#login-phone')?.value?.trim()||'',code=$('#login-code')?.value?.trim()||'';
  const err=$('#login-error');if(err)err.textContent='';
  if(!$('#agree-terms')?.checked||!$('#agree-privacy')?.checked){if(err)err.textContent='请先勾选两项协议';return}
  busyAI(b,async()=>{
   const {ok,body}=await authFetch('/api/auth/verify-code',{method:'POST',body:JSON.stringify({phone,code})});
   if(!ok){if(err)err.textContent=body?.error||'登录失败';return}
   authSession={token:body.token,phone:body.phone,sensitiveConsent:Boolean(body.sensitiveConsent)};saveAuth();
   close();await loadJourneyFromServer();render();toast('登录成功');
   if(!u()&&!authSession.sensitiveConsent)showSensitiveConsent(()=>{chatOnboarding.open();chatOnboarding.action('start-text')});
  });return}
 if(a==='confirm-sensitive'){
  const errEl=$('#sensitive-error');if(errEl)errEl.textContent='';
  if(!$('#agree-sensitive')?.checked){if(errEl)errEl.textContent='请勾选同意后再继续';else toast('请勾选同意后再继续');window.__syncSensitive?.();return}
  if(b.disabled){if(errEl)errEl.textContent='请先勾选同意';window.__syncSensitive?.();return}
  busyAI(b,async()=>{
   try{
    if(authSession?.token){
     const {ok,status,body}=await authFetch('/api/auth/sensitive-consent',{method:'POST',body:JSON.stringify({agreed:true}),timeoutMs:15000});
     if(!ok){const msg=body?.error||(status?`保存失败（${status}）`:'保存失败，请检查网络后重试');if(errEl)errEl.textContent=msg;else toast(msg);window.__syncSensitive?.();return}
    }
    if(authSession){authSession.sensitiveConsent=true;saveAuth()}
    const next=window.__afterSensitive;window.__afterSensitive=null;close();
    try{if(typeof next==='function')next();else render()}catch(e){toast(e.message||'已同意，但进入下一步失败，请刷新重试')}
   }catch(e){
    const msg=e.name==='TimeoutError'||e.name==='AbortError'?'网络超时，请重试':(e.message||'保存失败，请重试');
    if(errEl)errEl.textContent=msg;else toast(msg);
    window.__syncSensitive?.();
   }
  });return}
 if(a==='export-server'){
  if(!authSession?.token)return toast('请先登录后再导出云端数据');
  busyAI(b,async()=>{
   const {ok,body}=await authFetch('/api/account/export');
   if(!ok)return toast(body?.error||'导出失败');
   const blob=new Blob([JSON.stringify(body.data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download='蝴蝶效应-我的数据-服务端.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出');
  });return}
 if(a==='delete-account'){
  if(!authSession?.token)return toast('请先登录');
  modal('注销账号 / 删除全部数据',`<p>将删除服务端账号下的旅程、角色卡与故事存档，并退出登录。此操作不可恢复。</p><p class="microcopy">本地浏览器缓存需你自行清理；我们不会迁移或合并旧设备 localStorage。</p><label class="consent-row"><input type="checkbox" id="confirm-delete">我确认注销并删除全部数据</label><div id="delete-error" class="error"></div>`,`<button class="btn outline" data-action="close">取消</button><button class="btn" data-action="confirm-delete">确认注销</button>`);return}
 if(a==='confirm-delete'){
  if(!$('#confirm-delete')?.checked){$('#delete-error').textContent='请勾选确认';return}
  busyAI(b,async()=>{
   const {ok,body}=await authFetch('/api/account/delete',{method:'POST',body:JSON.stringify({confirm:'DELETE'})});
   if(!ok){$('#delete-error').textContent=body?.error||'注销失败';return}
   if(db.active&&db.users[db.active]&&!db.users[db.active].demo){delete db.users[db.active];db.active=null}
   clearAuth();save();close();page='today';render();toast('账号已注销');
  });return}
});
function syncViewport(){
 const viewport=window.visualViewport,height=viewport?.height||window.innerHeight,offset=viewport?.offsetTop||0;
 document.documentElement.style.setProperty('--visual-height',height+'px');document.documentElement.style.setProperty('--visual-top',offset+'px');
 if($('#modal').innerHTML||$('#home-conversation')){requestAnimationFrame(()=>{const el=document.activeElement;if(el?.matches?.('#modal input,#modal textarea,#modal select,#home-conversation textarea'))el.scrollIntoView({block:'center',behavior:'auto'})});}
}
window.visualViewport?.addEventListener('resize',syncViewport);window.visualViewport?.addEventListener('scroll',syncViewport);window.addEventListener('resize',syncViewport);
document.addEventListener('focusin',e=>{if(e.target.matches('#modal input,#modal textarea,#modal select,#home-conversation textarea')){syncViewport();setTimeout(()=>e.target.scrollIntoView({block:'center',behavior:'smooth'}),160)}});
document.addEventListener('input',e=>{if(e.target.closest('#wizard')&&e.target.name){formDraft[e.target.name]=e.target.value;if(!editing){db.onboarding={profile:structuredClone(formDraft),step:wizardStep};save()}}});
document.addEventListener('change',e=>{
 if(e.target.dataset.quest){const id=e.target.dataset.quest,i=Number(e.target.dataset.step);u().questChecks??={};u().questChecks[id]??=[];u().questChecks[id][i]=e.target.checked;save()}
 if(e.target.closest('#wizard')&&e.target.name){formDraft[e.target.name]=e.target.value;if(!editing){db.onboarding={profile:structuredClone(formDraft),step:wizardStep};save()}}
 if(e.target.id==='learn'){u().learn=e.target.checked;save();toast(e.target.checked?'已开启使用记录优化':'已关闭；保留手动反馈，不调用历史行为观察')}
 if(e.target.id==='preview-width'){document.documentElement.style.setProperty('--app-width',e.target.value+'px');previewWidth=e.target.value}
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape')close();
 if(e.key==='Tab'&&$('#modal').innerHTML){const nodes=[...document.querySelectorAll('#modal button, #modal input, #modal textarea, #modal select')].filter(el=>!el.disabled&&el.type!=='hidden'),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
});
render();

// Kept separate for authoring; embedded into the app module at build time.
let quickState=null,aiBusy=false,quickEditing=false;
function quickSave(){db.quickDraft=structuredClone(quickState);save()}
function quickStart(edit=false){quickEditing=edit;const p=edit?u().profile:{};quickState=edit?{intro:'',profile:structuredClone(p),goal:p.goal,hours:p.hours}:structuredClone(db.quickDraft||{intro:'',profile:{},goal:'',hours:''});quickForm()}
function quickForm(){
 modal(quickEditing?'聊聊你的新变化':'不用填长表，先聊聊你',`<div class="quick-lead"><span class="tag">轻量开始 · 随时补充</span><p id="private-service-status" role="status">正在检查私人规划服务…</p><h3>一句话，也可以是起点。</h3><p>说说现在做什么、有什么经验、最想改变什么。年龄、学历快速确认，经历用自己的话说就好。</p></div><form id="quick-form"><div class="two"><label for="quick-age">年龄<input id="quick-age" name="age" type="number" min="18" max="120" required value="${esc(quickState.profile.age||'')}" placeholder="例如：35"></label><label for="quick-education">最高学历<select id="quick-education" name="education" required>${['','初中及以下','高中 / 中专','大专','本科','硕士','博士','其他'].map(v=>`<option value="${v}" ${quickState.profile.education===v?'selected':''}>${v||'请选择'}</option>`).join('')}</select></label></div><label for="quick-intro">自我介绍 / 新近变化<span class="muted">（可选）</span></label><textarea id="quick-intro" name="intro" maxlength="6000" placeholder="例如：我是做咨询的，有十年行业经验。想尝试独立服务，每周能留4小时，暂时不能辞职。也可以粘贴自己的简历或简介。">${esc(quickState.intro)}</textarea><p class="microcopy">也可使用手机键盘自带的语音输入。此版本尚无独立录音与简历附件解析。</p><label for="quick-goal">这90天，你最希望做成什么？</label><textarea id="quick-goal" name="goal" maxlength="2000" required placeholder="例如：与3位潜在客户访谈，完成1次付费试单">${esc(quickState.goal)}</textarea><label for="quick-hours">每周真正能留几小时？</label><input id="quick-hours" name="hours" type="number" min="0.5" max="80" step="0.5" required value="${esc(quickState.hours)}"><details><summary>补充与目标相关的信息（选填）</summary><label for="quick-role">当前工作 / 身份</label><input id="quick-role" name="role" maxlength="200" value="${esc(quickState.profile.role||'')}"><label for="quick-skills">已有技能或成果</label><textarea id="quick-skills" name="skills" maxlength="2000">${esc(quickState.profile.skills||'')}</textarea><label for="quick-constraints">不能牺牲的条件</label><textarea id="quick-constraints" name="constraints" maxlength="2000">${esc(quickState.profile.constraints||'')}</textarea></details><label class="learning-toggle"><input type="checkbox" name="consent" ${quickState.consent?'checked':''}>允许在私人服务中处理本次自述、目标与所选档案，用于整理资料和规划路线</label></form><div id="quick-error" role="status" class="error"></div><p class="microcopy">整理后先请你确认，不会自动把推测写进档案。也可以先看看示例路线。</p>`,`<button class="btn outline" data-action="quick-local">先用模板</button><button class="btn" data-action="quick-extract">帮我整理</button>`);
 $('.modal').classList.add('onboarding');syncViewport();
 fetch('/api/ai/status').then(async r=>({ok:r.ok,data:await r.json()})).then(({ok,data})=>{const el=$('#private-service-status');if(el)el.textContent=ok&&data.reachable===true?'私人规划服务已连接':'服务暂时无法连接，输入会保留，请稍后重试。'}).catch(()=>{const el=$('#private-service-status');if(el)el.textContent='暂时无法检查连接，请稍后重试。'});
}
function readQuick(){const f=$('#quick-form');if(!f.reportValidity())return false;const d=Object.fromEntries(new FormData(f));if(!d.goal.trim()){toast('请写一个具体目标');return false}quickState={...quickState,intro:d.intro.trim(),goal:d.goal.trim(),hours:Number(d.hours),consent:d.consent==='on',profile:{...quickState.profile,age:d.age,education:d.education,role:d.role.trim(),skills:d.skills.trim(),constraints:d.constraints.trim()}};quickSave();return true}
async function callAI(mode,data){const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,...data}),signal:AbortSignal.timeout(300000)});let body;try{body=await r.json()}catch{throw Error('整理服务暂时不可用，输入已保留')}if(!r.ok){const err=Error(body.error||'暂时未能完成，输入已保留');err.code=body.code;err.retryAfterSec=body.retryAfterSec;throw err}return body}
async function busyAI(button,fn,{progress}={}){if(aiBusy){toast('还有操作在进行，请稍候再试');return}aiBusy=true;const old=button.textContent;button.disabled=true;const started=Date.now();const tick=()=>{if(!button.isConnected)return;const sec=Math.floor((Date.now()-started)/1000);const mm=Math.floor(sec/60),ss=String(sec%60).padStart(2,'0');button.textContent=progress?`故事生成约需2–3分钟… ${mm}:${ss}`:'正在处理，请稍候…';const status=$('#quick-error');if(progress&&status&&!status.dataset.locked)status.textContent='故事生成大约需要 2–3 分钟；若高峰排队请耐心等待。角色卡与资料已保留。'};if(progress)tick();const timer=progress?setInterval(tick,1000):null;try{await fn()}catch(e){const error=$('#quick-error');const msg=e.name==='TimeoutError'?'等待超时，请重试；输入已保留。':e.message;if(error){error.dataset.locked='1';error.textContent=msg}else toast(msg)}finally{clearInterval(timer);aiBusy=false;if(button.isConnected){button.textContent=old;if(button.id==='confirm-sensitive-btn'){window.__syncSensitive?.()}else{button.disabled=false}}}}
function quickSummary(result=null){
 const p=quickState.profile;
 modal('这是我目前对你的了解',`<span class="tag">${result?'资料摘要 · 待你确认':'手动资料 · 模板模式'}</span><p>${esc(result?.summary||'只使用你明确填写的信息；其他信息保持未知。')}</p>${result?.questions?.length?`<div class="minibox"><b>之后最值得补充的 ${result.questions.length} 个问题</b>${result.questions.map(q=>`<p>${esc(q)}</p>`).join('')}<p>现在可先开始，或返回自述里补充答案后重新整理。</p></div>`:''}<form id="quick-summary"><div class="two"><label>年龄<input name="age" type="number" min="18" max="120" required value="${esc(p.age||'')}"></label><label>学历<select name="education" required>${['','初中及以下','高中 / 中专','大专','本科','硕士','博士','其他'].map(v=>`<option value="${v}" ${p.education===v?'selected':''}>${v||'请选择'}</option>`).join('')}</select></label></div><label>称呼（选填）<input name="name" value="${esc(p.name||'')}" maxlength="200" placeholder="朋友"></label><label>当前身份（选填）<input name="role" value="${esc(p.role||'')}" maxlength="200"></label><label>经历 / 能力（选填）<textarea name="experience" maxlength="2000">${esc(p.experience||'')}</textarea><textarea aria-label="已有技能" name="skills" maxlength="2000">${esc(p.skills||'')}</textarea></label><label>已拥有的资源（选填）<textarea name="resources" maxlength="2000">${esc(p.resources||'')}</textarea></label><label>不可牺牲的条件（选填）<textarea name="constraints" maxlength="2000">${esc(p.constraints||'')}</textarea></label><label>90天目标<textarea name="goal" maxlength="2000" required>${esc(quickState.goal)}</textarea></label><label>每周小时<input name="hours" type="number" min="0.5" max="80" step="0.5" required value="${esc(quickState.hours)}"></label></form><div id="quick-error" role="status" class="error"></div><p class="microcopy">确认只代表资料准确，生成后仍可审核故事草案。年龄与学历用于理解现实起点，不能据此推断能力上限；完整经历可日后补充。</p>`,`<button class="btn outline" data-action="quick-back">返回补充</button><button class="btn" data-action="quick-generate" data-value="${result?'ai':'local'}">${result?'确认资料，展开故事':'确认，使用模板'}</button>`);
 $('.modal').classList.add('onboarding');syncViewport();
}
function quickProfile(){const f=$('#quick-summary');if(!f.reportValidity())return null;const d=Object.fromEntries(new FormData(f));if(!d.goal.trim())return null;const p={...quickState.profile,...d,hours:Number(d.hours),name:d.name.trim()||'朋友',goal:d.goal.trim()};p.dream=p.dream||p.goal;p.kind=p.kind||'custom';return p}
function aiTasks(p,chapter=0,week=1){return chapterTasks(p,chapter,week).map((t,i)=>({...t,aiTool:p.aiStory.chapters[chapter].quests[i].tool,why:p.aiStory.chapters[chapter].quests[i].why,source:'ai',horizon:i===0?'今天起步':'接下来7天'}))}
function previewAI(p,story,existing=null){
 const targetId=existing?.id||null;
 modal('审核你的人生故事',`<span class="tag">定制草案 · 尚未采用</span><h3>${esc(story.title)}</h3><p>${esc(story.baseline)}</p>${story.chapters.map((c,i)=>`<section class="summary-block"><small>第${i+1}幕 · ${esc(c.period)}</small><h3>${esc(c.name)}</h3><p>${esc(c.narrative)}</p><p><b>推进证据：</b>${esc(c.gate)}</p>${i===0?c.quests.map(q=>`<details><summary>${esc(q.title)} · ${q.minutes}分钟</summary><ol>${q.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p>工具：${esc(q.tool)}</p><p>产出：${esc(q.output)}</p><p>依据：${esc(q.why)}</p></details>`).join(''):''}</section>`).join('')}<p class="microcopy">远期是条件路线。你确认后才应用；既有反馈和成果会保留。</p>`,`<button class="btn outline" data-action="close">暂不采用</button><button class="btn" id="apply-ai-result">接受这个故事</button>`);
 $('#apply-ai-result').onclick=()=>{
  if(targetId&&db.active!==targetId)return toast('旅程已切换，请重新生成');
  if(existing){const ch=existing.chapter,old=Story.buildStory(existing.profile,existing),merged={...story,chapters:[...old.chapters.slice(0,ch),...story.chapters.slice(0,4-ch)]};const proposed={...p,aiStory:merged};draft={reason:'根据已确认资料和记录提出新路线',change:story.baseline,impact:'未来任务改变；历史事实保留',tasks:aiTasks(proposed,ch,existing.week),at:now(),before:structuredClone(existing.tasks),beforeProfile:structuredClone(existing.profile),beforeChapter:ch,proposedChapter:ch,proposedProfile:proposed};acceptDraft();}
  else{const profile={...p,aiStory:story};const id=uid(),n=makeUser(profile,id);n.tasks=aiTasks(profile);n.profileSources={type:'用户填写与资料整理，已由用户确认',at:now()};db.users[id]=n;db.active=id;db.lastOwn=id;delete db.quickDraft;delete db.chatDraft;save();close();page='route';selectedStory=0;render();toast('你的故事已开启');}
 };
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
 if(a==='new'||a==='new-text'){
  e.stopImmediatePropagation();
  if(!authSession?.token){showLogin();return}
  const start=()=>{chatOnboarding.open();if(a==='new'){if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){toast('当前 http 页面无法使用麦克风，已改用文字聊天');chatOnboarding.action('start-text')}else chatOnboarding.startVoice()}else chatOnboarding.action('start-text')};
  if(!authSession.sensitiveConsent){showSensitiveConsent(start);return}
  start();return
 }
 if(a==='quick-edit'){chatOnboarding.open(u());return}
 if(a==='role-card'){chatOnboarding.open(u());chatOnboarding.s.kind='edit';chatOnboarding.card();return}
 if(a==='quick-back'){quickForm();return}
 if(a==='quick-local'){if(readQuick()){if(quickState.intro&&!quickState.profile.experience)quickState.profile.experience=quickState.intro;quickSummary()}return}
 if(a==='quick-extract'){
  if(!readQuick())return;if(!quickState.consent)return toast('请先同意本次资料处理，或先看看示例路线');if(!quickState.intro)return toast('请先写一段自述，或直接使用模板');
  busyAI(b,async()=>{const result=await callAI('extract',{intro:quickState.intro+'\n我当前确认的目标：'+quickState.goal+'；每周可用时间：'+quickState.hours+'小时；年龄：'+quickState.profile.age+'；学历：'+quickState.profile.education+'。'});quickState.profile={...quickState.profile,...result.profile,age:quickState.profile.age,education:quickState.profile.education,goal:quickState.goal,hours:quickState.hours};quickSave();quickSummary(result)});return;
 }
 if(a==='quick-generate'){
  const p=quickProfile();if(!p)return;quickState.profile=p;quickState.goal=p.goal;quickState.hours=p.hours;quickSave();
  if(b.dataset.value==='local'){delete p.aiStory;if(quickEditing){close();adjustment(true,p)}else{const id=uid();db.users[id]=makeUser(p,id);db.active=id;db.lastOwn=id;delete db.quickDraft;save();close();page='route';render()}return}
  busyAI(b,async()=>{const result=await callAI('plan',{profile:p});previewAI(p,result.story,quickEditing?u():null)},{progress:true});return;
 }
 if(a==='ai-status'){busyAI(b,async()=>{const r=await fetch('/api/ai/status');const data=await r.json();modal('规划服务状态',`<p>${r.ok&&data.reachable===true?'私人规划服务已连接，可以整理资料和展开故事。':r.status===401?'请重新进入你的私人空间。':'规划服务暂时未连接，输入已保留，请稍后重试。'}</p><p>资料先由你确认，路线草案先由你审核，不会自动改动已有记录。</p>`,'<button class="btn" data-action="close">知道了</button>')});return}
 if(a==='ai-plan'){
  modal('规划你的下一步',`<p>将发送当前确认的档案${u().learn?'、最近12条任务反馈及有效观察':'；你已关闭行为学习，不发送任务反馈或观察'}，在私人服务中规划路线。已确认的信息与未知内容分别保留；草案先由你审核。</p><div id="quick-error" role="status" class="error"></div>`,`<button class="btn outline" data-action="close">取消</button><button class="btn" data-action="ai-regenerate">同意并生成草案</button>`);return;
 }
 if(a==='ai-regenerate'){const n=u(),id=n.id,profile=structuredClone(n.profile);delete profile.aiStory;busyAI(b,async()=>{const result=await callAI(n.learn?'adjust':'plan',{profile,stage:{name:Story.buildStory(n.profile,n).chapters[n.chapter].name,gate:Story.buildStory(n.profile,n).chapters[n.chapter].gate},records:n.learn?n.tasks.slice(-12):[],observations:n.learn?n.observations.filter(o=>!['不准确','已失效'].includes(o.state)):[]});if(db.active!==id)return;previewAI(profile,result.story,n)},{progress:true});return}
},true);
document.addEventListener('input',e=>{if(!e.target.closest('#quick-form')||!quickState)return;const f=$('#quick-form'),d=Object.fromEntries(new FormData(f));quickState={...quickState,intro:d.intro,goal:d.goal,hours:d.hours,consent:d.consent==='on',profile:{...quickState.profile,age:d.age,education:d.education,role:d.role,skills:d.skills,constraints:d.constraints}};if(!quickEditing)quickSave()});


chatOnboarding=new ChatOnboarding({
 modal,close,viewport:syncViewport,toast,
 hasSensitiveConsent:()=>Boolean(authSession?.sensitiveConsent),
 requireSensitiveConsent:(next)=>showSensitiveConsent(next),
 home:(title,body,foot)=>{
  $('#modal').innerHTML='';$('#app').inert=false;document.body.classList.remove('dialog-open');document.body.classList.add('conversation-home');
  $('#app').innerHTML=previewTools()+`<main id="home-conversation" class="voice-home" aria-label="首页聊天"><header class="sectionhead"><div class="wordmark"><span class="brand-symbol">⋈</span><b>蝴蝶效应</b></div><button class="link" data-c="leave">稍后再聊</button></header><div class="modalbody">${body}</div><footer>${foot}</footer></main>`;
 },
 leaveHome:()=>{document.body.classList.remove('conversation-home');render()},

 getDraft:()=>db.chatDraft,
 saveDraft:d=>{db.chatDraft=d;save()},
 story:(profile,story)=>previewAI(profile,story),
 update:(id,state)=>{
  const n=db.users[id];if(!n)return;
  const before=structuredClone(n.profile),next={...n.profile};
  for(const key of InterviewCore.fields)delete next[key];Object.assign(next,InterviewCore.clean(state.profile));
  if(state.profile.name)next.name=state.profile.name;
  n.profile=next;n.profileEvidence=state.evidence;n.profileInterpretations=state.interpretations;
  n.conversationRecords??=[];n.conversationRecords.push({at:now(),before,after:structuredClone(next),messages:state.messages.slice(-12),source:'user-confirmed'});n.conversationRecords=n.conversationRecords.slice(-8);
  if(state.kind==='checkin')n.lastConversationAt=now();n.notes.push({date:day(),week:n.week,text:'已确认近况：'+(state.profile.recentUpdate||'补充了经历和兴趣，原路线与任务保留。')});
  save();render();
 }
});
save();
function checkConversationDue(){const n=u();if(n&&!n.demo&&InterviewCore.due(n)&&!chatOnboarding.active)chatOnboarding.open(n,true)}
setTimeout(()=>{if(u())checkConversationDue();else if(authSession?.token&&authSession.sensitiveConsent){/* logged-in empty: wait for user */}else render()},0);
document.addEventListener('click',()=>{if(!chatOnboarding.active)setTimeout(checkConversationDue,0)});
