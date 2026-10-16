export const METHOD='paired-rgb-v2';
export function measure(data,width,height){
 const n=width*height;
 if(!Number.isInteger(n)||n<1||data.length!==n*4)throw new Error('Geçersiz görüntü');
 let r=0,g=0,b=0,sq=0,clipped=0;
 for(let i=0;i<data.length;i+=4){r+=data[i];g+=data[i+1];b+=data[i+2];const l=(data[i]+data[i+1]+data[i+2])/3;sq+=l*l;if(Math.min(data[i],data[i+1],data[i+2])<=3||Math.max(data[i],data[i+1],data[i+2])>=252)clipped++;}
 r/=n;g/=n;b/=n;const brightness=(r+g+b)/3;
 return {r,g,b,brightness,clipped:clipped/n,spread:Math.sqrt(Math.max(0,sq/n-brightness**2))};
}
export function distance(a,b){return Math.hypot(a.r-b.r,a.g-b.g,a.b-b.b);}
export function compare(a,b){return {distance:distance(a,b),brightness:Math.abs(a.brightness-b.brightness),channels:[b.r-a.r,b.g-a.g,b.b-a.b]};}
export function quality(f){
 const issues=[];
 for(const [key,label]of [['reference','Referans'],['sample','Numune']]){const s=f[key];if(s.brightness<25)issues.push(`${label} çok karanlık; ışığı artırın.`);if(s.brightness>235)issues.push(`${label} çok aydınlık; pozlamayı azaltın.`);if(s.clipped>.18)issues.push(`${label} alanında renk kanalları kırpılıyor; parlamadan kaçının.`);}
 const w=f.white;
 if(w.brightness<100||w.brightness>240)issues.push('Beyaz alanın ışığı uygun değil; mat beyaz bir bölge seçin.');
 if(Math.max(w.r,w.g,w.b)-Math.min(w.r,w.g,w.b)>28)issues.push('Beyaz alan renkli görünüyor; arka planı veya ışığı değiştirin.');
 if(w.clipped>.18)issues.push('Beyaz alan aşırı pozlanmış; ışığı azaltın.');
 if(w.spread>18)issues.push('Beyaz alan homojen değil; gölge veya kenar içermeyen bir bölge seçin.');
 return issues;
}
export function summarize(frames){
 if(!frames.length)throw new Error('Ölçüm yok');
 const median=v=>{v=[...v].sort((a,b)=>a-b);const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;},stats={};
 for(const role of ['reference','sample','white']){stats[role]={};for(const key of ['r','g','b','brightness','clipped','spread'])stats[role][key]=median(frames.map(f=>f[role][key]));}
 const diffs=frames.map(f=>distance(f.reference,f.sample)),range=Math.max(...diffs)-Math.min(...diffs),issues=[...new Set(frames.flatMap(quality))];
 const drift=Math.max(...frames.flatMap(f=>['reference','sample','white'].map(role=>distance(f[role],stats[role]))));
 if(frames.length>1&&(range>10||drift>15))issues.push('Seri çekim değişken; telefonu ve ışığı sabitleyip yeniden ölçün.');
 return {method:METHOD,...stats,...compare(stats.reference,stats.sample),frames:frames.length,range,drift,issues};
}
export function cropRect(region,sw,sh,vw,vh){const scale=Math.max(vw/sw,vh/sh);return {x:(sw-vw/scale)/2+region.x*vw/scale,y:(sh-vh/scale)/2+region.y*vh/scale,width:region.w*vw/scale,height:region.h*vh/scale};}
export function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
