"""Isolated, loopback-only Qwen speech workers. Audio and transcripts stay in memory."""
import argparse,io,json,threading,os,re
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import torch
parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['tts','asr']);args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
torch.set_num_threads(8)
if not torch.cuda.is_available():raise RuntimeError('CUDA is required for conversational speech')
if args.mode=='tts':
 from qwen_tts import Qwen3TTSModel
 import soundfile as sf
 from speech_pacing import pace_speech
 model=Qwen3TTSModel.from_pretrained(str(root/'.natural-tts-model'),device_map='cuda:0',dtype=torch.bfloat16,attn_implementation='sdpa',local_files_only=True)
else:
 from qwen_asr import Qwen3ASRModel
 from faster_whisper.audio import decode_audio
 from speech_quality import noise_text
 model=Qwen3ASRModel.from_pretrained(str(root/'.natural-asr-model'),device_map='cuda:0',dtype=torch.bfloat16,attn_implementation='sdpa',local_files_only=True,max_inference_batch_size=1,max_new_tokens=1024)
lock=threading.Lock()
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def reply(self,data,status=200,kind='application/json'):
  raw=data if isinstance(data,bytes) else json.dumps(data,ensure_ascii=False).encode()
  self.send_response(status);self.send_header('Content-Type',kind);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
 def do_GET(self):self.reply({'available':True,'mode':args.mode,'model':'Qwen3-1.7B','device':'cuda','voice':os.environ.get('BUTTERFLY_VOICE','Serena') if args.mode=='tts' else None} if self.path=='/health' else {},200 if self.path=='/health' else 404)
 def do_POST(self):
  expected='/speak' if args.mode=='tts' else '/transcribe'
  if self.path!=expected:return self.reply({'error':'not found'},404)
  try:size=int(self.headers.get('Content-Length','0'))
  except ValueError:return self.reply({'error':'invalid length'},400)
  if not 0<size<=(6000 if args.mode=='tts' else 2097152):return self.reply({'error':'invalid request size'},413)
  raw=self.rfile.read(size)
  if not lock.acquire(False):return self.reply({'error':'busy'},429)
  try:
   with torch.inference_mode():
    if args.mode=='tts':
     data=json.loads(raw);text=data.get('text','')
     if not isinstance(text,str) or not text.strip() or len(text)>1200:return self.reply({'error':'invalid text'},400)
     speaker=data.get('voice',os.environ.get('BUTTERFLY_VOICE','Serena'))
     if speaker not in ['Serena','Dylan','Uncle_Fu']:return self.reply({'error':'invalid voice'},400)
     waves,sr=model.generate_custom_voice(text=text,language='Chinese',speaker=speaker,instruct='用轻柔、温暖、放松的日常聊天语气，像坐在朋友身边慢慢说心里话。语速比平常稍慢，给对方思考的空隙，句间从容停顿。声音柔和但清晰，语调自然起伏，不急促，不刻意拖长字音。',max_new_tokens=min(2048,max(128,len(text)*16)),do_sample=True,temperature=.9,top_k=50,repetition_penalty=1.05)
     han=len(re.findall(r'[\u4e00-\u9fff]',text))
     audio=io.BytesIO();sf.write(audio,pace_speech(waves[0],sr,min_duration=han/3.3 if han>=5 else 0),sr,format='WAV',subtype='PCM_16');self.reply(audio.getvalue(),kind='audio/wav')
    else:
     audio=decode_audio(io.BytesIO(raw),sampling_rate=16000)
     if not .25<=len(audio)/16000<=75:return self.reply({'error':'invalid recording duration'},422)
     result=model.transcribe(audio=(audio,16000),language='Chinese')[0].text.strip()
     if not result or noise_text(result):return self.reply({'code':'UNCERTAIN_SPEECH','error':'这句话没有听清，请再说一次。'},422)
     self.reply({'text':result[:6000]})
  except Exception as error:
   print('speech request failed:',type(error).__name__,flush=True)
   self.reply({'error':'speech unavailable'},503)
  finally:lock.release()
print('Natural speech ready:',args.mode,flush=True)
ThreadingHTTPServer(('127.0.0.1',8792 if args.mode=='tts' else 8793),Handler).serve_forever()
