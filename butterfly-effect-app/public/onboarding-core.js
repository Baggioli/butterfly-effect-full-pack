const InterviewCore=(()=>{
 const fields=['goal','role','constraints','age','education','skills','hours','resources','experience','interests','recentUpdate'];
 const labels={goal:'近期想改变的事',role:'目前的职业或身份',constraints:'现实障碍与边界',age:'年龄',education:'最高学历',skills:'擅长的技能',hours:'每周可用时间',resources:'已有资源',experience:'重要经历',interests:'兴趣与偏好',recentUpdate:'最近的变化'};
 const required=['goal','role','constraints','age','education','skills','hours'];
 const known=v=>v!==undefined&&v!==null&&String(v).trim()!==''&&!['未知','不确定','不知道','跳过'].includes(String(v).trim());
 const isNoiseTranscript=value=>/^(?:字幕(?:by|由)[\p{L}\p{N}_-]{1,80}|(?:请不吝|請不吝)?(?:点赞|點贊)(?:订阅|訂閱)(?:转发|轉發)(?:打赏|打賞)支持.{0,40}|(?:感谢观看|感謝觀看|谢谢观看|謝謝觀看|thankyouforwatching){1,4})$/iu.test(String(value||'').replace(/[\s，,。.!！?？:：;；]/g,''));
 const clean=p=>Object.fromEntries(fields.filter(k=>known(p?.[k])).map(k=>[k,k==='hours'?Number(p[k]):String(p[k]).trim().slice(0,2000)]).filter(([k,v])=>k!=='hours'||Number.isFinite(v)&&v>=.5&&v<=80));
 function number(s){if(/^\d+(\.\d+)?$/.test(s))return Number(s);const map={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};if(s==='半')return .5;let n=0,t=0;for(const c of s){if(c==='十'){n+=(t||1)*10;t=0}else if(c==='百'){n+=(t||1)*100;t=0}else if(c in map)t=map[c];else return NaN}return n+t}
 function age(s){const m=s.match(/([0-9零一二两三四五六七八九十百]{1,5})\s*岁/)||s.match(/^\s*([0-9零一二两三四五六七八九十百]{1,5})\s*$/);const n=m?number(m[1]):NaN;return n>=1&&n<=120?String(n):null}
 function hours(s,direct=false){const m=s.match(/([0-9零一二两三四五六七八九十半.]{1,6})\s*(?:个)?小时/)||(direct?s.match(/^\s*([0-9零一二两三四五六七八九十半.]{1,6})\s*$/):null);const n=m?number(m[1]):NaN;return n>=.5&&n<=80?n:null}
 function education(s){for(const [test,value] of [[/博士/,'博士'],[/硕士|研究生/,'硕士'],[/本科|学士/,'本科'],[/大专|专科/,'大专'],[/高中|中专|职高/,'高中 / 中专'],[/初中|小学/,'初中及以下']])if(test.test(s))return value;return null}
 function apply(profile,field,answer,modelFacts=[]){
  const next=clean(profile),evidence={};answer=String(answer||'').trim().slice(0,2000);
  const set=(key,value,quote)=>{if(!known(value))return;next[key]=value;evidence[key]={value,evidence:quote,source:'user'}};
  if(fields.includes(field)&&!['age','hours','education'].includes(field)&&known(answer))set(field,answer,answer);
  const a=(field==='age'||/(?:我|本人)(?:今年|现在|已经)?(?:是)?\s*[0-9零一二两三四五六七八九十百]+岁/.test(answer))?age(answer):null,h=hours(answer,field==='hours'),e=(field==='education'||/(?:^|[，,。；;])(?:本科|硕士|博士|大专|高中|初中)学历/.test(answer)||/(?:我|本人)[^，,。；;]{0,12}(?:本科|硕士|博士|大专|专科|高中|初中|小学|学历)/.test(answer))?education(answer):null;
  const explicitRole=answer.match(/(?:^|[，,。；;])(?:我)?(?:现在|目前)(?:主要)?(?:是|做|从事)([^，,。；;]+)/);if(explicitRole){const role=explicitRole[1].split(/(?:我)?(?:擅长|每周|今年|最高学历|主要困难)/)[0].trim();if(role)set('role',role,explicitRole[0]);}
  const explicitSkills=answer.match(/擅长([^，,。；;]+)/);if(explicitSkills&&!/(?:不|没|不太|不是很)擅长/.test(answer))set('skills',explicitSkills[1].trim(),explicitSkills[0]);
  const explicitObstacle=answer.match(/(?:主要困难(?:是)?|障碍(?:是)?|卡住我的是|现实限制(?:是)?)[：: ]?([^。；;]+)/);if(explicitObstacle)set('constraints',explicitObstacle[1].trim(),explicitObstacle[0]);
  if(a)set('age',a,answer);if(h!==null&&(field==='hours'||/每周|一周|每星期/.test(answer)))set('hours',h,answer);if(e)set('education',e,answer);
  for(const f of modelFacts||[]){
   if(!fields.includes(f.field)||!f.evidence||!answer.includes(f.evidence)||!known(f.value)||evidence[f.field])continue;
   if(f.field==='age'){if(/孩子|女儿|儿子|父亲|母亲|爸爸|妈妈|妻子|丈夫/.test(f.evidence))continue;const n=age(f.evidence);if(n&&String(n)===String(f.value).replace(/岁$/,''))set(f.field,n,f.evidence)}
   else if(f.field==='hours'){const n=hours(f.evidence,true);if(n!==null&&n===Number(f.value))set(f.field,n,f.evidence)}
   else if(f.field==='education'){const n=education(f.evidence);if(n)set(f.field,n,f.evidence)}
   else if(String(f.evidence).includes(String(f.value))||String(f.value).includes(String(f.evidence)))set(f.field,String(f.value).slice(0,2000),f.evidence);
  }
  return {profile:next,evidence};
 }
 function next(profile,asked=[],skipped=[],kind='initial'){
  const seen=new Set([...asked,...skipped]);
  if(kind==='checkin')return ['recentUpdate','experience','interests'].find(k=>!seen.has(k))||null;
  const order=[...required];
  if(/忙|时间|加班/.test(profile.constraints||'')&&!known(profile.hours)){order.splice(order.indexOf('hours'),1);order.splice(Math.max(1,order.indexOf('constraints')+1),0,'hours')}
  return order.find(k=>!known(profile[k])&&!seen.has(k))||null;
 }
 function question(field,p={}){
  return ({goal:'最近有什么事，是你特别想改变的？',role:/换工作|转行|职业/.test(p.goal||'')?'你现在主要做什么工作，或处在哪个阶段？':'你平时主要做些什么？',constraints:'你觉得，现在最难的是哪一块？',age:'方便问下，你今年多大了？',education:'你读到哪个学历？也可以先跳过。',skills:'你觉得自己最拿手的是什么？日常的小事也算。',hours:'一周里，大概能留几小时给这件事？',resources:'目前有什么人、工具或资源能帮上一点忙？',experience:'这段时间有没有一件让你印象深的经历？',interests:'最近你更愿意把时间花在哪件感兴趣的事情上？',recentUpdate:'这两周，生活或想法有什么新变化？'}[field]||'还有什么想让我了解的？');
 }
 const options={goal:['工作更自主','增加收入来源','把一项技能变成作品','生活更有节奏'],role:['在职工作','正在学习','暂时休息或寻找机会','经营自己的事情'],constraints:['时间不够','不知道怎么开始','预算有限','担心失败或被拒绝'],age:[],education:['高中 / 中专','大专','本科','硕士','博士','其他'],skills:['沟通与协调','写作与表达','数据与表格','设计与创作','暂时说不清'],hours:['0.5小时','2小时','4小时','8小时'],recentUpdate:['最近没有明显变化','时间安排变了','目标有了新想法'],experience:['有一件小进展','遇到了一次挫折','暂时没有想补充的'],interests:['学习新东西','创作或表达','运动与户外','与人交流']};
 function due(n,now=Date.now()){return !n.demo&&now-new Date(n.lastConversationAt||n.conversationStartedAt||new Date(now).toISOString()).getTime()>=14*86400000}
 return {fields,labels,required,isNoiseTranscript,known,clean,number,age,hours,education,apply,next,question,options,due};
})();
export default InterviewCore;
