// 生成 worker/projection-persona-table.js（版本化人群参数包，P01–P12）。
// 数据源：butterfly-pm/persona_param_sources.csv（权威，节点时长系数 + 差距权重）+ persona_source_ledger.csv（台账条数/引用键）。
// 用法：node scripts/build-persona-table.mjs [persona_param_sources.csv] [persona_source_ledger.csv]
// 规则：节点时长系数、差距权重为产品初设（calibration=示例校准，内部标记，不得展示）；其余无数据字段回落通用包。
// 「收入斜率」= 同源 P75÷P25 带宽比，仅存 metadata，不作工龄涨幅，规则层收入仍走 INCOME_TABLE。
import fs from 'node:fs';
import crypto from 'node:crypto';
import {parseCSV} from './income-params-lib.mjs';
const src=process.argv[2]||'/workspace/butterfly-pm/persona_param_sources.csv';
const ledgerSrc=process.argv[3]||'/workspace/butterfly-pm/persona_source_ledger.csv';
const raw=fs.readFileSync(src,'utf8').replace(/^\uFEFF/,'');
const rows=parseCSV(raw).filter(r=>r.some(c=>String(c).trim()));
const H=rows[0].map(h=>h.trim());
const col=name=>{const i=H.findIndex(h=>h.startsWith(name));if(i<0)throw Error('缺少列：'+name);return i;};
const C={id:col('PersonaKey'),name:col('人群名称'),age:col('年龄段'),edu:col('学历'),occ:col('职业大类'),city:col('城市线级'),hours:col('周投入'),change:col('是否转行'),civil:col('是否体制内目标'),status:col('状态'),prio:col('优先级'),incomeKey:col('收入区间来源键'),slope:col('收入斜率'),cert:col('证书门槛引用键'),grad:col('起薪来源键'),cost:col('生活成本来源键'),dur:col('节点时长系数'),w:col('差距权重'),years:col('转行/晋升年限'),mark:col('标注'),note:col('备注')};
// 可选列「并行上限」：缺省由 worker/projection-persona.js PP_MAX_PARALLEL 代码默认（产品初设）补齐
const colOpt=name=>H.findIndex(h=>h.startsWith(name));const C_par=colOpt('并行上限');
const DIMS=['ability','credential','experience','network','income'];
const noData=v=>{const s=String(v??'').trim();return !s||s==='—'||/^无数据/.test(s)?null:s;};
const packs={};const issues=[];
for(const r of rows.slice(1)){
 const id=String(r[C.id]||'').trim();if(!/^P\d{2}_/.test(id))continue;
 const dur=Number(String(r[C.dur]).trim());
 const wm=String(r[C.w]||'').match(/^(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)/);
 let weightsPct=null;
 if(wm){weightsPct=Object.fromEntries(DIMS.map((k,i)=>[k,Number(wm[i+1])]));const sum=Object.values(weightsPct).reduce((a,b)=>a+b,0);if(sum!==100)issues.push(id+' 差距权重合计 '+sum+'≠100');}
 else issues.push(id+' 差距权重无法解析 → 回落通用权重');
 if(!Number.isFinite(dur)||dur<=0)issues.push(id+' 节点时长系数无效 → 回落 1.0');
 packs[id]={id,name:String(r[C.name]).trim(),priority:String(r[C.prio]).trim(),dataStatus:String(r[C.status]).trim(),
  axes:{ageBand:r[C.age],education:r[C.edu],occupation:r[C.occ],cityTier:r[C.city],hours:r[C.hours],careerChange:r[C.change],civilTarget:r[C.civil]},
  durationFactor:Number.isFinite(dur)&&dur>0?dur:null,
  dimWeightsPct:weightsPct,
  meta:{incomeSourceKeys:noData(r[C.incomeKey]),incomeBandRatio:noData(r[C.slope]),incomeBandRatioNote:'同源 P75÷P25 带宽比，非工龄涨幅；收入仍走 INCOME_TABLE',
   credentialRefs:noData(r[C.cert]),gradSalaryKeys:noData(r[C.grad]),livingCostKeys:noData(r[C.cost]),careerYears:noData(r[C.years])},
  maxParallelNodes:C_par>=0&&/^[1-9]$/.test(String(r[C_par]).trim())?Number(String(r[C_par]).trim()):null,
  calibration:String(r[C.mark]||'').trim()||null};
}
// 台账引用键索引：E06 → 报告名/机构/链接/发布日期/层级（R18 来源展示用）
const expandKeys=s=>{const out=[];for(const part of String(s||'').split(/[\/,，；;、（）()\s]+/)){const m=part.match(/^([A-Z])(\d{2})(?:[–-]([A-Z])?(\d{2}))?/);if(!m)continue;const a=Number(m[2]),b=m[4]?Number(m[4]):a;for(let i=a;i<=b&&i<=a+20;i++)out.push(m[1]+String(i).padStart(2,'0'));}return out;};
const ledgerIndex={};
let ledgerCount=0;try{const lr=parseCSV(fs.readFileSync(ledgerSrc,'utf8').replace(/^\uFEFF/,'')).filter(r=>r.some(c=>String(c).trim()));ledgerCount=Math.max(0,lr.length-1);
 const LH=lr[0].map(h=>h.trim()),li=n=>LH.findIndex(h=>h.startsWith(n));const L={title:li('报告名'),pub:li('平台或机构'),url:li('链接'),date:li('发布日期'),city:li('城市'),fields:li('使用字段'),metric:li('口径'),tier:li('来源层级')};
 for(const r of lr.slice(1))for(const k of expandKeys(r[L.fields]))if(!ledgerIndex[k])ledgerIndex[k]={key:k,title:String(r[L.title]||'').trim(),publisher:String(r[L.pub]||'').trim(),url:String(r[L.url]||'').trim(),publishDate:String(r[L.date]||'').trim(),city:String(r[L.city]||'').trim(),metric:String(r[L.metric]||'').trim(),tier:String(r[L.tier]||'').trim()};
}catch{issues.push('台账未读到：'+ledgerSrc);}
const hash=crypto.createHash('sha256').update(raw).digest('hex').slice(0,8);
const table={version:'persona-v1-2026-10-25-'+hash,sourceFile:'butterfly-pm/persona_param_sources.csv',ledgerFile:'butterfly-pm/persona_source_ledger.csv',ledgerCount,
 calibrationNote:'节点时长系数、差距权重为产品初设，非公开统计；calibration 为内部标记，不得展示',dims:DIMS,packs,ledgerIndex,buildIssues:issues};
fs.writeFileSync(new URL('../worker/projection-persona-table.js',import.meta.url),'/* 自动生成：node scripts/build-persona-table.mjs —— 请勿手改。calibration 为内部标记，不得展示。 */\nexport const PERSONA_TABLE='+JSON.stringify(table,null,1)+';\n');
console.log('persona table',table.version,'packs',Object.keys(packs).length,'ledger',ledgerCount,issues.length?'issues: '+issues.join('；'):'');
