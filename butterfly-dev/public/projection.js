/* 人生推演 M1 前端：确认差距评估 → 行动线推演页（单一行动线，无现状线）。
 * 文案约束：只出现系统固定模板与引擎输出；本页不含任何收费功能入口。 */
const FIRST_USE_KEY='butterfly-pj-first-use-v1';
const planLine=p=>(p?.lines||[]).find(l=>l.kind==='plan')||{nodes:[],milestones:[],horizon:null};
const actualLine=p=>(p?.lines||[]).find(l=>l.kind==='actual')||null;
const DEMO_SCENARIOS=[['on_plan','按计划执行'],['behind','部分完成较多'],['ahead','超出计划节奏'],['paused','含一周暂停']];
const demoEnabled=()=>{try{return new URLSearchParams(location.search).get('demo')==='1';}catch{return false;}};
export function createProjectionUI({esc,modal,close,toast,authHeaders,getProfile,render}){
 const slimPlanHandoff=ps=>{
  if(!ps||typeof ps!=='object')return null;
  const slimQuest=q=>({title:q?.title,output:q?.output,minutes:q?.minutes,steps:Array.isArray(q?.steps)?q.steps.slice(0,3):undefined,tool:q?.tool,example:typeof q?.example==='string'?String(q.example).slice(0,160):undefined,why:typeof q?.why==='string'?String(q.why).slice(0,120):undefined});
  const chapters=Array.isArray(ps.chapters)?ps.chapters.map(c=>({name:c?.name,period:c?.period,situation:c?.situation,action:c?.action,change:c?.change,cost:c?.cost,narrative:typeof c?.narrative==='string'?String(c.narrative).slice(0,280):undefined,gate:c?.gate,quests:Array.isArray(c?.quests)?c.quests.slice(0,3).map(slimQuest):undefined})):[];
  const nt=ps.nearTerm&&typeof ps.nearTerm==='object'?{todayTitle:ps.nearTerm.todayTitle,todayOutput:ps.nearTerm.todayOutput,weekTitle:ps.nearTerm.weekTitle,weekOutput:ps.nearTerm.weekOutput,today:ps.nearTerm.today,week:ps.nearTerm.week}:undefined;
  return {title:ps.title,baseline:ps.baseline,nearTerm:nt,chapters:chapters.length?chapters:undefined,provider:ps.provider,providerKind:ps.providerKind,model:ps.model,depthVersion:ps.depthVersion};
 };

const planHandoff=()=>{const p=getProfile?.()||null;const slim=slimPlanHandoff(p?.aiStory);const q=slim?.chapters?.[0]?.quests;let authoritativeNearTerm=null;if(Array.isArray(q)&&q.length>=2){const t=String(q[0]?.title||'').trim(),w=String(q[1]?.title||'').trim();if(t.startsWith('今天：')&&w.startsWith('本周：'))authoritativeNearTerm={today:{title:t,output:String(q[0]?.output||'').trim(),minutes:Number(q[0]?.minutes)||20},week:{title:w,output:String(q[1]?.output||'').trim(),minutes:Number(q[1]?.minutes)||30},source:'plan'};}return {profile:p?{...p,aiStory:slim||undefined}:null,planStory:slim,authoritativeNearTerm};};

 const st={params:null,gap:null,proj:null,crisis:null,loading:'',loaded:false,error:'',code:'',share:false,demo:null,demoLoading:'',demoWeekly:null,weekly:null,weeklyLoading:false};
 const DIM_FALLBACK={ability:'能力',credential:'资质/证书',experience:'经验',network:'人脉/作品',income:'收入',time:'可投入时间'};
 const dimLabel=(P,k)=>{const d=P?.dims;if(Array.isArray(d)){const hit=d.find(x=>x&&x.key===k);if(hit?.label)return hit.label;}else if(d&&d[k]?.label)return d[k].label;return P?.dimLabels?.[k]||DIM_FALLBACK[k]||k;};
 const friendlyErr=(e)=>{const m=String(e?.message||e||'');if(e?.code==='AUTH_REQUIRED')return '登录后才能使用人生推演。';if(e?.code==='SENSITIVE_REQUIRED')return '需要先同意敏感个人信息处理。';if(e?.name==='TimeoutError'||e?.name==='AbortError'||/timeout|aborted|fetch|network|Failed|terminated|EMPTY|mismatch/i.test(m)||/\u5931\u8d25/.test(m))return '暂未生成成功，请重试';return m||'暂未生成成功，请重试';};
 const api=async(path,body,timeoutMs=60000)=>{
  const once=async()=>{const r=await fetch(path,body===undefined?{headers:authHeaders(),signal:AbortSignal.timeout(timeoutMs)}:{method:'POST',headers:authHeaders(),body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)});const text=await r.text();let d={};try{d=text?JSON.parse(text):{};}catch{d={};}if(!r.ok)throw Object.assign(Error(d.error||'服务暂时不可用'),{code:d.code,status:r.status});return d;};
  try{return await once();}catch(e){if(e?.status&&e.status<500&&e.status!==0)throw e;try{return await once();}catch(e2){throw Object.assign(Error(friendlyErr(e2)),{code:e2.code,status:e2.status});}}
 };
 async function ensureParams(){if(!st.params){try{st.params=(await api('/api/projection/params',undefined,15000)).params;}catch{}}return st.params;}
 async function loadLatest(){st.loaded=true;try{await ensureParams();const d=await api('/api/projection/latest',undefined,20000);st.proj=d.projection;st.gap=d.gap;st.error='';st.code='';if(st.proj&&st.proj.mode==='normal')api('/api/projection/weekly-report',undefined,15000).then(w=>{st.weekly={gate:w.gate,report:w.report};render();}).catch(()=>{});}catch(e){st.code=e.code||'';st.error=e.code==='AUTH_REQUIRED'?'登录后才能使用人生推演。':e.code==='SENSITIVE_REQUIRED'?'需要先同意敏感个人信息处理。':'暂时读不到推演记录，可点下方按钮重新推演。';}render();}
 const badge=()=>{const b=String(st.params?.badge||'AI生成·模拟非承诺').replace(/\s+/g,'');return `<span class="pj-badge" aria-label="AI生成·模拟非承诺">${esc(b)}</span>`;};
 const range=t=>t?`第 ${t.lo}–${t.hi} 周`:'';
 /* §13-1 节点展开「本步 ↑↓」：与上一节点（首节点对比起点）相比，差距/角色/生活各项的升降；计划线、实际线共用 */
 function stepDelta(n,prev,L){
  const rows=[];const st=n.state||{},ps=prev?.state||{};
  if(st.gap)rows.push(['down','差距',st.gap]);
  if(st.role)rows.push([prev&&ps.role===st.role?'same':'up','角色',prev&&ps.role===st.role?'不变':st.role]);
  if(st.life)rows.push([prev&&ps.life===st.life?'same':'up','生活',prev&&ps.life===st.life?'不变（'+st.life+'）':st.life]);
  const ms=(L?.milestones||[]).find(m=>m.nodeId===n.id);if(ms)rows.push(['up','里程碑',ms.title]);
  if(n.deltaWeeks)rows.push([n.deltaWeeks>0?'later':'earlier','时间',(n.deltaWeeks>0?'比计划线晚约 ':'比计划线早约 ')+Math.abs(n.deltaWeeks)+' 周']);
  const ar={up:'↑',down:'↓',same:'＝',later:'→',earlier:'←'};
  return `<details class="pj-step"><summary>本步变了哪几项 ↑↓${prev?'（对比上一节点「'+esc(prev.title)+'」）':'（对比起点）'}</summary><ul>${rows.map(([k,l,t])=>`<li class="pj-step-${k}"><i class="pj-arrow" aria-hidden="true">${ar[k]}</i><b>${esc(l)}</b>：${esc(t)}</li>`).join('')}</ul></details>`;
 }
 /* §13-2 顶部「当前阶段卡」：中性色；当前进行到哪个节点 + 目标里程碑 + 约还需几周；不显示落后警告 */
 function stageCard(p){
  const PL=planLine(p),A=p.actual?.status==='ready'?p.actual:null,AL=A?actualLine(p):null;const L=AL||PL;const nodes=L.nodes||[];if(!nodes.length)return '';
  let wk=1;if(A?.startedAt&&A?.asOf)wk=Math.max(1,Math.ceil((Date.parse(A.asOf)-Date.parse(A.startedAt))/(7*864e5)));
  let i=nodes.findIndex(n=>n.tRange.hi>=wk);if(i<0)i=nodes.length-1;const cur=nodes[i];
  const ms=(L.milestones||[]).find(m=>m.nodeId===cur.id)||(L.milestones||[]).find(m=>m.tRange.hi>=wk)||(L.milestones||[]).at(-1);
  const left=ms?Math.max(0,ms.tRange.hi-wk):null;const goal=(L.milestones||[]).at(-1);
  return `<section class="card pj-stage" aria-label="当前阶段"><div class="pj-stage-row"><span class="pj-stage-label">当前阶段</span><b>${esc(cur.title)}</b><span class="pj-stage-pos">第 ${i+1}/${nodes.length} 个节点 · 第 ${wk} 周</span></div><p>${ms?`目标里程碑：<a href="#pj-node-${esc(ms.nodeId)}">${esc(ms.title)}</a>${left!=null?` · 按${AL?'实际线':'计划线'}约还需 ${left} 周`:''}`:''}</p>${goal&&goal!==ms?`<p class="microcopy">阶段目标：${esc(goal.title)}</p>`:''}</section>`;
 }
 /* §13-5 任务卡三要素：时长、难度档（按分钟数）、重复规则，并链到对应里程碑节点 */
 const diffTier=m=>m<=15?'极小':m<=30?'轻':m<=60?'中':'较重';
 function taskMeta(x,p,kind){
  const PL=planLine(p),n=PL.nodes.find(z=>z.id===x.nodeId),ms=(PL.milestones||[]).find(m=>m.nodeId===x.nodeId);
  return `<p class="pj-task-meta"><span class="pj-tag">约 ${esc(x.minutes)} 分钟</span> <span class="pj-tag">难度：${diffTier(Number(x.minutes)||0)}</span> <span class="pj-tag">${kind==='today'?'今天做一次':'本周内完成'}</span>${n?` <a class="pj-task-link" href="#pj-node-${esc(n.id)}">对应：${esc(ms?.title||n.title)}</a>`:''}</p>`;
 }
 /* P0-18 R18：数字旁可点开的「来源」——参数表 / 人群参数包 / 收入台账；兜底与省级/区域估算显式标注 */
 function srcChip(src){
  if(!src||!Array.isArray(src.lines)||!src.lines.length)return '';
  const refs=(src.personaRefs||[]).filter(r=>r&&(r.title||r.key));
  return `<details class="pj-src"><summary>${esc(src.label||'来源')}${src.fallback?' <span class="pj-src-fb">兜底</span>':''}</summary><ul>${src.lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ul>${refs.length?`<p class="microcopy">参考：${refs.map(r=>r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.key)} ${esc(r.title||'')}</a>`:esc(r.key+' '+(r.title||''))).join('；')}</p>`:''}${src.url?`<p class="microcopy"><a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">查看来源原文</a></p>`:''}</details>`;
 }
 /* P0-20 W1：周报卡（固定模板） */
 function weeklyCard(r,{demo=false}={}){
  if(!r)return '';
  const sp=r.story||{};const storyHtml=sp.kind==='placeholder'?`<p class="muted">${esc(sp.text)}</p>`:`<ul>${(sp.items||[]).map(i=>`<li><b>${esc(i.title)}</b>：${esc(i.excerpt)}</li>`).join('')}</ul>`;
  const hl=(r.highlights||[]).slice(0,5);
  return `<section class="card pj-weekly" aria-label="周报"><div class="sectionhead"><div><span class="microcopy">一句话给本周命名${r.rangeLabel?' · '+esc(r.rangeLabel):''}</span><h3>${esc(r.headline||r.title)}${demo?' <span class="pj-demo-tag">演示数据</span>':''}</h3></div>${badge()}</div>${hl.length?`<h4>本周关键变化</h4><ol class="pj-weekly-hl">${hl.map(h=>`<li>${esc(h)}</li>`).join('')}</ol><details><summary>本周完整记录</summary><p>${esc(r.progress)}</p></details>`:`<p>${esc(r.progress)}</p>`}<h4>故事更新</h4>${storyHtml}${r.next?`<p class="pj-plan"><b>${esc(r.next.text)}</b></p>`:''}<p class="microcopy">按固定模板，根据你的执行记录整理。</p></section>`;
 }
 function weeklyEntry(){
  const w=st.weekly;const g=w?.gate;
  return `<section class="card pj-weekly-entry"><div class="sectionhead"><h3>周报</h3><button class="btn light" data-action="pj-weekly" ${st.weeklyLoading?'disabled':''}>${st.weeklyLoading?'正在整理…':w?.report?'更新本周周报':'生成本周周报'}</button></div>${g&&!g.met?`<p class="microcopy">${esc(g.text||'满 7 天有效记录后可以生成周报。')}</p>`:''}${w?.report?weeklyCard(w.report):''}</section>`;
 }
 function chart(p){
  const L=planLine(p),nodes=L.nodes||[];if(!nodes.length)return '<p class="muted">暂无节点</p>';const AL=actualLine(p),an=new Map((AL?.nodes||[]).map(n=>[n.id,n]));const row=AL?44:34;
  const max=Math.max(...nodes.map(n=>n.tRange.hi),...(AL?.nodes||[]).map(n=>n.tRange.hi),4),W=640,H=nodes.length*row+46,x=w=>40+w/max*(W-70);
  const ticks=[0,Math.round(max/4),Math.round(max/2),Math.round(max*3/4),max];
  return `<svg class="pj-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="行动线：${nodes.length} 个节点，约 ${range(L.horizon)} 前后"><g font-size="11" fill="currentColor">${ticks.map(t=>`<line x1="${x(t)}" x2="${x(t)}" y1="8" y2="${H-26}" stroke="#d9e2dc"/><text x="${x(t)}" y="${H-10}" text-anchor="middle">第${t}周</text>`).join('')}</g>${nodes.map((n,i)=>{const y=14+i*row,ms=(L.milestones||[]).find(m=>m.nodeId===n.id);return `<g><rect x="${x(n.tRange.lo-Math.max(1,n.duration?.lo||1))}" y="${y}" width="${Math.max(6,x(n.tRange.hi)-x(n.tRange.lo-Math.max(1,n.duration?.lo||1)))}" height="16" rx="8" fill="${n.dim==='goal'?'#244e40':'#8fb9a5'}" opacity=".85"/><text x="${x(n.tRange.lo-Math.max(1,n.duration?.lo||1))+6}" y="${y+12}" font-size="11" fill="#fff">${esc(n.title)}</text>${ms?`<circle cx="${x(ms.tRange.hi)}" cy="${y+8}" r="5" fill="#f2a65a"/>`:''}${an.has(n.id)?(()=>{const a=an.get(n.id),a0=x(a.tRange.lo-Math.max(1,n.duration?.lo||1));return `<rect class="pj-actual-bar" x="${a0}" y="${y+19}" width="${Math.max(6,x(a.tRange.hi)-a0)}" height="7" rx="3.5" fill="#d9822b"/>`;})():''}</g>`}).join('')}</svg><p class="pj-legend"><span><i class="pj-sw pj-sw-plan"></i>计划线</span>${AL?'<span><i class="pj-sw pj-sw-actual"></i>实际线（按执行记录推演）</span>':''}<span><i class="pj-sw pj-sw-ms"></i>里程碑（区间上沿）</span></p>`;
 }
 function actualSection(p){
  const A=p.actual;if(!A||A.status==='paused')return '';
  if(A.status!=='ready'){const g=A.gate||{};return `<section class="card pj-actual-ph" aria-label="实际线占位"><p class="muted">${esc(A.placeholder||'开始执行后，这里会出现按你实际执行情况推演的轨迹')}</p>${g.minDays?`<p class="microcopy">已记录 ${esc(g.records||0)} 条、${esc(g.days||0)} 天（满 ${esc(g.minDays)} 天且 ${esc(g.minValidRecords)} 条后出现）</p>`:''}</section>`;}
  const AL=actualLine(p),PL=planLine(p),d=A.deltaWeeks||0;
  return `<section class="card pj-actual" aria-label="计划线与实际线"><div class="sectionhead"><h3>计划线 vs 实际线</h3><span class="tag">${d>0?'实际线晚约 '+esc(d)+' 周':d<0?'实际线早约 '+esc(-d)+' 周':'两条线一致'}</span></div><p class="pj-notice">${esc(A.notice)}</p><div class="pj-sbs"><div class="pj-sbs-col pj-sbs-plan"><h4><i class="pj-sw pj-sw-plan"></i>计划线</h4><p class="microcopy">约 ${esc(range(PL.horizon))} 前后到达</p><ol>${PL.nodes.map(n=>`<li><b>${esc(n.title)}</b><span>${esc(range(n.tRange))}</span></li>`).join('')}</ol></div><div class="pj-sbs-col pj-sbs-actual"><h4><i class="pj-sw pj-sw-actual"></i>实际线</h4><p class="microcopy">约 ${esc(range(AL.horizon))} 前后到达</p><ol>${PL.nodes.map(n=>{const a=AL.nodes.find(x=>x.id===n.id);return `<li><b>${esc(n.title)}</b><span>${a?esc(range(a.tRange)):'—'}${a&&a.deltaWeeks?` <small class="${a.deltaWeeks>0?'pj-late':'pj-early'}">${a.deltaWeeks>0?'+':''}${esc(a.deltaWeeks)} 周</small>`:''}</span></li>`;}).join('')}</ol></div></div><table class="pj-cmp"><thead><tr><th>节点</th><th>计划线</th><th>实际线</th></tr></thead><tbody>${PL.nodes.map(n=>{const a=AL.nodes.find(x=>x.id===n.id);return `<tr><td>${esc(n.title)}</td><td>${esc(range(n.tRange))}</td><td>${a?esc(range(a.tRange)):'—'}${a&&a.deltaWeeks?` <small class="muted">（${a.deltaWeeks>0?'+':''}${esc(a.deltaWeeks)} 周）</small>`:''}</td></tr>`;}).join('')}</tbody></table>${A.attribution?.length?`<h4>变化说明 · 前 ${Math.min(3,A.attribution.length)} 项</h4><ol class="pj-attr">${A.attribution.slice(0,3).map(x=>{const e=x.direction==='earlier',w=Math.max(0.1,Math.abs(Number(x.weeks)||0));return `<li class="${e?'pj-attr-done':'pj-attr-open'}"><span class="pj-attr-chip">${e?'已完成 · 追回约 ':'未完成 · 晚约 '}${esc(w)} 周</span><p>${esc(x.text)}</p><details class="pj-adjust"><summary>调整计划</summary><ul>${x.options.map(o=>`<li>${esc(o)}</li>`).join('')}</ul></details></li>`;}).join('')}</ol>`:''}${A.pauses?.length?`<p class="microcopy">暂停：${A.pauses.map(z=>esc(z.label)+' '+esc(z.from.slice(0,10))+'～'+esc(z.to.slice(0,10))).join('；')}（暂停期间不计入时间差）</p>`:''}</section>`;
 }
 /* P0-14 详细故事版：短摘要默认展开 + 长文折叠；generating 时显示进度并轮询，failed 可重试（不影响行动线） */
 function storyLong(s){
  return String(s.longForm||'').split('\n').filter(Boolean).map(line=>{
   if(/^【.+】$/.test(line))return `<h4>${esc(line.slice(1,-1))}</h4>`;
   const m=line.match(/^(处境|行动|变化|代价)：(.*)$/);
   return m?`<p class="pj-story-f"><b>${esc(m[1])}</b>：${esc(m[2])}</p>`:`<p>${esc(line)}</p>`;
  }).join('');
 }
 function storySection(p,{demo=false}={}){
  const s=p.story;if(!s)return '';
  const head=`<div class="sectionhead"><h3>详细故事版</h3><span class="pj-badge" aria-label="AI生成·模拟非承诺">${esc(String(s.badge||st.params?.badge||'AI生成·模拟非承诺').replace(/\s+/g,''))}</span></div>`;
  const P=st.params?.story||{};
  if(s.status==='ready'){
   const conts=(s.continuations||[]).map(c=>`<div class="pj-story-cont"><h4>续写 · ${esc(c.title)}</h4><p>${esc(c.text)}</p></div>`).join('');
   const drafts=demo?'':(s.drafts||[]).map(d=>`<div class="pj-story-draft" role="group" aria-label="待确认的故事改动"><p><b>${d.kind==='rewrite'?'AI 改写草稿':'续写草稿'}</b>：${esc(d.diff?.text||'')}</p>${d.kind==='continuation'?`<p class="muted">${esc(d.continuation?.text||'')}</p>`:''}<button class="btn small" data-action="pj-story-ok" data-value="${esc(d.id)}">确认写入</button> <button class="btn outline small" data-action="pj-story-no" data-value="${esc(d.id)}">放弃</button></div>`).join('');
   const rw=s.rewrite;const rwLine=rw?.status==='generating'?`<p class="muted" role="status">正在生成改写草稿（已完成 ${esc(rw.progress?.done||0)}/${esc(rw.progress?.total||0)} 段），当前故事保持不变。</p>`:rw?.status==='failed'?`<p class="muted">${esc(rw.failedText||'改写暂未成功，当前故事不受影响。')}</p>`:'';
   const done=new Set((s.continuations||[]).map(c=>c.nodeId));const pend=(s.perNode||[]).filter(n=>!done.has(n.nodeId));
   const contBtns=demo||!pend.length?'':`<details class="pj-story-mark"><summary>完成了某一段？标记后续写这一幕</summary>${pend.map(n=>`<button class="btn outline small" data-action="pj-story-cont" data-value="${esc(n.nodeId)}">${esc(n.title)}</button>`).join(' ')}</details>`;
   // P0-26: demo path must show readable story body without extra click; open long form by default
   return `<section class="card pj-story" aria-label="详细故事版">${head}<p class="pj-story-summary">${esc(s.summary||'')}</p><details class="pj-story-long"${demo?' open':''}><summary>${demo?'文字人生故事（详细）':'展开详细故事版'}（约 ${esc(s.chars||'')} 字 · 每段含处境、行动、变化、代价）</summary>${storyLong(s)}</details>${conts}${drafts}${rwLine}<p class="microcopy">${esc(s.sourceNote||'')}${s.storyVersion?` · 故事版本 v${esc(s.storyVersion)}`:''}</p>${contBtns}${demo?'':`<button class="btn outline small" data-action="pj-story-gen" data-value="force" ${st.storyBusy||rw?.status==='generating'?'disabled':''}>AI 改写（先看差异再确认）</button>`}</section>`;
  }
  if(s.status==='generating'){
   const pr=s.progress||{},done=pr.done||0,total=pr.total||0;
   return `<section class="card pj-story" aria-label="详细故事版" aria-busy="true">${head}<p class="muted" role="status">${esc(s.generatingText||P.generatingText||'正在生成详细故事版，可以先看上方行动线，完成后会自动显示。')}</p>${total?`<progress max="${esc(total)}" value="${esc(done)}"></progress> <small>已完成 ${esc(done)}/${esc(total)} 段</small>`:''}</section>`;
  }
  const msg=s.status==='failed'?(s.failedText||P.failedText||'详细故事版暂未生成成功，行动线不受影响，可以点按钮重试。'):(s.pendingText||'详细故事版正在准备，完成后会显示在这里。');
  return `<section class="card pj-story" aria-label="详细故事版">${head}<p class="muted">${esc(msg)}</p>${demo?'':`<button class="btn outline" data-action="pj-story-gen" ${st.storyBusy?'disabled':''}>${s.status==='failed'?'重试生成故事':'生成详细故事版'}</button>`}</section>`;
 }
 function storyPoll(){
  const p=st.proj;if(st.storyTimer||st.demo||(p?.story?.status!=='generating'&&p?.story?.rewrite?.status!=='generating'))return;
  st.storyTimer=setTimeout(async()=>{
   const id=st.proj?.id;
   try{const d=await api('/api/projection/story?id='+encodeURIComponent(id),undefined,15000);st.storyErr=0;if(st.proj?.id===id){st.proj={...st.proj,story:d.story};}}
   catch{st.storyErr=(st.storyErr||0)+1;if(st.storyErr>=3&&st.proj?.id===id){st.proj={...st.proj,story:{...st.proj.story,status:'failed'}};st.storyErr=0;}}
   st.storyTimer=null;render();
  },4000);
 }
 async function storyPost(path,body){
  const p=st.proj;if(!p||st.storyBusy)return null;st.storyBusy=true;let d=null;
  try{d=await api(path,{projectionId:p.id,...body},20000);if(d?.story&&st.proj?.id===p.id)st.proj={...st.proj,story:d.story};}catch(e){toast(friendlyErr(e));}
  st.storyBusy=false;render();return d;
 }
 async function storyContinue(nodeId){
  const p=st.proj;if(!p)return;
  try{await api('/api/projection/log',{taskId:'',nodeId,status:'done',nodeComplete:true},20000);}catch(e){toast(friendlyErr(e));return;}
  const d=await storyPost('/api/projection/story/continue',{nodeId});if(d?.draft)toast('续写草稿已生成，确认后写入');
 }
 async function storyGenerate(force){
  const p=st.proj;if(!p||st.storyBusy)return;st.storyBusy=true;
  try{const d=await api('/api/projection/story/generate',{projectionId:p.id,force:!!force,...planHandoff()},20000);if(st.proj?.id===p.id)st.proj={...st.proj,story:d.story};}
  catch(e){toast(friendlyErr(e));}
  st.storyBusy=false;render();
 }
 function demoBar(){
  if(!demoEnabled()&&!st.demo)return '';
  return `<section class="card pj-demo-bar"><p><span class="pj-demo-tag">演示数据</span> 用合成执行记录 + 时钟快进查看实际线，不会保存到你的推演记录。</p><div class="pj-demo-btns">${DEMO_SCENARIOS.map(([k,l])=>`<button class="btn ${st.demo?.demo?.scenario===k?'':'light'}" data-action="pj-demo" data-value="${k}" ${st.demoLoading?'disabled':''}>${esc(l)}</button>`).join(' ')}${st.demo?' <button class="btn outline" data-action="pj-demo-exit">退出演示</button>':''}</div>${st.demoLoading?`<p class="microcopy">${esc(st.demoLoading)}</p>`:''}</section>`;
 }
 function demoPage(head){
  const p=st.demo,D=p.demo||{};
  if(p.mode!=='normal')return head+demoBar()+`<section class="card"><p>当前状态下实际线已暂停。</p></section>`;
  // P0-26: story body + path chart first (理念可见)，再里程碑/节点/对照
  return head+`<div class="pj-demo-banner" role="status"><b>演示数据</b> · ${esc(D.note||'')}<br><small>合成 ${esc(D.records)} 条记录，时钟快进 ${esc(D.days)} 天（${esc(String(D.startedAt||'').slice(0,10))} → ${esc(String(D.asOf||'').slice(0,10))}）${D.source==='synthetic'?' · 使用合成画像':' · 使用你最近确认的差距评估'}</small></div>`+demoBar()+stageCard(p)+storySection(p,{demo:true})+`<section class="card pj-top pj-demo"><p class="pj-plan"><b>${esc(p.meta.planAssumption)}</b></p>${p.persona?`<p class="microcopy">参数：${esc(p.persona.label)}</p>`:''}${chart(p)}</section>${actualSection(p)}<section class="card pj-demo-ms"><h3>里程碑</h3><ol>${(planLine(p).milestones||[]).map(m=>`<li>${esc(m.title)} · ${esc(range(m.tRange))}${srcChip(m.source)}</li>`).join('')}</ol></section>${weeklyCard(st.demoWeekly,{demo:true})}${demoTasks(p)}<div class="sectionhead"><h2>行动线节点</h2></div>${planLine(p).nodes.map((n,i,a)=>{const an=actualLine(p)?.nodes.find(x=>x.id===n.id);return nodeCard(an?{...n,deltaWeeks:an.deltaWeeks}:n,a[i-1],planLine(p));}).join('')}`;
 }
 function demoTasks(p){
  const t=p.tasks||{};const xs=[...(t.today||[]).map(x=>[x,'today']),...(t.week||[]).map(x=>[x,'week'])];if(!xs.length)return '';
  return `<div class="sectionhead"><h2>今天与本周</h2></div>${xs.map(([x,k])=>`<article class="card pj-task"><b>${esc(x.title)}</b>${taskMeta(x,p,k)}<ol>${x.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p class="muted">产出：${esc(x.output)} · ${esc(x.why)}</p></article>`).join('')}`;
 }
 function nodeCard(n,prev,L){
  return `<article class="card pj-node" id="pj-node-${esc(n.id)}"><div class="sectionhead"><h3>${esc(n.title)}</h3><span class="tag">${esc(range(n.tRange))}</span></div>${n.deferred?`<p class="microcopy">${esc(n.deferred.reason||'')}</p>`:''}${srcChip(n.source)}<p>${esc(n.reason)}</p><ul class="pj-state"><li>差距：${esc(n.state.gap)}</li><li>角色：${esc(n.state.role)}</li><li>生活：${esc(n.state.life)}</li></ul>${stepDelta(n,prev,L)}<details class="pj-why"><summary>依据与假设（${(n.evidence||[]).length} 条依据 · ${(n.assumptions||[]).length} 条假设）</summary><b>依据</b><ul>${(n.evidence||[]).map(e=>`<li><span class="muted">${esc(e.label)}：</span>${esc(e.text)}</li>`).join('')||'<li class="muted">暂无你提供的直接依据，见下方假设</li>'}</ul><b>假设</b><ul>${(n.assumptions||[]).map(a=>`<li>${esc(a.text)}</li>`).join('')}</ul></details></article>`;
 }
 function incomeCard(i){
  if(!i)return '';
  if(!i.available)return `<section class="card pj-income"><h3>收入参考</h3><p><b>${esc(i.reason)}</b></p>${i.detail?`<p class="muted">${esc(i.detail)}</p>`:''}${i.selfReported?`<p class="muted"><span class="pj-tag">${esc(i.selfReported.label)}</span> ${esc(i.selfReported.text)}（仅作为你提供的条件，不据此生成区间）</p>`:''}</section>`;
  const yr=i.publishYear!=null?i.publishYear:i.dataYear;
  const stale=i.dataStaleNote?`<p class="muted"><span class="pj-tag">${esc(i.dataStaleNote)}</span></p>`:'';
  const l3=i.l3IndustryNote?`<p class="microcopy">${esc(i.l3IndustryNote)}</p>`:'';
  const isMean=i.bandKind==='industry_mean';
  const amount=isMean?`约 ${i.low} <small>${esc(i.unit)} · 行业平均</small>`:`${i.low}–${i.high} <small>${esc(i.unit)}</small>`;
  const bandTag=i.bandLabel?`<span class="pj-tag">${esc(i.bandLabel)}</span> `:'';
  const sampleTag=i.sampleLabel?`<span class="pj-tag">${esc(i.sampleLabel)}</span> `:'';
  const est=i.estimateLabel?`<p><span class="pj-tag">${esc(i.estimateLabel)}</span></p>`:'';
  return `<section class="card pj-income"><h3>收入参考</h3><p class="microcopy">${esc(i.label)}</p><p class="pj-amount">${amount}</p>${srcChip(i.source)}<p>${bandTag}${sampleTag}${esc(i.occupation)} · ${esc(i.city)} · 发布年份 ${esc(String(yr))}</p>${stale}${l3}${est}<p class="muted">来源类别：${esc(i.sourceTier||'')} ${esc(i.sourceCategory)}${i.industryName?' · 行业 '+esc(i.industryName):''}</p><details class="pj-income-src"><summary>完整来源</summary><p>${esc(i.sourceFull||('来源类别 '+ (i.sourceTier||'')+' '+ (i.sourceCategory||'')))}</p><p class="muted"><a href="${esc(i.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看来源原文</a></p></details>${!isMean&&i.stages?.length>1?`<details><summary>按相关经验分档</summary><ul>${i.stages.map(s=>`<li>${esc(s.label)}：${s.lo}–${s.hi}（${esc(s.when)}）</li>`).join('')}</ul></details>`:''}<details open><summary>成立条件</summary><ul>${i.conditions.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></details><p class="microcopy">${esc(i.disclaimer)}</p></section>`;
 }
 function shareCard(p){
  const s=p.shareCard;if(!s)return '';
  return `<section class="card pj-share" aria-label="分享卡"><div class="sectionhead"><b>${esc(s.title)}</b>${badge()}</div><p>${esc(s.goal)}</p><ol>${s.nodes.map(n=>`<li>${esc(n.title)} · ${esc(range(n.tRange))}</li>`).join('')}</ol><p class="microcopy">里程碑：${s.milestones.map(m=>esc(m.title)).join(' → ')}</p><p class="microcopy">${esc(st.params?.planAssumption||'')}</p></section>`;
 }
 function crisisView(c){
  return `<section class="card pj-crisis" role="alert"><h2>${esc(c.title)}</h2><p>${esc(c.body)}</p><ul>${(c.hotlines||[]).map(h=>`<li><b>${esc(h.name)}</b>：${esc(h.phone)}</li>`).join('')}</ul><p class="microcopy">${esc(c.note||'')}</p><button class="btn outline" data-action="pj-crisis-back">我现在安全，返回</button></section>`;
 }
 function page(){
  const tok=authHeaders().Authorization||'';if(tok!==st.token){st.token=tok;st.loaded=false;st.proj=null;st.gap=null;st.error='';st.code='';}
  if(!st.loaded){loadLatest();return `<section class="card">正在读取你的推演记录…</section>`;}
  if(st.crisis)return crisisView(st.crisis);
  const head=`<div class="greeting"><div><span class="eyebrow">LIFE PROJECTION · 人生推演</span><h1>行动路径模拟</h1></div>${badge()}</div>`;
  if(st.demo)return demoPage(head);
  if(st.error){
   const needLogin=st.code==='AUTH_REQUIRED'||/登录/.test(st.error);
   const loginCta=needLogin?`<p class="microcopy">${demoEnabled()?'演示可直接点上方按钮查看计划线与实际线；登录后可保存自己的推演。':'登录后可使用人生推演并保存记录。'}</p><p><button type="button" class="btn" data-action="login">去登录</button></p>`:'';
   return head+demoBar()+`<section class="card"><p>${esc(st.error)}</p>${loginCta}</section>`;
  }
  const p=st.proj;
  const start=`<button class="btn" data-action="pj-start" ${st.loading?'disabled':''}>${st.loading?esc(st.loading):p?'按最新角色卡重新推演':'开始推演'}</button>`;
  if(!p)return head+demoBar()+`<section class="card"><p>先根据你已确认的角色卡生成一份六维差距评估，你确认或修改后，再生成行动路径模拟。</p>${start}</section>`;
  const t=p.tasks||{};
  storyPoll();
  try{
  return head+demoBar()+stageCard(p)+`<section class="card pj-top"><p class="microcopy">${esc(p.meta.disclaimer)}</p><p class="pj-plan"><b>${esc(p.meta.planAssumption)}</b></p><p>难度：${esc(p.difficulty.tierLabel)} · 预计约 ${esc(range(planLine(p).horizon))} 前后到达阶段目标验证 · 版本 v${esc(p.version)}</p>${p.diffFromPrev?.changes?.length?`<details><summary>与上一版相比的变化</summary><ul>${p.diffFromPrev.changes.map(c=>`<li>${esc(c.text)}</li>`).join('')}</ul></details>`:''}${(p.notices||[]).map(n=>`<p class="pj-notice">${esc(n.text||n)}</p>`).join('')}${p.persona?`<p class="microcopy">参数：${esc(p.persona.label)}</p>`:''}${chart(p)}${actualSection(p)}${start} <button class="btn outline" data-action="pj-share">${st.share?'收起分享卡':'生成分享卡'}</button></section>${st.share?shareCard(p):''}<div class="sectionhead"><h2>今天与本周</h2></div>${[...(t.today||[]).map(x=>[x,'today']),...(t.week||[]).map(x=>[x,'week'])].map(([x,k])=>`<article class="card pj-task"><b>${esc(x.title)}</b>${taskMeta(x,p,k)}<ol>${x.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p class="muted">产出：${esc(x.output)} · ${esc(x.why)}</p><button class="btn light" data-action="pj-log" data-value="${esc(x.id)}|${esc(x.nodeId)}|done">记录完成</button> <button class="btn light" data-action="pj-log" data-value="${esc(x.id)}|${esc(x.nodeId)}|partial">部分完成</button> <button class="btn light" data-action="pj-log" data-value="${esc(x.id)}|${esc(x.nodeId)}|skipped">今天没做</button></article>`).join('')}<p><button class="btn outline" data-action="pj-pause">有原因暂停</button></p><div class="sectionhead"><h2>行动线节点</h2></div>${planLine(p).nodes.map((n,i,a)=>nodeCard(n,a[i-1],planLine(p))).join('')}<div class="sectionhead"><h2>里程碑</h2></div><section class="card"><ol>${planLine(p).milestones.map(m=>`<li>${esc(m.title)} · ${esc(range(m.tRange))}${srcChip(m.source)}</li>`).join('')}</ol></section>${incomeCard(p.income)}${weeklyEntry()}${storySection(p)}<section class="card"><h3>假设与未知</h3><ul>${p.assumptions.map(a=>`<li>${esc(a.text)}</li>`).join('')}</ul>${p.unknowns.length?`<p class="muted">未提供：${p.unknowns.map(u=>esc(u.label)).join('、')}（补充后可重新推演）</p>`:''}</section>`;
  }catch(e){console.error(e);return head+`<section class="card"><p>推演页暂时无法展示，请点下方重新推演。</p>${start}</section>`;}
 }
 function confirmModal(){
  const g=st.gap,P=st.params||{};const labels=P.levelLabels||['0','1','2','3','4'];
  modal('确认差距评估',`<p class="microcopy">以下是根据你已确认的角色卡做的六维差距评估（0=基本无差距，4=很大）。请确认或修改等级，确认后再生成行动路径模拟。</p><form id="pj-gap-form">${Object.entries(g.dims).map(([k,d])=>`<div class="pj-gap-row"><label for="pj-l-${k}"><b>${esc(dimLabel(P,k))}</b></label><select id="pj-l-${k}" name="${k}">${[0,1,2,3,4].map(l=>`<option value="${l}" ${d.level===l?'selected':''}>${l} · ${esc(labels[l]||'')}</option>`).join('')}</select><p class="muted">${d.evidence?.length?'依据：'+d.evidence.map(esc).join('；'):esc(d.assumption||'缺少相关信息')}${d.source==='rule'?'（按每周可投入时间计算）':''}</p></div>`).join('')}</form><p class="microcopy">评估来源：${esc(g.source==='llm'?'本地模型 '+(g.model||''):'规则估算（模型未返回有效结果）')}</p>`,`<button class="btn outline" data-action="close">取消</button><button class="btn" data-action="pj-confirm">确认并生成推演</button>`,true);
 }
 async function start(){
  if(!localStorage.getItem(FIRST_USE_KEY)){await ensureParams();modal('人生推演',`<p class="pj-first">${esc(st.params?.firstUseNotice||'人生推演是基于你所给条件的AI模拟，不是算命，不承诺结果。')}</p>`,`<button class="btn" data-action="pj-first-ok">我知道了</button>`);return;}
  const profile=getProfile();if(!profile?.goal){toast('请先完成角色卡并确认目标');return;}
  st.loading='正在生成差距评估…';render();
  try{await ensureParams();const d=await api('/api/projection/gap',{profile},120000);
   if(d.mode==='crisis_hold'){st.crisis=d.crisis;st.loading='';render();return;}
   st.gap=d.gap;if(d.dimLabels){st.params=st.params||{};st.params.dimLabels={...(st.params.dimLabels||{}),...d.dimLabels};}st.loading='';render();confirmModal();
  }catch(e){st.loading='';render();toast(friendlyErr(e));}
 }
 async function confirm(){
  const levels={};document.querySelectorAll('#pj-gap-form select').forEach(s=>levels[s.name]=Number(s.value));
  close();st.loading='正在生成推演…';render();
  try{
   /* 单请求 confirm+skeleton，减少预览隧道往返（隧道偶发 EMPTY_RESPONSE / Content-Length 错配） */
   const c=await api('/api/projection/gap/confirm',{gapId:st.gap.id,levels,generate:true,...planHandoff()},45000);
   st.gap=c.gap;if(c.dimLabels){st.params=st.params||{};st.params.dimLabels={...(st.params.dimLabels||{}),...c.dimLabels};}
   if(c.projection){st.proj=c.projection;}
   else{const s=await api('/api/projection/skeleton',{gapId:c.gap.id,...planHandoff()},30000);st.proj=s.projection;}
   st.loading='';render();window.scrollTo(0,0);
  }catch(e){st.loading='';render();toast(friendlyErr(e));}
 }
 function handle(a,v){
  if(a==='pj-start')start();
  else if(a==='pj-first-ok'){localStorage.setItem(FIRST_USE_KEY,'1');close();start();}
  else if(a==='pj-confirm')confirm();
  else if(a==='pj-share'){st.share=!st.share;render();}
  else if(a==='pj-crisis-back'){st.crisis=null;render();}
  else if(a==='pj-log'){const [taskId,nodeId,status]=String(v).split('|');api('/api/projection/log',{taskId,nodeId,status}).then(()=>{toast('已记录');loadLatest();}).catch(e=>toast(e.message));}
  else if(a==='pj-pause'){ensureParams().then(P=>{const R=P?.actualLine?.pauseReasons||[];modal('有原因暂停',`<p class="microcopy">暂停期间不计入实际线的时间差。请选择原因：</p><form id="pj-pause-form">${R.map((r,i)=>`<label class="pj-radio"><input type="radio" name="reason" value="${esc(r.key)}" ${i===0?'checked':''}> ${esc(r.label)}</label>`).join('')}<label>暂停天数 <select name="days">${[1,3,7,14,30].map(d=>`<option value="${d}" ${d===7?'selected':''}>${d} 天</option>`).join('')}</select></label></form>`,`<button class="btn outline" data-action="close">取消</button><button class="btn" data-action="pj-pause-ok">确认暂停</button>`,true);});}
  else if(a==='pj-pause-ok'){const f=document.getElementById('pj-pause-form');const reason=f?.querySelector('input[name=reason]:checked')?.value;const days=Number(f?.querySelector('select[name=days]')?.value||7);close();api('/api/projection/log',{status:'paused',pauseReason:reason,pauseDays:days}).then(()=>{toast('已记录暂停');loadLatest();}).catch(e=>toast(e.message));}
  else if(a==='pj-demo'){st.demoLoading='正在生成演示数据…';render();ensureParams().then(()=>api('/api/projection/demo/actual',{scenario:v,days:28},30000)).then(d=>{st.demo=d.projection;st.demoWeekly=d.weeklyReport||null;st.demoLoading='';render();window.scrollTo(0,0);}).catch(e=>{st.demoLoading='';render();toast(friendlyErr(e));});}
  else if(a==='pj-story-gen')storyGenerate(v==='force');
  else if(a==='pj-story-ok')storyPost('/api/projection/story/confirm',{draftId:v,accept:true}).then(d=>d?.accepted&&toast('已写入故事，并保留了上一版'));
  else if(a==='pj-story-no')storyPost('/api/projection/story/confirm',{draftId:v,accept:false});
  else if(a==='pj-story-cont')storyContinue(v);
  else if(a==='pj-demo-exit'){st.demo=null;st.demoWeekly=null;render();}
  else if(a==='pj-weekly'){st.weeklyLoading=true;render();api('/api/projection/weekly-report',{},20000).then(d=>{st.weekly={gate:d.gate,report:d.report};toast('周报已生成');}).catch(e=>{if(e.code==='WEEKLY_NOT_READY'){st.weekly={...(st.weekly||{}),gate:{met:false,text:e.message}};}else toast(friendlyErr(e));}).finally(()=>{st.weeklyLoading=false;render();});}
  else return false;
  return true;
 }
 return {page,handle,reset(){st.loaded=false;st.proj=null;st.gap=null;st.crisis=null;st.error='';st.code='';}};
}
