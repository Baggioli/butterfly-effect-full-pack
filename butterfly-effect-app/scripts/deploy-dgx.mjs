// Publish this local checkout to the existing private DGX application, preserving runtime credentials.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
const root=fileURLToPath(new URL('../',import.meta.url));
const env={...process.env,PATH:dirname(process.execPath)+':'+process.env.PATH,COPYFILE_DISABLE:'1'};
function run(command,args,extra={}){const r=spawnSync(command,args,{cwd:root,env,stdio:'inherit',...extra});if(r.error)throw r.error;if(r.status!==0)throw Error(command+' failed; deployment stopped')}
run('npm',['test']);run('npm',['run','build']);run('npm',['run','validate']);
const folder=mkdtempSync(join(tmpdir(),'butterfly-deploy-')),archive=join(folder,'source.tgz');
try{
 // Only runtime source is deployed. Personal verification documents and reports stay local.
 run('/usr/bin/tar',['--no-xattrs','-czf',archive,'public','worker','scripts','package.json','.openai','.gitignore']);
 const command='set -eu; cd ~/apps/butterfly-effect; tar -xzf -; export PATH="$HOME/.nvm/versions/node/v22.23.3/bin:$PATH"; npm run build; npm run validate; systemctl --user restart butterfly-effect.service; systemctl --user is-active butterfly-effect.service; if systemctl --user cat butterfly-effect-mobile.service >/dev/null 2>&1; then systemctl --user restart butterfly-effect-mobile.service; fi';
 run('/usr/bin/ssh',['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','dgx',command],{stdio:['pipe','inherit','inherit'],input:readFileSync(archive)});
 console.log('Local checkout deployed to the private DGX application.');
}finally{rmSync(folder,{recursive:true,force:true})}
