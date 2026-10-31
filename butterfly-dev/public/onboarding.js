import Core from './onboarding-core.js';
import {SilenceGate} from './voice-turn.js';
import VoiceOutput from './voice-output.js';
import {audioRoutes} from './audio-devices.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export default class ChatOnboarding{
 constructor(adapter){this.a=adapter;this.preferredMic='';this.routes={};globalThis.navigator?.mediaDevices?.addEventListener?.('devicechange',()=>{clearTimeout(this.deviceTimer);this.deviceTimer=setTimeout(()=>this.refreshDevices(true),300)});this.active=false;this.required=false;this.busy=false;this.spoken='';this.recorder=null;this.stream=null;this.abort=null;globalThis.document?.addEventListener?.('visibilitychange',()=>{if(document.hidden&&this.active){this.voiceMode=false;this.stopMedia(true);this.recording=false;this.voiceStatus='语音已暂停，回来后点一下继续。';this.render()}})}
 open(user=null,required=false){
  this.restartForDevice=false;this.voiceMode=false;this.textMode=false;this.voiceRead=false;this.spoken='';this.speaking=false;this.voiceStatus='';this.required=required;this.active=true;this.target=user?.id||null;
  const draft=user?null:this.a.getDraft();
  this.s=draft?.version===1?draft:{version:1,kind:user?'checkin':'initial',profile:{...Core.clean(user?.profile||{}),name:user?.profile?.name||''},evidence:{...(user?.profileEvidence||{})},interpretations:structuredClone(user?.profileInterpretations||[]),asked:[],skipped:[],messages:[],phase:'intro',startedAt:new Date().toISOString(),draftInput:''};
  if(this.s.kind==='initial'&&Core.isNoiseTranscript(this.s.profile.goal)){
   this.s.unconfirmedInputs??=[];this.s.unconfirmedInputs.push({field:'goal',value:this.s.profile.goal,reason:'声音识别待重新确认'});
   delete this.s.profile.goal;delete this.s.evidence.goal;this.s.asked=this.s.asked.filter(k=>k!=='goal');this.s.skipped=this.s.skipped.filter(k=>k!=='goal');
   this.s.messages=[...this.s.messages.map(m=>({...m,archived:true})),{role:'friend',text:'刚才那句话没听清。最近，你最想改变的一件事是什么？'}];this.s.field='goal';this.s.phase='talk';this.persist();
  }
  if(this.s.phase==='generating')this.s.phase='card';
  if(this.s.phase==='talk'&&this.s.asked.includes(this.s.field)){const next=Core.next(this.s.profile,this.s.asked,this.s.skipped,this.s.kind);this.s.field=next;if(next)this.s.messages.push({role:'friend',text:Core.question(next,this.s.profile)});else this.s.phase='card'}
  this.busy=false;this.error='';this.render();this.refreshDevices();
 }

 ensureSensitive(next){
  if(this.a.requireSensitiveConsent && !this.a.hasSensitiveConsent?.()){
   this.a.requireSensitiveConsent(next);
   return false;
  }
  return true;
 }
 persist(){if(this.s.kind==='initial')this.a.saveDraft(structuredClone(this.s))}
 beforeClose(){if(!this.active)return true;if(this.required){this.a.toast('可以用文字说一句近况，或选择最近没有变化。');return false}this.active=false;this.voiceMode=false;this.stopMedia(true);this.audioContext?.close?.();this.audioContext=null;this.abort?.abort();this.persist();return true}
 stopMedia(discard=false){this.discardAudio=discard;if(this.audioTurn)this.audioTurn.discard=discard;if(this.recorder?.state==='recording')this.recorder.stop();this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;clearInterval(this.recordClock);clearTimeout(this.recordLimit);this.voiceEpoch=(this.voiceEpoch||0)+1;this.speaking=false;this.preparingVoice=false;this.voiceSource?.disconnect();this.voiceSource=null;this.voiceSink?.disconnect();this.voiceSink=null;this.voiceOutput?.stop();window.speechSynthesis?.cancel()}
 begin(){this.s.phase='talk';this.s.field=Core.next(this.s.profile,this.s.asked,this.s.skipped,this.s.kind);if(!this.s.field)return this.card();this.s.messages.push({role:'friend',text:(!this.s.asked.length?'嗯，我们慢慢聊就好。':'')+Core.question(this.s.field,this.s.profile)});this.persist();this.render();this.speak()}
 async previewVoice(){
  if(this.busy||this.recording||this.speaking||this.preparingVoice)return;this.voiceMode=false;this.voiceRead=true;this.spoken='';this.error='';
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){this.fallback('这个浏览器暂时无法播放声音。');return}
  try{this.audioContext??=new Audio();await this.audioContext.resume();await this.speak()}catch{this.fallback('声音暂时没有播放出来，请重新试一次。')}
 }
 micTracks(stream=this.stream){return stream?.getAudioTracks?.()||stream?.getTracks?.()||[]}
 hasMic(){return this.micTracks().some(t=>t.readyState!=='ended')}
 async ensureMic(session,epoch){
  if(this.hasMic())return this.stream;
  const stream=await (this.a.getMicrophone||navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices))({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,...(this.preferredMic?{deviceId:{exact:this.preferredMic}}:{})}});
  if(!this.active||this.s!==session||!this.voiceMode||this.voiceEpoch!==epoch){this.micTracks(stream).forEach(t=>t.stop());return null}
  this.stream=stream;this.micTracks().forEach(t=>{t.enabled=false;t.onended=()=>{if(this.active&&this.voiceMode)this.refreshDevices(true,true)}});await this.refreshDevices();
  return stream;
 }
 async startVoice(){
  if(!this.ensureSensitive(()=>this.startVoice()))return;
  if(this.busy||this.recording||this.micPending){
   const tip=this.micPending?'正在接通麦克风，请稍候…':this.recording?'正在听你说，说完点一下或稍等…':'正在处理上一句，请稍候…';
   this.voiceStatus=tip;this.error=tip;this.render();this.a.toast?.(tip);return;
  }
  // P0-22: http://LAN 非安全上下文会静默拦 getUserMedia，intro 页原先无任何反馈。
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
   this.fallback('当前页面不是安全连接（需要 https 或 localhost）才能使用麦克风。已为你切换到文字聊天；也可点「用文字聊」。');
   return;
  }
  this.voiceMode=true;this.textMode=false;this.voiceRead=true;this.spoken='';this.error='';this.voiceStatus='先接通麦克风，再开始聊…';this.preparingVoice=true;this.render();
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio||!window.MediaRecorder){this.fallback('这个浏览器暂不支持语音交流，请用系统浏览器打开，或先用文字继续。');return}
  const session=this.s,epoch=this.voiceEpoch=(this.voiceEpoch||0)+1;this.micPending=true;
  try{
   this.audioContext??=new Audio();
   const mic=this.ensureMic(session,epoch);
   const [stream]=await Promise.all([mic,this.audioContext.resume()]);
   if(!stream||!this.active||this.s!==session||!this.voiceMode||this.voiceEpoch!==epoch){
    if(this.active&&this.s===session&&this.voiceEpoch===epoch&&this.voiceMode){
     this.preparingVoice=false;this.voiceStatus='麦克风没有接通，请再试一次，或改用文字聊。';this.error=this.voiceStatus;this.render();this.a.toast?.(this.voiceStatus);
    }
    return;
   }
   this.micPending=false;this.preparingVoice=false;
   if(this.s.phase==='intro')this.begin();else {this.render();this.speak()}
  }catch(e){if(this.active&&this.s===session&&this.voiceEpoch===epoch)this.fallback(this.micError(e))}
  finally{this.micPending=false;this.resumeDeviceVoice()}
 }
 micError(e){
  return ({NotAllowedError:'麦克风没有获得允许，请在浏览器或系统设置中允许使用麦克风，再点继续。',NotFoundError:'没有找到可用麦克风，请连接麦克风后再试，或先用文字继续。',NotReadableError:'麦克风暂时被其他程序占用，请关闭占用后再试。',OverconstrainedError:'刚才选择的麦克风不可用，请换一个麦克风。',SecurityError:'当前页面不是安全连接，浏览器不允许使用麦克风。请改用文字聊，或通过 https / localhost 打开。'}[e?.name]||'语音连接暂时中断，请重新点继续，或先用文字继续。');
 }
 async refreshDevices(changed=false,ended=false){
  if(!globalThis.navigator?.mediaDevices?.enumerateDevices)return;
  try{
   const session=this.s,devices=await navigator.mediaDevices.enumerateDevices();if(!this.active||this.s!==session)return;
   const old=this.routes||{},next=audioRoutes(devices,this.preferredMic,this.micTracks()[0]?.label);
   const missing=this.preferredMic&&!devices.some(d=>d.kind==='audioinput'&&d.deviceId===this.preferredMic);
   if(missing){this.preferredMic='';Object.assign(next,audioRoutes(devices))}
   this.routes=next;this.micOptions=devices.filter(d=>d.kind==='audioinput'&&d.deviceId!=='default');
   const inputChanged=ended||missing||(!this.preferredMic&&old.inputKey&&next.inputKey&&old.inputKey!==next.inputKey);
   if(changed&&inputChanged&&(this.stream||ended)){
    const resume=this.voiceMode;this.stopMedia(true);this.recording=false;
    this.voiceStatus='声音设备已切换，正在重新接通…';
    // Never interrupt a submitted answer or start a paused/background session.
    if(resume&&this.micPending&&!this.busy)this.restartForDevice=true;
    if(resume&&!this.busy&&!this.micPending&&!document.hidden){this.voiceMode=false;await this.startVoice();return}
   }
   this.render();
  }catch{/* Device names may be unavailable before permission; the system default still works. */}
 }
 resumeDeviceVoice(){if(!this.restartForDevice)return;this.restartForDevice=false;if(this.active&&this.voiceMode&&!this.busy&&!document.hidden){this.voiceMode=false;this.startVoice()}}
 deviceSummary(){const r=this.routes||{};return (this.preferredMic?'本次选择':'自动跟随系统')+' · 麦克风：'+(r.input||'开始后识别')+' · 播放：'+(r.output||'跟随系统输出')}
 async chooseMic(){
  this.voiceMode=false;this.stopMedia(true);this.recording=false;
  await this.refreshDevices();this.showMicOptions=true;this.voiceStatus='默认自动跟随系统；也可以只为这次聊天选择麦克风。';this.render();
 }
 fallback(message){this.voiceMode=false;this.voiceRead=false;this.textMode=true;this.stopMedia(true);this.recording=false;this.preparingVoice=false;this.voiceStatus='';this.error=message;this.a.toast?.(message);if(this.s?.phase==='intro'){this.begin();return}this.render()}
 async speak(){
  if(!this.active||!this.voiceRead)return;
  this.micTracks().forEach(t=>t.enabled=false);
  const session=this.s,epoch=this.voiceEpoch=(this.voiceEpoch||0)+1;
  let text;
  if(session.phase==='card'){
   const items=['goal','role','age','education','skills','constraints','hours'].filter(k=>Core.known(session.profile[k])).map(k=>Core.labels[k]+'：'+String(session.profile[k]).slice(0,80)+(k==='hours'?'小时':''));
   text='我把你刚才说的整理好了。'+items.join('。')+'。你听听，这些准确吗？可以说“确认”，也可以直接告诉我哪里要改。';
  }else{
   text=session.messages.slice(-2).filter(m=>m.role==='friend').map(m=>m.text).join('。');if(!text&&session.phase==='intro')text='嗯，我们慢慢聊就好。'+Core.question('goal',session.profile);
  }
  if(!text||text===this.spoken)return;this.spoken=text;
  this.preparingVoice=true;this.speaking=false;this.voiceStatus='我想想怎么和你说…';this.render();
  const current=()=>this.active&&this.s===session&&this.voiceEpoch===epoch;
  this.voiceOutput??=new VoiceOutput();
  await this.voiceOutput.speak(text,this.audioContext,{
   onStart:mode=>{if(!current())return;this.voiceOutputMode=mode;this.preparingVoice=false;this.speaking=true;this.voiceStatus='我在说，接下来听你说';this.render()},
   onEnd:()=>{if(!current())return;this.preparingVoice=false;this.speaking=false;this.voiceStatus=this.voiceMode?'':'听到了吗？准备好后，点一下就可以接着聊。';this.render();if(this.voiceMode)this.record()},
   onError:message=>{if(current()){this.preparingVoice=false;this.fallback(message)}}
  });
 }
 watchSilence(stream){
  if(!this.audioContext||!this.voiceMode)return;
  const source=this.audioContext.createMediaStreamSource(stream),analyser=this.audioContext.createAnalyser(),sink=this.audioContext.createGain();
  analyser.fftSize=2048;sink.gain.value=0;source.connect(analyser);analyser.connect(sink);sink.connect(this.audioContext.destination);this.voiceSource=source;this.voiceSink=sink;
  const samples=new Float32Array(analyser.fftSize),gate=this.voiceGate=new SilenceGate();this.signalPeak=0;
  this.recordClock=setInterval(()=>{
   if(!this.recording)return;analyser.getFloatTimeDomainData(samples);let sum=0;for(const v of samples)sum+=v*v;
   const rms=Math.sqrt(sum/samples.length);this.signalPeak=Math.max(this.signalPeak,rms);
   const bar=document.querySelector('.voice-input-level>i');if(bar)bar.style.width=Math.min(100,rms*1800)+'%';
   const result=gate.sample(rms,performance.now());
   if(result==='empty'){this.discardAudio=true;this.voiceMode=false;this.voiceStatus='没有听到清晰的人声，已暂停。靠近麦克风再试，或换个麦克风。';this.recorder?.stop()}
   else if(result==='done')this.recorder?.stop();
  },80);
 }
 async acceptTranscript(value){
  if(Core.isNoiseTranscript(value)){this.voiceMode=false;this.stopMedia(true);this.voiceStatus='刚才没有听清，请再说一次。';this.error='这句话没有用于建档，也没有跳到下一题。';this.render();return}
  if(this.s.phase!=='card'){await this.send(value);return}
  if(/^(确认|对的|是的|没问题|准确|可以|确认无误)[，,。！!\s]*$/.test(value.trim())){this.confirm();return}
  const session=this.s;this.busy=true;this.render();
  try{
   const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'interview',field:'recentUpdate',answer:value,profile:this.s.profile,asked:[],skipped:[]}),signal:AbortSignal.timeout(60000)});const d=await r.json();if(!r.ok)throw Error();if(!this.active||this.s!==session)return;
   this.s.profile={...Core.clean(d.profile),name:this.s.profile.name};this.s.evidence={...this.s.evidence,...d.evidence};this.spoken='';this.busy=false;this.persist();this.render();this.speak();
  }catch{if(!this.active||this.s!==session)return;this.busy=false;this.fallback('这次更正没有整理完成，请直接修改角色卡，或重新开启语音。')}
 }
 render(){
  if(!this.active)return;
  const s=this.s,title=s.kind==='edit'?'我的角色卡':s.kind==='checkin'?'聊聊最近的你':'像朋友一样，先聊聊你';
  let body='',footer='';
  if(s.phase==='intro'){
   body='<div class="chat-intro"><span class="tag">蝴蝶效应 · 先听你说</span><div class="chat-avatar">⋈</div><h3>最近，最想改变的一件事是什么？</h3><p>像和朋友说说心里话。想做什么、擅长什么、眼下有什么难处，都可以慢慢告诉我。</p><p class="microcopy">内容只在你的私人服务中整理，录音转成文字后不保留原始音频。角色卡由你确认后才采用。</p></div>';
   footer='<button class="voice-start" data-c="start-voice"><span>◉</span>开始语音聊天</button><button class="link" data-c="start-text">现在不方便说话，用文字聊</button>';
  }else if(s.phase==='talk'){
   const field=s.field,choices=Core.options[field]||[];
   body='<div class="chat-progress"><span>'+escape(s.kind==='checkin'?'一次轻量近况确认':'慢慢说，不用一次想清楚')+'</span>'+(!this.voiceMode&&!this.busy&&!this.speaking&&!this.preparingVoice?'<button class="link voice-replay" data-c="preview-voice">听听这个问题</button>':'')+'</div><div class="chat-messages" aria-live="polite">'+s.messages.filter(m=>!m.archived).map(m=>'<div class="chat-bubble '+(m.role==='user'?'mine':'friend')+'">'+escape(m.text)+'</div>').join('')+(this.busy?'<div class="chat-bubble friend">我在认真整理你刚才说的…</div>':'')+'</div>';
   const status=this.busy?'正在认真想你刚才说的…':this.preparingVoice?'让我想想怎么和你说…':this.speaking?'我在说，接下来听你说':this.recording?'我在听，慢慢说…':this.voiceStatus||'准备好了，随时可以继续';
   const disabled=this.busy||this.preparingVoice||this.speaking||this.recording;
   footer='<div class="chat-footer"><div class="voice-state" role="status">'+escape(status)+'</div>'+(!this.textMode?'<div class="voice-controls">'+(this.recording?'<div class="voice-input-level" role="img" aria-label="麦克风音量"><i></i></div>':'')+'<button class="voice-orb '+(this.recording?'listening':this.speaking?'speaking':'')+'" data-c="'+(this.recording?'record':(this.voiceMode||this.speaking||this.preparingVoice)?'pause-voice':'start-voice')+'" '+(this.busy?'disabled':'')+' data-voice-output="'+(this.speaking?'playing':this.preparingVoice?'preparing':'idle')+'" aria-label="'+(this.recording?'我说完了':(this.voiceMode||this.speaking||this.preparingVoice)?'暂停语音':'继续语音聊天')+'"><span>⋈</span></button><p class="voice-hint">'+(this.recording?'停顿后会自动接着聊，也可以点一下表示说完了':this.speaking?(this.voiceMode?'说完这一句，我就听你说':'正在播报，点一下可以暂停'):this.voiceMode?'可以随时暂停':'点一下继续语音聊天')+'</p></div><div class="chat-bottom"><button class="link" data-c="type">改用文字</button><button class="link" data-c="choose-mic">声音设备</button><button class="link" data-c="skip" '+(disabled?'disabled':'')+'>这题先跳过</button></div>':'<div class="chat-options">'+choices.map(v=>'<button class="chat-chip" data-c="option" data-value="'+escape(v)+'" '+(disabled?'disabled':'')+'>'+escape(v)+'</button>').join('')+'</div><div class="chat-compose"><textarea id="chat-answer" '+(this.busy?'disabled':'')+' rows="2" maxlength="2000" aria-label="你的回答" placeholder="想说什么都可以，慢慢写">'+escape(s.draftInput||'')+'</textarea><button class="btn" data-c="send" '+(this.busy?'disabled':'')+'>发送</button></div><div class="chat-bottom"><button class="link" data-c="start-voice" '+(this.busy?'disabled':'')+'>换成语音聊天</button><button class="link" data-c="choose-mic">声音设备</button><button class="link" data-c="skip" '+(disabled?'disabled':'')+'>这题先跳过</button></div>')+'<p class="voice-device-summary" aria-live="polite">'+escape(this.deviceSummary())+'</p><p class="chat-error" role="status">'+escape(this.error||'')+'</p>'+(this.showMicOptions?'<label class="voice-mic-choice">使用哪个麦克风？<select id="chat-mic"><option value="" '+(!this.preferredMic?'selected':'')+'>自动识别（跟随系统）</option>'+(this.micOptions||[]).map((d,i)=>'<option value="'+escape(d.deviceId)+'" '+(d.deviceId===this.preferredMic?'selected':'')+'>'+escape(d.label||'麦克风 '+(i+1))+'</option>').join('')+'</select></label>':'')+'</div>';

  }else if(s.phase==='card'){
   const keys=['goal','role','age','education','skills','hours','constraints','resources','experience','interests'];
   const editor=k=>'<label class="chat-fact"><span>'+Core.labels[k]+'<small>'+(Core.known(s.profile[k])?'你明确说过':'尚未补充')+'</small></span>'+(k==='education'?'<select name="'+k+'">'+['','初中及以下','高中 / 中专','大专','本科','硕士','博士','其他'].map(v=>'<option value="'+v+'" '+(s.profile[k]===v?'selected':'')+'>'+escape(v||'暂时未知')+'</option>').join('')+'</select>':'<input name="'+k+'" '+(['age','hours'].includes(k)?'type="number" step="'+(k==='hours'?'.5':'1')+'" min="'+(k==='hours'?'.5':'1')+'" max="'+(k==='hours'?'80':'120')+'"':'type="text"')+' value="'+escape(s.profile[k]??'')+'" maxlength="2000" placeholder="可以之后再补充">')+(s.evidence[k]?'<details><summary>看看原话依据</summary><small>'+escape(s.evidence[k].evidence)+'</small></details>':'')+'</label>';
   body='<section class="chat-role"><div class="chat-avatar">♧</div><h3>我的角色卡</h3><p>这只是现在的你，随时可以改写。</p></section><form id="chat-role-card"><label class="chat-fact"><span>希望怎么称呼你？<small>可留空</small></span><input name="name" maxlength="100" value="'+escape(s.profile.name||'')+'" placeholder="朋友"></label><h3>你明确说过的</h3>'+keys.filter(k=>Core.known(s.profile[k])).map(editor).join('')+'<details class="chat-unknown"><summary>还有 '+keys.filter(k=>!Core.known(s.profile[k])).length+' 项尚未补充</summary>'+keys.filter(k=>!Core.known(s.profile[k])).map(editor).join('')+'</details></form><section class="chat-understanding"><h3>有待确认的理解</h3><p class="microcopy">这些不是事实，不会自动写进你的角色信息或用来限制选择。</p>'+(s.interpretations.length?s.interpretations.map((v,i)=>'<div class="chat-inference"><p>'+escape(v.text)+'</p><span class="tag">'+({pending:'待你判断',confirmed:'你确认的理解',rejected:'已标为不准确'}[v.state]||'待你判断')+'</span><div class="row"><button class="btn light tiny" data-c="interpret" data-value="'+i+'|confirmed">符合我</button><button class="btn light tiny" data-c="interpret" data-value="'+i+'|rejected">不准确</button></div></div>').join(''):'<p>目前没有需要额外推断的内容。</p>')+'</section><p class="chat-error" role="status">'+escape(this.error||'')+'</p>';
   footer='<button class="btn" data-c="confirm">'+(s.kind==='edit'?'保存角色卡':s.kind==='checkin'?'确认近况，继续旅程':(this.error?'重新展开故事':'确认角色卡，展开故事'))+'</button><button class="link" data-c="'+(this.voiceMode?'pause-voice':'start-voice')+'">'+(this.recording?'正在听你确认或更正…':this.voiceMode?'暂停语音确认':'用语音确认或更正')+'</button>'+(this.error&&s.kind==='initial'?'<p class="microcopy">角色卡已保存在本机，可修改后再次展开。</p>':'');
  }else if(s.phase==='generating'){
   const elapsed=Math.max(0,Math.floor((Date.now()-(this.genStartedAt||Date.now()))/1000));
   const mm=String(Math.floor(elapsed/60)).padStart(1,'0'),ss=String(elapsed%60).padStart(2,'0');
   body='<div class="chat-intro"><div class="chat-avatar">⋈</div><h3>正在把你的故事慢慢展开…</h3><p>会有完整的四幕，也会把今天和近期的第一小步写清楚。</p><p class="microcopy">故事生成大约需要 2–3 分钟；若高峰排队请耐心等待。</p><p class="microcopy" id="plan-elapsed" aria-live="polite">已等待 '+mm+':'+ss+' · 角色卡已保存在本机</p></div>';
  }
  this.inline=this.s.kind==='initial'&&['intro','talk'].includes(s.phase)&&Boolean(this.a.home);
  if(this.inline)this.a.home(title,body,footer);else this.a.modal(title,body,footer);const dialog=document.querySelector(this.inline?'#home-conversation':'#modal .modal');dialog?.classList.add('chat-dialog');this.a.viewport();
  dialog?.addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b)return;e.preventDefault();e.stopPropagation();this.action(b.dataset.c,b.dataset.value)});
  document.querySelector('#chat-mic')?.addEventListener('change',e=>{this.preferredMic=e.target.value;this.showMicOptions=false;this.voiceStatus='声音设备已更新，点一下继续。';this.refreshDevices();this.render()});
  const cardForm=document.querySelector('#chat-role-card');for(const event of ['input','change'])cardForm?.addEventListener(event,()=>{this.captureCard();this.persist()});
  const input=document.querySelector('#chat-answer');input?.addEventListener('input',()=>{s.draftInput=input.value;this.persist()});
  input?.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();this.send()}});
  const scroll=dialog?.querySelector('.modalbody');if(s.phase==='talk'&&scroll)scroll.scrollTop=scroll.scrollHeight;
 }
 action(action,value){
  if(action==='choose-mic'){this.chooseMic();return}
  if(action==='preview-voice'){this.previewVoice();return}
  if(action==='begin'||action==='start-voice'){this.startVoice();return}
  if(action==='start-text'){if(!this.ensureSensitive(()=>{this.textMode=true;this.voiceMode=false;this.voiceRead=false;this.begin()}))return;this.textMode=true;this.voiceMode=false;this.voiceRead=false;this.begin();return}
  if(action==='pause-voice'){this.voiceMode=false;this.stopMedia(true);this.recording=false;this.voiceStatus='语音已暂停，准备好后点一下继续。';this.render();return}
  if(action==='leave'){if(this.beforeClose())this.a.leaveHome?.();return}
  if(action==='voice-read'){this.voiceRead=!this.voiceRead;this.spoken='';if(this.voiceRead)this.speak();else window.speechSynthesis?.cancel();this.render();return}
  if(action==='type'){this.voiceMode=false;this.voiceRead=false;this.textMode=true;this.stopMedia(true);this.recording=false;this.render();document.querySelector('#chat-answer')?.focus();return}
  if(action==='record'){this.record();return}
  if(action==='send'){this.send();return}
  if(action==='option'){this.send(value);return}
  if(action==='skip'){if(this.busy||this.recording)return;this.s.skipped.push(this.s.field);this.s.asked.push(this.s.field);this.s.messages.push({role:'user',text:'这题先跳过，之后再补充。'});this.advance('没关系，先放在这里。');return}
  if(action==='interpret'){this.captureCard();const [i,state]=value.split('|');this.s.interpretations[Number(i)].state=state;this.persist();this.render();return}
  if(action==='confirm'){this.confirm()}
 }
 advance(ack){
  const s=this.s,field=Core.next(s.profile,s.asked,s.skipped,s.kind);if(ack)s.messages.push({role:'friend',text:ack});s.field=field;s.draftInput='';this.busy=false;
  if(!field){this.card();return}s.messages.push({role:'friend',text:Core.question(field,s.profile)});this.persist();this.render();this.speak();
 }
 async send(explicit){
  if(this.busy||this.recording)return;const answer=(explicit??document.querySelector('#chat-answer')?.value??this.s.draftInput??'').trim();if(!answer){this.error='说一点或写一点就好，也可以先跳过。';this.render();return}
  const s=this.s,field=s.field;s.messages.push({role:'user',text:answer});const direct=Core.apply(s.profile,field,answer);s.profile=direct.profile;s.evidence={...s.evidence,...direct.evidence};s.asked.push(field);s.draftInput='';this.busy=true;this.error='';this.persist();this.render();
  try{
   const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'interview',field,answer,profile:s.profile,asked:s.asked,skipped:s.skipped,kind:s.kind}),signal:AbortSignal.timeout(60000)});
   const d=await r.json();if(!r.ok)throw Error(d.error||'这次整理没有完成。');if(!this.active||this.s!==s)return;
   s.profile={...Core.clean(d.profile),name:s.profile.name||''};s.evidence={...s.evidence,...d.evidence};for(const item of d.interpretations||[])if(!s.interpretations.some(v=>v.text===item.text))s.interpretations.push(item);s.interpretations=s.interpretations.slice(-4);this.advance(d.acknowledgement||'谢谢你愿意告诉我。');
  }catch(e){
   if(!this.active||this.s!==s)return;this.voiceMode=false;this.voiceRead=false;this.voiceStatus='语音已暂停';this.error='这次私人整理没有完成，你的原话已保留。可以稍后继续或用文字修改。';this.advance('你的原话我先保存下来，不做额外猜测。');
  }
 }
 card(){this.stopMedia();this.s.phase='card';this.busy=false;this.persist();this.render();if(this.voiceMode){this.spoken='';this.speak()}}
 captureCard(){
  const form=document.querySelector('#chat-role-card');if(!form)return;
  const p={...this.s.profile},data=Object.fromEntries(new FormData(form));for(const [key,value] of Object.entries(data)){const v=String(value).trim();if(!v){delete p[key];delete this.s.evidence[key];continue}p[key]=key==='hours'?Number(v):v;if(String(this.s.profile[key]??'')!==String(p[key]))this.s.evidence[key]={value:p[key],evidence:'你在角色卡中亲自填写并确认',source:'user'};}this.s.profile=p;
 }
 confirm(){
  const form=document.querySelector('#chat-role-card');if(!form?.reportValidity())return;this.captureCard();
  if(this.s.kind==='initial'&&!Core.known(this.s.profile.goal)){this.error='先在角色卡里补一句最想改变的事，就可以展开故事。';this.render();return}
  this.voiceMode=false;this.voiceRead=false;this.stopMedia(true);this.recording=false;this.s.confirmedAt=new Date().toISOString();this.persist();
  if(this.s.kind!=='initial'){this.active=false;this.required=false;const res=this.a.update(this.target,this.s);this.a.close();this.a.toast(res?.goalChanged?'新目标已保存，正在立即重算路线与故事…':'近况已记录，已有行动和历史都保留。');return}
  this.generate();
 }
 async generate(){
  const p={...Core.clean(this.s.profile),name:this.s.profile.name||'朋友',kind:'custom',dream:this.s.profile.goal,conversationEvidence:this.s.evidence,conversationInterpretations:this.s.interpretations,conversationConfirmedAt:this.s.confirmedAt};
  this.s.phase='generating';this.busy=true;this.error='';this.genStartedAt=Date.now();this.persist();this.render();
  clearInterval(this.progressTimer);this.progressTimer=setInterval(()=>{if(this.active&&this.s.phase==='generating')this.render()},1000);
  this.abort=new AbortController();const timer=setTimeout(()=>this.abort.abort(),300000);
  try{
   const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'plan',profile:Core.clean(p)}),signal:this.abort.signal});const d=await r.json();if(!r.ok){const err=Error(d.error||'这次故事还没有完成。');err.code=d.code;err.retryAfterSec=d.retryAfterSec;throw err;}if(!this.active)return;
   this.active=false;this.busy=false;this.a.story(p,d.story);
  }catch(e){if(!this.active)return;this.s.phase='card';this.busy=false;const aborted=e?.name==='AbortError';const busy=e?.code==='PLAN_BUSY';this.error=aborted?'故事生成超时，角色卡已保存，可以点下方按钮重试。':busy?(e.message||'故事生成高峰排队中，角色卡已保存。请稍后再试。'):((e?.name==='TypeError'||/load failed|failed to fetch|networkerror|network connection was lost|network request failed|offline/i.test(String(e?.message||'')))?'暂时连不上私人规划服务（网络中断，或手机 Tailscale 未连接），角色卡已保存。请确认已连上后点下方按钮重试。':(e?.message||'这次故事没有完成，角色卡已保存，可以稍后重试。'));this.persist();this.render()}finally{clearTimeout(timer);clearInterval(this.progressTimer);this.progressTimer=null;this.genStartedAt=null}
 }
 async record(){
  if(this.busy||this.micPending)return;if(this.recording){this.recorder?.stop();return}
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){this.fallback('这个浏览器暂不支持直接录音，可以用文字继续。');return}
  const session=this.s,epoch=this.voiceEpoch;this.micPending=true;window.speechSynthesis?.cancel();this.error='';this.discardAudio=false;
  try{
   const health=await fetch('/api/speech/status',{signal:AbortSignal.timeout(5000)});const state=await health.json();if(!health.ok||!state.available)throw Error('语音暂时不可用，可以先用文字继续。');
   if(!this.active||this.s!==session||!this.voiceMode||this.voiceEpoch!==epoch)return;
   this.stream=await this.ensureMic(session,epoch);if(!this.stream)return;
   if(this.audioContext?.state!=='running')await this.audioContext?.resume();
   this.micTracks().forEach(t=>t.enabled=true);if(!this.active||this.s!==session||!this.voiceMode||this.voiceEpoch!==epoch){this.stream.getTracks().forEach(t=>t.stop());return}
   const turn=this.audioTurn={discard:false},stream=this.stream;
   const type=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
   this.recorder=new MediaRecorder(this.stream,type?{mimeType:type,audioBitsPerSecond:64000}:undefined);const chunks=[];
   this.recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
   this.recorder.onerror=()=>{if(this.audioTurn===turn)this.fallback('录音意外中断，可以重新开启语音或用文字继续。')};
   this.recorder.onstop=async()=>{
    if(this.audioTurn!==turn){this.micTracks(stream).forEach(t=>t.stop());return;}
    this.micTracks(stream).forEach(t=>t.enabled=false);
    this.recording=false;clearTimeout(this.recordLimit);clearInterval(this.recordClock);this.voiceSource?.disconnect();this.voiceSource=null;this.voiceSink?.disconnect();this.voiceSink=null;
    if(!turn.discard&&!this.discardAudio&&this.voiceGate?.hasSpeech!==true){this.discardAudio=true;this.voiceMode=false;this.voiceStatus='没有听到清晰的人声，已暂停。这一轮没有用于建档。'}
    if(turn.discard||this.discardAudio||!this.active||this.s!==session){if(!this.voiceMode)this.micTracks(stream).forEach(t=>t.stop());if(this.active)this.render();return;}const blob=new Blob(chunks,{type:this.recorder.mimeType||type||'audio/webm'});
    if(blob.size>2*1024*1024){this.error='这段录音有点长，请分成短句说，或改用文字。';this.render();return}
    this.busy=true;this.speechNote='正在把语音整理成文字…';this.render();
    let spokenText='';
    try{const r=await fetch('/api/speech/transcribe',{method:'POST',headers:{'Content-Type':blob.type},body:blob,signal:AbortSignal.timeout(90000)});const d=await r.json();if(!r.ok||!d.text)throw Error(d.error||'没听清这句话，请再试一次或打字。');if(!this.active||this.s!==session)return;this.s.draftInput=d.text;spokenText=d.text;this.persist()}catch(e){this.voiceMode=false;this.stopMedia(true);this.voiceStatus='语音已暂停';this.error=e.message}finally{this.busy=false;if(this.active&&this.s===session)this.render()}
    if(spokenText&&this.active&&this.s===session){if(this.voiceMode)await this.acceptTranscript(spokenText);else{this.textMode=true;this.render()}}
   };
   this.recorder.start();this.recording=true;this.voiceStatus='';this.watchSilence(this.stream);this.a.onListening?.(this.s.field,this.stream);if(!this.active||!this.voiceMode||!this.recording)return;this.recordLimit=setTimeout(()=>{if(this.recorder?.state==='recording')this.recorder.stop()},45000);this.render();
  }catch(e){this.stream?.getTracks().forEach(t=>t.stop());this.recording=false;this.fallback(this.micError(e))}finally{this.micPending=false;this.resumeDeviceVoice()}
 }
}
