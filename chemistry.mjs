const aliases={'su':'water','etanol':'ethanol','etil alkol':'ethanol','aseton':'acetone','gliserin':'glycerol','gliserol':'glycerol','metanol':'methanol','izopropil alkol':'isopropyl alcohol','izopropanol':'isopropanol','asetik asit':'acetic acid'};
const mixtures=new Set(['zeytinyağı','zeytinyagi','ayçiçek yağı','aycicek yagi','motor yağı','motor yagi','süt','sut','benzin','olive oil','sunflower oil','milk','gasoline']);
export function chemicalQuery(value){const query=(value||'').trim().replace(/\s+/g,' ');if(query.length<2||query.length>80||!/[\p{L}\p{N}]/u.test(query)||!/^[\p{L}\p{N}\s(),.+_-]+$/u.test(query))throw new Error('2–80 karakterlik madde adı veya CAS numarası gir.');const lower=query.toLocaleLowerCase('tr-TR');return {query,name:aliases[lower]||query,mixture:mixtures.has(lower)};}
export function createChemistry({fetcher=fetch,now=Date.now}={}){
 const cache=new Map(),clients=new Map();let active=0;
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 return {async handle(req,res){
  const url=new URL(req.url,'http://local');if(!url.pathname.startsWith('/api/chemistry/'))return false;
  if(url.pathname!=='/api/chemistry/search'||req.method!=='GET'){send(res,405,{error:'Bu işlem desteklenmiyor.'});return true;}
  let input;try{input=chemicalQuery(url.searchParams.get('q'));}catch(e){send(res,400,{error:e.message});return true;}
  if(input.mixture){send(res,200,{kind:'mixture',query:input.query,results:[],message:'Bu ad bir karışımı ifade eder. Tek bir molekül formülü veya sabit spektrumla tüm örnekleri temsil edemeyiz. Bildiğin bir bileşeni ayrı arayabilirsin; bu, numunende bulunduğu anlamına gelmez.'});return true;}
  const timestamp=now(),id=req.socket.remoteAddress||'unknown';for(const [k,v]of clients)if(timestamp-v.start>60000)clients.delete(k);const client=clients.get(id)||{start:timestamp,count:0};
  if(client.count>=20){send(res,429,{error:'Çok sık arama yapıldı. Bir dakika sonra tekrar dene.'});return true;}client.count++;clients.set(id,client);
  const cacheKey=input.name.toLowerCase(),hit=cache.get(cacheKey);if(hit&&timestamp-hit.time<1200000){send(res,200,{...hit.value,query:input.query});return true;}
  if(active>=2){send(res,429,{error:'Kütüphane şu an meşgul. Biraz sonra tekrar dene.'});return true;}active++;
  try{
   const upstream=await fetcher('https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/'+encodeURIComponent(input.name)+'/property/MolecularFormula,MolecularWeight,IUPACName,Title/JSON',{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
   if(!upstream.ok){send(res,upstream.status===404?404:upstream.status===429||upstream.status===503?503:502,{error:upstream.status===404?'Kayıt bulunamadı. İngilizce adını veya CAS numarasını deneyebilirsin.':'Kimya kütüphanesi şu an yanıt veremiyor. Biraz sonra tekrar dene.'});return true;}
   const payload=await upstream.json(),rows=payload.PropertyTable?.Properties;if(!Array.isArray(rows)||!rows.length)throw new Error('Missing records');
   const results=rows.slice(0,5).map(r=>{if(!Number.isSafeInteger(r.CID)||r.CID<1||typeof r.MolecularFormula!=='string'||typeof r.Title!=='string'||typeof r.IUPACName!=='string'||!Number.isFinite(Number(r.MolecularWeight))||Number(r.MolecularWeight)<=0)throw new Error('Invalid record');return {cid:r.CID,title:r.Title.slice(0,250),formula:r.MolecularFormula.slice(0,250),molecularWeight:String(r.MolecularWeight).slice(0,40),iupacName:r.IUPACName.slice(0,500),source:'PubChem',sourceUrl:'https://pubchem.ncbi.nlm.nih.gov/compound/'+r.CID,spectrumSearchUrl:'https://webbook.nist.gov/cgi/cbook.cgi?Name='+encodeURIComponent(r.IUPACName)+'&Units=SI'};});
   const value={kind:'compounds',results,moreMatches:rows.length>5,retrievedAt:new Date(timestamp).toISOString(),message:'Bunlar aradığın ada ait kütüphane kayıtlarıdır. Kameradaki sıvının kimliği olarak belirlenmemiştir.'};if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(cacheKey,{time:timestamp,value});send(res,200,{...value,query:input.query});
  }catch{send(res,502,{error:'Kütüphane verisi alınamadı. İnternet bağlantısını kontrol edip tekrar dene.'});}finally{active--;}
  return true;
 }};
}
