// Verify the actual Mac -> SSH -> production DGX service without printing credentials.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const password=execFileSync('ssh',['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','dgx','cat ~/.local/state/butterfly-effect/password'],{encoding:'utf8'});
const origin=process.env.BUTTERFLY_CHECK_ORIGIN||'http://127.0.0.1:8787';
assert.ok(['http://127.0.0.1:8787','http://127.0.0.1:4173'].includes(origin),'Only the application loopback endpoints may receive credentials');
const auth={Authorization:'Basic '+Buffer.from('owner:'+password).toString('base64')};
assert.equal((await fetch(origin+'/api/ai/status', {headers:{'oai-authenticated-user-id':'spoof'}})).status,origin.endsWith(':4173')?200:401);
const page=await fetch(origin,{headers:auth});assert.equal(page.status,200);assert.match(await page.text(),/蝴蝶效应/);
const status=await fetch(origin+'/api/ai/status',{headers:auth});assert.equal(status.status,200);
const info=await status.json();assert.equal(info.provider,'DGX 私有模型');assert.ok(info.configured);
const denied=await fetch(origin+'/api/ai',{method:'POST',headers:{...auth,Origin:'http://example.invalid','Content-Type':'application/json'},body:JSON.stringify({mode:'extract',intro:'test'})});assert.equal(denied.status,403);
const invalid=await fetch(origin+'/api/ai',{method:'POST',headers:{...auth,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({mode:'plan',profile:{goal:'test',hours:4}})});assert.equal(invalid.status,400);
console.log(JSON.stringify({tunnel:true,authenticatedPage:true,spoofRejected:true,originRejected:true,incompleteProfileRejected:true,model:info.model}));
if(process.argv.includes('--live')||process.argv.includes('--live-extract')){
 const cases=[{id:'production-extract',body:{mode:'extract',intro:'我是虚构测试甲，22岁，高中毕业，在便利店工作，没有编程经验。只有个人电脑，没有客户联系人。目标90天内完成Excel表格自动化服务的一个付费试单，每周4小时。不辞职，不买课程。'}},
 {id:'production-adjust',body:{mode:'adjust',profile:{age:'45',education:'本科',role:'财务主管',experience:'15年财务报表经验',skills:'Excel透视表',goal:'90天内完成Excel表格自动化服务的一个付费试单',hours:.5,resources:'原有3位愿意交流的同行',constraints:'不辞职，不买课程，不使用公司机密数据'},stage:{name:'验证需求',gate:'找到一个可验证的问题'},records:[{title:'邀请3位同行交流',status:'done',actual:25,result:'3位同行全部拒绝，尚无需求证据'},{title:'制作样表',status:'unknown',result:'尚未反馈'}],observations:[{text:'每周只能30分钟，不能开视频会议',state:'已确认'},{text:'用户不擅长Excel',state:'不准确'}]}}];
 const report={date:new Date().toISOString(),model:info.model,productionEndpoint:origin,fictionalData:true,cases:[]};
 for(const c of cases.filter(c=>!process.argv.includes('--live-extract')||c.body.mode==='extract')){
  const start=performance.now();const r=await fetch(origin+'/api/ai',{method:'POST',headers:{...auth,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(c.body),signal:AbortSignal.timeout(200000)});const output=await r.json();
  const entry={id:c.id,status:r.status,elapsedSeconds:(performance.now()-start)/1000,input:c.body,output};report.cases.push(entry);
  try{assert.equal(r.status,200);if(c.body.mode==='extract'){assert.equal(output.profile.age,'22');assert.equal(output.profile.hours,4);assert.match(output.profile.role,/便利店/);assert.match(output.profile.experience,/编程/);assert.match(output.profile.resources,/电脑/);assert.equal(output.profile.city,undefined)}else{assert.equal(output.story.chapters.length,4);assert.ok(output.story.chapters[0].quests.reduce((s,q)=>s+q.minutes,0)<=21)}entry.passed=true}catch(e){entry.passed=false;entry.failure=e.message}
  console.log(JSON.stringify({id:entry.id,status:entry.status,seconds:+entry.elapsedSeconds.toFixed(2),passed:entry.passed,failure:entry.failure}));
 }
 await mkdir('reports',{recursive:true});await writeFile(origin.endsWith(':4173')?'reports/local-preview-verification.json':'reports/production-verification.json',JSON.stringify(report,null,2)+'\n');
 if(report.cases.some(c=>!c.passed))process.exitCode=1;
}
