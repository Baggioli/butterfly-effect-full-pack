/**
 * 人群参数包（M1.5 · P0-15 stub）。isomorphic，不依赖 node:*。
 * PersonaKey（年龄段/学历/职业大类/城市线级/周投入 + 可选 转行/体制内目标）→ 版本化参数包 → 现有规则层。
 * v1 只用建档已有字段，不加个性长问卷。系数全部为占位 1.0，待市场调研 persona_param_sources.xlsx 填 P01–P12 初值。
 * 不读取、不修改 salary_reference*；收入仍只走 INCOME_TABLE。
 */
import {PERSONA_TABLE} from './projection-persona-table.js';

const ppStr=v=>v===undefined||v===null?'':String(v).trim();
export const PP_TIER1=['北京','上海','广州','深圳'];
/** 新一线（2025 公开榜单口径，仅作线级分组）。 */
export const PP_NEW_TIER1=['成都','杭州','重庆','武汉','苏州','西安','南京','长沙','天津','郑州','东莞','青岛','昆明','宁波','合肥'];
/** 职业大类（按目标优先，其次当前职业）。
 *  v1.26 产品拍板：职业实体 > 备考动作。kind='entity' 为职业实体词，kind='action' 为备考动作词（仅当文本无任何职业实体时才生效）。
 *  多个实体冲突时：命中词更长者优先；同长按下表顺序。 */
export const PP_OCC=[
 {key:'civil',label:'公务员/参公',pattern:'公务员|参公'},
 {key:'cpa',label:'会计/CPA',pattern:'会计|CPA|注会|注册会计师|出纳|财务'},
 {key:'law',label:'法考/法律',pattern:'法考|司法考试|律师|律所|法务|法律'},
 {key:'teacher',label:'教师/教资',pattern:'小学教师|中学教师|初中教师|高中教师|幼儿教师|幼师|在编教师|公办教师|民办教师|教师|老师|教资|讲师|教培'},
 {key:'data',label:'数据分析',pattern:'数据分析'},
 {key:'tech',label:'互联网技术/研发',pattern:'程序员|前端|后端|软件|开发工程师|研发|编程|全栈|算法|客户端|服务端|写代码'},
 {key:'design',label:'UI/视觉设计',pattern:'UI|UX|交互设计|平面设计|视觉|美工'},
 {key:'ops',label:'互联网运营',pattern:'运营'},
 {key:'hr',label:'人力资源',pattern:'人力资源|HR|人事|招聘专员'},
 {key:'sales',label:'销售',pattern:'销售|营销员'},
 {key:'side',label:'兼职/自媒体/技能副业',pattern:'副业|兼职|自媒体|博主|接单|自由职业'}
];
/** 备考动作（无职业实体时兜底为 civil → P05）。 */
export const PP_EXAM_ACTION='考公|考编|事业编|国考|省考|选调|体制内|事业单位';
const PP_PUBLIC='公办|在编|编制|考编|事业编|事业单位|体制内|考公|国考|省考|公务员|参公|选调';
/** 文本 → {occ, via:'entity'|'action'|null, word}。纯函数。 */
export function ppOccDetail(t){
 const s=ppStr(t);if(!s)return {occ:null,via:null,word:null};
 let best=null;
 PP_OCC.forEach((o,i)=>{for(const m of s.matchAll(new RegExp(o.pattern,'gi'))){const len=m[0].length;if(!best||len>best.len||(len===best.len&&i<best.i))best={occ:o.key,len,i,word:m[0]};}});
 if(best)return {occ:best.occ,via:'entity',word:best.word};
 const a=s.match(new RegExp(PP_EXAM_ACTION));
 return a?{occ:'civil',via:'action',word:a[0]}:{occ:null,via:null,word:null};
}
const ppOccOf=t=>ppOccDetail(t).occ;
export function ppAgeBand(age){const n=Number(String(age??'').match(/\d+/)?.[0]);if(!Number.isFinite(n)||n<=0)return 'unknown';return n<=22?'le22':n<=27?'23_27':n<=35?'28_35':n<=45?'36_45':'46p';}
export function ppEduBand(e){const s=ppStr(e);if(!s)return 'unknown';if(/博士|硕士|研究生/.test(s))return 'master_plus';if(/本科|学士/.test(s))return 'bachelor';if(/大专|专科|高职/.test(s))return 'college';return 'highschool_or_below';}
export function ppCityTier(c){const s=ppStr(c);if(!s)return 'unknown';if(PP_TIER1.some(x=>s.includes(x)))return 't1';if(PP_NEW_TIER1.some(x=>s.includes(x)))return 'nt1';return 'other';}
export function ppHoursBand(h){const n=Number(h);if(!Number.isFinite(n)||n<=0)return 'unknown';return n<5?'low':n<10?'mid':'high';}

