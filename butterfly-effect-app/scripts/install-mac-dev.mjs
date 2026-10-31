import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const label='com.lq.butterfly-effect.dev',domain=`gui/${process.getuid()}`;
const root=fileURLToPath(new URL('../',import.meta.url));
const directory=resolve(homedir(),'Library/LaunchAgents');
const file=resolve(directory,label+'.plist'),marker='Managed by Butterfly Effect local development';
try{if(!(await readFile(file,'utf8')).includes(marker))throw Error('An unmanaged development agent already exists.')}catch(e){if(e.code!=='ENOENT')throw e}
await mkdir(resolve(root,'.runtime'),{recursive:true,mode:0o700});await mkdir(directory,{recursive:true});
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
await writeFile(file,`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><!-- ${marker} -->
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(resolve(root,'scripts/dev.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>15</integer><key>ProcessType</key><string>Background</string>
<key>StandardErrorPath</key><string>${xml(resolve(root,'.runtime/dev-error.log'))}</string>
<key>StandardOutPath</key><string>${xml(resolve(root,'.runtime/dev.log'))}</string>
</dict></plist>\n`,{mode:0o600});
const run=args=>spawnSync('/bin/launchctl',args,{encoding:'utf8'});
const checked=spawnSync('/usr/bin/plutil',['-lint',file],{encoding:'utf8'});if(checked.status!==0)throw Error(checked.stderr||checked.stdout);
run(['bootout',domain+'/'+label]);run(['enable',domain+'/'+label]);
const loaded=run(['bootstrap',domain,file]);if(loaded.status!==0)throw Error(loaded.stderr);
console.log('Installed Mac local development preview at http://127.0.0.1:4173');
