import {createMicrophoneTest} from './microphone-test.mjs';
import {diagnosticReport,serviceLabel} from './voice-diagnostics.mjs';
export function speechChunks(value,max=220,limit=6000){
 max=Math.max(40,Math.min(400,Number(max)||220));limit=Math.max(0,Math.min(6000,Number(limit)||0));
 const clean=String(value||'').replace(/```[\s\S]*?```/g,' Kod örneği ekranda gösteriliyor. ').replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/\[\d+\]/g,'').replace(/[`#*_]/g,'').replace(/\s+/g,' ').trim();
 const truncated=clean.length>limit;let text=clean.slice(0,limit),chunks=[];
 while(text){let end=Math.min(max,text.length);if(end<text.length){const boundary=Math.max(text.lastIndexOf('. ',end),text.lastIndexOf('? ',end),text.lastIndexOf('! ',end));if(boundary>max/3)end=boundary+1;else{const space=text.lastIndexOf(' ',end);if(space>max/3)end=space;}}chunks.push(text.slice(0,end).trim());text=text.slice(end).trimStart();}
 return {chunks,truncated};
}
export function recognitionError(code,permission){if(code==='not-allowed'&&permission==='granted')return 'Ses tanıma izni verilmedi. Mikrofon izni açık; tarayıcının ses tanıma servisi güvenlik veya gizlilik ayarı nedeniyle engellenmiş olabilir. Mikrofon testiyle ses girişini ayrıca kontrol et.';return ({'not-allowed':'Mikrofon izni verilmedi. Tarayıcının site izinlerinden mikrofonu açıp yeniden dene.','service-not-allowed':'Tarayıcı ses tanıma servisine izin vermedi. Yazılı sohbeti kullanabilirsin.','audio-capture':'Mikrofon bulunamadı veya başka bir uygulama tarafından kullanılıyor.','network':'Ses tanıma servisine ulaşılamadı. Bağlantını kontrol edip yeniden dene.','no-speech':'Ses algılanmadı. Konuş düğmesiyle tekrar deneyebilirsin.','language-not-supported':'Seçili konuşma dili bu cihazda desteklenmiyor.','aborted':'Dinleme durduruldu.'})[code]||'Konuşma tanınamadı. Yeniden deneyebilir veya sorunu yazabilirsin.';}
export function microphoneError(error){return ({NotAllowedError:'Mikrofon erişimi engellendi. Adres çubuğundaki site ayarlarından Mikrofon → İzin ver seç; tarayıcı ve sistem izinlerini kontrol et.',SecurityError:'Bu sayfanın mikrofon erişimi tarayıcı veya sayfa güvenlik ayarlarıyla engellenmiş.',NotFoundError:'Mikrofon bulunamadı. Bir mikrofon bağlayıp yeniden dene.',NotReadableError:'Mikrofon açılamadı. Başka bir uygulama kullanıyor olabilir; sistem mikrofon ayarlarını kontrol et.',AbortError:'Mikrofon başlatılamadı. Yeniden deneyebilirsin.'})[error?.name]||'Mikrofona erişilemedi. Site izinlerini ve bağlı mikrofonu kontrol et.';}
export function createVoiceAssistant({canAsk,onQuestion,onCancel}){
 const $=id=>document.getElementById(id),Recognition=window.SpeechRecognition||window.webkitSpeechRecognition,synth=window.speechSynthesis;
 const supportsSpeech=!!(synth&&window.SpeechSynthesisUtterance),supportsRecognition=!!Recognition&&window.isSecureContext;
 let active=false,listening=false,speaking=false,waiting=false,recognizer=null,recognitionVersion=0,speechVersion=0,lastAnswer='',restartTimer=null,listenTimer=null,utterance=null,choices=[],appReady=false,appBusy=false;
 let microphonePermission='unknown',requesting=false,permissionTask=null,permissionVersion=0,permissionCheckVersion=0,permissionTimer=null,permissionStatus=null;
 let serviceState='untried',lastError=null,recognitionStartTimer=null;
 const micTest=createMicrophoneTest({canStart:()=>appReady&&!appBusy&&!active&&!requesting&&!permissionTask&&!speaking&&!listening,onState:()=>render(),onAccess:()=>{microphonePermission='granted';},onIssue:error=>recordIssue(error?.name||'microphone-test',microphoneError(error),'microphone')});
 const note=text=>$('voiceStatus').textContent=text;
 function recordIssue(code,message,phase='recognition'){
  lastError={code:String(code||'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64),phase,at:new Date().toISOString()};
  if(phase==='recognition')serviceState='failed';
  note(message);$('voiceDiagnosticCopyStatus').textContent='';$('voiceDiagnostics').open=true;render();
 }
 function renderDiagnostics(){
  $('voiceRecognitionBadge').textContent=serviceLabel(serviceState,!!Recognition);$('voiceRecognitionBadge').dataset.state=serviceState;if(serviceState==='failed'&&lastError?.phase==='recognition')$('voiceRecognitionBadge').textContent+=' · '+lastError.code;
  $('voiceDiagnosticReport').textContent=diagnosticReport({secure:window.isSecureContext,recognition:!!Recognition,microphone:microphonePermission,service:serviceState,lastError});
  $('voiceLastError').textContent=lastError?'Son hata: '+lastError.code+' · '+lastError.phase:'Henüz hata kaydedilmedi.';
 }

 function render(){
  const available=appReady&&canAsk(),questionMode=['auto','web','question','general'].includes($('documentTask').value);
  $('voiceStart').disabled=!supportsRecognition||!available||appBusy||!!permissionTask||micTest.isRunning();
  $('voiceStartLabel').textContent=!Recognition?'Ses tanıma kullanılamıyor':!window.isSecureContext?'Güvenli bağlantı gerekiyor':requesting?'İzin bekleniyor…':serviceState==='connecting'?'Servise bağlanılıyor…':listening?'Seni dinliyorum':speaking?'Söz almak için dokun':active?'Konuş / Söz al':'Konuşmaya başla';$('voiceStart').setAttribute('aria-label',active?'Konuş / Söz al':'Sesli sohbeti başlat');
  $('voiceEnd').disabled=!active&&!listening&&!speaking&&!waiting&&!requesting;
  $('voiceRead').disabled=!supportsSpeech||!lastAnswer||appBusy||listening||micTest.isRunning();
  $('voiceStopSpeech').disabled=!speaking;
  $('voiceLanguage').disabled=active||appBusy||speaking;
  $('voiceSpeaker').disabled=speaking||!supportsSpeech;
  $('voiceRate').disabled=speaking||!supportsSpeech;
  $('voicePanel').dataset.state=requesting?'permission':serviceState==='connecting'?'connecting':listening?'listening':speaking?'speaking':waiting?'waiting':'idle';
  $('voiceStart').setAttribute('aria-pressed',String(active));
  $('voiceSupport').textContent=!questionMode?'Sesli sohbet için bir soru/araştırma modu seç.':!window.isSecureContext?'Mikrofon için HTTPS veya localhost gerekir.':!Recognition?'Bu tarayıcı ses tanımayı desteklemiyor; sorunu yazabilirsin.':!supportsSpeech?'Ses tanıma hazır; cihazda sesli okuma kullanılamıyor.':'Mikrofon izni ile ses tanıma desteği ayrı kontrollerdir. Sesi burada kaydetmiyoruz.';renderPermission();
 }
 function renderPermission(){
  const labels={unknown:'İzin durumu kontrol edilmedi',prompt:'Mikrofon izni gerekiyor',granted:'Mikrofon izni açık',denied:'Mikrofon erişimi engellendi',error:'Mikrofon kontrol edilmeli'};
  $('voicePermissionLabel').textContent=!window.isSecureContext?'Mikrofon için HTTPS gerekli':!navigator.mediaDevices?.getUserMedia?'Bu tarayıcıda mikrofon erişimi yok':requesting?'Tarayıcıdan izin bekleniyor…':labels[microphonePermission]||labels.unknown;
  $('voicePermission').dataset.permission=requesting?'pending':microphonePermission;
  $('voiceRequestPermission').textContent=permissionTask?'İzin yanıtı bekleniyor…':microphonePermission==='granted'?'Mikrofonu kontrol et':'Mikrofon izni ver';
  $('voiceRequestPermission').disabled=!appReady||appBusy||!!permissionTask||active||listening||speaking||!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||micTest.isRunning();
  $('voiceCheckPermission').disabled=requesting;
  renderDiagnostics();micTest.sync();
 }
 async function checkPermission(){
  const version=++permissionCheckVersion;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){render();return;}
  try{
   const result=await navigator.permissions.query({name:'microphone'});if(version!==permissionCheckVersion)return;
   const update=()=>{
    microphonePermission=['granted','denied','prompt'].includes(result.state)?result.state:'unknown';
    if(microphonePermission==='denied'&&!requesting&&(active||listening||speaking||waiting||requesting||micTest.isRunning()))stop('Mikrofon izni kaldırıldı; sesli sohbet durduruldu.');
    if(microphonePermission==='denied')$('voicePermissionHelp').open=true;
    render();
   };
   if(permissionStatus)permissionStatus.onchange=null;permissionStatus=result;result.onchange=update;update();
  }catch{render();}
 }
 async function requestPermission(startAfter=false){
  if(permissionTask||!appReady||appBusy)return;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){note('Mikrofon izni için siteyi HTTPS üzerinden, kendi tarayıcı sekmesinde aç.');$('voicePermissionHelp').open=true;render();return;}
  const version=++permissionVersion;permissionCheckVersion++;requesting=true;
  if(startAfter)active=true;
  clearRestart();stopRecognition();stopSpeech();note('Tarayıcının mikrofon izin penceresinde İzin ver seçeneğini seç.');
  let task;try{task=navigator.mediaDevices.getUserMedia({audio:true,video:false});}catch(error){requesting=false;active=false;microphonePermission=error?.name==='NotAllowedError'?'denied':'error';recordIssue(error?.name||'microphone-error',microphoneError(error),'microphone');$('voicePermissionHelp').open=true;render();return;}
  permissionTask=task;render();
  permissionTimer=setTimeout(()=>{if(version===permissionVersion&&requesting){note('Tarayıcıdan yanıt bekleniyor. Pencere görünmüyorsa adres çubuğundaki mikrofon veya site izinlerini kontrol et.');$('voicePermissionHelp').open=true;}},12000);
  let granted=false;
  try{
   const stream=await task;
   // Permission is checked with a short-lived stream. Never keep it alongside recognition.
   stream.getTracks().forEach(track=>track.stop());
   if(version!==permissionVersion)return;
   microphonePermission='granted';granted=true;
   note(Recognition?'Mikrofon erişimi hazır. Konuşmaya başlayabilirsin.':'Mikrofon izni açık; bu tarayıcı ses tanımayı desteklemiyor. Yazılı sohbeti ve sesli okumayı kullanabilirsin.');
  }catch(error){
   if(version!==permissionVersion)return;
   active=false;microphonePermission=['NotAllowedError','SecurityError'].includes(error?.name)?'denied':'error';
   recordIssue(error?.name||'microphone-error',microphoneError(error),'microphone');$('voicePermissionHelp').open=true;
  }finally{
   clearTimeout(permissionTimer);permissionTask=null;
   if(version===permissionVersion){requesting=false;render();if(granted&&startAfter&&active&&!document.hidden&&!$('view-assistant').hidden)listen();}
   else render();
  }
 }

 function stopRecognition(){
  recognitionVersion++;clearTimeout(recognitionStartTimer);clearTimeout(listenTimer);listenTimer=null;const previous=recognizer;recognizer=null;listening=false;
  if(previous){if(['connecting','listening'].includes(serviceState))serviceState='stopped';previous.onstart=previous.onresult=previous.onerror=previous.onend=previous.onspeechend=null;try{previous.abort();}catch{}}
 }
 function stopSpeech(){speechVersion++;speaking=false;utterance=null;if(supportsSpeech)synth.cancel();}
 function clearRestart(){clearTimeout(restartTimer);restartTimer=null;}
 function stop(message='Sesli sohbet kapatıldı.',cancel=true){
  const shouldCancel=active&&waiting;permissionVersion++;requesting=false;clearTimeout(permissionTimer);active=false;waiting=false;clearRestart();micTest.stop();stopRecognition();stopSpeech();if(cancel&&shouldCancel)onCancel();note(message);render();
 }
 function reset(message='Sesli sohbet hazır.'){stop(message);serviceState='untried';lastError=null;$('voiceDiagnostics').open=false;$('voiceDiagnosticCopyStatus').textContent='';lastAnswer='';$('voiceTranscript').textContent='';$('voiceMicTestStatus').textContent='Test yalnızca düğmeye bastığında başlar.';render();}
 function populateVoices(){
  const selected=$('voiceSpeaker').value,lang='tr';
  choices=supportsSpeech?synth.getVoices().filter(v=>v.lang?.toLowerCase().startsWith(lang)).sort((a,b)=>Number(b.localService)-Number(a.localService)):[];
  $('voiceSpeaker').replaceChildren();const automatic=document.createElement('option');automatic.value='';automatic.textContent='Cihazın uygun sesi';$('voiceSpeaker').append(automatic);
  choices.forEach((v,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=v.name+(v.localService?' · Cihaz sesi':' · Çevrimiçi ses');$('voiceSpeaker').append(o);});
  if(choices[Number(selected)]&&selected!=='')$('voiceSpeaker').value=selected;
 }
 function scheduleListening(){
  clearRestart();if(!active)return;
  if(!$('voiceContinue').checked){note('Yanıt bitti. Konuş düğmesiyle devam edebilirsin.');render();return;}
  restartTimer=setTimeout(()=>{if(active&&$('voiceContinue').checked&&!appBusy&&!document.hidden&&!$('view-assistant').hidden)listen();},450);
 }
 function speak(text){
  clearRestart();stopRecognition();stopSpeech();waiting=false;
  const result=speechChunks(text);if(!supportsSpeech||!result.chunks.length){note('Bu cihazda sesli okuma başlatılamadı. Yanıtı ekrandan okuyabilirsin.');render();return;}
  const version=++speechVersion;let index=0;speaking=true;note(result.truncated?'Yanıtın ilk 6000 karakteri seslendiriliyor.':'Yanıt seslendiriliyor…');render();
  function next(){
   if(version!==speechVersion)return;
   if(index>=result.chunks.length){speaking=false;utterance=null;note('Seslendirme tamamlandı.');render();scheduleListening();return;}
   let part;try{part=new SpeechSynthesisUtterance(result.chunks[index++]);}catch{stopSpeech();note('Bu cihazda seslendirme başlatılamadı. Yanıtı ekrandan okuyabilirsin.');render();return;}utterance=part;part.lang='tr-TR';part.rate=Number($('voiceRate').value)||1;
   const chosen=$('voiceSpeaker').value,voice=chosen!==''?choices[Number(chosen)]:choices[0];if(voice)part.voice=voice;
   part.onend=()=>{if(version===speechVersion)next();};
   part.onerror=e=>{if(version!==speechVersion)return;stopSpeech();note(e.error==='not-allowed'?'Tarayıcı otomatik seslendirmeyi engelledi. Yanıtı dinle düğmesine bas.':'Seslendirme tamamlanamadı. Yanıtı dinle düğmesiyle tekrar deneyebilirsin.');render();};
   try{synth.speak(part);}catch{stopSpeech();note('Seslendirme başlatılamadı. Yanıtı ekrandan okuyabilirsin.');render();}
  }
  next();
 }
 function listen(){
  if(!active||!supportsRecognition||appBusy||!canAsk()||document.hidden||$('view-assistant').hidden)return;
  clearRestart();stopSpeech();stopRecognition();serviceState='connecting';lastError=null;waiting=false;listening=true;$('voiceTranscript').textContent='';note('Mikrofon açılıyor…');render();
  const version=++recognitionVersion;let rec;try{rec=new Recognition();}catch{active=false;listening=false;recordIssue('constructor-error','Bu cihazda ses tanıma başlatılamadı. Sorunu yazabilirsin.');return;}recognizer=rec;let finalText='',failed=false,received=false;
  rec.lang=$('voiceLanguage').value;rec.continuous=false;rec.interimResults=true;rec.maxAlternatives=1;
  const current=()=>version===recognitionVersion&&active;
  rec.onstart=()=>{if(!current())return;clearTimeout(recognitionStartTimer);serviceState='listening';render();note($('voiceAutoSend').checked?'Dinliyorum… Konuşman bitince sorunu göndereceğim.':'Dinliyorum… Sözlerini yazıya çevireceğim; göndermeden kontrol edebilirsin.');listenTimer=setTimeout(()=>{if(current()){stopRecognition();note('Dinleme süresi doldu. Konuş düğmesiyle devam edebilirsin.');render();}},45000);};
  rec.onresult=e=>{
   if(!current())return;let final='',interim='';
   for(let i=0;i<e.results.length;i++){const text=e.results[i][0]?.transcript||'';if(e.results[i].isFinal)final+=text+' ';else interim+=text+' ';}
   finalText=final.trim();if(finalText){serviceState='recognized';lastError=null;renderDiagnostics();}received=!!(finalText||interim.trim());const preview=(final+' '+interim).replace(/\s+/g,' ').trim();
   $('voiceTranscript').textContent=preview;$('documentQuestion').value=preview.slice(0,$('documentQuestion').maxLength);
  };
  rec.onerror=e=>{if(!current())return;failed=true;const code=e.error;serviceState='failed';stopRecognition();if(code!=='no-speech')active=false;recordIssue(code,recognitionError(code,microphonePermission));};
  rec.onend=()=>{
   if(!current())return;recognitionVersion++;clearTimeout(recognitionStartTimer);clearTimeout(listenTimer);recognizer=null;listening=false;
   if(failed)return;
   if(!received||finalText.length<3){recordIssue('no-result','Soru anlaşılamadı. Konuş düğmesiyle tekrar deneyebilirsin.');return;}
   if(finalText.length>$('documentQuestion').maxLength){note('Soru çok uzun; metni alana sığacak şekilde kısalttım. Kontrol edip Gönder düğmesine bas.');render();return;}
   $('documentQuestion').value=finalText;
   if(!$('voiceAutoSend').checked){note('Sözlerin yazıya çevrildi. Kontrol edip Gönder düğmesine bas.');render();return;}
   if(!canAsk()){note('Asistan şu an hazır değil. Sorun yazı alanında duruyor.');render();return;}
   waiting=true;note('Sorun gönderiliyor…');render();
   try{onQuestion(finalText);}catch{waiting=false;note('Soru gönderilemedi. Metin alanından yeniden deneyebilirsin.');render();}
  };
  recognitionStartTimer=setTimeout(()=>{if(current()&&serviceState==='connecting'){serviceState='failed';stopRecognition();active=false;recordIssue('start-timeout','Ses tanıma 15 saniye içinde başlamadı. Açık izin veya dil paketi penceresini kontrol et. Mikrofon testi çalışıyorsa sorun tarayıcının tanıma servisiyle ilgili olabilir.');}},15000);
  try{rec.start();}catch(error){failed=true;serviceState='failed';stopRecognition();active=false;recordIssue(error?.name||'start-error','Ses tanıma başlatılamadı. Mikrofon testini ve tarayıcı ayarlarını kontrol et.');}
 }
 $('voiceStart').onclick=()=>{if(!canAsk()||appBusy||permissionTask||micTest.isRunning())return;if(microphonePermission!=='granted'){void requestPermission(true);return;}active=true;listen();};
 $('voiceRequestPermission').onclick=()=>void requestPermission(false);
 $('voiceCheckPermission').onclick=()=>void checkPermission();
 $('voiceEnd').onclick=()=>stop();
 $('voiceRead').onclick=()=>speak(lastAnswer);
 $('voiceStopSpeech').onclick=()=>{clearRestart();stopSpeech();note('Seslendirme durduruldu.');render();};
 $('voiceLanguage').onchange=populateVoices;
 $('voiceContinue').onchange=()=>{if(!$('voiceContinue').checked)clearRestart();};
 $('voiceAutoRead').onchange=()=>{if(!$('voiceAutoRead').checked){clearRestart();stopSpeech();note('Otomatik sesli yanıt kapalı.');render();}};
 window.addEventListener('viewchange',e=>{if(e.detail!=='assistant'&&(active||listening||speaking||waiting||requesting||micTest.isRunning()))stop('Sesli sohbet sayfadan çıkıldığı için durduruldu.');});
 window.addEventListener('accountchange',()=>reset('Hesap değişti; sesli sohbet kapatıldı.'));
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&(active||listening||speaking||waiting||requesting||micTest.isRunning()))stop('Sekme arka plana geçti; sesli sohbet durduruldu.');});
 window.addEventListener('pagehide',()=>stop());
 if(supportsSpeech)synth.addEventListener?.('voiceschanged',populateVoices);
 $('voiceUseText').onclick=()=>$('assistantTextTab').click();
 $('voiceCopyDiagnostics').onclick=async()=>{try{await navigator.clipboard.writeText($('voiceDiagnosticReport').textContent);$('voiceDiagnosticCopyStatus').textContent='Rapor kopyalandı.';}catch{$('voiceDiagnosticCopyStatus').textContent='Kopyalanamadı; aşağıdaki raporu seçip kopyalayabilirsin.';}};
 populateVoices();render();void checkPermission();
 return {
  isActive:()=>active,
  sync({ready,busy}){appReady=ready;appBusy=busy;render();},
  reset,
  suspend:()=>stop('Sesli sohbet durduruldu; yazılı sohbet kullanılabilir.'),
  prepareForQuestion(){micTest.stop('Soru gönderildiği için mikrofon testi durduruldu.');clearRestart();stopRecognition();stopSpeech();lastAnswer='';waiting=active;if(active)note('Yanıt hazırlanıyor…');render();},
  receiveAnswer(text){lastAnswer=String(text||'');waiting=false;render();if(active){if($('voiceAutoRead').checked)speak(lastAnswer);else{note('Yanıt ekranda hazır. Konuş düğmesiyle devam edebilirsin.');render();}}},
  answerFailed(){waiting=false;clearRestart();if(active)note('Yanıt tamamlanmadı. Ekrandaki açıklamayı kontrol edip Konuş düğmesiyle devam edebilirsin.');render();}
 };
}