/** 从角色卡事实（buildRoleFacts 输出）解析 PersonaKey。纯函数。 */
export function resolvePersonaKey(roleFacts){
 const get=k=>roleFacts?.facts?.find(f=>f.key===k)?.value;
 const goalText=[get('goal'),get('longGoal')].map(ppStr).join(' ');
 const roleText=ppStr(get('role'));
 const goalD=ppOccDetail(goalText),roleD=ppOccDetail(roleText);
 // 目标中的职业实体 > 目标中的备考动作；目标只有备考动作而角色是教师 → 仍按教师（实体优先，例如「在培训机构当老师」+「考编」）
 let d=goalD;
 if(goalD.via==='action'&&roleD.via==='entity'&&roleD.occ==='teacher')d=roleD;
 if(!d.occ)d=roleD;
 const goalOcc=goalD.occ,roleOcc=roleD.occ;
 const occupation=d.occ||'unknown';
 const careerChange=Boolean(goalOcc&&roleText&&roleOcc!==goalOcc&&!(goalD.via==='action'&&roleOcc===occupation));
 const pubText=goalText+' '+roleText;
 const civilTarget=new RegExp(PP_PUBLIC).test(goalText)||(occupation==='civil');
 const institution=/民办|私立|培训机构|教培/.test(goalText)?'private':new RegExp(PP_PUBLIC).test(pubText)?'public':null;
 const wy=Number(String(get('workYears')??'').match(/\d+/)?.[0]);
 return {ageBand:ppAgeBand(get('age')),eduBand:ppEduBand(get('education')),occupation,cityTier:ppCityTier(get('city')),hoursBand:ppHoursBand(get('hours')),
  careerChange,civilTarget,institution,occupationVia:d.via,workYears:Number.isFinite(wy)?wy:null};
}

/** 参数包（从 PERSONA_TABLE 读取，表由 scripts/build-persona-table.mjs 生成）：
 *  durationFactor  全部节点时长乘数（表「节点时长系数」；缺失 → 通用 1.0 并标注）
 *  dimWeightsPct   能力/证书/经验/人脉作品/收入（合计 100）→ 归一化到通用权重同一尺度；time 维沿用通用包
 *  meta            收入斜率（P75÷P25 带宽比，仅 metadata）、证书/起薪/生活成本引用键、转行年限（多为无数据）
 *  未给出的字段一律回落通用包，并在 fallbackFields 中列出。
 */
export const PERSONA_PACKS_VERSION=PERSONA_TABLE.version;
const inA=(v,arr)=>arr.includes(v);
/** 匹配谓词（代码侧，按建档已有字段）；顺序即优先级（体制内/证书类先于城市×职业类）。 */
const PERSONA_MATCH=[
 ['P05_civil_exam',k=>k.occupation==='civil'],
 ['P06_cpa_path',k=>k.occupation==='cpa'],
 ['P07_judicial_exam',k=>k.occupation==='law'],
 ['P08_teacher_path',k=>k.occupation==='teacher'],
 ['P11_low_hours_side',k=>k.hoursBand==='low'&&(k.occupation==='side'||inA(k.ageBand,['28_35','36_45']))],
 ['P04_career_change_da',k=>k.occupation==='data'&&k.careerChange&&k.ageBand==='28_35'&&inA(k.cityTier,['t1','nt1'])],
 ['P01_T1_grad_tech',k=>k.occupation==='tech'&&k.cityTier==='t1'&&inA(k.ageBand,['le22','23_27'])],
 ['P02_NT1_grad_tech',k=>k.occupation==='tech'&&k.cityTier==='nt1'&&inA(k.ageBand,['le22','23_27'])],
 ['P03_ops_T1_NT1',k=>k.occupation==='ops'&&inA(k.cityTier,['t1','nt1'])&&inA(k.ageBand,['23_27','28_35'])],
 ['P09_sales_T1',k=>k.occupation==='sales'&&k.cityTier==='t1'],
 ['P10_design_UI',k=>k.occupation==='design'&&inA(k.cityTier,['t1','nt1'])],
 ['P12_hr_NT1_1to3y',k=>k.occupation==='hr'&&k.cityTier==='nt1'&&(k.workYears==null||(k.workYears>=1&&k.workYears<=3))]
];
/**
 * P0-17 PP3：同时「进行中」的节点数上限（产品初设，2026-10-25）。
 * 通用 2；考证/体制向 1–2；技术高投入 2–3；低投入 P11=1。CSV 若提供「并行上限」列则以表为准。
 */
