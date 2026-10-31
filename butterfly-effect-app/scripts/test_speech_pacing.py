import numpy as np
from speech_pacing import pace_speech
sr=24000
original=np.sin(2*np.pi*440*np.arange(sr*2)/sr).astype(np.float32)*.2
slower=pace_speech(original,sr)
assert 2.28<len(slower)/sr<2.4
freq=np.fft.rfftfreq(len(slower),1/sr)[np.argmax(abs(np.fft.rfft(slower)))]
assert abs(freq-440)<2,(freq,'voice pitch changed')
assert np.isfinite(slower).all() and np.max(abs(slower))<.3
print('Passed: slower speech duration, preserved pitch, valid audio level.')

controlled=pace_speech(original,sr,min_duration=2.7)
assert 2.6<len(controlled)/sr<2.8
