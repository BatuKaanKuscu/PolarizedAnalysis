import {quality} from './dist/analysis.mjs';
import {verdict} from './dist/verdict.mjs';
export function cleanMeasurement(input){
 const report={};
 for(const role of ['reference','sample']){const s=input?.[role];if(!s)throw new Error('Önce bir karşılaştırma yap.');report[role]={};for(const [key,max]of [['r',255],['g',255],['b',255],['clipped',1],['spread',255]]){if(typeof s[key]!=='number'||!Number.isFinite(s[key])||s[key]<0||s[key]>max)throw new Error('Ölçüm özeti geçersiz.');report[role][key]=s[key];}report[role].brightness=(s.r+s.g+s.b)/3;}
 for(const [key,max]of [['frames',32],['range',442],['drift',442]]){const v=input[key];if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)throw new Error('Ölçüm özeti geçersiz.');report[key]=v;}
 if(!Number.isInteger(report.frames)||report.frames<1)throw new Error('Kare sayısı geçersiz.');
 report.demo=input.demo===true;report.issues=quality(report);if(report.range>10||report.drift>15)report.issues.push('Görüntü seri çekimde değişken. Telefonu ve ışığı sabitle.');
 return report;
}
const instructions=`Türkçe konuşan bir sıvı görüntüsü karşılaştırma yardımcısısın. Yalnızca verilen sayısal kamera özetini açıkla. Kimyasal kimlik, sıvı türü, saflık, içilebilirlik, sağlık, yoğunluk veya sahtecilik hakkında karar verme. Kamera optik yoğunluğu ve ışığın uçuş süresini ölçmez. Sunulan karar kesin değildir, kararı değiştirme. DEMO ise sentetik veri olduğunu söyle. Kalite sorunu varsa yeniden çekimi öner. Günlük dilde en fazla üç kısa cümlelik explanation ve en fazla üç kısa nextSteps üret. Yanıt yalnızca JSON olsun: {"explanation":"...","nextSteps":["..."]}. Yüzdelik doğruluk veya kesin aynı madde iddiası verme.`;
export function createAI({key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL||'gemini-2.5-flash-lite',fetcher=fetch,now=Date.now,dailyLimit=Number(process.env.AI_DAILY_LIMIT)||100}={}){
 const buckets=new Map();let day='',used=0,active=0;
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 return {async handle(req,res){
  const path=new URL(req.url,'http://local').pathname;if(!path.startsWith('/api/ai/'))return false;
  if(path==='/api/ai/status'&&req.method==='GET'){send(res,200,{enabled:!!key,provider:'Google Gemini',model});return true;}
  if(path!=='/api/ai/interpret'||req.method!=='POST'){send(res,405,{error:'Bu işlem desteklenmiyor.'});return true;}
  const origin=req.headers.origin,host=req.headers.host;
  if(origin){try{const u=new URL(origin);if(u.host!==host||!['http:','https:'].includes(u.protocol))throw new Error();}catch{send(res,403,{error:'İstek kaynağı doğrulanamadı.'});return true;}}
  if(!req.headers['content-type']?.startsWith('application/json')){send(res,415,{error:'JSON ölçüm özeti gerekli.'});return true;}
  if(!key){send(res,503,{error:'Yapay zekâ henüz etkin değil. Normal karşılaştırmayı kullanabilirsin.'});return true;}
  let body;try{let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192){send(res,413,{error:'Ölçüm özeti fazla büyük.'});return true;}}body=JSON.parse(raw);}catch{send(res,400,{error:'Ölçüm özeti okunamadı.'});return true;}
  let measurement;try{if(body.consent!==true)throw new Error('Sayısal özetin Google Gemini’ye gönderilmesine izin vermelisin.');measurement=cleanMeasurement(body.measurement);}catch(e){send(res,400,{error:e.message});return true;}
  const timestamp=now(),date=new Date(timestamp).toISOString().slice(0,10),ip=req.socket.remoteAddress||'unknown';if(day!==date){day=date;used=0;}
  for(const [id,b]of buckets)if(timestamp-b.start>60000)buckets.delete(id);
  const bucket=buckets.get(ip)||{start:timestamp,count:0};
  if(bucket.count>=5||used>=dailyLimit||active>=2){send(res,429,{error:'Yorum sınırına ulaşıldı. Daha sonra tekrar dene; normal ölçüm kullanılabilir.'});return true;}
  bucket.count++;buckets.set(ip,bucket);used++;active++;
  try{
   const comparison=verdict(measurement);
   const response=await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({systemInstruction:{parts:[{text:instructions}]},contents:[{role:'user',parts:[{text:JSON.stringify({measurement,comparison})}]}],generationConfig:{temperature:.2,maxOutputTokens:600,responseMimeType:'application/json'}}),signal:AbortSignal.timeout(20000)});
   if(!response.ok){send(res,response.status===429?429:502,{error:response.status===429?'Ücretsiz servis kotası dolmuş olabilir. Daha sonra tekrar dene.':'Yapay zekâ servisine ulaşılamadı. Normal karşılaştırmayı kullanabilirsin.'});return true;}
   const result=await response.json(),candidate=result.candidates?.[0];if(candidate?.finishReason!=='STOP')throw new Error('Incomplete');
   const parsed=JSON.parse(candidate.content?.parts?.map(p=>p.text||'').join(''));
   if(typeof parsed.explanation!=='string'||!parsed.explanation.trim()||parsed.explanation.length>1500||!Array.isArray(parsed.nextSteps)||parsed.nextSteps.length>3||parsed.nextSteps.some(s=>typeof s!=='string'||!s.trim()||s.length>400))throw new Error('Invalid model output');
   send(res,200,{provider:'Google Gemini',model,explanation:parsed.explanation,nextSteps:parsed.nextSteps,comparison:comparison.state,disclaimer:'Bu yapay zekâ yorumu kimyasal analiz veya saflık onayı değildir.'});
  }catch{send(res,502,{error:'Yapay zekâ yorumu tamamlanamadı. Ölçüm sonucu geçerli; daha sonra yeniden deneyebilirsin.'});}finally{active--;}
  return true;
 }};
}
