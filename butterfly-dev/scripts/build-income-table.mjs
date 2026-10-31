// 生成 worker/projection-income-table.js（版本化收入参数表）。
//  - 职业×城市（或省份/区域）行：data/income-params.csv（可追加；列见 scripts/income-params-lib.mjs）
//  - 工龄系数 / 无数据方向 / 核对行：butterfly-pm/salary_reference.csv
// 用法：node scripts/build-income-table.mjs [salary_reference.csv]
import fs from 'node:fs';
import {parseCSV,INCOME_PARAM_COLUMNS,LEDGER_COLUMNS,SOURCE_TIERS,CITY_PROVINCE,CITY_REGION} from './income-params-lib.mjs';
const src=process.argv[2]||'/workspace/butterfly-pm/salary_reference.csv';
const raw=fs.readFileSync(src,'utf8');
const rows=parseCSV(raw);
const header=rows[1];
const range=s=>{const m=String(s).replace(/,/g,'').match(/(\d+)\s*–\s*(\d+)/);return m?[Number(m[1]),Number(m[2])]:null;};
const noData=[],expRows=[],gradRows=[];
for(const r of rows.slice(2)){
 if(r.length<10||r[0]==='说明')break;
 const [direction,tier,city,official]=r;
 const allRange=range(r[4]);
 if(direction.startsWith('通用参照')){
  if(city==='深圳')expRows.push({education:official.split('·')[0],le1:range(r[7]),y2_3:range(r[10]),y4_5:range(r[13]),sourceUrl:r[8],dataYear:r[9],note:r[16]});
  else gradRows.push({category:official.split('·').at(-1),medianMonthly:Number(String(r[7]).replace(/,/g,'').match(/\d+/)?.[0]),sourceUrl:r[8],dataYear:r[9]});
  continue;
 }
 if(!allRange)noData.push({direction,tier,city,reason:r[16],internalMarker:r[17]});
}
const ledgerPath='data/salary_source_ledger.csv';
const lr=parseCSV(fs.readFileSync(ledgerPath,'utf8')).filter(r=>r.some(x=>x.trim()));
if(lr[0].join(',')!==LEDGER_COLUMNS.join(','))throw new Error('salary_source_ledger.csv 表头不符');
const ledgerById={};
for(const r of lr.slice(1)){
 const o=Object.fromEntries(LEDGER_COLUMNS.map((c,j)=>[c,r[j]??'']));
 if(!o.id||!o.reportTitle||!o.publisher||!o.url||!o.publishDate||!o.sourceTier)throw new Error('台账行缺少必要字段: '+o.id);
 if(!SOURCE_TIERS[o.sourceTier])throw new Error('台账 '+o.id+' 层级无效');
 if(ledgerById[o.id])throw new Error('台账 id 重复: '+o.id);
 ledgerById[o.id]={id:o.id,reportTitle:o.reportTitle,publisher:o.publisher,platform:o.platform||'',url:o.url,publishDate:o.publishDate,fetchedDate:o.fetchedDate||'',city:o.city||'',occupation:o.occupation||'',fieldsUsed:o.fieldsUsed||'',metric:o.metric||'',sourceTier:o.sourceTier,termsCheck:o.termsCheck||'',note:o.note||''};
}
const pr=parseCSV(fs.readFileSync('data/income-params.csv','utf8')).filter(r=>r.some(x=>x.trim()));
if(pr[0].join(',')!==INCOME_PARAM_COLUMNS.join(','))throw new Error('data/income-params.csv 表头不符，应为：'+INCOME_PARAM_COLUMNS.join(','));
const num=v=>v===''||v==null?null:Number(v);
const rowsOut=pr.slice(1).map((r,i)=>{const o=Object.fromEntries(INCOME_PARAM_COLUMNS.map((c,j)=>[c,r[j]??'']));const at='第 '+(i+2)+' 行';
 for(const c of ['scope','occupation','dataYear','sourceTier','sourceLedgerId','sourceUrl','metric'])if(!o[c])throw new Error(at+' 缺少 '+c);
 if(!SOURCE_TIERS[o.sourceTier])throw new Error(at+' 来源层级须为 L1/L2/L3');
 if(!['city','province','region'].includes(o.scope))throw new Error(at+' scope 须为 city/province/region');
 if(o.scope==='city'&&!o.city)throw new Error(at+' 城市行缺少 city');
 if(!o.province)throw new Error(at+' 缺少 province');
 const led=ledgerById[o.sourceLedgerId];if(!led)throw new Error(at+' sourceLedgerId 不在台账中: '+o.sourceLedgerId);
 if(led.url!==o.sourceUrl)throw new Error(at+' sourceUrl 与台账不一致');
 if(led.sourceTier!==o.sourceTier)throw new Error(at+' sourceTier 与台账不一致');
 const lo=num(o.p25), mid=num(o.p50), hi=num(o.p75), mean=num(o.mean);
 const row={scope:o.scope,city:o.scope==='city'?o.city:null,province:o.province,occupation:o.occupation,officialName:o.officialName||o.occupation,
  p25:lo,p50:mid,p75:hi,mean,
  percentileLow:num(o.percentileLow),percentileMid:num(o.percentileMid),percentileHigh:num(o.percentileHigh),
  bandLabel:o.bandLabel||'',sampleLabel:o.sampleLabel||'',industryName:o.industryName||'',
  metric:o.metric,dataYear:o.dataYear,sourceTier:o.sourceTier,sourceTierLabel:SOURCE_TIERS[o.sourceTier],sourceLedgerId:o.sourceLedgerId,sourceUrl:o.sourceUrl,expCoefVersion:o.expCoefVersion||null,internalMarker:o.internalMarker||'',note:o.note||''};
 if(lo!=null&&hi!=null&&!(lo<hi))throw new Error(at+' 分位低值须小于高值');
 if(mid!=null&&lo!=null&&hi!=null&&!(lo<=mid&&mid<=hi))throw new Error(at+' 中位须在低–高之间');
 if(lo==null&&mean==null)throw new Error(at+' 须有分位区间或均值');
 return row;});
