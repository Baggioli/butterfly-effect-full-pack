// App-specific macOS login agent; SSH retains the user's existing config and host checks.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const label='com.lq.butterfly-effect.tunnel';
const domain=`gui/${process.getuid()}`;
const root=fileURLToPath(new URL('../',import.meta.url));
const runtime=resolve(root,'.runtime');
const directory=resolve(homedir(),'Library/LaunchAgents');
const file=resolve(directory,label+'.plist');
const marker='Managed by Butterfly Effect local deployment';
try{if(!(await readFile(file,'utf8')).includes(marker))throw Error('An unmanaged tunnel agent already exists.')}catch(e){if(e.code!=='ENOENT')throw e}
await mkdir(runtime,{recursive:true,mode:0o700});await mkdir(directory,{recursive:true});
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const args=['/usr/bin/ssh','-N','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ExitOnForwardFailure=yes','-o','ControlMaster=no','-o','ControlPath=none','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3','-L','127.0.0.1:8787:127.0.0.1:8787','dgx'];
await writeFile(file,`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<!-- ${marker} -->
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array>${args.map(a=>'<string>'+xml(a)+'</string>').join('')}</array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>15</integer>
<key>ProcessType</key><string>Background</string>
<key>StandardErrorPath</key><string>${xml(resolve(runtime,'tunnel-error.log'))}</string>
</dict></plist>\n`,{mode:0o600});
const run=(cmd,args)=>spawnSync(cmd,args,{encoding:'utf8'});
const checked=run('/usr/bin/plutil',['-lint',file]);if(checked.status!==0)throw Error(checked.stderr||checked.stdout);
// Retire only this application's previous one-shot control-master tunnel, if present.
run('/usr/bin/ssh',['-S',`/private/tmp/butterfly-effect-${process.getuid()}/dgx.sock`,'-O','exit','dgx']);
run('/bin/launchctl',['bootout',domain+'/'+label]);
run('/bin/launchctl',['enable',domain+'/'+label]);
const loaded=run('/bin/launchctl',['bootstrap',domain,file]);if(loaded.status!==0)throw Error(loaded.stderr);
console.log('Installed the application SSH tunnel with automatic reconnection.');
