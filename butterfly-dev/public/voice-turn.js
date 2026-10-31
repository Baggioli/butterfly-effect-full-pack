// A speech turn ends only after sustained voice followed by a natural pause.
export class SilenceGate{
 constructor({silenceMs=1900,noSpeechMs=12000,maxMs=45000,threshold=.006}={}){Object.assign(this,{silenceMs,noSpeechMs,maxMs,threshold});this.started=null;this.lastVoice=null;this.voicedMs=0;this.previous=null}
 get hasSpeech(){return this.voicedMs>=200}
 sample(rms,now){
  this.started??=now;const delta=this.previous===null?0:Math.min(100,now-this.previous);this.previous=now;
  if(rms>=this.threshold){this.voicedMs+=delta;this.lastVoice=now}
  if(now-this.started>=this.maxMs)return this.voicedMs>=200?'done':'empty';
  if(this.voicedMs>=200&&now-this.lastVoice>=this.silenceMs)return 'done';
  if(this.voicedMs<200&&now-this.started>=this.noSpeechMs)return 'empty';
  return null;
 }
}
