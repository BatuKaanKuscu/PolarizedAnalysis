const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
let controller=null,generation=0;
function loading(value){$('chemSubmit').disabled=value;$('chemLibrary').setAttribute('aria-busy',String(value));}
$('chemQuery').addEventListener('input',()=>{generation++;controller?.abort();controller=null;loading(false);$('chemResults').replaceChildren();$('chemStatus').textContent='Yeni madde için kütüphanede ara düğmesine bas.';});
$('chemForm').onsubmit=async e=>{
 e.preventDefault();controller?.abort();controller=new AbortController();const ticket=++generation;loading(true);$('chemResults').replaceChildren();$('chemStatus').textContent='PubChem kütüphanesi aranıyor…';
 try{const response=await fetch('/api/chemistry/search?q='+encodeURIComponent($('chemQuery').value),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])}),data=await response.json();if(ticket!==generation)return;if(!response.ok)throw new Error(data.error||'Arama tamamlanamadı.');$('chemStatus').textContent=data.message;
  if(data.kind==='mixture')return;
  if(data.results.length>1)$('chemResults').append(node('p','Bu adla birden fazla kayıt bulundu. Kayıtları kaynak sayfalarından kontrol et.','hint'));
  for(const r of data.results){const card=node('article',null,'compound-card'),top=node('div',null,'panel-heading');top.append(node('h2',r.title),node('span','PubChem · CID '+r.cid,'status'));card.append(top,node('p','Molekül formülü: '+r.formula,'compound-formula'));
   const detail=node('details'),summary=node('summary','Teknik bilgiler');detail.append(summary,node('p','IUPAC adı: '+r.iupacName),node('p','Molekül ağırlığı: '+r.molecularWeight+' g/mol'));card.append(detail);
   const links=node('div',null,'compound-links');for(const [label,url]of [['PubChem kaynağı ↗',r.sourceUrl],['NIST’te spektrum ara ↗',r.spectrumSearchUrl]]){const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}card.append(links,node('p','NIST bağlantısı kaynakta arama yapar; her kayıt için spektrum bulunacağı garanti değildir.','hint'));$('chemResults').append(card);
  }
  if(data.moreMatches)$('chemResults').append(node('p','İlk beş kayıt gösteriliyor. Daha kesin bir ad veya CAS numarası kullan.','hint'));
 }catch(error){if(ticket===generation&&error.name!=='AbortError')$('chemStatus').textContent=error.name==='TimeoutError'?'Kütüphane geç yanıt veriyor. Tekrar deneyebilirsin.':error.message;}
 finally{if(ticket===generation)loading(false);}
};
document.querySelectorAll('[data-chemical]').forEach(b=>b.onclick=()=>{$('chemQuery').value=b.dataset.chemical;$('chemForm').requestSubmit();});
window.addEventListener('viewchange',e=>{if(e.detail!=='library'&&controller){generation++;controller.abort();controller=null;loading(false);if(!$('chemResults').children.length)$('chemStatus').textContent='Madde adı veya CAS numarasıyla yeniden arayabilirsin.';}});
