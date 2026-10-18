import {verdict} from './verdict.mjs';
import {CameraAssistant} from './camera-assistant.mjs';
import {createAIReport} from './ai-client.mjs';
import {compareRepeat} from './repeat.mjs';
import {measure,quality,summarize,cropRect,overlap,METHOD} from './analysis.mjs';
import {drawDemo,scenarios} from './demo.mjs';
import {currentUser} from './site.mjs';
import {suggestRegions} from './locate.mjs';
const $=id=>document.getElementById(id),all=s=>[...document.querySelectorAll(s)],video=$('video'),stage=$('stage'),canvas=$('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
const roles=['reference','sample'];
let mode='none',stream=null,imageURL=null,selected='reference',busy=false,generation=0,torch=false,lastReport=null,regions=defaults();
let demoAnimation=null,demoElapsed=0,demoStarted=0,demoPaused=false,demoScenario='stable';
let assistant=null,adjusting=false,lastAdjustment=0;
let aiReport=null;
let repeatSession=null,qualityHistory=[];
function endRepeat(restore=true){if(repeatSession&&restore)regions=structuredClone(repeatSession.first.regions);repeatSession=null;$('repeatBanner').hidden=true;$('swapConfirmed').checked=false;drawRegions();}
function beginRepeat(r){
 if(busy||adjusting||mode!==r.source||!['camera','demo'].includes(mode))return;
 repeatSession={first:structuredClone(r)};const old=structuredClone(regions);regions={reference:old.sample,sample:old.reference};qualityHistory=[];
 invalidate();drawRegions();$('repeatBanner').hidden=false;$('swapConfirmed').checked=false;
 $('repeatInstructions').textContent=r.demo?'Demo tekrarı: kutuların etiketleri yer değiştirdi. Bu işlem gerçek kap değişimini temsil etmez; yalnızca tekrar akışını deneyebilirsin.':'İçlerindeki sıvıları değiştirmeden iki kabın yerini değiştir. Kutuların etiketleri de yer değiştirdi: referans kutusu aynı referans sıvıyı, numune kutusu aynı numuneyi göstermeli.';
 controls();stage.scrollIntoView({behavior:'smooth',block:'center'});
}
$('swapConfirmed').onchange=()=>{invalidate();controls();};
$('cancelRepeat').onclick=()=>{if(busy||adjusting)return;endRepeat();invalidate();controls();say('Tekrar kontrolü iptal edildi.');};
const settle=()=>new Promise(resolve=>setTimeout(resolve,650));
function cameraInfo(text){$('cameraHelpStatus').textContent=text;}
function cameraControls(){
 const available=mode==='camera'&&assistant?.active,range=assistant?.capabilities.exposureCompensation;
 $('cameraTools').dataset.available=String(!!available);
 for(const id of ['autoCamera','autoTorch','fixCamera','resetCamera'])$(id).disabled=!available||busy||adjusting;
 const settings=assistant?.settings()||{};
 $('autoTorch').disabled=!available||busy||adjusting||assistant.capabilities.torch!==true;
 $('exposureSlider').disabled=!available||busy||adjusting||!range||!Number.isFinite(settings.exposureCompensation)||range.max<=range.min;
 if(range){$('exposureSlider').min=range.min;$('exposureSlider').max=range.max;$('exposureSlider').step=range.step>0?range.step:1/3;}
 if(Number.isFinite(settings.exposureCompensation)){$('exposureSlider').value=settings.exposureCompensation;$('exposureValue').textContent=settings.exposureCompensation.toFixed(2)+' EV';}else $('exposureValue').textContent='Desteklenmiyor';
 if(available){torch=settings.torch===true;$('torch').textContent=torch?'Feneri kapat':'Fener';}
 $('cameraCapabilities').textContent=available?['exposureMode','focusMode','whiteBalanceMode'].map((k,i)=>['Pozlama','Odak','Beyaz dengesi'][i]+': '+(assistant.capabilities[k]?.includes('continuous')?'otomatik destekli':'tarayıcı kontrolü yok')).join(' · '):'Canlı kamerada cihazın desteklediği ayarlar burada görünür.';
}
async function correctCamera(manual=false){
 if(!assistant||adjusting||mode!=='camera'||busy)return;
 const active=assistant,ticket=generation;adjusting=true;controls();
 try{const frame=capture(),r=await active.adjust(frame,{allowTorch:$('autoTorch').checked});if(ticket!==generation)return;
  cameraInfo(r.ok?'Kamera ayarı uygulandı; görüntünün oturması bekleniyor…':r.reason==='unverified'?'Ayar istendi ancak kamera uygulandığını doğrulamadı.':r.reason==='rejected'?'Kamera ayarı kabul etmedi. Işığı veya çekim açısını değiştir.':quality(frame).length?'Bu sorun cihaz ayarıyla giderilemiyor. Yansımayı azalt, arkadaki ışığı eşitle ve telefonu sabitle.':'Işık uygun; ek düzeltme gerekmiyor.');
  if(r.ok){invalidate();await settle();if(ticket!==generation)return;const issues=quality(capture());cameraInfo(issues.length?'Ayar uygulandı; çekim hâlâ düzeltme istiyor. '+issues.join(' '):'Ayar uygulandı. Işık ön kontrolü uygun; alanları kontrol et.');}
  if(manual&&ticket===generation&&geometryIssues().length){$('suggest').onclick();cameraInfo(geometryIssues().length?'Kutular örtüşüyor; uygun alan bulunamadı. Kutuları elle ayır.':'Alan önerisi yerleştirildi. Kutuların sıvı içinde olduğunu kontrol et.');}
 }catch{if(ticket===generation)cameraInfo('Otomatik düzenleme tamamlanamadı. Kamerayı yeniden açabilirsin.');}
 finally{if(ticket===generation){adjusting=false;lastAdjustment=performance.now();controls();liveQuality();}}
}
$('fixCamera').onclick=()=>correctCamera(true);
$('autoCamera').onchange=()=>{invalidate();cameraInfo($('autoCamera').checked?'Otomatik ışık desteği açık.':'Otomatik ışık desteği kapalı; ayarları elle yönetebilirsin.');};
$('autoTorch').onchange=()=>{invalidate();cameraInfo($('autoTorch').checked?'Çok karanlıkta fener denenebilir; parlama algılanırsa kapatılır.':'Otomatik fener kapalı.');};
$('exposureSlider').onchange=async()=>{
 if(!assistant||busy||adjusting)return;const active=assistant,ticket=generation;adjusting=true;const value=Number($('exposureSlider').value);$('autoCamera').checked=false;invalidate();controls();
 try{const r=await active.set('exposureCompensation',value);if(ticket===generation){cameraInfo(r.ok?'Işık ayarı uygulandı. Otomatik düzenleme kapatıldı.':'Kamera istenen ışık ayarını doğrulamadı.');await settle();}}finally{if(ticket===generation){adjusting=false;controls();liveQuality();}}
};
$('resetCamera').onclick=async()=>{
 if(!assistant||busy||adjusting)return;const active=assistant,ticket=generation;adjusting=true;invalidate();controls();
 try{await active.reset();await active.configure();if(ticket===generation){$('autoCamera').checked=true;$('autoTorch').checked=false;cameraInfo('Başlangıç ayarları istendi. Desteklenen otomatik modlar açıldı.');await settle();}}catch{if(ticket===generation)cameraInfo('Ayarlar sıfırlanamadı. Kamerayı yeniden aç.');}finally{if(ticket===generation){adjusting=false;controls();liveQuality();}}
};
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
function demoTime(){return demoElapsed+(demoPaused?0:performance.now()-demoStarted);}
function stopDemo(){if(demoAnimation!==null)cancelAnimationFrame(demoAnimation);demoAnimation=null;}
function paintDemo(){const rect=stage.getBoundingClientRect(),c=$('demoCanvas'),w=Math.round(rect.width*2),h=Math.round(rect.height*2);if(c.width!==w||c.height!==h){c.width=w;c.height=h;}drawDemo(c,demoScenario,demoTime());}
function animateDemo(){if(mode!=='demo'||demoPaused)return;paintDemo();demoAnimation=requestAnimationFrame(animateDemo);}
function updateDemoExpected(){$('demoExpected').textContent=demoPaused?'Duraklatıldı: tek kare ölçülür; zamana göre değişim sınanmaz.':scenarios[demoScenario].expected;}
function setDemoPaused(paused){if(paused===demoPaused)return;demoElapsed=demoTime();demoStarted=performance.now();demoPaused=paused;stopDemo();if(!paused)animateDemo();$('demoPause').textContent=paused?'▶ Devam et':'Ⅱ Duraklat';$('demoPause').setAttribute('aria-pressed',String(paused));updateDemoExpected();invalidate();controls();}
function restartDemo(){stopDemo();demoElapsed=0;demoStarted=performance.now();paintDemo();if(!demoPaused)animateDemo();invalidate();liveQuality();}
function defaults(){return {reference:{x:.15,y:.40,w:.22,h:.26},sample:{x:.63,y:.40,w:.22,h:.26}};}
function say(text){$('message').textContent=text;}
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn,cls){const b=node('button',text,cls);b.onclick=fn;return b;}
function ready(){return (!repeatSession||$('swapConfirmed').checked)&&(mode==='demo'||(mode!=='none'&&all('.condition').every(c=>c.checked)&&$('refName').value.trim()&&$('sampleName').value.trim()));}
function controls(){
 $('analyze').disabled=busy||adjusting||!ready();$('start').disabled=busy;$('upload').disabled=busy;document.querySelector('.upload').setAttribute('aria-disabled',String(busy));
 $('stop').disabled=(mode==='none'||mode==='demo')&&!busy;$('stop').textContent=busy?'İptal et':'Animasyona dön';
 $('torch').disabled=busy||adjusting||!stream?.getVideoTracks()[0]?.getCapabilities?.().torch;
 all('.placement button,.roi,.setup input,.setup select,.setup textarea').forEach(e=>e.disabled=busy);
 all('[data-nav],#accountToggle').forEach(e=>e.disabled=busy);
 all('#demoPanel button,#demoPanel select').forEach(e=>e.disabled=busy);
 all('#assistPanel button,#assistPanel select').forEach(e=>e.disabled=busy||adjusting||mode==='none');updateReadiness();cameraControls();
 $('swapConfirmed').disabled=busy||adjusting;$('cancelRepeat').disabled=busy||adjusting;
 all('.repeat-result button').forEach(e=>e.disabled=busy||adjusting);
 if(repeatSession)for(const id of ['refName','sampleName','demoScenario','positions','quickNames'])$(id).disabled=true;
}
function updateReadiness(){
 const missing=[];if(mode==='none')missing.push('Kamera veya fotoğraf açın.');if(mode!=='demo'){if(!$('refName').value.trim()||!$('sampleName').value.trim())missing.push('Referans ve numuneye ad verin.');if(!all('.condition').every(c=>c.checked))missing.push('Hazırlık onaylarını tamamlayın.');}
 if(repeatSession&&!$('swapConfirmed').checked)missing.push('Kapları yer değiştirip kutuları kontrol ettiğini onayla.');
 $('readiness').textContent=busy?'Ölçüm sürüyor; görüntüyü sabit tutun.':missing.length?missing.join(' '):mode==='demo'?'Animasyon hazır. Doğrudan karşılaştırmayı başlatabilirsiniz.':'Hazırlık tamam. Kutuları kontrol edip karşılaştırmayı başlatın.';
 all('.flow-step').forEach((e,i)=>e.classList.toggle('complete',i===0?mode!=='none':i===1?!!ready():!$('result').hidden));
}
function stopCamera(){assistant?.dispose();assistant=null;adjusting=false;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;torch=false;$('torch').textContent='Fener';cameraInfo('Canlı kamerayı açtığında otomatik destek başlayacak.');}
function clearSource(){endRepeat();qualityHistory=[];for(const role of roles){const p=$('preview-'+role);p.getContext('2d').clearRect(0,0,p.width,p.height);}stopCamera();stopDemo();stage.classList.remove('measuring');if(imageURL)URL.revokeObjectURL(imageURL);imageURL=null;$('photo').removeAttribute('src');}
function invalidate(){qualityHistory=[];aiReport?.dispose();aiReport=null;$('result').hidden=true;lastReport=null;}
function setMode(next){mode=next;video.hidden=next!=='camera';$('photo').hidden=next!=='photo';$('demoCanvas').hidden=next!=='demo';$('placeholder').hidden=next!=='none';$('regions').hidden=next==='none';$('demoBadge').hidden=next!=='demo';$('demoPanel').hidden=next!=='demo';$('cameraStatus').textContent={none:'Kaynak bekleniyor',camera:'Canlı kamera',photo:'Tek fotoğraf',demo:'Animasyonlu test'}[next];invalidate();controls();drawRegions();}
function select(role){selected=role;all('.placement [data-role]').forEach(b=>{b.classList.toggle('active',b.dataset.role===role);b.setAttribute('aria-pressed',String(b.dataset.role===role));});all('.roi').forEach(b=>b.classList.toggle('selected',b.dataset.role===role));}
function drawRegions(){for(const role of roles){const e=document.querySelector(`.roi[data-role="${role}"]`),r=regions[role];Object.assign(e.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.w*100+'%',height:r.h*100+'%'});}select(selected);}
function move(role,x,y){const r=regions[role];r.x=Math.max(0,Math.min(1-r.w,x-r.w/2));r.y=Math.max(.07,Math.min(1-r.h,y-r.h/2));qualityHistory=[];drawRegions();invalidate();liveQuality();}
all('.placement [data-role]').forEach(b=>b.onclick=()=>select(b.dataset.role));
$('regions').onclick=e=>{if(busy)return;const box=e.target.closest('.roi');if(box){select(box.dataset.role);return;}const b=stage.getBoundingClientRect();move(selected,(e.clientX-b.left)/b.width,(e.clientY-b.top)/b.height);};
all('.roi').forEach(b=>{
 let drag=null;
 b.onpointerdown=e=>{if(busy)return;select(b.dataset.role);drag={x:e.clientX,y:e.clientY,moved:false};b.setPointerCapture(e.pointerId);};
 b.onpointermove=e=>{if(!drag||busy)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<4&&!drag.moved)return;drag.moved=true;const rect=stage.getBoundingClientRect();move(b.dataset.role,(e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height);};
 b.onpointerup=()=>drag=null;b.onpointercancel=()=>drag=null;
 b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||busy)return;e.preventDefault();const r=regions[b.dataset.role];move(b.dataset.role,r.x+r.w/2+(e.key==='ArrowLeft'?-.01:e.key==='ArrowRight'?.01:0),r.y+r.h/2+(e.key==='ArrowUp'?-.01:e.key==='ArrowDown'?.01:0));};
});
$('positions').onclick=()=>{regions=defaults();$('regionSize').value='medium';drawRegions();invalidate();liveQuality();};
$('focusSetup').onclick=()=>{$('refName').scrollIntoView({behavior:'smooth',block:'center'});$('refName').focus({preventScroll:true});};
$('quickNames').onclick=()=>{if(!$('refName').value.trim())$('refName').value='Referans 01';if(!$('sampleName').value.trim())$('sampleName').value='Numune 01';invalidate();controls();};
$('regionSize').onchange=()=>{const [w,h]={small:[.14,.18],medium:[.22,.26],large:[.28,.32]}[$('regionSize').value];for(const role of roles){const r=regions[role],cx=r.x+r.w/2,cy=r.y+r.h/2;regions[role]={x:Math.max(0,Math.min(1-w,cx-w/2)),y:Math.max(.07,Math.min(1-h,cy-h/2)),w,h};}invalidate();drawRegions();liveQuality();};
$('suggest').onclick=()=>{
 if(busy||mode==='none')return;
 try{if(mode==='demo')paintDemo();const source=mode==='camera'?video:mode==='photo'?$('photo'):$('demoCanvas'),w=source.videoWidth||source.naturalWidth||source.width,h=source.videoHeight||source.naturalHeight||source.height,box=stage.getBoundingClientRect();if(!w||!h)throw new Error('Görüntü henüz hazır değil.');const c=document.createElement('canvas');c.width=120;c.height=90;const d=c.getContext('2d'),r=cropRect({x:0,y:0,w:1,h:1},w,h,box.width,box.height);d.drawImage(source,r.x,r.y,r.width,r.height,0,0,c.width,c.height);const suggestion=suggestRegions(d.getImageData(0,0,c.width,c.height).data,c.width,c.height);if(!suggestion){say('İki uygun renkli alan önerilemedi. Kapları yan yana getirin veya kutuları elle taşıyın.');return;}regions=repeatSession?{reference:suggestion.sample,sample:suggestion.reference}:suggestion;$('regionSize').value='suggested';drawRegions();invalidate();liveQuality();say('Alan önerisi yerleştirildi. Kutuların sıvının içinde olduğunu gözle kontrol edin; bu işlem sıvı türünü tanımaz.');}catch(error){say(error.message);}
};
function geometryIssues(){for(let i=0;i<roles.length;i++)for(let j=i+1;j<roles.length;j++)if(overlap(regions[roles[i]],regions[roles[j]]))return ['Ölçüm kutuları örtüşüyor. Alanları birbirinden ayırın.'];return [];}
function capture(){
 if(mode==='demo')paintDemo();
 const source=mode==='camera'?video:mode==='photo'?$('photo'):$('demoCanvas');
 const w=source.videoWidth||source.naturalWidth||source.width,h=source.videoHeight||source.naturalHeight||source.height;
 if(!w||!h||mode==='none')throw new Error('Görüntü hazır değil. Yeniden kamera veya fotoğraf açın.');
 const bounds=stage.getBoundingClientRect(),frame={};canvas.width=64;canvas.height=64;
 for(const role of roles){const r=cropRect(regions[role],w,h,bounds.width,bounds.height);ctx.drawImage(source,r.x,r.y,r.width,r.height,0,0,64,64);frame[role]=measure(ctx.getImageData(0,0,64,64).data,64,64);const preview=$('preview-'+role);preview.getContext('2d').drawImage(canvas,0,0,preview.width,preview.height);}
 return frame;
}
function health(key,state,text){const n=$('health-'+key);n.dataset.state=state;n.querySelector('b').textContent=text;}
function liveQuality(){
 if(busy)return;
 let issues=[];
 if(mode==='none'){$('qualityText').textContent='Kamera veya fotoğraf açıldığında ışık kontrolü burada görünür.';$('qualityIndicator').textContent='○';document.querySelector('.quality-strip').classList.remove('bad');for(const key of ['light','glare','motion'])health(key,'waiting','Bekleniyor');return;}
 try{
  const frame=capture();issues=[...geometryIssues(),...quality(frame)];
  const dark=roles.some(role=>frame[role].brightness<25),bright=roles.some(role=>frame[role].brightness>235),glare=roles.some(role=>frame[role].clipped>.18);
  health('light',dark||bright?'bad':'good',dark?'Çok karanlık':bright?'Fazla aydınlık':'Uygun');
  health('glare',glare?'bad':'good',glare?'Ayrıntı kaybı':'Kırpılma düşük');
  if(mode==='camera'&&!adjusting){qualityHistory.push(frame);qualityHistory=qualityHistory.slice(-4);const movement=qualityHistory.length>=3&&summarize(qualityHistory).issues.some(i=>i.includes('değişken'));health('motion',movement?'bad':qualityHistory.length<3?'waiting':'good',movement?'Görüntü değişiyor':qualityHistory.length<3?'Kontrol ediliyor':'Şimdilik sabit');if(movement)issues.push('Görüntü değişiyor. Telefonu, kapları ve ışığı sabitle.');}
  else health('motion','waiting',mode==='photo'?'Tek kare':mode==='demo'?'Demo görüntüsü':'Ayar yapılıyor');
  for(const role of roles){const x=frame[role];$('live-'+role).textContent='Parlaklık '+Math.round(x.brightness)+' / 255';$('color-'+role).style.background=`rgb(${x.r},${x.g},${x.b})`;}
 }catch{issues=['Görüntü hazırlanıyor…'];for(const key of ['light','glare','motion'])health(key,'waiting','Bekleniyor');}
 $('qualityText').textContent=issues.length?issues.join(' '):'Işık ön kontrolü uygun görünüyor. Yakın görünümlerde kap kenarı ve yansıma olmadığını kontrol et.';
 updateReadiness();
 $('qualityIndicator').textContent=issues.length?'△':'✓';document.querySelector('.quality-strip').classList.toggle('bad',!!issues.length);
 if(mode==='camera'&&$('autoCamera').checked&&!adjusting&&performance.now()-lastAdjustment>2200)void correctCamera();
}
setInterval(liveQuality,900);
$('start').onclick=async()=>{
 if(busy)return;const ticket=++generation;clearSource();setMode('none');busy=true;controls();$('stop').disabled=false;say('Kamera izni bekleniyor…');
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Kamera için HTTPS ve desteklenen bir tarayıcı gerekir. Fotoğraf yükleyebilirsiniz.');
  const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
  if(ticket!==generation){next.getTracks().forEach(t=>t.stop());return;}
  stream=next;video.srcObject=next;await video.play();if(ticket!==generation)return;
  assistant=new CameraAssistant(stream.getVideoTracks()[0]);const configured=await assistant.configure();if(ticket!==generation)return;
  cameraInfo(configured.some(r=>r.ok)?'Desteklenen otomatik kamera modları açıldı.':'Bu tarayıcı kamera modlarını kontrol etmiyor; ışık sorunlarında yönlendirme gösterilecek.');lastAdjustment=0;
  setMode('camera');stream.getVideoTracks()[0].addEventListener('ended',()=>{if(mode==='camera'){$('stop').click();say('Kamera bağlantısı kesildi; yeniden açabilirsiniz.');}},{once:true});
  say('Referans ve numuneyi yan yana yerleştirin. Hazırlığı tamamlayıp ölçümü başlatın.');
 }catch(e){if(ticket!==generation)return;clearSource();setMode('none');say(e.name==='NotAllowedError'?'Kamera izni verilmedi. Tarayıcı izinlerini kontrol edin veya fotoğraf yükleyin.':e.name==='NotFoundError'?'Kamera bulunamadı. Fotoğraf yükleyebilirsiniz.':e.message);}
 finally{if(ticket===generation){busy=false;controls();liveQuality();}}
};
function suspendSource(){generation++;busy=false;clearSource();setMode('none');$('progress').hidden=true;}
$('stop').onclick=()=>{suspendSource();if(!$('view-measure').hidden)startDemo();};
$('torch').onclick=async()=>{if(!assistant||busy||adjusting)return;const active=assistant,ticket=generation;adjusting=true;invalidate();controls();try{const r=await active.set('torch',!torch);if(ticket===generation){cameraInfo(r.ok?'Fener ayarı uygulandı. Yansımayı kontrol et.':'Fener ayarı kamera tarafından doğrulanmadı.');await settle();}}finally{if(ticket===generation){adjusting=false;controls();liveQuality();}}};
document.querySelector('.upload').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!busy){e.preventDefault();$('upload').click();}};
$('upload').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file||busy)return;
 if(!file.type.startsWith('image/')){say('Bir görüntü dosyası seçin.');return;}if(file.size>25*1024*1024){say('Fotoğraf 25 MB sınırını aşıyor. Daha küçük bir görüntü seçin.');return;}
 const ticket=++generation;clearSource();setMode('none');busy=true;controls();$('stop').disabled=false;
 try{imageURL=URL.createObjectURL(file);$('photo').src=imageURL;await $('photo').decode();if(ticket!==generation)return;setMode('photo');say('Tek fotoğraf modu. İki kap aynı fotoğrafta bulunmalı.');}
 catch{if(ticket===generation){clearSource();setMode('none');say('Fotoğraf okunamadı. JPEG, PNG veya WebP deneyin.');}}
 finally{if(ticket===generation){busy=false;controls();liveQuality();}}
};
function startDemo(){
 generation++;clearSource();regions=defaults();demoScenario=$('demoScenario').value;demoPaused=reducedMotion.matches;$('demoPause').textContent=demoPaused?'▶ Devam et':'Ⅱ Duraklat';$('demoPause').setAttribute('aria-pressed',String(demoPaused));setMode('demo');restartDemo();updateDemoExpected();say('Animasyonlu demo sentetik veridir. Hazırlık onayları gerekmez. Test için karşılaştırmayı başlatın; gerçek numune kaydı oluşturulmaz.');
}
$('demoScenario').onchange=()=>{demoScenario=$('demoScenario').value;updateDemoExpected();restartDemo();say('Test senaryosu değişti. Karşılaştırmayı başlatarak beklenen davranışı deneyin.');};
$('demoPause').onclick=()=>setDemoPaused(!demoPaused);
$('demoRestart').onclick=restartDemo;
reducedMotion.addEventListener('change',e=>{if(e.matches&&mode==='demo'&&!busy)setDemoPaused(true);});
all('.setup input,.setup select,.setup textarea').forEach(e=>e.addEventListener('input',()=>{invalidate();controls();}));
function nextFrame(){
 return new Promise((resolve,reject)=>{
  let callback;const timeout=setTimeout(()=>{if(callback!==undefined)video.cancelVideoFrameCallback?.(callback);reject(new Error('Kameradan yeni kare alınamadı; tekrar deneyin.'));},3000);
  if(video.requestVideoFrameCallback)callback=video.requestVideoFrameCallback(()=>{clearTimeout(timeout);resolve();});
  else setTimeout(()=>{clearTimeout(timeout);resolve();},180);
 });
}
$('analyze').onclick=async()=>{
 if(busy||adjusting||!ready())return;const ticket=generation,sourceMode=mode;
 const geometry=geometryIssues();if(geometry.length){say(geometry[0]);return;}
 invalidate();busy=true;controls();$('progress').hidden=false;$('progress').value=0;say('Alanlar ölçülüyor; telefonu ve numuneleri sabit tutun.');
 try{
  const frames=[],count=mode==='camera'||(mode==='demo'&&!demoPaused)?8:1;$('progress').max=count;stage.classList.add('measuring');
  for(let i=0;i<count;i++){if(sourceMode==='camera')await nextFrame();else if(sourceMode==='demo'&&count>1)await new Promise(resolve=>setTimeout(resolve,180));if(ticket!==generation)return;frames.push(capture());$('progress').value=i+1;}
  const report=summarize(frames);
  report.comparison=verdict(report);
  if(sourceMode==='camera')report.camera={settings:assistant?.snapshot(),adjustments:assistant?.log.slice(-20),automatic:$('autoCamera').checked};
  Object.assign(report,{id:crypto.randomUUID(),createdAt:new Date().toISOString(),referenceName:$('refName').value.trim()||'Demo referans',sampleName:$('sampleName').value.trim()||'Demo numune',notes:$('notes').value.trim(),source:sourceMode,demo:sourceMode==='demo',...(sourceMode==='demo'?{demoScenario,demoPaused}:{}),regions:structuredClone(regions),conditions:all('.condition').map(c=>c.checked)});
  if(repeatSession){report.repeatValidation=compareRepeat(repeatSession.first,report,$('swapConfirmed').checked);report.firstCapture=repeatSession.first;if(report.comparison.issues.length===0)endRepeat(false);}
  renderReport(report);say(sourceMode==='demo'?'Animasyon karşılaştırması tamamlandı. Sonuç gerçek bir numuneye ait değildir.':'Karşılaştırma hazır. Sonuçları inceleyebilirsiniz.');$('result').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){if(ticket===generation)say(e.message);}
 finally{if(ticket===generation){stage.classList.remove('measuring');busy=false;$('progress').hidden=true;controls();liveQuality();}}
};
const number=(n,d=1)=>Number(n).toLocaleString('tr-TR',{minimumFractionDigits:d,maximumFractionDigits:d});
const date=s=>new Date(s).toLocaleString('tr-TR');
const rgb=s=>`rgb(${Math.round(s.r)},${Math.round(s.g)},${Math.round(s.b)})`;
function renderReport(r){
 aiReport?.dispose();
 lastReport=r;const result=$('result');result.replaceChildren();result.hidden=false;
 if(r.demo)result.append(node('p',`DEMO · ${scenarios[r.demoScenario]?.name||'Sentetik görüntü'}${r.demoPaused?' · Duraklatılmış tek kare':''}. Gerçek bir sıvı numunesini temsil etmez.`,'demo-alert'));
 const v=r.comparison||verdict(r);
 const head=node('div',undefined,'result-heading'),left=node('div');left.append(node('span','03 / KARŞILAŞTIRMA SONUCU','eyebrow'),node('h2',v.title),node('p',`${date(r.createdAt)} · ${r.frames} kare`));head.append(left,node('span',r.demo?'Örnek test':r.frames>1?'Canlı çekim':'Fotoğraf','status'));result.append(head,node('p',v.explanation));
 for(const issue of v.issues)result.append(node('p',issue,'form-message error'));
 const swatches=node('div',undefined,'swatches');for(const [role,label]of [['reference',r.referenceName],['sample',r.sampleName]]){const wrap=node('div',undefined,'swatch'),color=node('i');color.style.background=rgb(r[role]);wrap.append(color,node('div',label));swatches.append(wrap);}result.append(swatches);
 if(!v.issues.length){const explanation=node('div',undefined,'result-next');explanation.append(node('b','Neye baktık?'),node('p',v.colorDifference<.025?'Renkleri birbirine yakın görünüyor.':'Renklerinde fark görülüyor.'),node('p',Math.abs(v.relativeOpticalDifference)<.035?'Işığı geçirme görünümleri birbirine yakın.':'Bir taraf kamerada daha koyu görünüyor.'),node('p','Görüntü seri çekim boyunca yeterince sabit kaldı.'));result.append(explanation);}
 result.append(node('p','Bu sonuç yalnızca bu çekimdeki görünümü anlatır. Aynı içerik veya saflık onayı değildir.','hint'));
 if(r.repeatValidation){const check=node('section',undefined,'repeat-result');check.append(node('span','İKİ ÇEKİMİN KONTROLÜ','eyebrow'),node('h3',r.repeatValidation.title),node('p',r.repeatValidation.explanation),node('p','Bu kontrol de pratik kamera eşikleri kullanır; kimyasal analiz değildir.','hint'));result.append(check);}
 else if(v.issues.length===0&&['camera','demo'].includes(r.source)){const check=node('section',undefined,'repeat-result');check.append(node('h3','Sonuç yer değiştirince de sürüyor mu?'),node('p',r.demo?'Demo akışında ikinci çekimi deneyebilirsin. Gerçek sıvı kontrolü değildir.':'Kapların yerini değiştirip yeniden ölç. İki çekim birlikte değerlendirilerek konum ve aydınlatma etkisi kontrol edilir.'),button(r.demo?'Demo tekrarını dene':'Yer değiştirerek kontrol et',()=>beginRepeat(r),'primary'));result.append(check);}
 aiReport=createAIReport(r,data=>{if(lastReport===r)r.aiInterpretation=data;});result.append(aiReport.element);
 const next=node('div',undefined,'result-next');next.append(node('b','Şimdi ne yapmalıyım?'),node('p',r.demo?'Bu bir animasyon ölçümüdür. Gerçek karşılaştırma için kamerayı açın veya iki numuneyi birlikte gösteren fotoğraf yükleyin.':'Kutuların kap kenarı ve yansıma içermediğini kontrol edin. Aynı numuneleri tekrar ölçerek farkın tekrarlanıp tekrarlanmadığına bakın.'),button('Tekrar ölç',()=>{invalidate();stage.scrollIntoView({behavior:'smooth',block:'center'});controls();}));result.append(next);
 if(r.notes)result.append(node('p','Not: '+r.notes));
 const details=node('details'),summary=node('summary','Çekim kontrolü ve yöntem');details.append(summary,node('p',`Renk oranı farkı: ${number(v.colorDifference,4)}. Göreli kamera ışık farkı: ${v.relativeOpticalDifference===null?'ölçülemedi':number(v.relativeOpticalDifference,4)}. Yöntem: ${v.method}. Kalibre edilmiş optik yoğunluk değildir. Işık uçuş süresi ölçülmez. Karar eşikleri laboratuvarla doğrulanmamıştır.`));result.append(details);
 const actions=node('div',undefined,'actions');actions.append(button('Sonucu indir',()=>downloadJSON(r)),button('Yazdır / PDF',()=>window.print()));result.append(actions);

}

function downloadJSON(report){const url=URL.createObjectURL(new Blob([JSON.stringify({...report,interpretation:'Görsel sıvı karşılaştırması; kimyasal bileşim veya saflık belirlenemez.'},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='liquid-lens-sonuc.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
window.addEventListener('viewchange',e=>{if(e.detail==='measure'){if(mode==='none')startDemo();}else suspendSource();});
window.addEventListener('accountchange',()=>{if(busy)return;const user=currentUser();$('demoScenario').value=user?.scenario||'stable';if(mode==='demo')startDemo();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(stream||busy))suspendSource();else if(document.hidden&&mode==='demo')setDemoPaused(true);else if(!document.hidden&&mode==='none'&&!$('view-measure').hidden&&!$('method-camera').hidden)startDemo();});
window.addEventListener('pagehide',()=>{generation++;stopCamera();stopDemo();if(imageURL)URL.revokeObjectURL(imageURL);});
drawRegions();controls();
