"""Pure checks for untrusted speech hypotheses; no audio or text logging."""
import re
def noise_text(text):
 compact=re.sub(r"[\s，,。.!！?？:：;；]","",text)
 return bool(re.fullmatch(r"(?:字幕(?:by|由)[\w\u4e00-\u9fff-]{1,80}|(?:请不吝|請不吝)?(?:点赞|點贊)(?:订阅|訂閱)(?:转发|轉發)(?:打赏|打賞)支持.{0,40}|(?:感谢观看|感謝觀看|谢谢观看|謝謝觀看|thankyouforwatching){1,4})",compact,re.I))
def reliable_text(segments):
 accepted=[]
 for s in segments:
  if s.avg_logprob < -1.1 or (s.no_speech_prob > .5 and s.avg_logprob < -.65) or s.compression_ratio > 2.5:continue
  if s.end-s.start < .12:continue
  accepted.append(s.text)
 text=''.join(accepted).strip()[:6000]
 return text if text and not noise_text(text) else None
