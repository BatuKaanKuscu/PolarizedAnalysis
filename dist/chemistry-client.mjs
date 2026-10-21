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
   const st=r.stereochemistry;if(st){const box=node('section',null,'stereo-summary');box.append(node('h3',st.summary),node('p',st.explanation));const metrics=node('div',null,'stereo-counts');for(const [label,value]of [['Tanımlı atom merkezi',st.atomDefined],['Tanımsız atom merkezi',st.atomUndefined],['Stereo bağ',st.bondTotal]]){const item=node('div');item.append(node('b',value===null?'—':String(value)),node('span',label));metrics.append(item);}box.append(metrics,node('p','Optik çevirme açısı ve enantiyomerik fazlalık bu kayıttan belirlenmez.','hint'));card.append(box);}
   const detail=node('details'),summary=node('summary','Teknik bilgiler');detail.append(summary,node('p','IUPAC adı: '+r.iupacName),node('p','Molekül ağırlığı: '+r.molecularWeight+' g/mol'));if(st?.smiles)detail.append(node('p','İzomerik SMILES:'),node('code',st.smiles,'stereo-code'));if(st?.inchiKey)detail.append(node('p','InChIKey:'),node('code',st.inchiKey,'stereo-code'));card.append(detail);
   const links=node('div',null,'compound-links');for(const [label,url]of [['PubChem kaynağı ↗',r.sourceUrl],['IUPAC · Kiralite ↗','https://goldbook.iupac.org/terms/view/C01057']]){const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}card.append(links,node('p','Bu bilgiler kütüphane kaydına aittir. R/S tanımı, (+)/(−) optik çevirme işaretini tek başına belirlemez.','hint'));$('chemResults').append(card);
  }
  if(data.moreMatches)$('chemResults').append(node('p','İlk beş kayıt gösteriliyor. Daha kesin bir ad veya CAS numarası kullan.','hint'));
 }catch(error){if(ticket===generation&&error.name!=='AbortError')$('chemStatus').textContent=error.name==='TimeoutError'?'Kütüphane geç yanıt veriyor. Tekrar deneyebilirsin.':error.message;}
 finally{if(ticket===generation)loading(false);}
};
document.querySelectorAll('[data-chemical]').forEach(b=>b.onclick=()=>{$('chemQuery').value=b.dataset.chemical;$('chemForm').requestSubmit();});
window.addEventListener('viewchange',e=>{if(e.detail!=='library'&&controller){generation++;controller.abort();controller=null;loading(false);if(!$('chemResults').children.length)$('chemStatus').textContent='Madde adı veya CAS numarasıyla yeniden arayabilirsin.';}});

window.addEventListener('open-library',e=>{const query=e.detail?.query;if(typeof query==='string'&&query.trim().length>=2){$('chemQuery').value=query.trim();$('chemForm').requestSubmit();}});
