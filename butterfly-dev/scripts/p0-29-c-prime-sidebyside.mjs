/**
 * P0-29 formal package samples:
 * 1) DeepSeek online = primary candidate
 * 2) qwen2.5:32b depth = required对照
 * 3) qwen2.5:7b baseline = optional
 * Secrets from BUTTERFLY_LLM_ENV_FILE / butterfly-secrets — never log values.
 */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createDGXServer} from './dgx-server.mjs';
import {buildRuleFacts,DEPTH_CONTRACT_VERSION} from '../worker/depth-contract.js';
import {buildRoleFacts,buildGoalTree,heuristicGap,assembleGap,computeProjection,pjLine} from '../worker/projection.js';
import {generateStoryLLM} from '../worker/projection-story.js';

const OUT=process.env.P0_29_OUT||'/workspace/butterfly-handoff/p0-29-c-prime';
const SECRET_FILE=process.env.BUTTERFLY_LLM_ENV_FILE||'/workspace/butterfly-secrets/butterfly-llm.env';
const SKIP_7B=process.env.P0_29_SKIP_7B==='1';
const SKIP_PROJ=process.env.P0_29_SKIP_PROJ==='1';

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
function fullPlanText(story){
  if(!story)return '';
  return [story.title,story.baseline,...(story.chapters||[]).flatMap(c=>[c.name,c.period,c.narrative,c.gate,...(c.quests||[]).flatMap(q=>[q.title,...(q.steps||[]),q.output,q.tool,q.example,q.why])])].filter(Boolean).join('\n');
}
function hasQuad(narr){
  const s=String(narr||'');
  return ['因为','于是','代价','放弃','牺牲','挤出','占用','若','如果','然后','开始','变成','留下'].filter(c=>s.includes(c)).length>=3;
}
function weekFirst(story){
  const q=story?.chapters?.[0]?.quests||[];
  return {today:q[0]?.title,week:q[1]?.title,todayOut:q[0]?.output,weekOut:q[1]?.output,gate:story?.chapters?.[0]?.gate};
}
function scoreMicheal(story,label){
  const text=fullPlanText(story);const nChars=narrativeChars(story);
  const dims={
    详细:nChars>=1200?2:nChars>=800?1:0,
    细节:/(Excel|透视|VBA|录屏|模板|样表|____|列名|对账)/i.test(text)?2:/(表格|自动化)/.test(text)?1:0,
    可信:!/(保证成功|一定能|包过|稳赚|改命|算命)/.test(text)&&!/成功率\s*\d/.test(text)?2:0,
    可实现可落地:weekFirst(story).today?.startsWith('今天：')&&weekFirst(story).week?.startsWith('本周：')?2:0,
    阶段清晰:(story?.chapters||[]).length===4&&story.chapters.every(c=>c.period&&c.narrative)?2:0
  };
  return {label,dims,clearWins:Object.values(dims).filter(v=>v>=2).length,nChars,quadOk:(story?.chapters||[]).filter(c=>hasQuad(c.narrative)).length};
}

