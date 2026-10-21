export const MAX_TEXT=250000,MAX_TOTAL=1000000,MAX_FILES=12;
export async function readDocument(file){
 const extension=file.name.split('.').at(-1).toLowerCase();if(!['txt','md','csv','json','pdf'].includes(extension))throw new Error('PDF, TXT, MD, CSV veya JSON dosyası seç.');if(file.size>8*1024*1024)throw new Error('Dosya en fazla 8 MB olabilir.');
 const bytes=new Uint8Array(await file.arrayBuffer()),digest=await crypto.subtle.digest('SHA-256',bytes),id=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');let pages=[];
 if(extension==='pdf'){
  const pdfjs=await import('./vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
  const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,useWasm:false,disableFontFace:true});let pdf;
  try{pdf=await task.promise;if(pdf.numPages>80)throw new Error('PDF en fazla 80 sayfa olabilir.');let size=0;for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent(),text=content.items.map(v=>v.str?(v.str+(v.hasEOL?'\n':' ')):'').join('');size+=text.length;if(size>MAX_TEXT)throw new Error('Belge metni 250.000 karakter sınırını aşıyor.');pages.push({page:i,text});page.cleanup();}}
  catch(e){if(e.name==='PasswordException')throw new Error('Şifreli PDF desteklenmiyor; şifresiz bir kopya yükle.');throw e;}
  finally{await task.destroy();}
 }else{let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new Error('Metin dosyasını UTF-8 biçiminde kaydedip tekrar yükle.');}if(text.length>MAX_TEXT)throw new Error('Belge metni 250.000 karakter sınırını aşıyor.');if(extension==='json'){try{JSON.parse(text);}catch{throw new Error('JSON dosyası okunamadı.');}}pages=[{page:null,text}];}
 const characters=pages.reduce((n,p)=>n+p.text.length,0);if(pages.every(p=>p.text.trim().length<16))throw new Error(extension==='pdf'?'PDF içinde okunabilir metin yok. Taranmış görseller için önce OCR gerekir.':'Belgede yeterli okunabilir metin yok.');
 return {id,name:file.name.slice(0,160),pages,characters,createdAt:new Date().toISOString()};
}
