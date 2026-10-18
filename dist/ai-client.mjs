let statusPromise;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
export function aiSummary(r){return Object.fromEntries(['reference','sample'].map(role=>[role,Object.fromEntries(['r','g','b','clipped','spread'].map(k=>[k,r[role][k]]))]).concat(['frames','range','drift','demo'].map(k=>[k,r[k]])));}
export function createAIReport(report,onResult){
 const controller=new AbortController(),panel=el('section',null,'ai-panel'),head=el('div',null,'panel-heading'),title=el('div');
 title.append(el('span','İKİNCİ BİR BAKIŞ','eyebrow'),el('h3','Yapay zekâ ne diyor?'));head.append(title,el('span','Google Gemini','status'));panel.append(head);
 panel.append(el('p','Yapay zekâ, bu ölçümün sayısal özetini yorumlar ve tekrar çekim önerileri verir. Sıvının türünü veya saf olduğunu belirleyemez.'));
 const message=el('p','Yorum servisi kontrol ediliyor…','ai-status');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
 const consentWrap=el('label',null,'ai-consent'),consent=el('input');consent.type='checkbox';consent.disabled=true;consentWrap.append(consent,el('span','Yalnızca sayısal ölçüm özetinin Google Gemini’ye gönderilmesine izin veriyorum. Fotoğrafım ve hesap bilgilerim gönderilmez. Ücretsiz kullanımda Google bu verileri ürünlerini geliştirmek için kullanabilir.'));
 const actions=el('div',null,'actions'),button=el('button','Ölçümü yapay zekâya yorumlat ↗');button.disabled=true;actions.append(button);
 const output=el('div',null,'ai-output');output.hidden=true;output.setAttribute('aria-live','polite');panel.append(message,consentWrap,actions,output);
 let available=false,loading=false,disposed=false;
 consent.onchange=()=>button.disabled=!available||!consent.checked||loading;
 statusPromise??=fetch('/api/ai/status',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error();return r.json();}).catch(e=>{statusPromise=null;throw e;});
 statusPromise.then(s=>{if(disposed)return;available=s.enabled===true;consent.disabled=!available;button.disabled=!available||!consent.checked;message.textContent=available?'İstersen ölçümün için kısa bir yorum alabilirsin.':'Yapay zekâ servisi henüz etkin değil. Yukarıdaki otomatik karşılaştırma kullanılabilir.';consentWrap.hidden=!available;actions.hidden=!available;}).catch(()=>{if(!disposed){message.textContent='Yorum servisine ulaşılamadı. Normal karşılaştırma kullanılabilir.';consentWrap.hidden=true;actions.hidden=true;}});
 button.onclick=async()=>{
  if(!available||!consent.checked||loading||disposed)return;loading=true;button.disabled=true;consent.disabled=true;output.hidden=true;message.textContent='Ölçüm özeti yorumlanıyor…';panel.setAttribute('aria-busy','true');
  try{const response=await fetch('/api/ai/interpret',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:true,measurement:aiSummary(report)}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])}),data=await response.json();if(disposed)return;if(!response.ok)throw new Error(data.error||'Yorum alınamadı.');
   output.replaceChildren(el('b','Yapay zekâ yorumu'),el('p',data.explanation));if(data.nextSteps?.length){const list=el('ul');for(const step of data.nextSteps)list.append(el('li',step));output.append(list);}output.append(el('p',data.disclaimer,'hint'));output.hidden=false;message.textContent='Yorum hazır. Ölçüm kararı yapay zekâ tarafından değiştirilmedi.';button.textContent='Yeniden yorumlat';onResult?.(data);
  }catch(e){if(!disposed)message.textContent=e.name==='TimeoutError'?'Yorum servisi yavaş yanıt verdi. Yeniden deneyebilirsin.':e.message||'Yorum alınamadı; ölçümünü kullanmaya devam edebilirsin.';}
  finally{if(!disposed){loading=false;button.disabled=!consent.checked;consent.disabled=false;panel.setAttribute('aria-busy','false');}}
 };
 return {element:panel,dispose(){disposed=true;controller.abort();}};
}
