import io,json,threading,wave,os
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio
from faster_whisper.vad import get_speech_timestamps,VadOptions
from speech_quality import reliable_text
root=Path(__file__).resolve().parents[1]
natural=os.environ.get('BUTTERFLY_NATURAL_SPEECH')=='1'
def natural_call(port,path,raw=None,kind='application/json',timeout=70):
 request=Request(f'http://127.0.0.1:{port}{path}',data=raw,headers={'Content-Type':kind})
 try:
  with urlopen(request,timeout=timeout) as response:return response.read(),response.status,response.headers.get('Content-Type','application/json')
 except HTTPError as error:return error.read(),error.code,'application/json'
def natural_ready(port):
 try:
  raw,status,_=natural_call(port,'/health',timeout=2)
  return status==200 and bool(json.loads(raw).get('available'))
 except Exception:return False
recognition_model=root/('.speech-model-turbo' if (root/'.speech-model-turbo/model.bin').is_file() else '.speech-model')
model=WhisperModel(str(recognition_model),device='cpu',compute_type='int8',cpu_threads=12,local_files_only=True)
voice=None
try:
 from piper import PiperVoice
 voice=PiperVoice.load(root/'.tts-model/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx')
except Exception: pass
lock=threading.Lock()
voice_lock=threading.Lock()
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def binary(self,raw,kind,status=200):
  self.send_response(status);self.send_header('Content-Type',kind);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
 def reply(self,data,status=200):
  self.binary(json.dumps(data,ensure_ascii=False).encode(),'application/json',status)
 def do_GET(self):
  if self.path!='/health':return self.reply({},404)
  transcription=natural_ready(8793) if natural else True;synthesis=natural_ready(8792) if natural else voice is not None
  self.reply({'available':transcription and synthesis,'transcription':transcription,'synthesis':synthesis,'recognitionModel':'Qwen3-ASR-1.7B' if natural else recognition_model.name,'voiceModel':'Qwen3-TTS-1.7B' if natural else 'piper-huayan'},200 if transcription and synthesis else 503)
 def do_POST(self):
  try:size=int(self.headers.get('Content-Length','0'))
  except ValueError:return self.reply({'error':'invalid length'},400)
  if self.path=='/speak':
   if not 0<size<=6000:return self.reply({'error':'text too long'},413)
   if not natural and voice is None:return self.reply({'error':'voice unavailable'},503)
   if not voice_lock.acquire(False):return self.reply({'error':'busy'},429)
   try:
    data=json.loads(self.rfile.read(size));text=data.get('text','')
    if not isinstance(text,str) or not text.strip() or len(text)>1200:return self.reply({'error':'invalid text'},400)
    if natural:
     raw,status,kind=natural_call(8792,'/speak',json.dumps({'text':text}).encode())
     return self.binary(raw,kind,status)
    audio=io.BytesIO()
    with wave.open(audio,'wb') as output:voice.synthesize_wav(text,output)
    self.binary(audio.getvalue(),'audio/wav')
   except Exception:self.reply({'error':'voice unavailable'},503)
   finally:voice_lock.release()
   return
  if self.path!='/transcribe' or not 0<size<=2097152:return self.reply({'error':'invalid recording'},413)
  if not lock.acquire(False):return self.reply({'error':'busy'},429)
  try:
   recording=self.rfile.read(size)
   audio=decode_audio(io.BytesIO(recording),sampling_rate=16000)
   if len(audio)/16000>75:return self.reply({'error':'recording too long'},413)
   chunks=get_speech_timestamps(audio,VadOptions(threshold=.55,min_speech_duration_ms=250,min_silence_duration_ms=350,speech_pad_ms=100))
   voiced=sum(c['end']-c['start'] for c in chunks)/16000
   if voiced<.25:return self.reply({'code':'NO_SPEECH','error':'没有听到清晰的人声，请靠近麦克风再说一次。'},422)
   if natural:
    raw,status,kind=natural_call(8793,'/transcribe',recording,self.headers.get('Content-Type','audio/webm'))
    return self.binary(raw,kind,status)
   segments,info=model.transcribe(audio,language='zh',beam_size=3,vad_filter=True,vad_parameters={'min_speech_duration_ms':250,'min_silence_duration_ms':350},condition_on_previous_text=False,initial_prompt='普通话日常对话。用简体中文记录。',log_prob_threshold=-.8,no_speech_threshold=.45,compression_ratio_threshold=2.2)
   result=reliable_text(list(segments))
   if not result:return self.reply({'code':'UNCERTAIN_SPEECH','error':'这句话没有听清，不会用于建档，请再说一次。'},422)
   self.reply({'text':result})

  except Exception:self.reply({'error':'transcription unavailable'},503)
  finally:lock.release()
ThreadingHTTPServer(('127.0.0.1',8791),Handler).serve_forever()
