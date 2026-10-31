import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const local='http://127.0.0.1:4173',mobile='https://spark-864f.tailfb7e5f.ts.net:8443';
const report={date:new Date().toISOString(),passwordRequired:false,phoneDeviceTested:false,endpoints:[],cases:[]};
for(const origin of [local,mobile]){
 let page;for(let attempt=0;attempt<30;attempt++){try{page=await fetch(origin,{signal:AbortSignal.timeout(2000)});break}catch{await new Promise(resolve=>setTimeout(resolve,500))}}
 if(!page)throw Error('Application did not become ready: '+origin);const html=await page.text();
 assert.equal(page.status,200);assert.ok(html.includes('id="app"'));assert.ok(!html.includes('name="password"'));assert.equal(page.headers.get('www-authenticate'),null);
 const status=await fetch(origin+'/api/ai/status',{signal:AbortSignal.timeout(15000)});const data=await status.json();assert.equal(status.status,200);assert.equal(data.reachable,true);
 const denied=await fetch(origin+'/api/ai',{method:'POST',headers:{Origin:'https://untrusted.invalid','Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403);
 report.endpoints.push({origin,application:true,passwordForm:false,connected:true,crossOriginRejected:true,model:data.model});
 console.log(JSON.stringify({origin,application:true,passwordRequired:false,connected:true}));
}
const input={mode:'extract',intro:'这是虚构验收人物：我22岁，高中毕业，在便利店工作，没有编程经验，只有个人电脑。每周能拿出4小时，希望90天内完成一个Excel自动化服务的试单，不辞职。'};
const start=performance.now();
const response=await fetch(mobile+'/api/ai',{method:'POST',headers:{Origin:mobile,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(200000)});
const output=await response.json();
const entry={id:'private-mobile-real-extract',status:response.status,elapsedSeconds:(performance.now()-start)/1000,input,output};
report.cases.push(entry);
try{assert.equal(response.status,200);assert.equal(output.profile.age,'22');assert.equal(output.profile.hours,4);assert.ok(output.summary);entry.passed=true}catch(e){entry.passed=false;entry.failure=e.message}
await mkdir('reports',{recursive:true});await writeFile('reports/direct-access-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({id:entry.id,status:entry.status,seconds:+entry.elapsedSeconds.toFixed(2),passed:entry.passed,failure:entry.failure}));
if(!entry.passed)process.exitCode=1;
