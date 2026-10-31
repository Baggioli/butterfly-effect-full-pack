/** 推演/账户的本地文件持久化（仅 DGX 封闭测试；目录与文件权限 700/600）。 */
import {mkdirSync,readFileSync,writeFileSync,renameSync,chmodSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const safeKey=k=>String(k).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64)||'x';
function atomicWrite(file,data){const tmp=file+'.tmp';writeFileSync(tmp,data,{mode:0o600});chmodSync(tmp,0o600);renameSync(tmp,file);}
export function createFileProjectionStore(dir){
 mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);
 return {dir,
  async load(key){const f=join(dir,safeKey(key)+'.json');if(!existsSync(f))return null;try{return JSON.parse(readFileSync(f,'utf8'));}catch{return null;}},
  async save(key,doc){atomicWrite(join(dir,safeKey(key)+'.json'),JSON.stringify(doc));}};
}
export function createFileAccountPersist(file){
 return {file,
  load(){if(!existsSync(file))return null;try{return JSON.parse(readFileSync(file,'utf8'));}catch{return null;}},
  save(state){try{atomicWrite(file,JSON.stringify(state));}catch(e){console.error('account persist failed',e.message);}}};
}
