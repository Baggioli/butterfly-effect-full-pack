import urllib.request,urllib.parse,json,hashlib,time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
root=Path(__file__).resolve().parents[1]
for model,folder in [('Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice','.natural-tts-model'),('Qwen/Qwen3-ASR-1.7B','.natural-asr-model')]:
 base='https://modelscope.cn/api/v1/models/'+model+'/repo/'
 listing=json.load(urllib.request.urlopen(base+'files?Revision=master&Recursive=true',timeout=45))
 files=[f for f in listing['Data']['Files'] if f['Type']=='blob' and f['Path'] not in ['README.md','.gitattributes']]
 print(model,'files',len(files),flush=True)
 def get(f):
  path=f['Path'];target=root/folder/path
  assert not path.startswith('/') and '..' not in Path(path).parts
  target.parent.mkdir(parents=True,exist_ok=True)
  if target.is_file() and target.stat().st_size==f['Size']:
   if hashlib.file_digest(target.open('rb'),'sha256').hexdigest()==f['Sha256']:return
  url=base+'?Revision='+urllib.parse.quote(f['Revision'])+'&FilePath='+urllib.parse.quote(path)
  for attempt in range(5):
   try:
    sha=hashlib.sha256()
    with urllib.request.urlopen(url,timeout=90) as response,target.with_suffix(target.suffix+'.part').open('wb') as out:
     while data:=response.read(4*1024*1024):out.write(data);sha.update(data)
    if sha.hexdigest()!=f['Sha256']:raise ValueError('checksum mismatch')
    target.with_suffix(target.suffix+'.part').replace(target)
    print('Verified',folder,path,flush=True);return
   except Exception as e:
    print('Retry',path,type(e).__name__,flush=True)
    if attempt==4:raise
    time.sleep(2)
 with ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(get,files))
 print('Ready',folder,flush=True)
