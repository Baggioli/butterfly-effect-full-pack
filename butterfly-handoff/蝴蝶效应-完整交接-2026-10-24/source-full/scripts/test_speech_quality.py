from types import SimpleNamespace
from speech_quality import reliable_text,noise_text
def segment(text,**kw):
 data=dict(text=text,start=0,end=1,avg_logprob=-.2,no_speech_prob=.05,compression_ratio=1.0)
 data.update(kw)
 return SimpleNamespace(**data)
assert reliable_text([segment('我擅长表格整理')])=='我擅长表格整理'
assert reliable_text([segment('字幕by索兰娅')]) is None
assert reliable_text([segment('字幕by索兰娅 字幕by索兰娅')]) is None
assert reliable_text([segment('错误猜测',no_speech_prob=.9,avg_logprob=-.9)]) is None
assert reliable_text([segment('低置信度',avg_logprob=-1.2)]) is None
assert reliable_text([segment('我做字幕设计')])=='我做字幕设计'
print('通过：字幕幻觉、无声置信度、过低置信度拒绝，正常自述保留。')

assert reliable_text([segment('请不吝点赞 订阅 转发 打赏支持明镜与点点栏目')]) is None
assert reliable_text([segment('我想增加公司视频的点赞和订阅')]) == '我想增加公司视频的点赞和订阅'