export const PP_MAX_PARALLEL_DEFAULT=2;
export const PP_MAX_PARALLEL={P01:3,P02:3,P03:2,P04:2,P05:1,P06:2,P07:1,P08:2,P09:2,P10:2,P11:1,P12:2};
export function ppMaxParallel(id,row){const v=Number(row?.maxParallelNodes);if(Number.isInteger(v)&&v>=1&&v<=4)return v;const d=PP_MAX_PARALLEL[String(id||'').slice(0,3)];return d||PP_MAX_PARALLEL_DEFAULT;}
/** R18：把人群包 meta 引用键（E06 / C01/C02 / K05–K08）展开为台账条目（报告名/机构/链接）。 */
export function ppExpandKeys(s){const out=[];for(const part of String(s||'').split(/[\/,，；;、（）()\s]+/)){const m=part.match(/^([A-Z])(\d{2})(?:[–-]([A-Z])?(\d{2}))?/);if(!m)continue;const a=Number(m[2]),b=m[4]?Number(m[4]):a;for(let i=a;i<=b&&i<=a+20;i++)out.push(m[1]+String(i).padStart(2,'0'));}return out;}
export function ppLedgerRefs(keys,T=PERSONA_TABLE){return ppExpandKeys(keys).map(k=>T.ledgerIndex?.[k]?{...T.ledgerIndex[k]}:{key:k,title:null,missing:true});}
function ppBuildPack(id,match,T=PERSONA_TABLE){
 const row=T.packs?.[id];if(!row)return null;
 const fallbackFields=[];
 if(!(row.durationFactor>0))fallbackFields.push('durationFactor');
 if(!row.dimWeightsPct)fallbackFields.push('dimWeights');
 fallbackFields.push('overlap','credentialGateWeeks');
 for(const [k,v] of Object.entries(row.meta||{}))if(v==null)fallbackFields.push(k);
 return {id,name:row.name,version:T.version,match,status:row.dataStatus||'unknown',durationFactor:row.durationFactor>0?row.durationFactor:1,dimWeightsPct:row.dimWeightsPct||null,
  overlap:null,credentialGateWeeks:[0,0],maxParallelNodes:ppMaxParallel(id,row),maxParallelFrom:Number.isInteger(row.maxParallelNodes)?'table':'code_default',meta:row.meta||{},fallbackFields};
}
export const PERSONA_PACKS=PERSONA_MATCH.map(([id,m])=>ppBuildPack(id,m)).filter(Boolean);
export const GENERIC_PACK={id:'generic',name:'通用参数',version:PERSONA_TABLE.version,match:()=>true,status:'generic',durationFactor:1,dimWeightsPct:null,overlap:null,credentialGateWeeks:[0,0],maxParallelNodes:PP_MAX_PARALLEL_DEFAULT,maxParallelFrom:'code_default',meta:{},fallbackFields:['all']};
/** 5 维百分比 → 与通用权重同尺度（保持 5 维总量不变，time 维沿用通用包）。 */
export function ppNormalizeWeights(pct,base){
 const dims=Object.keys(pct);const baseSum=dims.reduce((a,k)=>a+(base[k]??0),0);const pctSum=dims.reduce((a,k)=>a+pct[k],0)||1;
 return Object.fromEntries(dims.map(k=>[k,Math.round(pct[k]/pctSum*baseSum*10000)/10000]));
}

export function selectPersonaPack(key,packs=PERSONA_PACKS){const hit=packs.find(p=>{try{return p.match(key);}catch{return false;}});return hit||GENERIC_PACK;}

/** 把参数包叠加到通用 ParamTable 上，返回新的 P（不修改原对象）。 */
export function applyPersonaPack(P,pack){
 if(!pack)return P;
 const out={...P,personaPack:{id:pack.id,name:pack.name,version:pack.version,durationFactor:pack.durationFactor??1,credentialGateWeeks:[...(pack.credentialGateWeeks||[0,0])],maxParallelNodes:pack.maxParallelNodes||PP_MAX_PARALLEL_DEFAULT,meta:{...(pack.meta||{})}}};
 if(pack.dimWeightsPct)out.dimWeights={...P.dimWeights,...ppNormalizeWeights(pack.dimWeightsPct,P.dimWeights)};
 if(pack.overlap!=null)out.overlap=pack.overlap;
 return out;
}
/** 对外展示的人群包摘要（不含 match 函数、不含内部校准标记）。 */
export function personaSummary(key,pack){
 const generic=pack.id==='generic';
 return {key,packId:pack.id,packName:pack.name,packVersion:pack.version,dataStatus:pack.status,generic,
  durationFactor:pack.durationFactor,dimWeightsPct:pack.dimWeightsPct,fallbackFields:pack.fallbackFields,maxParallelNodes:pack.maxParallelNodes||PP_MAX_PARALLEL_DEFAULT,
  incomeBandRatio:pack.meta?.incomeBandRatio||null,
  label:generic?'通用参数':'人群参数包：'+pack.name,
  note:generic?'未匹配到细分人群，节点时间按通用参数估算':'节点时长系数与差距权重为产品初设示例值，尚未用实际数据校准；表中无数据的字段按通用参数处理'};
}
