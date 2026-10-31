/* P0-14 详细故事版验收：合成人群 S1（长文 1500–3000 字）、S2（每节点四要素）、S3（R8 零命中）+ 数字锁定。
 * 离线：模板 + 模拟模型（合格输出 / 违规输出被拒并回落模板）。
 * 在线（可选）：STORY_LIVE=1 OLLAMA_BASE_URL=http://127.0.0.1:11434 AI_MODEL=qwen2.5:7b node scripts/test-projection-story.mjs */
import assert from 'node:assert/strict';
import * as E from '../worker/projection.js';
import {storyTemplate,storyValidate,generateStoryLLM,STORY_FIELDS,storyContinuationTemplate,storyValidateContinuation,storyRewriteDiff} from '../worker/projection-story.js';
import {PROJECTION_PARAMS as P} from '../worker/projection-params.js';
import {PERSONAS} from './projection-personas.mjs';
const IDS=(process.env.STORY_PERSONAS||'medium_1,salary_public_teacher').split(',');
const build=pe=>{const rf=E.buildRoleFacts(pe.profile),gt=E.buildGoalTree(pe.profile);const gap=E.confirmGap(E.assembleGap(E.heuristicGap(rf),rf,{}),pe.confirmLevels||{});return {rf,proj:E.computeProjection({roleFacts:rf,goalTree:gt,gap})};};
const line=(id,s)=>{const v=s.validation;return `${id.padEnd(22)} source=${String(s.source).padEnd(8)} chars=${s.chars} S1=${v.S1.pass} S2=${v.S2.pass} S3=${v.S3.pass} lock=${v.numberLock.pass}`;};
const ok=(s,id)=>{const v=s.validation;assert.ok(v.S1.pass,id+' S1 '+s.chars);assert.ok(v.S2.pass,id+' S2');assert.ok(v.S3.pass,id+' S3 '+JSON.stringify(v.S3.hits));assert.ok(v.numberLock.pass,id+' lock '+JSON.stringify(v.numberLock.issues));
 assert.ok(s.chars>=P.story.minChars&&s.chars<=P.story.maxChars);assert.equal(s.badge,P.aiBadge);assert.ok(s.summary&&s.summary.length<=P.story.summaryMaxChars,id+' summary');
 for(const n of s.perNode)for(const [k] of STORY_FIELDS)assert.ok(String(n[k]||'').length>=P.story.fieldMinChars,id+' '+n.nodeId+'.'+k);
 assert.ok(!/注定|命运/.test(s.summary+s.longForm),id+' 无注定/命运');};
// 1) 模板：所有非危机人群都要过
for(const pe of PERSONAS){const {rf,proj}=build(pe);if(proj.mode!=='normal'){assert.equal(proj.story,null);continue;}const s=storyTemplate(proj,{roleFacts:rf});ok(s,pe.id);if(IDS.includes(pe.id))console.log('[template] '+line(pe.id,s));
 // 节点周数/收入不被故事改动
 const before=JSON.stringify(proj.lines);storyValidate(s,proj,{roleFacts:rf});assert.equal(JSON.stringify(proj.lines),before);}
// 2) 篡改：改数字 / 绝对化 → 校验拒绝
{const {rf,proj}=build(PERSONAS.find(p=>p.id===IDS[0]));const s=structuredClone(storyTemplate(proj,{roleFacts:rf}));s.perNode[0].change='第 1–2 周就月入 99999 元';s.longForm+=s.perNode[0].change+'这是注定的';
 const v=storyValidate(s,proj,{roleFacts:rf});assert.equal(v.numberLock.pass,false,'改数字被拒');assert.equal(v.S3.pass,false,'绝对化被拒');assert.equal(v.pass,false);}
// 3) 模拟模型：合格输出 → llm；违规字段（数字/中文数字/注定）→ 回落模板
const pad='你按自己的节奏把这一段拆成很小的动作，每次只推进一件事，做完写下感受与问题，再根据反馈调整下一步，慢慢把零散的尝试整理成清楚的记录。';
const mock=(bad)=>async(url,init)=>{const u=String(url);if(u.endsWith('/api/show'))return new Response(JSON.stringify({details:{family:'qwen2'}}),{status:200});
 const out={situation:'眼下'+pad,action:'于是'+pad,change:bad?'三个月后收入翻倍，第 1–9 周注定成功':'渐渐地'+pad,cost:bad?'每月多花 500 元':'当然也要付出'+pad};
 return new Response(JSON.stringify({message:{content:JSON.stringify(out)},done_reason:'stop'}),{status:200});};
