// 收入参数表（data/income-params.csv）的列定义、解析与来源层级判定。
export const INCOME_PARAM_COLUMNS=['city','province','scope','occupation','officialName','p25','p50','p75','mean','percentileLow','percentileMid','percentileHigh','bandLabel','sampleLabel','industryName','metric','dataYear','sourceTier','sourceLedgerId','sourceUrl','expCoefVersion','internalMarker','note'];
export const LEDGER_COLUMNS=['id','reportTitle','publisher','platform','url','publishDate','fetchedDate','city','occupation','fieldsUsed','metric','sourceTier','termsCheck','note'];
export const SOURCE_TIERS={L1:'人社局工资价位',L2:'统计局平均工资',L3:'招聘平台公开报告'};
/** 城市 → 省份（用于“省级数据估算”开关；直辖市省份即自身）。新增城市在此追加。 */
/** 城市 → 区域样本（如川渝）；区域行 scope=region，展示「区域样本 ≠ 单市」。 */
export const CITY_REGION={成都:'川渝',重庆:'川渝'};
export const CITY_PROVINCE={深圳:'广东',广州:'广东',东莞:'广东',佛山:'广东',珠海:'广东',宁波:'浙江',杭州:'浙江',温州:'浙江',郑州:'河南',洛阳:'河南',
 北京:'北京',上海:'上海',天津:'天津',重庆:'重庆',成都:'四川',武汉:'湖北',南京:'江苏',苏州:'江苏',西安:'陕西',长沙:'湖南',合肥:'安徽',青岛:'山东',济南:'山东',厦门:'福建',福州:'福建'};
/** 按来源链接判定层级：人社部门 → L1；统计部门 → L2；其余（招聘平台报告）→ L3。宁波人社文件取自 m12333 镜像，按人社局计。 */
export function tierFromUrl(url){
 const h=(()=>{try{return new URL(url).host;}catch{return '';}})();
 if(/(^|\.)(hrss|rsj|rlsbj|hrss)\.|m12333\.cn$|jiceng\.zhengzhou\.gov\.cn$/.test(h))return 'L1';
 if(/(^|\.)(stats|tjj)\.|tjj\./.test(h))return 'L2';
 return h?'L3':null;
}
export function parseCSV(s){const rows=[];let row=[],f='',q=false;for(let i=0;i<s.length;i++){const c=s[i];if(q){if(c==='"'){if(s[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f.replace(/\r$/,''));rows.push(row);row=[];f='';}else f+=c;}if(f||row.length){row.push(f);rows.push(row);}return rows;}
const cell=v=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
export function toCSV(cols,objs){return [cols.join(','),...objs.map(o=>cols.map(c=>cell(o[c])).join(','))].join('\n')+'\n';}
