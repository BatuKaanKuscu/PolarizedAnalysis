export function speechChunks(value,max=220,limit=6000){
 max=Math.max(40,Math.min(400,Number(max)||220));limit=Math.max(0,Math.min(6000,Number(limit)||0));
 const clean=String(value||'').replace(/```[\s\S]*?```/g,' Kod örneği ekranda gösteriliyor. ').replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/\[\d+\]/g,'').replace(/[`#*_]/g,'').replace(/\s+/g,' ').trim();
 const truncated=clean.length>limit;let text=clean.slice(0,limit),chunks=[];
 while(text){let end=Math.min(max,text.length);if(end<text.length){const boundary=Math.max(text.lastIndexOf('. ',end),text.lastIndexOf('? ',end),text.lastIndexOf('! ',end));if(boundary>max/3)end=boundary+1;else{const space=text.lastIndexOf(' ',end);if(space>max/3)end=space;}}chunks.push(text.slice(0,end).trim());text=text.slice(end).trimStart();}
 return {chunks,truncated};
}
export function recognitionError(code){return ({'not-allowed':'Mikrofon izni verilmedi. Tarayıcının site izinlerinden mikrofonu açıp yeniden dene.','service-not-allowed':'Tarayıcı ses tanıma servisine izin vermedi. Yazılı sohbeti kullanabilirsin.','audio-capture':'Mikrofon bulunamadı veya başka bir uygulama tarafından kullanılıyor.','network':'Ses tanıma servisine ulaşılamadı. Bağlantını kontrol edip yeniden dene.','no-speech':'Ses algılanmadı. Konuş düğmesiyle tekrar deneyebilirsin.','language-not-supported':'Seçili konuşma dili bu cihazda desteklenmiyor.','aborted':'Dinleme durduruldu.'})[code]||'Konuşma tanınamadı. Yeniden deneyebilir veya sorunu yazabilirsin.';}
export function createVoiceAssistant({canAsk,onQuestion,onCancel}){
 const $=id=>document.getElementById(id),Recognition=window.SpeechRecognition||window.webkitSpeechRecognition,synth=window.speechSynthesis;
 const supportsSpeech=!!(synth&&window.SpeechSynthesisUtterance),supportsRecognition=!!Recognition&&window.isSecureContext;
 let active=false,listening=false,speaking=false,waiting=false,recognizer=null,recognitionVersion=0,speechVersion=0,lastAnswer='',restartTimer=null,listenTimer=null,utterance=null,choices=[],appReady=false,appBusy=false;
 const note=text=>$('voiceStatus').textContent=text;
 function render(){
  const available=appReady&&canAsk(),questionMode=['auto','web','question','general'].includes($('documentTask').value);
  $('voiceStart').disabled=!supportsRecognition||!available||appBusy;
  $('voiceStart').textContent=active?'Konuş / Söz al':'Sesli sohbeti başlat';
  $('voiceEnd').disabled=!active&&!listening&&!speaking&&!waiting;
  $('voiceRead').disabled=!supportsSpeech||!lastAnswer||appBusy||listening;
  $('voiceStopSpeech').disabled=!speaking;
  $('voiceLanguage').disabled=active||appBusy||speaking;
  $('voiceSpeaker').disabled=speaking||!supportsSpeech;
  $('voiceRate').disabled=speaking||!supportsSpeech;
  $('voicePanel').dataset.state=listening?'listening':speaking?'speaking':waiting?'waiting':'idle';
  $('voiceStart').setAttribute('aria-pressed',String(active));
  $('voiceSupport').textContent=!questionMode?'Sesli sohbet için bir soru/araştırma modu seç.':!window.isSecureContext?'Mikrofon için HTTPS veya localhost gerekir.':!Recognition?'Bu tarayıcı ses tanımayı desteklemiyor; sorunu yazabilirsin.':!supportsSpeech?'Ses tanıma hazır; cihazda sesli okuma kullanılamıyor.':'Mikrofon yalnızca sesli sohbeti başlattığında açılır.';
 }
 function stopRecognition(){
  recognitionVersion++;clearTimeout(listenTimer);listenTimer=null;const previous=recognizer;recognizer=null;listening=false;
  if(previous){previous.onstart=previous.onresult=previous.onerror=previous.onend=previous.onspeechend=null;try{previous.abort();}catch{}}
 }
 function stopSpeech(){speechVersion++;speaking=false;utterance=null;if(supportsSpeech)synth.cancel();}
 function clearRestart(){clearTimeout(restartTimer);restartTimer=null;}
 function stop(message='Sesli sohbet kapatıldı.',cancel=true){
  const shouldCancel=active&&waiting;active=false;waiting=false;clearRestart();stopRecognition();stopSpeech();if(cancel&&shouldCancel)onCancel();note(message);render();
 }
 function reset(message='Sesli sohbet hazır.'){stop(message);lastAnswer='';$('voiceTranscript').textContent='';render();}
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
  clearRestart();stopSpeech();stopRecognition();waiting=false;listening=true;$('voiceTranscript').textContent='';note('Mikrofon açılıyor…');render();
  const version=++recognitionVersion;let rec;try{rec=new Recognition();}catch{active=false;listening=false;note('Bu cihazda ses tanıma başlatılamadı. Sorunu yazabilirsin.');render();return;}recognizer=rec;let finalText='',failed=false,received=false;
  rec.lang=$('voiceLanguage').value;rec.continuous=false;rec.interimResults=true;rec.maxAlternatives=1;
  const current=()=>version===recognitionVersion&&active;
  rec.onstart=()=>{if(!current())return;note($('voiceAutoSend').checked?'Dinliyorum… Konuşman bitince sorunu göndereceğim.':'Dinliyorum… Sözlerini yazıya çevireceğim; göndermeden kontrol edebilirsin.');listenTimer=setTimeout(()=>{if(current()){stopRecognition();note('Dinleme süresi doldu. Konuş düğmesiyle devam edebilirsin.');render();}},45000);};
  rec.onresult=e=>{
   if(!current())return;let final='',interim='';
   for(let i=0;i<e.results.length;i++){const text=e.results[i][0]?.transcript||'';if(e.results[i].isFinal)final+=text+' ';else interim+=text+' ';}
   finalText=final.trim();received=!!(finalText||interim.trim());const preview=(final+' '+interim).replace(/\s+/g,' ').trim();
   $('voiceTranscript').textContent=preview;$('documentQuestion').value=preview.slice(0,$('documentQuestion').maxLength);
  };
  rec.onerror=e=>{if(!current())return;failed=true;const code=e.error;stopRecognition();note(recognitionError(code));if(code!=='no-speech')active=false;render();};
  rec.onend=()=>{
   if(!current())return;recognitionVersion++;clearTimeout(listenTimer);recognizer=null;listening=false;
   if(failed)return;
   if(!received||finalText.length<3){note('Soru anlaşılamadı. Konuş düğmesiyle tekrar deneyebilirsin.');render();return;}
   if(finalText.length>$('documentQuestion').maxLength){note('Soru çok uzun; metni alana sığacak şekilde kısalttım. Kontrol edip Gönder düğmesine bas.');render();return;}
   $('documentQuestion').value=finalText;
   if(!$('voiceAutoSend').checked){note('Sözlerin yazıya çevrildi. Kontrol edip Gönder düğmesine bas.');render();return;}
   if(!canAsk()){note('Asistan şu an hazır değil. Sorun yazı alanında duruyor.');render();return;}
   waiting=true;note('Sorun gönderiliyor…');render();
   try{onQuestion(finalText);}catch{waiting=false;note('Soru gönderilemedi. Metin alanından yeniden deneyebilirsin.');render();}
  };
  try{rec.start();}catch{failed=true;stopRecognition();active=false;note('Mikrofon başlatılamadı. Site izinlerini kontrol edip yeniden dene.');render();}
 }
 $('voiceStart').onclick=()=>{if(!canAsk()||appBusy)return;active=true;listen();};
 $('voiceEnd').onclick=()=>stop();
 $('voiceRead').onclick=()=>speak(lastAnswer);
 $('voiceStopSpeech').onclick=()=>{clearRestart();stopSpeech();note('Seslendirme durduruldu.');render();};
 $('voiceLanguage').onchange=populateVoices;
 $('voiceContinue').onchange=()=>{if(!$('voiceContinue').checked)clearRestart();};
 $('voiceAutoRead').onchange=()=>{if(!$('voiceAutoRead').checked){clearRestart();stopSpeech();note('Otomatik sesli yanıt kapalı.');render();}};
 window.addEventListener('viewchange',e=>{if(e.detail!=='assistant'&&(active||listening||speaking||waiting))stop('Sesli sohbet sayfadan çıkıldığı için durduruldu.');});
 window.addEventListener('accountchange',()=>reset('Hesap değişti; sesli sohbet kapatıldı.'));
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&(active||listening||speaking||waiting))stop('Sekme arka plana geçti; sesli sohbet durduruldu.');});
 window.addEventListener('pagehide',()=>stop());
 if(supportsSpeech)synth.addEventListener?.('voiceschanged',populateVoices);
 populateVoices();render();
 return {
  isActive:()=>active,
  sync({ready,busy}){appReady=ready;appBusy=busy;render();},
  reset,
  prepareForQuestion(){clearRestart();stopRecognition();stopSpeech();lastAnswer='';waiting=active;if(active)note('Yanıt hazırlanıyor…');render();},
  receiveAnswer(text){lastAnswer=String(text||'');waiting=false;render();if(active){if($('voiceAutoRead').checked)speak(lastAnswer);else{note('Yanıt ekranda hazır. Konuş düğmesiyle devam edebilirsin.');render();}}},
  answerFailed(){waiting=false;clearRestart();if(active)note('Yanıt tamamlanmadı. Ekrandaki açıklamayı kontrol edip Konuş düğmesiyle devam edebilirsin.');render();}
 };
}