for(const id of IDS){const {rf,proj}=build(PERSONAS.find(p=>p.id===id));
 const prog=[];const good=await generateStoryLLM({AI_MODEL:'qwen2.5:7b'},proj,{roleFacts:rf,fetchImpl:mock(false),onProgress:p=>prog.push(p)});
 ok(good,id+' mock');assert.equal(good.source,'llm');assert.equal(prog.at(-1).done,prog.at(-1).total,'进度到满');console.log('[mock-ok]  '+line(id,good));
 const bad=await generateStoryLLM({AI_MODEL:'qwen2.5:7b'},proj,{roleFacts:rf,fetchImpl:mock(true)});ok(bad,id+' mock-bad');
 assert.ok(bad.perNode.every(n=>n.fieldSource.change==='template'&&n.fieldSource.cost==='template'),'违规字段回落模板');assert.ok(!/注定|翻倍|500/.test(bad.longForm));console.log('[mock-bad] '+line(id,bad));
 const off=await generateStoryLLM({PROJECTION_STORY_LLM:'0'},proj,{roleFacts:rf,fetchImpl:()=>{throw Error('不应外连');}});assert.equal(off.source,'template');}
// 4) 在线（可选）
if(process.env.STORY_LIVE==='1'){
 const env={AI_MODEL:process.env.AI_MODEL||'qwen2.5:7b',OLLAMA_BASE_URL:process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434'};
 for(const id of IDS){const {rf,proj}=build(PERSONAS.find(p=>p.id===id));const t0=Date.now();
  const s=await generateStoryLLM(env,proj,{roleFacts:rf,base:env.OLLAMA_BASE_URL,onProgress:p=>process.stdout.write(`  ${id} ${p.done}/${p.total}\r`)});
  ok(s,id+' live');const fs=s.perNode.flatMap(n=>Object.values(n.fieldSource||{}));
  console.log('[live]     '+line(id,s)+` llmFields=${fs.filter(x=>x==='llm').length}/${fs.length} ${((Date.now()-t0)/1000).toFixed(0)}s${s.fallbackReason?' fallback='+s.fallbackReason:''}`);
  if(process.env.STORY_DUMP)console.log(s.summary+'\n'+s.longForm);}
}
// P0-16 S4：每个非危机人群、每个节点的一幕续写 100–200 字、点名节点、R8=0、数字锁定；篡改被拒
let s4=0;for(const pe of PERSONAS){const {rf,proj}=build(pe);if(proj.mode!=='normal')continue;
 for(const n of E.pjLine(proj).nodes){const c=storyContinuationTemplate(proj,n.id,{roleFacts:rf});const v=storyValidateContinuation(c,proj,{roleFacts:rf});assert.ok(v.pass,pe.id+' '+n.id+' S4 '+JSON.stringify(v));s4++;
  assert.ok(!storyValidateContinuation({...c,text:c.text+'你注定会成功。'},proj,{roleFacts:rf}).pass,'S4 R8');
  assert.ok(!storyValidateContinuation({...c,text:c.text.replace(/第 \d+–\d+ 周/,'第 1–2 周')},proj,{roleFacts:rf}).pass||/第 1–2 周/.test(c.text),'S4 lock');}}
console.log(`[S4] 续写 ${s4} 段全部通过（100–200 字 / 点名节点 / R8=0 / 数字锁定）`);
{const {rf,proj}=build(PERSONAS.find(x=>x.id===IDS[0]));const a=storyTemplate(proj,{roleFacts:rf});const b={...a,perNode:a.perNode.map((n,i)=>i?n:{...n,change:n.change+'（改写）'})};
 const d=storyRewriteDiff(a,b);assert.equal(d.changed.length,1);assert.ok(d.text.includes('变化')&&d.text.includes('不变'));assert.equal(storyRewriteDiff(a,a).changed.length,0);}
console.log('通过：详细故事版 S1 长度 / S2 四要素 / S3 R8 零命中 / 数字锁定（模板、模拟模型合格与违规回落）+ S4 节点续写 + 改写差异摘要'+(process.env.STORY_LIVE==='1'?'（含在线模型）':'')+'。');
