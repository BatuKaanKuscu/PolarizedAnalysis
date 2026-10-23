import {tokens} from './document-engine.mjs';
import {taskBlocks} from './document-tasks.mjs';
export function extractSummary(doc,limit=6){
 const candidates=[];let position=0;const frequency=new Map(),seen=new Set();
 for(const [pageIndex,page] of doc.pages.entries()){
  for(const sentence of page.text.split(/(?<=[.!?])\s+|\n+/u)){
   for(const piece of taskBlocks({pages:[{page:page.page,text:sentence}]},650)){
    const text=piece.text.trim();if(text.length<25)continue;
    const key=text.toLocaleLowerCase('tr-TR').replace(/\s+/g,' ');if(seen.has(key))continue;seen.add(key);
    const words=tokens(text);for(const word of words)frequency.set(word,(frequency.get(word)||0)+1);
    candidates.push({text,page:page.page,pageIndex,position:position++,words});
   }
  }
 }
 const count=Math.min(Math.max(1,limit),candidates.length),items=[];
 const score=c=>[...new Set(c.words)].reduce((sum,w)=>sum+Math.log(1+(frequency.get(w)||0)),0)/Math.sqrt(Math.max(1,c.words.length));
 const rank=(a,b)=>score(b)-score(a)||a.position-b.position;
 const groups=[...new Set(candidates.map(c=>c.pageIndex))].map(page=>candidates.filter(c=>c.pageIndex===page));
 for(let i=0;i<Math.min(count,groups.length);i++){
  const group=groups[count<groups.length?Math.round(i*(groups.length-1)/Math.max(1,count-1)):i];items.push([...group].sort(rank)[0]);
 }
 for(const item of [...candidates].sort(rank)){if(items.length>=count)break;if(!items.includes(item))items.push(item);}
 return {items:items.sort((a,b)=>a.position-b.position).map(({words,pageIndex,...item})=>item),keywords:[...frequency].filter(([word,n])=>word.length>3&&n>1).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([word])=>word),pagesConsidered:doc.pages.filter(p=>p.text.trim()).length};
}
export function answerInstruction(style){return style==='detailed'?'Yanıtı Türkçe, kısa paragraflarla yaz: tanım, kaynak destekliyorsa çalışma mantığı, bir örnek ve sınırlar. En fazla 350 kelime kullan.':'Günlük Türkçeyle en fazla 100 kelimelik, doğrudan bir açıklama yaz. Kaynak numaralarını koru.';}
export function attachAnswerTools(container,{question='',suggestions=[],onSuggestion}={}){
 container.querySelector('.answer-tools')?.remove();
 const bar=document.createElement('div');bar.className='answer-tools';
 const copy=document.createElement('button');copy.type='button';copy.textContent='Yanıtı kopyala';
 const download=document.createElement('button');download.type='button';download.textContent='Kaynaklarıyla indir';
 const notice=document.createElement('span');notice.setAttribute('role','status');notice.className='hint';
 const text=()=>{const clone=container.cloneNode(true);clone.querySelectorAll('.answer-tools,.answer-suggestions,button').forEach(n=>n.remove());clone.querySelectorAll('a[href]').forEach(a=>a.textContent+=' ('+a.href+')');clone.querySelectorAll('p,h3,h4,b,blockquote,article').forEach(n=>n.append(document.createTextNode('\n')));return (question?'Soru / dosya: '+question+'\n\n':'')+clone.textContent.trim();};
 copy.onclick=async()=>{try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(text());notice.textContent='Kopyalandı.';}catch{notice.textContent='Panoya erişilemedi. Metni seçebilir veya indirebilirsin.';}};
 download.onclick=()=>{const url=URL.createObjectURL(new Blob([text()],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='liquid-lens-yanit.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice.textContent='İndirme hazırlandı.';};
 bar.append(copy,download,notice);container.append(bar);
 if(onSuggestion&&suggestions.length){const box=document.createElement('div');box.className='answer-suggestions';const label=document.createElement('p');label.className='hint';label.textContent='İlgili bir başlığı araştır:';box.append(label);for(const term of [...new Set(suggestions)].slice(0,3)){const b=document.createElement('button');b.type='button';b.textContent=term;b.onclick=()=>onSuggestion(term);box.append(b);}container.append(box);}
}