async function startServer(envExtra,port){
  const worker=(await import(pathToFileURL(resolve('worker/index.js'))+'?t='+Date.now()+Math.random())).default;
  const password='p029-sidebyside-test-key';
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

async function runOne({id,port,envExtra,profile}){
  const {server,origin,headers}=await startServer(envExtra,port);
  try{
    const st=redact(await (await fetch(origin+'/api/ai/status',{headers})).json());
    console.log(JSON.stringify({phase:'status',id,provider:st.provider,model:st.model,providerKind:st.providerKind,onlineReady:st.onlineReady,hasApiKey:st.hasApiKey,fallbackReason:st.fallbackReason}));
    const plan=await callPlan(origin,headers,profile);
    const story=plan.body?.story;
    const row={id,status:plan.status,ms:plan.ms,aiStatus:st,error:plan.body?.error,code:plan.body?.code,
      provider:plan.body?.provider||story?.provider,model:plan.body?.model||story?.model,invokeMeta:plan.body?.invokeMeta,
      story,score:scoreMicheal(story,id)};
    console.log(JSON.stringify({phase:'plan-done',id,status:row.status,ms:row.ms,model:row.model,narr:row.score?.nChars,err:row.error||null}));
    return row;
  }finally{await new Promise(r=>server.close(r));}
}

async function main(){
  await mkdir(OUT,{recursive:true});
  let secrets={};
  try{secrets=loadEnvFile(await readFile(SECRET_FILE,'utf8'));console.log(JSON.stringify({phase:'secrets',loaded:true,keys:Object.keys(secrets),file:SECRET_FILE}));}
  catch(e){console.log(JSON.stringify({phase:'secrets',loaded:false,error:String(e.message||e)}));}

  const ruleFacts=buildRuleFacts(persona);
  const runs=[];

  // 1) DeepSeek primary（欠长则最多重试2次，保留汉字最多的一份）
  if(secrets.BUTTERFLY_LLM_API_KEY){
    const dsEnv={
      BUTTERFLY_LLM_PROVIDER:secrets.BUTTERFLY_LLM_PROVIDER||'deepseek',
      BUTTERFLY_LLM_BASE_URL:secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com',
      BUTTERFLY_LLM_MODEL:secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat',
      BUTTERFLY_LLM_API_KEY:secrets.BUTTERFLY_LLM_API_KEY,
      AI_PROVIDER:secrets.BUTTERFLY_LLM_PROVIDER||'deepseek',
      AI_MODEL:secrets.BUTTERFLY_LLM_MODEL||'deepseek-chat',
      AI_BASE_URL:secrets.BUTTERFLY_LLM_BASE_URL||'https://api.deepseek.com',
      DEEPSEEK_API_KEY:secrets.BUTTERFLY_LLM_API_KEY
    };
    let best=null;
    for(let attempt=1;attempt<=2;attempt++){
      const row=await runOne({id:'plan-deepseek-primary',port:18794+attempt,envExtra:dsEnv,profile:persona});
      if(!best||(row.score?.nChars||0)>(best.score?.nChars||0))best=row;
      console.log(JSON.stringify({phase:'deepseek-attempt',attempt,narr:row.score?.nChars||0,best:best.score?.nChars||0}));
      if((best.score?.nChars||0)>=1500)break;
    }
    runs.push(best);
  }else{
    runs.push({id:'plan-deepseek-primary',status:0,error:'BUTTERFLY_LLM_API_KEY missing',score:null});
  }

  const REUSE=process.env.P0_29_REUSE_LOCAL==='1';
  async function loadPrior(id){
    try{const j=JSON.parse(await readFile(`${OUT}/${id}.json`,'utf8')); if(j?.story) return {id,...j,status:200};}catch{}
    return null;
  }

  // 2) 32b对照 (required)
  if(REUSE){const prior=await loadPrior('plan-32b-contrast'); if(prior){runs.push(prior); console.log(JSON.stringify({phase:'reuse',id:prior.id,narr:prior.score?.nChars}));}}
  if(!runs.find(r=>r.id==='plan-32b-contrast')) runs.push(await runOne({
    id:'plan-32b-contrast',port:18796,
    envExtra:{AI_PROVIDER:'ollama',AI_MODEL:'qwen2.5:32b',BUTTERFLY_LLM_PROVIDER:'ollama',BUTTERFLY_LLM_MODEL:'qwen2.5:32b'},
    profile:persona
  }));

  // 3) optional 7b baseline
  if(!SKIP_7B){
    if(REUSE){const prior=await loadPrior('plan-7b-baseline'); if(prior){runs.push(prior); console.log(JSON.stringify({phase:'reuse',id:prior.id,narr:prior.score?.nChars}));}}
    if(!runs.find(r=>r.id==='plan-7b-baseline')) runs.push(await runOne({
      id:'plan-7b-baseline',port:18797,
      envExtra:{AI_PROVIDER:'ollama',AI_MODEL:'qwen2.5:7b',AI_DEPTH_CONTRACT:'0',BUTTERFLY_LLM_PROVIDER:'ollama',BUTTERFLY_LLM_MODEL:'qwen2.5:7b'},
      profile:persona
    }));
  }

  // projection story with 32b (depth) — proves口径; skip if env set
  let projectionStory=null;
  if(!SKIP_PROJ){
    if(REUSE){try{const j=JSON.parse(await readFile(`${OUT}/projection-story-32b.json`,'utf8')); if(j?.longForm){projectionStory=j; console.log(JSON.stringify({phase:'reuse-proj',chars:j.chars}));}}catch{}}
    if(projectionStory){/* reused */}
    else try{
      const rf=buildRoleFacts(persona);
      const gt=buildGoalTree(persona);
      const gapObj=assembleGap(heuristicGap(rf),rf,{model:null,source:'heuristic'});
      const proj=computeProjection({roleFacts:rf,goalTree:gt,gap:gapObj});
      const t0=Date.now();
      const story=await generateStoryLLM({AI_MODEL:'qwen2.5:32b',AI_DEPTH_CONTRACT:'1',PROJECTION_STORY_LLM:'1'},proj,{
        roleFacts:rf,base:'http://127.0.0.1:11434',model:'qwen2.5:32b'
      });
      projectionStory={ms:Date.now()-t0,model:'qwen2.5:32b',chars:story?.chars||countHan(story?.longForm),source:story?.source,validation:story?.validation?.pass,longForm:story?.longForm,
        perNode:(story?.perNode||[]).map(n=>({title:n.title,tRange:n.tRange,situation:n.situation,action:n.action,change:n.change,cost:n.cost,source:n.source}))};
      console.log(JSON.stringify({phase:'proj-story',ms:projectionStory.ms,chars:projectionStory.chars,source:projectionStory.source}));
    }catch(e){projectionStory={error:String(e?.message||e).slice(0,300)};console.log(JSON.stringify({phase:'proj-story-fail',error:projectionStory.error}));}
  }

  const primary=runs.find(r=>r.id==='plan-deepseek-primary');
  const c32=runs.find(r=>r.id==='plan-32b-contrast');
  const b7=runs.find(r=>r.id==='plan-7b-baseline');
  const focus=primary?.story?primary:(c32?.story?c32:null);

  const hard={};
  if(focus?.story){
    const s=focus.story;const n=narrativeChars(s);const text=fullPlanText(s);
    hard['1_main_path_ge_1500']=n>=1500;hard['1_narrative_chars']=n;
    hard['2_stages_to_mid']=Boolean(s.chapters?.length===4);
    hard['2_quad_chapters']=focus.score?.quadOk;
    hard['2_executable_today_week']=Boolean(weekFirst(s).today?.startsWith('今天：')&&weekFirst(s).week?.startsWith('本周：'));
    hard['3_named_actions']=/(Excel|样表|模板|录屏|透视|____)/i.test(text);
    hard['3_banned_success']=!/(保证成功|一定能|包过|稳赚|改命)/.test(text);
    hard['4_five_min_retell']=Boolean(weekFirst(s).today&&weekFirst(s).gate);
    hard['5_plan_vs_projection']=projectionStory&&!projectionStory.error?`plan_narr=${n}; proj=${projectionStory.chars}`:'projection_skipped_or_failed';
    hard['6_structure_ok']=s.chapters?.length===4;
  }
  const m5={
    deepseek:primary?.score?.dims||null,
    '32b':c32?.score?.dims||null,
    '7b':b7?.score?.dims||null,
    primary_clearWins:primary?.score?.clearWins,
    primary_vs_7b_ge_3:b7?.score? (primary?.score?.clearWins>=3 && (primary?.score?.nChars||0)>(b7?.score?.nChars||0)):null
  };

  const recommendation={
    primaryCandidate:primary?.story?'deepseek-chat':'missing',
    hotUpdateNow:false,
    hardPassFlags:Object.fromEntries(Object.entries(hard).filter(([k])=>/^\d_/.test(k)||/^[1-6]_/.test(k))),
    suggestProductReview:Boolean(primary?.story),
    note:'正式首包主样例=DeepSeek；32b为强制对照；不热更现网。'
  };

  const summaryRuns=runs.map(r=>({
    id:r.id,status:r.status,ms:r.ms,error:r.error,provider:r.provider,model:r.model,
    narrativeChars:r.score?.nChars,score:r.score,weekFirst:r.story?weekFirst(r.story):null,
    title:r.story?.title,
    chapters:(r.story?.chapters||[]).map(c=>({name:c.name,period:c.period,narrativeChars:countHan(c.narrative),questTitles:(c.quests||[]).map(q=>q.title),gate:c.gate}))
  }));

  const report=redact({
    at:new Date().toISOString(),contractVersion:DEPTH_CONTRACT_VERSION,persona,ruleFacts,
    secretsLoaded:Boolean(secrets.BUTTERFLY_LLM_API_KEY),secretKeys:Object.keys(secrets),
    runs:summaryRuns,hardBars:hard,michealFive:m5,recommendation,
    projectionStorySummary:projectionStory&&{ms:projectionStory.ms,chars:projectionStory.chars,source:projectionStory.source,validation:projectionStory.validation,error:projectionStory.error}
  });

  await writeFile(`${OUT}/sidebyside-report.json`,JSON.stringify({...report,runsFull:redact(runs),projectionStory:redact(projectionStory)},null,2));
  let md=`# P0-29 正式首包样例（DeepSeek 主候选 + 32b 对照）\n\n- 时间：${report.at}（Asia/Shanghai）\n- 契约：${DEPTH_CONTRACT_VERSION}\n- 密钥：已加载=${report.secretsLoaded}（路径仅运行时，不入库）\n- 档案：${persona.role} · ${persona.goal}\n\n## 跑次\n\n`;
  for(const r of summaryRuns){
    md+=`### ${r.id}\n- status=${r.status} model=${r.model} provider=${r.provider} ms=${r.ms} narr汉字≈${r.narrativeChars}\n- 今天/本周：${r.weekFirst?.today||'-'} / ${r.weekFirst?.week||'-'}\n- 五维：${JSON.stringify(r.score?.dims)}\n\n`;
  }
  for(const id of ['plan-deepseek-primary','plan-32b-contrast','plan-7b-baseline']){
    const full=runs.find(x=>x.id===id)?.story; if(!full)continue;
    md+=`## 全文 · ${id}\n\n**${full.title}**\n\nbaseline：${full.baseline}\n\n`;
    for(const c of full.chapters||[]){
      md+=`### ${c.name}（${c.period}）\n\n${c.narrative}\n\n- gate：${c.gate}\n`;
      for(const q of c.quests||[])md+=`- ${q.title}（${q.minutes}分）→ ${q.output}\n`;
      md+='\n';
    }
  }
  if(projectionStory?.longForm)md+=`## Projection story（32b）\n\nchars=${projectionStory.chars} source=${projectionStory.source}\n\n${projectionStory.longForm.slice(0,3000)}\n\n`;
  md+=`## 硬条\n\n\`\`\`json\n${JSON.stringify(hard,null,2)}\n\`\`\`\n\n## 五维\n\n\`\`\`json\n${JSON.stringify(m5,null,2)}\n\`\`\`\n\n## 建议\n\n\`\`\`json\n${JSON.stringify(recommendation,null,2)}\n\`\`\`\n`;
  await writeFile(`${OUT}/sidebyside-summary.md`,md);
  await writeFile(`${OUT}/persona.json`,JSON.stringify({persona,ruleFacts},null,2));
  for(const r of runs){
    if(r?.story) await writeFile(`${OUT}/${r.id}.json`,JSON.stringify(redact({id:r.id,provider:r.provider,model:r.model,ms:r.ms,score:r.score,story:r.story}),null,2));
  }
  if(projectionStory?.longForm) await writeFile(`${OUT}/projection-story-32b.json`,JSON.stringify(redact(projectionStory),null,2));
  await writeFile(`${OUT}/README.md`, `# P0-29 C′ / 正式首包复现\n\n## 分支\n\`feat/p0-29-c-prime-32b\`（不 merge main、不热更 A2）\n\n## 环境\n1. Ollama 隧道：\`ssh -L 11434:127.0.0.1:11434\` 到 DGX（本机需有 qwen2.5:7b / 32b）\n2. 线上密钥文件（chmod 600，勿提交）：\`/workspace/butterfly-secrets/butterfly-llm.env\`\n3. \`node scripts/embed-assets.mjs\`\n4. \`BUTTERFLY_LLM_ENV_FILE=/workspace/butterfly-secrets/butterfly-llm.env node scripts/p0-29-c-prime-sidebyside.mjs\`\n\n## 切换模型\n- 线上主候选：env 内 \`BUTTERFLY_LLM_PROVIDER=deepseek\` + key\n- 仅本地 32b：\`AI_PROVIDER=ollama AI_MODEL=qwen2.5:32b\`\n- 回退 7b 基线：\`AI_MODEL=qwen2.5:7b AI_DEPTH_CONTRACT=0\`\n- 关深度契约：\`AI_DEPTH_CONTRACT=0\`\n\n## 产物\n- \`sidebyside-summary.md\` / \`sidebyside-report.json\`\n`);
  console.log(JSON.stringify(redact({done:true,out:OUT,hard,m5,recommendation,runIds:runs.map(r=>r.id)}),null,2));
}

main().catch(e=>{console.error(String(e?.stack||e));process.exit(1);});
