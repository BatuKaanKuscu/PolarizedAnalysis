export function researchQuery(value){const q=String(value||'').trim().replace(/\s+/g,' ');if(q.length<2||q.length>160||!/[\p{L}\p{N}]/u.test(q)||/[\x00-\x1f<>]/.test(q))throw new Error('2–160 karakterlik bir terim veya kısa soru yaz.');return q.replace(/\s+(nedir|ne demek|ne anlama gelir|hakkında bilgi)([?？.]*)$/iu,'').replace(/[?？]+$/u,'').trim()||q;}
export function createResearch({fetcher=fetch,now=Date.now}={}){
 const cache=new Map(),clients=new Map();let active=0;
 const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 async function search(query,lang){
  const url=new URL('https://'+lang+'.wikipedia.org/w/api.php');url.search=new URLSearchParams({action:'query',format:'json',formatversion:'2',generator:'search',gsrsearch:query,gsrnamespace:'0',gsrlimit:'3',prop:'extracts',exintro:'1',explaintext:'1',exlimit:'3',exchars:'1400',redirects:'1'});
  const response=await fetcher(url.href,{signal:AbortSignal.timeout(10000),redirect:'error',headers:{Accept:'application/json','User-Agent':'LiquidLens/3.1 (https://github.com/BatuKaanKuscu/PolarizedAnalysis)'}});
  if(!response.ok)throw new Error('Provider unavailable');
  const data=await response.json();if(data.error)throw new Error('Provider error');
  const pages=data.query?.pages;if(pages!==undefined&&!Array.isArray(pages))throw new Error('Malformed records');
  return (pages||[]).sort((a,b)=>(a.index||0)-(b.index||0)).filter(p=>typeof p.title==='string'&&typeof p.extract==='string'&&p.extract.trim().length>40&&!p.missing).slice(0,3).map(p=>({name:p.title.slice(0,200),text:p.extract.slice(0,1400),language:lang,url:'https://'+lang+'.wikipedia.org/wiki/'+encodeURIComponent(p.title.replace(/ /g,'_')),publisher:'Vikipedi',license:'CC BY-SA',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'}));
 }
 return {async handle(req,res){
  const url=new URL(req.url,'http://local');if(!url.pathname.startsWith('/api/research/'))return false;
  if(url.pathname!=='/api/research/search'||req.method!=='GET'){send(res,405,{error:'Bu işlem desteklenmiyor.'});return true;}
  let query;try{query=researchQuery(url.searchParams.get('q'));}catch(e){send(res,400,{error:e.message});return true;}
  const time=now(),ip=req.socket.remoteAddress||'unknown';for(const[k,v]of clients)if(time-v.start>=60000)clients.delete(k);
  const client=clients.get(ip)||{start:time,count:0};if(client.count>=20){send(res,429,{error:'Çok sık arama yapıldı. Bir dakika sonra tekrar dene.'});return true;}client.count++;clients.set(ip,client);
  const key=query.toLocaleLowerCase('tr-TR'),hit=cache.get(key);if(hit&&time-hit.time<900000){send(res,200,{...hit.data,cached:true});return true;}
  if(active>=3){send(res,429,{error:'Araştırma servisi meşgul. Biraz sonra tekrar dene.'});return true;}active++;
  try{let results=await search(query,'tr');if(!results.length)results=await search(query,'en');const data={query,results,retrievedAt:new Date(now()).toISOString(),message:results.length?'Arama sonuçlarıdır; terimle ilişkisini ve asıl kaynağı kontrol et.':'Kaynak bulunamadı. Terimin kısa adını veya İngilizcesini dene.'};if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{time:now(),data});send(res,200,data);}
  catch{send(res,502,{error:'İnternet kaynaklarına şu anda ulaşılamadı. Biraz sonra yeniden dene; belge araması kullanılabilir.'});}finally{active--;}return true;
 }};
}
