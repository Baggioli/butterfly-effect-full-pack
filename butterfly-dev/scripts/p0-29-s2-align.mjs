/**
 * P0-29 S2-align：热更前极小对齐样例
 * - 近端以 plan 为权威同源：projection 复用同一对 nearTerm（字面一致）
 * - 用户可见产物不暴露 rawProjectionHorizon（行动线 raw 仅内部记录）
 * - DeepSeek plan + DeepSeek projection（同契约）
 * 密钥仅运行时读取，不入库、不打印明文。
 */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createDGXServer} from './dgx-server.mjs';
import {buildRuleFacts,DEPTH_CONTRACT_VERSION,chapterHasExplicitQuad,extractQuadFromText,nearTermFromPlanStory} from '../worker/depth-contract.js';
import {buildRoleFacts,buildGoalTree,heuristicGap,assembleGap,computeProjection,pjLine} from '../worker/projection.js';
import {generateStoryLLM} from '../worker/projection-story.js';

const OUT=process.env.P0_29_OUT||'/workspace/butterfly-handoff/p0-29-c-prime/s2-align';
const SECRET_FILE=process.env.BUTTERFLY_LLM_ENV_FILE||'/workspace/butterfly-secrets/butterfly-llm.env';

const persona={
  name:'虚构便利店试单甲',age:'22',education:'高中 / 中专',role:'便利店店员',
  experience:'没有编程经验，刚开始学习Excel',skills:'基础录入',
  resources:'只有个人电脑，没有客户联系人',budget:0,hours:4,
  goal:'90天内完成一个Excel表格自动化服务的付费试单',
  constraints:'不辞职，不购买课程，不编造收入与客户',
  longGoal:'用表格自动化技能接稳定小单'
};

function loadEnvFile(text){
  const out={};
  for(const line of String(text||'').split(/\r?\n/)){
    const t=line.trim();if(!t||t.startsWith('#'))continue;
    const i=t.indexOf('=');if(i<1)continue;
    out[t.slice(0,i).trim()]=t.slice(i+1).trim();
  }
  return out;
}
function redact(obj){
  const s=JSON.stringify(obj,(k,v)=>{
    if(/key|secret|token|password|authorization/i.test(String(k))&&typeof v==='string'&&v)return `<redacted len=${v.length}>`;
    if(typeof v==='string'&&/^sk-/.test(v))return `<redacted len=${v.length}>`;
    return v;
  });
  return JSON.parse(s);
}
function countHan(s){return Array.from(String(s||'')).filter(ch=>/\p{Script=Han}/u.test(ch)).length;}
function narrativeChars(story){return (story?.chapters||[]).reduce((n,c)=>n+countHan(c.narrative||''),0);}
function weekFirst(story){
  const q=story?.chapters?.[0]?.quests||[];
  return {today:q[0]?.title,week:q[1]?.title,todayOut:q[0]?.output,weekOut:q[1]?.output,gate:story?.chapters?.[0]?.gate};
}
function chapterQuadReport(c){
  const explicit=chapterHasExplicitQuad(c);
  const fromLabel=extractQuadFromText(c?.narrative||'');
  return {
    explicit,
    hasFields:['situation','action','change','cost'].every(k=>String(c?.[k]||'').trim().length>=8),
    fieldChars:Object.fromEntries(['situation','action','change','cost'].map(k=>[k,countHan(c?.[k]||fromLabel?.[k]||'')])),
    narrativeHasLabels:!!fromLabel
  };
}

async function startServer(envExtra,port){
  const worker=(await import(pathToFileURL(resolve('worker/index.js'))+'?t='+Date.now()+Math.random())).default;
  const password='p029-s2-test-key';
  const env={
    DGX_APP_PASSWORD:password,DGX_APP_PORT:String(port),
    OLLAMA_BASE_URL:'http://127.0.0.1:11434',
    AI_DEPTH_CONTRACT:'1',
    AI_FALLBACK_MODELS:'qwen2.5:32b,qwen2.5:7b',
    ...envExtra
  };
  const server=createDGXServer(worker,env);
  await new Promise((res,rej)=>{server.once('error',rej);server.listen(port,'127.0.0.1',res);});
  const origin=`http://127.0.0.1:${port}`;
  const headers={Authorization:'Basic '+Buffer.from('owner:'+password).toString('base64'),Origin:origin,'Content-Type':'application/json'};
  return {server,origin,headers};
}

async function callPlan(origin,headers,profile){
  const t0=Date.now();
  const r=await fetch(origin+'/api/ai',{method:'POST',headers,body:JSON.stringify({mode:'plan',profile})});
  const body=await r.json();
  return {status:r.status,ms:Date.now()-t0,body:redact(body)};
}

