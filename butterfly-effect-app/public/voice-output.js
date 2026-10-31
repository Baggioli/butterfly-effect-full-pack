// Private speech playback is preferred; a device voice is a local fallback.
export function speechChunks(text,limit=60){
 const parts=String(text).match(/[^。！？!?；;]+[。！？!?；;]?/gu)||[String(text)],chunks=[];let pending='';
 for(let part of parts){
  if(pending&&pending.length+part.length>limit){chunks.push(pending);pending=''}
  while(part.length>limit){let end=part.slice(0,limit).lastIndexOf('，')+1;if(end<20)end=limit;chunks.push(part.slice(0,end));part=part.slice(end)}
  if(pending.length+part.length>limit){chunks.push(pending);pending=''}pending+=part;
 }
 if(pending)chunks.push(pending);return chunks.filter(Boolean);
}
export default class VoiceOutput{
 constructor(){this.epoch=0}
 stop(){
  this.epoch++;this.abort?.abort();this.abort=null;
  if(this.source){this.source.onended=null;try{this.source.stop()}catch{}this.source.disconnect();this.source=null}
  if(this.native){this.native.onend=null;this.native.onerror=null;this.native=null;globalThis.window?.speechSynthesis?.cancel()}
 }
 async speak(text,context,{onStart,onEnd,onError}){
  this.stop();const epoch=this.epoch,current=()=>this.epoch===epoch;
  const controller=this.abort=new AbortController();
  try{
   const chunks=speechChunks(text);
   const load=async part=>{
    const timer=setTimeout(()=>controller.abort(),70000);
    try{
     const response=await fetch('/api/speech/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:part}),signal:controller.signal});
     if(!response.ok||!response.headers.get('content-type')?.startsWith('audio/'))throw Error('voice unavailable');
     const bytes=await response.arrayBuffer();if(!current())return null;
     return await context.decodeAudioData(bytes);
    }finally{clearTimeout(timer)}
   };
   const first=await load(chunks[0]);if(!current())return;
   if(context.state!=='running')await context.resume();if(!current())return;
   if(context.state!=='running')throw Error('audio suspended');
   const play=(buffer,index)=>{
    if(!current())return;
    const next=index+1<chunks.length?load(chunks[index+1]).catch(()=>null):null;
    const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);
    source.onended=()=>{
     source.disconnect();if(this.source===source)this.source=null;if(!current())return;
     if(!next){onEnd();return}
     next.then(buffer=>{if(!current())return;if(buffer)play(buffer,index+1);else onError('声音暂时中断，请点一下继续，或改用文字。')});
    };
    this.source=source;source.start();if(index===0)onStart('private');
   };
   play(first,0);return;
  }catch{if(!current())return}
  // Never use a remote/browser cloud voice as an automatic fallback.
  const synth=globalThis.window?.speechSynthesis;
  let voices=synth?.getVoices()||[];
  if(synth&&!voices.some(v=>v.localService&&/^zh/i.test(v.lang))){
   voices=await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timeout);synth.removeEventListener?.('voiceschanged',finish);resolve(synth.getVoices())};const timeout=setTimeout(finish,1500);synth.addEventListener?.('voiceschanged',finish)});
  }
  if(!current())return;
  const voice=voices.find(v=>v.localService&&/^zh/i.test(v.lang));
  if(!voice){onError('声音暂时没有播放出来，请点一下重新开启语音，或改用文字。');return}
  const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=.98;this.native=utterance;
  utterance.onstart=()=>{if(current())onStart('device')};
  utterance.onend=()=>{if(current())onEnd()};
  utterance.onerror=()=>{if(current())onError('声音被暂停了，请重新开启语音。')};
  try{synth.speak(utterance)}catch{if(current())onError('声音暂时无法播放，请重新开启语音。')}
 }
}
