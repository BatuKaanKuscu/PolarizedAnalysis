import {measure,quality,summarize,cropRect,overlap,METHOD} from './analysis.mjs';
import {drawDemo,scenarios} from './demo.mjs';
const $=id=>document.getElementById(id),all=s=>[...document.querySelectorAll(s)],video=$('video'),stage=$('stage'),canvas=$('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
const KEY='liquid-lens-reports-v2',roles=['reference','sample'];
let mode='none',stream=null,imageURL=null,selected='reference',busy=false,generation=0,torch=false,lastReport=null,regions=defaults(),records=[],storageError=false;
let demoAnimation=null,demoElapsed=0,demoStarted=0,demoPaused=false,demoScenario='stable';
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
function ready(){return mode==='demo'||(mode!=='none'&&all('.condition').every(c=>c.checked)&&$('refName').value.trim()&&$('sampleName').value.trim());}
function controls(){
 $('analyze').disabled=busy||!ready();$('start').disabled=busy;$('upload').disabled=busy;document.querySelector('.upload').setAttribute('aria-disabled',String(busy));
 $('stop').disabled=mode==='none'&&!busy;
 $('torch').disabled=busy||!stream?.getVideoTracks()[0]?.getCapabilities?.().torch;
 all('.placement button,.roi,.setup input,.setup select,.setup textarea').forEach(e=>e.disabled=busy);
 $('demo').disabled=busy;
 all('#demoPanel button,#demoPanel select').forEach(e=>e.disabled=busy);
}
function stopCamera(){stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;torch=false;$('torch').textContent='Fener';}
function clearSource(){stopCamera();stopDemo();stage.classList.remove('measuring');if(imageURL)URL.revokeObjectURL(imageURL);imageURL=null;$('photo').removeAttribute('src');}
function invalidate(){$('result').hidden=true;lastReport=null;}
function setMode(next){mode=next;video.hidden=next!=='camera';$('photo').hidden=next!=='photo';$('demoCanvas').hidden=next!=='demo';$('placeholder').hidden=next!=='none';$('regions').hidden=next==='none';$('demoBadge').hidden=next!=='demo';$('demoPanel').hidden=next!=='demo';$('cameraStatus').textContent={none:'Kaynak bekleniyor',camera:'Canlı kamera',photo:'Tek fotoğraf',demo:'Animasyonlu test'}[next];invalidate();controls();drawRegions();}
function select(role){selected=role;all('.placement [data-role]').forEach(b=>{b.classList.toggle('active',b.dataset.role===role);b.setAttribute('aria-pressed',String(b.dataset.role===role));});all('.roi').forEach(b=>b.classList.toggle('selected',b.dataset.role===role));}
function drawRegions(){for(const role of roles){const e=document.querySelector(`.roi[data-role="${role}"]`),r=regions[role];Object.assign(e.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.w*100+'%',height:r.h*100+'%'});}select(selected);}
function move(role,x,y){const r=regions[role];r.x=Math.max(0,Math.min(1-r.w,x-r.w/2));r.y=Math.max(.07,Math.min(1-r.h,y-r.h/2));drawRegions();invalidate();liveQuality();}
all('.placement [data-role]').forEach(b=>b.onclick=()=>select(b.dataset.role));
$('regions').onclick=e=>{if(busy)return;const box=e.target.closest('.roi');if(box){select(box.dataset.role);return;}const b=stage.getBoundingClientRect();move(selected,(e.clientX-b.left)/b.width,(e.clientY-b.top)/b.height);};
all('.roi').forEach(b=>{
 let drag=null;
 b.onpointerdown=e=>{if(busy)return;select(b.dataset.role);drag={x:e.clientX,y:e.clientY,moved:false};b.setPointerCapture(e.pointerId);};
 b.onpointermove=e=>{if(!drag||busy)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<4&&!drag.moved)return;drag.moved=true;const rect=stage.getBoundingClientRect();move(b.dataset.role,(e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height);};
 b.onpointerup=()=>drag=null;b.onpointercancel=()=>drag=null;
 b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||busy)return;e.preventDefault();const r=regions[b.dataset.role];move(b.dataset.role,r.x+r.w/2+(e.key==='ArrowLeft'?-.01:e.key==='ArrowRight'?.01:0),r.y+r.h/2+(e.key==='ArrowUp'?-.01:e.key==='ArrowDown'?.01:0));};
});
$('positions').onclick=()=>{regions=defaults();drawRegions();invalidate();liveQuality();};
function geometryIssues(){for(let i=0;i<roles.length;i++)for(let j=i+1;j<roles.length;j++)if(overlap(regions[roles[i]],regions[roles[j]]))return ['Ölçüm kutuları örtüşüyor. Alanları birbirinden ayırın.'];return [];}
function capture(){
 if(mode==='demo')paintDemo();
 const source=mode==='camera'?video:mode==='photo'?$('photo'):$('demoCanvas');
 const w=source.videoWidth||source.naturalWidth||source.width,h=source.videoHeight||source.naturalHeight||source.height;
 if(!w||!h||mode==='none')throw new Error('Görüntü hazır değil. Yeniden kamera veya fotoğraf açın.');
 const bounds=stage.getBoundingClientRect(),frame={};canvas.width=64;canvas.height=64;
 for(const role of roles){const r=cropRect(regions[role],w,h,bounds.width,bounds.height);ctx.drawImage(source,r.x,r.y,r.width,r.height,0,0,64,64);frame[role]=measure(ctx.getImageData(0,0,64,64).data,64,64);}
 return frame;
}
function liveQuality(){
 if(busy)return;
 let issues=[];
 if(mode==='none'){$('qualityText').textContent='Kamera veya fotoğraf açıldığında ışık kontrolü burada görünür.';$('qualityIndicator').textContent='○';document.querySelector('.quality-strip').classList.remove('bad');return;}
 try{issues=[...geometryIssues(),...quality(capture())];}catch{issues=['Görüntü hazırlanıyor…'];}
 $('qualityText').textContent=issues.length?issues.join(' '):'Işık ön kontrolü uygun görünüyor. Bölge konumlarını gözle kontrol edin.';
 $('qualityIndicator').textContent=issues.length?'△':'✓';document.querySelector('.quality-strip').classList.toggle('bad',!!issues.length);
}
setInterval(liveQuality,900);
$('start').onclick=async()=>{
 if(busy)return;const ticket=++generation;clearSource();setMode('none');busy=true;controls();$('stop').disabled=false;say('Kamera izni bekleniyor…');
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Kamera için HTTPS ve desteklenen bir tarayıcı gerekir. Fotoğraf yükleyebilirsiniz.');
  const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
  if(ticket!==generation){next.getTracks().forEach(t=>t.stop());return;}
  stream=next;video.srcObject=next;await video.play();if(ticket!==generation)return;
  setMode('camera');stream.getVideoTracks()[0].addEventListener('ended',()=>{if(mode==='camera'){$('stop').click();say('Kamera bağlantısı kesildi; yeniden açabilirsiniz.');}},{once:true});
  say('Referans ve numuneyi yan yana yerleştirin. Hazırlığı tamamlayıp ölçümü başlatın.');
 }catch(e){if(ticket!==generation)return;clearSource();setMode('none');say(e.name==='NotAllowedError'?'Kamera izni verilmedi. Tarayıcı izinlerini kontrol edin veya fotoğraf yükleyin.':e.name==='NotFoundError'?'Kamera bulunamadı. Fotoğraf yükleyebilirsiniz.':e.message);}
 finally{if(ticket===generation){busy=false;controls();liveQuality();}}
};
$('stop').onclick=()=>{generation++;busy=false;clearSource();setMode('none');$('progress').hidden=true;liveQuality();say('Kaynak kapatıldı. Kaydedilmiş raporlar Kayıtlar bölümünde kalır.');};
$('torch').onclick=async()=>{if(!stream||busy)return;try{const next=!torch;await stream.getVideoTracks()[0].applyConstraints({advanced:[{torch:next}]});torch=next;$('torch').textContent=next?'Feneri kapat':'Fener';invalidate();say('Fener yansıması ölçüm alanına düşmemeli; iki kap eşit aydınlanmalı.');}catch{say('Bu cihazda fener kontrolü kullanılamıyor.');}};
document.querySelector('.upload').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!busy){e.preventDefault();$('upload').click();}};
$('upload').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file||busy)return;
 if(!file.type.startsWith('image/')){say('Bir görüntü dosyası seçin.');return;}if(file.size>25*1024*1024){say('Fotoğraf 25 MB sınırını aşıyor. Daha küçük bir görüntü seçin.');return;}
 const ticket=++generation;clearSource();setMode('none');busy=true;controls();$('stop').disabled=false;
 try{imageURL=URL.createObjectURL(file);$('photo').src=imageURL;await $('photo').decode();if(ticket!==generation)return;setMode('photo');say('Tek fotoğraf modu. İki kap aynı fotoğrafta bulunmalı.');}
 catch{if(ticket===generation){clearSource();setMode('none');say('Fotoğraf okunamadı. JPEG, PNG veya WebP deneyin.');}}
 finally{if(ticket===generation){busy=false;controls();liveQuality();}}
};
$('demo').onclick=()=>{
 generation++;clearSource();regions=defaults();demoScenario=$('demoScenario').value;demoPaused=reducedMotion.matches;$('demoPause').textContent=demoPaused?'▶ Devam et':'Ⅱ Duraklat';$('demoPause').setAttribute('aria-pressed',String(demoPaused));setMode('demo');restartDemo();updateDemoExpected();say('Animasyonlu demo sentetik veridir. Hazırlık onayları gerekmez. Test için karşılaştırmayı başlatın; gerçek numune kaydı oluşturulmaz.');
};
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
 if(busy||!ready())return;const ticket=generation,sourceMode=mode;
 const geometry=geometryIssues();if(geometry.length){say(geometry[0]);return;}
 invalidate();busy=true;controls();$('progress').hidden=false;$('progress').value=0;say('Alanlar ölçülüyor; telefonu ve numuneleri sabit tutun.');
 try{
  const frames=[],count=mode==='camera'||(mode==='demo'&&!demoPaused)?8:1;$('progress').max=count;stage.classList.add('measuring');
  for(let i=0;i<count;i++){if(sourceMode==='camera')await nextFrame();else if(sourceMode==='demo'&&count>1)await new Promise(resolve=>setTimeout(resolve,180));if(ticket!==generation)return;frames.push(capture());$('progress').value=i+1;}
  const report=summarize(frames);
  if(report.issues.length){say('Ölçüm kaydedilmedi. '+report.issues.join(' '));return;}
  Object.assign(report,{id:crypto.randomUUID(),createdAt:new Date().toISOString(),oilType:$('oilType').value,referenceName:$('refName').value.trim()||'Demo referans',sampleName:$('sampleName').value.trim()||'Demo numune',notes:$('notes').value.trim(),source:sourceMode,demo:sourceMode==='demo',...(sourceMode==='demo'?{demoScenario,demoPaused}:{}),regions:structuredClone(regions),conditions:all('.condition').map(c=>c.checked)});
  renderReport(report);say(sourceMode==='demo'?'Demo raporu hazır. Gerçek ölçüm değildir ve kayıtlara eklenemez.':'Karşılaştırma hazır. Raporu inceleyip cihazınıza kaydedebilirsiniz.');$('result').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){if(ticket===generation)say(e.message);}
 finally{if(ticket===generation){stage.classList.remove('measuring');busy=false;$('progress').hidden=true;controls();liveQuality();}}
};
const number=(n,d=1)=>Number(n).toLocaleString('tr-TR',{minimumFractionDigits:d,maximumFractionDigits:d});
const date=s=>new Date(s).toLocaleString('tr-TR');
const rgb=s=>`rgb(${Math.round(s.r)},${Math.round(s.g)},${Math.round(s.b)})`;
function renderReport(r){
 lastReport=r;const result=$('result');result.replaceChildren();result.hidden=false;
 if(r.demo)result.append(node('p',`DEMO · ${scenarios[r.demoScenario]?.name||'Sentetik görüntü'}${r.demoPaused?' · Duraklatılmış tek kare':''}. Gerçek bir yağ numunesini temsil etmez.`,'demo-alert'));
 const head=node('div',undefined,'result-heading'),left=node('div');left.append(node('span','03 / ÖLÇÜM RAPORU','eyebrow'),node('h2','Görünür fark kaydedildi'),node('p',`${r.oilType} · ${date(r.createdAt)} · ${r.frames} kare`));head.append(left,node('span',r.frames>1?'Seri kontrolü geçti':'Tek kare · kararlılık ölçülmedi','status'));result.append(head);
 const swatches=node('div',undefined,'swatches');for(const [role,label]of [['reference',r.referenceName],['sample',r.sampleName]]){const wrap=node('div',undefined,'swatch'),color=node('i'),labelNode=node('div',label);color.style.background=rgb(r[role]);labelNode.append(node('small',`${role==='reference'?'Referans':'Numune'} · RGB ${[r[role].r,r[role].g,r[role].b].map(n=>number(n,0)).join(' / ')}`));wrap.append(color,labelNode);swatches.append(wrap);}result.append(swatches);
 const metrics=node('div',undefined,'metrics');for(const [value,label,note]of [[r.distance,'RGB uzaklığı','0–441,7 · kamera birimi'],[r.brightness,'Parlaklık farkı','0–255 · kamera birimi'],[r.range,'Seri fark aralığı',r.frames>1?'Kareler arası RGB fark değişimi':'Tek karede değerlendirilemez']]){const m=node('div',undefined,'metric');m.append(node('b',label==='Seri fark aralığı'&&r.frames===1?'—':number(value)),node('span',label),node('small',note));metrics.append(m);}result.append(metrics);
 const chart=node('div',undefined,'channel-chart');chart.append(node('h3','Kanal farkları · Numune − Referans'));r.channels.forEach((delta,i)=>{const row=node('div',undefined,'channel-row'),track=node('div',undefined,'channel-track'),dot=node('span',undefined,'channel-dot');dot.style.left=(50+delta/255*50)+'%';track.append(dot);row.append(node('span',['R','G','B'][i]),track,node('span',(delta>0?'+':'')+number(delta)));chart.append(row);});chart.append(node('p','Ortadaki çizgi sıfır farktır. Sol: numunede daha düşük, sağ: daha yüksek kanal değeri.','hint'));result.append(chart);
 result.append(node('p','Bu değerler iki alanın kamera renkleri arasındaki farkı gösterir. Düşük fark orijinallik kanıtı değildir; yüksek fark da karışım kanıtı değildir. Işık, kap ve doğal renk farklılıkları sonucu etkileyebilir.'));
 if(r.notes)result.append(node('p','Not: '+r.notes));
 const details=node('details'),summary=node('summary','Çekim kontrolü ve yöntem');details.append(summary,node('p',`Seri içi en büyük bölge sapması: ${number(r.drift)}. Yöntem: ${r.method}. Fiziksel kalibrasyon yapılmamıştır. Pratik eşikler laboratuvar doğrulamasından geçmemiştir.`));result.append(details);
 const actions=node('div',undefined,'actions'),save=button(records.some(x=>x.id===r.id)?'Kaydedildi':'Cihaza kaydet',()=>{if(saveRecord(r)){save.textContent='Kaydedildi';save.disabled=true;}});save.disabled=r.demo||records.some(x=>x.id===r.id);actions.append(save,button('JSON indir',()=>downloadJSON(r)),button('CSV indir',()=>downloadCSV([r])),button('Yazdır / PDF',()=>window.print()));result.append(actions);
}
function validReport(r){return r&&['paired-rgb-v2',METHOD].includes(r.method)&&typeof r.id==='string'&&typeof r.referenceName==='string'&&typeof r.sampleName==='string'&&typeof r.oilType==='string'&&typeof r.notes==='string'&&!r.demo&&Number.isFinite(Date.parse(r.createdAt))&&['distance','brightness','range','drift','frames'].every(k=>Number.isFinite(r[k]))&&roles.every(role=>r[role]&&['r','g','b','brightness','clipped','spread'].every(k=>Number.isFinite(r[role][k])))&&Array.isArray(r.channels)&&r.channels.length===3&&r.channels.every(Number.isFinite);}
try{const parsed=JSON.parse(localStorage.getItem(KEY)||'[]');records=Array.isArray(parsed)?parsed.filter(validReport).slice(0,30):[];}catch{storageError=true;}
function saveRecord(r){if(r.demo)return false;if(records.some(x=>x.id===r.id))return true;const next=[r,...records].slice(0,30);try{localStorage.setItem(KEY,JSON.stringify(next));records=next;renderHistory();say('Rapor bu tarayıcıya kaydedildi. Fotoğraf saklanmadı.');return true;}catch{say('Tarayıcıya kayıt yapılamadı. JSON veya CSV indirerek raporu saklayın.');return false;}}
function renderHistory(){
 $('historyCount').textContent=records.length;const list=$('historyList');list.replaceChildren();$('exportAll').disabled=!records.length;$('clearHistory').disabled=!records.length;
 if(!records.length)list.append(node('div',storageError?'Tarayıcı kayıtlarına erişilemiyor. Ölçüm raporlarını dosya olarak indirebilirsiniz.':'Henüz kayıt yok. Ölçüm yaptıktan sonra “Cihaza kaydet” düğmesini kullanın.','empty'));
 for(const r of records){const item=node('article',undefined,'card history-item'),info=node('div');info.append(node('h3',`${r.referenceName} ↔ ${r.sampleName}`),node('p',`${date(r.createdAt)} · ${r.oilType} · RGB farkı ${number(r.distance)}`));const actions=node('div',undefined,'actions');actions.append(button('Raporu aç',()=>{showView('measure');renderReport(r);$('result').scrollIntoView({behavior:'smooth'});}),button('JSON',()=>downloadJSON(r)),button('Sil',()=>{if(!confirm('Bu rapor silinsin mi?'))return;try{const next=records.filter(x=>x.id!==r.id);localStorage.setItem(KEY,JSON.stringify(next));records=next;renderHistory();if(lastReport?.id===r.id)renderReport(lastReport);}catch{alert('Kayıt silinemedi. Tarayıcı depolama izinlerini kontrol edin.');}},'danger'));item.append(info,actions);list.append(item);}
}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=node('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function downloadJSON(r){download(`liquid-lens-${r.id}.json`,JSON.stringify({...r,interpretation:'Görsel karşılaştırma. Saflık, güvenlik veya karışım oranı belirlenemez.'},null,2),'application/json');}
function downloadCSV(rows){const headers=['Tarih','Yağ türü','Referans','Numune','Kaynak','Demo','Kare sayısı','RGB farkı','Parlaklık farkı','Seri aralığı','R farkı','G farkı','B farkı','Notlar','Yöntem','Sınır'];const quote=v=>'"'+(typeof v==='string'&&/^[\s]*[=+@-]/.test(v)?"'"+v:String(v)).replaceAll('"','""')+'"';const data=rows.map(r=>[r.createdAt,r.oilType,r.referenceName,r.sampleName,r.source,r.demo,r.frames,r.distance,r.brightness,r.range,...r.channels,r.notes,r.method,'Saflık ve karışım oranı belirlenemez']);download('liquid-lens-rapor.csv','\uFEFF'+[headers,...data].map(row=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');}
$('exportAll').onclick=()=>downloadCSV(records);
$('clearHistory').onclick=()=>{if(!confirm('Bu tarayıcıdaki tüm ölçüm raporları silinsin mi?'))return;try{localStorage.removeItem(KEY);records=[];renderHistory();invalidate();}catch{alert('Kayıtlar temizlenemedi.');}};
function showView(view){all('.view').forEach(e=>e.hidden=e.id!=='view-'+view);all('.tab').forEach(b=>{const active=b.dataset.view===view;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});if(view!=='measure'&&(mode==='camera'||mode==='demo'))$('stop').click();if(view==='history')renderHistory();}
all('.tab').forEach(b=>b.onclick=()=>{if(busy)return;showView(b.dataset.view);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(stream||busy)){$('stop').click();say('Sayfa arka plana geçtiği için çekim durduruldu. Yeniden açabilirsiniz.');}else if(document.hidden&&mode==='demo')setDemoPaused(true);});
window.addEventListener('pagehide',()=>{generation++;stopCamera();stopDemo();if(imageURL)URL.revokeObjectURL(imageURL);});
drawRegions();renderHistory();controls();