async function main(){
  await mkdir(OUT,{recursive:true});
  let secrets={};
  try{secrets=loadEnvFile(await readFile(SECRET_FILE,'utf8'));console.log(JSON.stringify({phase:'secrets',loaded:true,keys:Object.keys(secrets)}));}
  catch(e){console.log(JSON.stringify({phase:'secrets',loaded:false,error:String(e.message||e)}));process.exit(2);}

  if(!secrets.BUTTERFLY_LLM_API_KEY){console.error('missing key');process.exit(2);}
  const ruleFacts=buildRuleFacts(persona);
  const dsEnv={
    BUTTERFLY_LLM_PROVIDER:secrets.BUTTERFLY_LLM_PROVIDER||'deepseek',
    BUTTERFLY_LLM_BASE_URL:secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com',
    BUTTERFLY_LLM_MODEL:secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat',
    BUTTERFLY_LLM_API_KEY:secrets.BUTTERFLY_LLM_API_KEY,
    AI_PROVIDER:secrets.BUTTERFLY_LLM_PROVIDER||'deepseek',
    AI_MODEL:secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat',
    AI_BASE_URL:secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com',
    DEEPSEEK_API_KEY:secrets.BUTTERFLY_LLM_API_KEY,
    AI_DEPTH_CONTRACT:'1'
  };

  // 1) DeepSeek plan
  let planRow=null;
  for(let attempt=1;attempt<=2;attempt++){
    const {server,origin,headers}=await startServer(dsEnv,18810+attempt);
    try{
      const st=redact(await (await fetch(origin+'/api/ai/status',{headers})).json());
      console.log(JSON.stringify({phase:'status',attempt,provider:st.provider,model:st.model,providerKind:st.providerKind,depthVersion:st.depthVersion}));
      const plan=await callPlan(origin,headers,persona);
      const story=plan.body?.story;
      const row={id:'plan-deepseek-s2',attempt,status:plan.status,ms:plan.ms,aiStatus:st,error:plan.body?.error,
        provider:plan.body?.provider||story?.provider,model:plan.body?.model||story?.model,invokeMeta:plan.body?.invokeMeta,
        story,narr:narrativeChars(story),quadExplicit:story?.quadExplicit??(story?.chapters||[]).every(c=>chapterHasExplicitQuad(c)),
        chapterQuads:(story?.chapters||[]).map(chapterQuadReport),weekFirst:weekFirst(story)};
      console.log(JSON.stringify({phase:'plan-done',attempt,status:row.status,ms:row.ms,narr:row.narr,quadExplicit:row.quadExplicit,err:row.error||null}));
      if(!planRow||(row.narr||0)>(planRow.narr||0))planRow=row;
      if((planRow.narr||0)>=1500&&planRow.quadExplicit)break;
    }finally{await new Promise(r=>server.close(r));}
  }

  // 2) DeepSeek projection — nearTerm 以 plan 为权威同源
  const planStory=planRow?.story;
  const planNear=nearTermFromPlanStory(planStory);
  if(!planNear){console.error(JSON.stringify({phase:'align-fail',reason:'plan_nearTerm_missing',weekFirst:weekFirst(planStory)}));process.exit(3);}
  console.log(JSON.stringify({phase:'plan-nearTerm',today:planNear.today.title,week:planNear.week.title}));

  const rf=buildRoleFacts(persona);
  const gt=buildGoalTree(persona);
  const gapObj=assembleGap(heuristicGap(rf),rf,{model:null,source:'heuristic'});
  const proj=computeProjection({roleFacts:rf,goalTree:gt,gap:gapObj});
  const rawHorizonInternal=pjLine(proj)?.horizon; // 行动线算法 raw，仅内部；不进用户可见产物
  const t0=Date.now();
  const projStory=await generateStoryLLM({...dsEnv,AI_DEPTH_CONTRACT:'1',PROJECTION_STORY_LLM:'1',__ruleFacts:ruleFacts},proj,{
    roleFacts:rf,profile:persona,base:'http://127.0.0.1:11434',model:dsEnv.BUTTERFLY_LLM_MODEL,
    authoritativeNearTerm:planNear,planStory
  });
  // 用户可见投影产物：剥离 rawProjectionHorizon / 任意 hi>rule 暴露
  const projectionUser={
    ms:Date.now()-t0,
    provider:projStory.provider,providerKind:projStory.providerKind,model:projStory.model,
    source:projStory.source,chars:projStory.chars,validation:projStory.validation?.pass,
    depth:projStory.depth,depthVersion:projStory.depthVersion,depthSpine:projStory.depthSpine,
    ruleHorizonWeeks:projStory.ruleHorizonWeeks,
    nearTerm:projStory.nearTerm,
    nearTermSource:projStory.nearTermSource,
    perNode:(projStory.perNode||[]).map(n=>({nodeId:n.nodeId,title:n.title,tRange:n.tRange,depthStage:n.depthStage,source:n.source,
      situation:n.situation,action:n.action,change:n.change,cost:n.cost,
      fieldChars:{situation:countHan(n.situation),action:countHan(n.action),change:countHan(n.change),cost:countHan(n.cost)}})),
    longForm:projStory.longForm,
    attempts:projStory.attempts
  };
  console.log(JSON.stringify({phase:'proj-done',ms:projectionUser.ms,chars:projectionUser.chars,provider:projectionUser.provider,nodes:projectionUser.perNode.length,
    maxHi:Math.max(0,...projectionUser.perNode.map(n=>n.tRange?.hi||0)),ruleHorizonWeeks:projectionUser.ruleHorizonWeeks,
    nearTermSource:projectionUser.nearTermSource,
    nearTermMatch:projectionUser.nearTerm?.today?.title===planNear.today.title&&projectionUser.nearTerm?.week?.title===planNear.week.title,
    validation:projectionUser.validation}));

  // Self-check：硬条⑤/④对齐 + 无 raw40 暴露
  const planMaxWeekGuess=(()=>{
    const periods=(planStory?.chapters||[]).map(c=>String(c.period||'')).join(' ');
    const nums=[...periods.matchAll(/(\d+)/g)].map(m=>Number(m[1])).filter(n=>n>0&&n<=52);
    return nums.length?Math.max(...nums):null;
  })();
  const projMaxHi=Math.max(0,...(projectionUser.perNode||[]).map(n=>n.tRange?.hi||0));
  const planWF=weekFirst(planStory);
  const nearTermTitleEqual=Boolean(
    projectionUser.nearTerm?.today?.title===planNear.today.title&&
    projectionUser.nearTerm?.week?.title===planNear.week.title
  );
  const nearTermOutputEqual=Boolean(
    projectionUser.nearTerm?.today?.output===planNear.today.output&&
    projectionUser.nearTerm?.week?.output===planNear.week.output
  );
  const userVisibleBlob=JSON.stringify({plan:planRow&&{weekFirst:planWF,storyTitles:(planStory?.chapters||[]).map(c=>c.name)},projection:projectionUser});
  const userVisibleExposesRaw40=/rawProjectionHorizon/.test(userVisibleBlob)||/"hi"\s*:\s*40/.test(userVisibleBlob);
  const hard={
    '2_plan_quad_explicit':Boolean(planRow?.quadExplicit),
    '2_plan_quad_chapters':(planRow?.chapterQuads||[]).filter(q=>q.explicit).length,
    '5_same_provider':Boolean(String(planRow?.provider||'').toLowerCase().includes('deepseek')&&String(projectionUser.provider||'').toLowerCase().includes('deepseek')),
    '5_plan_provider':planRow?.provider||null,
    '5_proj_provider':projectionUser.provider||null,
    '5_same_depth_version':planStory?.depthVersion===projectionUser.depthVersion||projectionUser.depthVersion===DEPTH_CONTRACT_VERSION,
    '5_proj_within_rule_weeks':projMaxHi>0&&projMaxHi<=(ruleFacts.deadlineWeeks||13),
    '5_proj_node_count_4':(projectionUser.perNode||[]).length===4,
    '5_proj_has_near_term':Boolean(projectionUser.nearTerm?.today?.title?.startsWith?.('今天：')&&projectionUser.nearTerm?.week?.title?.startsWith?.('本周：')),
    '5_plan_has_near_term':Boolean(planWF.today?.startsWith('今天：')&&planWF.week?.startsWith('本周：')),
    '5_proj_quad_fields':(projectionUser.perNode||[]).every(n=>['situation','action','change','cost'].every(k=>countHan(n[k])>=30)),
    '4_nearTerm_title_equal':nearTermTitleEqual,
    '4_nearTerm_output_equal':nearTermOutputEqual,
    '4_nearTerm_source_plan':projectionUser.nearTermSource==='plan'||projectionUser.nearTermSource==='authoritative',
    'align_user_visible_no_raw40':!userVisibleExposesRaw40,
    '1_plan_narr_ge_1500':(planRow?.narr||0)>=1500,
    planNarr:planRow?.narr||0,
    projChars:projectionUser.chars||0,
    projMaxHi,
    ruleDeadlineWeeks:ruleFacts.deadlineWeeks,
    planPeriodMaxDigit:planMaxWeekGuess,
    planNearTerm:{today:planNear.today.title,week:planNear.week.title},
    projNearTerm:{today:projectionUser.nearTerm?.today?.title,week:projectionUser.nearTerm?.week?.title}
  };
  hard.pass5=hard['5_same_provider']&&hard['5_proj_within_rule_weeks']&&hard['5_proj_node_count_4']&&hard['5_proj_has_near_term']&&hard['5_plan_has_near_term']&&hard['5_proj_quad_fields'];
  hard.pass2=hard['2_plan_quad_explicit']&&hard['2_plan_quad_chapters']===4;
  hard.pass4_align=hard['4_nearTerm_title_equal']&&hard['4_nearTerm_output_equal']&&hard['4_nearTerm_source_plan'];
  hard.pass_raw_strip=hard['align_user_visible_no_raw40'];
  hard.readyForProductReview=Boolean(hard.pass5&&hard.pass2&&hard['1_plan_narr_ge_1500']&&hard.pass4_align&&hard.pass_raw_strip);

  const report=redact({
    at:new Date().toISOString(),
    contractVersion:DEPTH_CONTRACT_VERSION,
    alignVersion:'p0-29-s2-align-v1',
    persona,ruleFacts,
    plan:planRow&&{id:planRow.id,status:planRow.status,ms:planRow.ms,provider:planRow.provider,model:planRow.model,narr:planRow.narr,quadExplicit:planRow.quadExplicit,chapterQuads:planRow.chapterQuads,weekFirst:planRow.weekFirst,invokeMeta:planRow.invokeMeta},
    projection:redact({...projectionUser,longForm:undefined,attempts:projectionUser.attempts?.slice?.(-8)}),
    hard,
    internal:{note:'行动线算法 raw horizon，非用户可见产物',actionLineHorizonRaw:rawHorizonInternal}
  });

  await writeFile(`${OUT}/self-check.json`,JSON.stringify(report,null,2));
  if(planStory)await writeFile(`${OUT}/plan-deepseek-s2.json`,JSON.stringify(redact({...planRow,aiStatus:undefined}),null,2));
  await writeFile(`${OUT}/projection-deepseek-s2.json`,JSON.stringify(redact(projectionUser),null,2));

  let md=`# P0-29 S2-align 样例（近端同源 · 无 raw40 暴露）\n\n`;
  md+=`- 时间：${report.at}（请按 Asia/Shanghai 理解）\n- 契约：${DEPTH_CONTRACT_VERSION}\n- 对齐：p0-29-s2-align-v1\n- 档案：${persona.role} · ${persona.goal}\n- 规则周界：${ruleFacts.deadlineDays}天 / ${ruleFacts.deadlineWeeks}周\n\n`;
  md+=`## 自检（⑤同深 · ④近端同源 · raw 剥离）\n\n\`\`\`json\n${JSON.stringify(hard,null,2)}\n\`\`\`\n\n`;
  md+=`## 近端同源证明\n\n`;
  md+=`- plan 今天：${planNear.today.title}\n- proj 今天：${projectionUser.nearTerm?.today?.title}\n- 标题一致：${nearTermTitleEqual}\n`;
  md+=`- plan 本周：${planNear.week.title}\n- proj 本周：${projectionUser.nearTerm?.week?.title}\n`;
  md+=`- 产出一致：${nearTermOutputEqual}\n- nearTermSource：${projectionUser.nearTermSource}\n\n`;
  md+=`## Plan（DeepSeek）\n\n- narr汉字=${planRow?.narr} quadExplicit=${planRow?.quadExplicit} provider=${planRow?.provider} model=${planRow?.model}\n`;
  md+=`- 今天/本周：${planWF.today} / ${planWF.week}\n\n`;
  if(planStory){
    md+=`**${planStory.title}**\n\nbaseline：${planStory.baseline}\n\n`;
    for(const c of planStory.chapters||[]){
      md+=`### ${c.name}（${c.period}）\n\n`;
      md+=`- 四元显式：${chapterHasExplicitQuad(c)}\n`;
      if(c.situation)md+=`- 处境：${c.situation}\n- 行动：${c.action}\n- 变化：${c.change}\n- 代价：${c.cost}\n\n`;
      md+=`${c.narrative}\n\n- gate：${c.gate}\n`;
      for(const q of c.quests||[])md+=`- ${q.title} → ${q.output}\n`;
      md+='\n';
    }
  }
  md+=`## Projection（DeepSeek · depth spine · nearTerm←plan）\n\n`;
  md+=`- chars=${projectionUser.chars} provider=${projectionUser.provider} model=${projectionUser.model} nodes=${projectionUser.perNode.length} maxHi=${projMaxHi} ruleWeeks=${projectionUser.ruleHorizonWeeks}\n`;
  md+=`- nearTerm：${projectionUser.nearTerm?.today?.title} / ${projectionUser.nearTerm?.week?.title}\n`;
  md+=`- 用户可见含 rawProjectionHorizon：${userVisibleExposesRaw40}（须为 false）\n`;
  md+=`- 内部行动线 raw（不进用户产物）：${JSON.stringify(rawHorizonInternal)}\n\n`;
  for(const n of projectionUser.perNode||[]){
    md+=`### ${n.title}（第 ${n.tRange?.lo}–${n.tRange?.hi} 周）\n\n`;
    md+=`- 处境：${n.situation}\n- 行动：${n.action}\n- 变化：${n.change}\n- 代价：${n.cost}\n\n`;
  }
  if(projectionUser.longForm)md+=`### longForm\n\n${projectionUser.longForm}\n`;
  await writeFile(`${OUT}/sidebyside-summary.md`,md);

  await writeFile(`${OUT}/PRODUCT-NOTES.md`, `# P0-29 S2-align · 热更前极小对齐交核

- 分支：\`feat/p0-29-c-prime-32b\`（本刀本地 commit，未 push / 未 merge main / 未热更 A2）
- 契约：\`${DEPTH_CONTRACT_VERSION}\` · 对齐 \`p0-29-s2-align-v1\`
- 时间：${report.at}（Asia/Shanghai）
- 主样例：同次新鲜 **DeepSeek plan** + **DeepSeek projection**（nearTerm←plan）

## 对齐点

1. **近端同源**：推演 \`nearTerm\` 直接复用 plan 第一章今天/本周（\`nearTermSource=${projectionUser.nearTermSource}\`）；标题+产出字面一致。
2. **清 raw40**：用户可见 \`projection-deepseek-s2.json\` / plan 产物 **不含** \`rawProjectionHorizon\`；行动线 raw 仅在 \`self-check.json → internal\`。

## 自检

| 项 | 结果 |
|----|------|
| 硬条② plan 四元显式 | ${hard.pass2?'PASS':'FAIL'}（${hard['2_plan_quad_chapters']}/4） |
| 硬条⑤ 同 provider | ${hard['5_same_provider']}（plan=${hard['5_plan_provider']} / proj=${hard['5_proj_provider']}） |
| 硬条⑤ proj≤规则周界 | ${hard['5_proj_within_rule_weeks']}（maxHi=${projMaxHi} / ${ruleFacts.deadlineWeeks}） |
| 硬条⑤ 近端双侧 | plan=${hard['5_plan_has_near_term']} proj=${hard['5_proj_has_near_term']} |
| 硬条④ 近端字面同源 | titles=${hard['4_nearTerm_title_equal']} outputs=${hard['4_nearTerm_output_equal']} source=${hard['4_nearTerm_source_plan']} |
| 用户可见无 raw40 | ${hard['align_user_visible_no_raw40']} |
| 硬条① narr≥1500 | ${hard['1_plan_narr_ge_1500']}（${hard.planNarr}） |
| **可否再交产品核议热更** | **${hard.readyForProductReview?'YES':'NO — 见 self-check.json'}** |

## 产物

- \`plan-deepseek-s2.json\` / \`projection-deepseek-s2.json\`（用户可见，无 raw40）
- \`self-check.json\` / \`sidebyside-summary.md\`

## 边界

不热更、不 merge、不开 B、不动周边 UI、不催 Micheal、secrets 不进 git。
`);

  await writeFile(`${OUT}/README.md`, `# P0-29 S2-align 复现

\`\`\`bash
BUTTERFLY_LLM_ENV_FILE=/workspace/butterfly-secrets/butterfly-llm.env \\
  node scripts/p0-29-s2-align.mjs
\`\`\`

输出目录：\`${OUT}\`
`);

  console.log(JSON.stringify(redact({done:true,out:OUT,hard:{
    pass5:hard.pass5,pass2:hard.pass2,pass4_align:hard.pass4_align,pass_raw_strip:hard.pass_raw_strip,
    readyForProductReview:hard.readyForProductReview,
    nearTermTitleEqual,nearTermOutputEqual,userVisibleExposesRaw40
  }}),null,2));
}

main().catch(e=>{console.error(String(e?.stack||e));process.exit(1);});