const annual=note=>{const out={};for(const [k,re] of [['le1',/≤1年 ([\d,\/]+)/],['y2_3',/2–3年 ([\d,\/]+)/],['y4_5',/4–5年 ([\d,\/]+)/]]){const m=note.match(re);if(m)out[k]=m[1].split('/').map(x=>Number(x.replace(/,/g,'')));}return out;};
const expCoefficients={};
for(const e of expRows){
 const a=annual(e.note);const ref=a.y2_3;const r3=x=>Math.round(x*1000)/1000;
 expCoefficients[e.education]={
  le1:{p25:r3(a.le1[1]/ref[1]),p50:r3(a.le1[2]/ref[2]),p75:r3(a.le1[3]/ref[3])},
  y2_3:{p25:1,p50:1,p75:1},
  y4_5:{p25:r3(a.y4_5[1]/ref[1]),p50:r3(a.y4_5[2]/ref[2]),p75:r3(a.y4_5[3]/ref[3])},
  monthlyBands:{le1:e.le1,y2_3:e.y2_3,y4_5:e.y4_5},annualP10toP90:a,sourceUrl:e.sourceUrl,dataYear:e.dataYear
 };
}
const citySet=new Set([
 ...rowsOut.filter(r=>r.scope==='city').map(r=>r.city),
 ...Object.keys(CITY_PROVINCE).filter(c=>rowsOut.some(r=>(r.scope==='province'&&r.province===CITY_PROVINCE[c])||(r.scope==='region'&&CITY_REGION[c]&&r.province===CITY_REGION[c])))
]);
const table={
 version:'income-v1-2026-10-24d',
 collectedAt:'2026-10-24',
 sourceFile:'butterfly-pm/salary_reference.xlsx + data/income-params.csv',
 basis:'税前应发工资（企业在岗职工，含基本工资、奖金、津贴补贴、加班工资）；月薪=官方年值÷12；区间分位以各行 bandLabel / percentile* 为准（常见 P25–P75，南京等为 P10–P90），不分工龄',
 sourceTiers:SOURCE_TIERS,
 cityProvince:CITY_PROVINCE,
 cityRegion:CITY_REGION,
 cities:[...citySet],
 ledger:ledgerById,
 rows:rowsOut,noData,
 expCoefficients:{version:'exp-coef-v0-2026-10-24',reference:'深圳 学历×工龄（不分职业），2–3 年档=1.0；低/高分位分别取比值',buckets:{le1:'相关经验 1 年及以下',y2_3:'相关经验 2–3 年',y4_5:'相关经验 4–5 年'},byEducation:expCoefficients},
 crossCheck:{note:'北京 2025 届高校毕业生起薪中位值（点值），仅用于核对入门档，不参与计算',rows:gradRows}
};
fs.writeFileSync('worker/projection-income-table.js','/* 自动生成：node scripts/build-income-table.mjs —— 请勿手改。internalMarker 为内部标记，不得展示。 */\nexport const INCOME_TABLE='+JSON.stringify(table,null,1)+';\n');
console.log(JSON.stringify({rows:rowsOut.length,scopes:[...new Set(rowsOut.map(r=>r.scope))],noData:noData.length,version:table.version},null,1));
