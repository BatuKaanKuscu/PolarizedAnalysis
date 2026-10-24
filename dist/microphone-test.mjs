export function rmsLevel(bytes){if(!bytes?.length)return 0;let sum=0;for(const byte of bytes){const value=(byte-128)/128;sum+=value*value;}return Math.sqrt(sum/bytes.length);}
export function createMicrophoneTest({canStart,onState,onAccess,onIssue}){
 const $=id=>document.getElementById(id);let running=false,pendingRequest=null,version=0,stream=null,context=null,source=null,analyser=null,frame=null,timer=null,peak=0,sampled=false;
 function sync(){$('voiceMicTest').disabled=running||!!pendingRequest||!canStart();$('voiceMicTestCancel').disabled=!running;}
 function cleanup(){clearTimeout(timer);cancelAnimationFrame(frame);timer=frame=null;try{source?.disconnect();analyser?.disconnect();}catch{}source=analyser=null;stream?.getTracks().forEach(t=>t.stop());stream=null;const previous=context;context=null;if(previous&&previous.state!=='closed')void previous.close().catch(()=>{});$('voiceMicLevel').value=0;}
 function stop(message='Mikrofon testi durduruldu.'){version++;const wasRunning=running;running=false;cleanup();if(wasRunning)$('voiceMicTestStatus').textContent=message+(pendingRequest?' Açık mikrofon izin penceresinde de seçim yapmalısın.':'');sync();if(wasRunning)onState();}
 async function start(){
  if(running||pendingRequest||!canStart())return;const Audio=window.AudioContext||window.webkitAudioContext;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){$('voiceMicTestStatus').textContent='Ses testi için HTTPS ve mikrofon erişimi gerekir.';return;}
  if(!Audio){$('voiceMicTestStatus').textContent='Bu tarayıcı ses seviyesi testini desteklemiyor. Yukarıdan mikrofon iznini kontrol edebilirsin.';return;}
  const id=++version;running=true;peak=0;sampled=false;sync();onState();$('voiceMicTestStatus').textContent='Mikrofon açılıyor… İzin istenirse tarayıcıdan onayla.';
  let localContext;
  try{
   localContext=new Audio();context=localContext;void localContext.resume().catch(()=>{});
   pendingRequest=navigator.mediaDevices.getUserMedia({audio:true,video:false});const acquired=await pendingRequest;pendingRequest=null;
   if(id!==version){acquired.getTracks().forEach(t=>t.stop());if(localContext.state!=='closed')void localContext.close().catch(()=>{});return;}
   stream=acquired;onAccess();source=localContext.createMediaStreamSource(stream);analyser=localContext.createAnalyser();analyser.fftSize=512;source.connect(analyser);
   const bytes=new Uint8Array(analyser.fftSize);$('voiceMicTestStatus').textContent='5 saniye boyunca konuş. Ses seviyesi yalnızca bu cihazda ölçülüyor.';
   const sample=()=>{if(id!==version)return;if(localContext.state==='running'){analyser.getByteTimeDomainData(bytes);const level=rmsLevel(bytes);sampled=true;peak=Math.max(peak,level);$('voiceMicLevel').value=Math.min(1,level*4);}frame=requestAnimationFrame(sample);};sample();
   timer=setTimeout(()=>{if(id!==version)return;const message=!sampled?'Tarayıcı ses ölçümünü başlatamadı. Sayfaya dönüp testi yeniden dene.':peak>.015?'Ses sinyali algılandı. Mikrofon girişi çalışıyor; ses tanıma servisi ayrıca kontrol edilir.':'Bu kısa testte belirgin ses algılanmadı. Mikrofonu, sessize alma düğmesini ve sistem giriş aygıtını kontrol et.';stop(message);},5000);
  }catch(error){if(id!==version)return;stop('Mikrofon testi tamamlanamadı.');onIssue(error);}finally{pendingRequest=null;sync();onState();}
 }
 $('voiceMicTest').onclick=()=>void start();$('voiceMicTestCancel').onclick=()=>stop();sync();
 return {sync,stop,isRunning:()=>running||!!pendingRequest};
}
