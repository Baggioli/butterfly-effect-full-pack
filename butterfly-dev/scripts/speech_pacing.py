"""Small, pitch-preserving pace adjustment; no audio files or external processes."""
from fractions import Fraction
import av
import numpy as np

def pace_speech(samples,sample_rate,rate=.85,min_duration=0):
 if not .65<=rate<=1.1:raise ValueError('unsupported speech pace')
 samples=np.ascontiguousarray(samples,dtype=np.float32).reshape(1,-1)
 if min_duration>0:rate=max(.65,min(rate,samples.size/sample_rate/min_duration))
 frame=av.AudioFrame.from_ndarray(samples,format='fltp',layout='mono')
 frame.sample_rate=sample_rate;frame.time_base=Fraction(1,sample_rate);frame.pts=0
 graph=av.filter.Graph()
 source=graph.add_abuffer(sample_rate=sample_rate,format='fltp',layout='mono',time_base=Fraction(1,sample_rate))
 tempo=graph.add('atempo',str(rate));sink=graph.add('abuffersink')
 source.link_to(tempo);tempo.link_to(sink);graph.configure()
 output=[]
 def drain():
  while True:
   try:output.append(graph.pull().to_ndarray().reshape(-1))
   except (av.BlockingIOError,av.EOFError):break
 graph.push(frame);drain();graph.push(None);drain()
 if not output:raise ValueError('empty speech after pace adjustment')
 return np.concatenate(output)
