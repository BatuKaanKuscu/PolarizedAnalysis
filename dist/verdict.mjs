// Relative camera features, not calibrated absorbance or chemical identification.
export const COMPARISON_METHOD='paired-camera-screening-v1';
const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
function features(s){const rgb=[s.r,s.g,s.b].map(linear),sum=rgb.reduce((a,b)=>a+b,0);return {color:rgb.map(v=>v/sum),light:.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]};}
export {features as cameraFeatures};
export function verdict(report){
 const issues=[...(report.issues||[])];
 for(const role of ['reference','sample'])if(!['r','g','b'].every(k=>Number.isFinite(report[role]?.[k])&&report[role][k]>=0&&report[role][k]<=255))throw new Error('Geçersiz kamera verisi');
 const a=features(report.reference),b=features(report.sample);
 if(!a.light||!b.light)issues.push('Görüntü çok karanlık.');
 if(report.frames<2)issues.push('Tek fotoğrafla ışığın ve görüntünün sabitliği kontrol edilemiyor. Canlı kamerayla tekrar dene.');
 const colorDifference=Math.hypot(...a.color.map((v,i)=>v-b.color[i]));
 const relativeOpticalDifference=a.light&&b.light?(a.light===b.light?0:-Math.log10(b.light/a.light)):null;
 const lightDifference=relativeOpticalDifference===null?Infinity:Math.abs(relativeOpticalDifference);
 // Deliberately retain an inconclusive band; thresholds are practical, unvalidated.
 const state=issues.length?'insufficient':colorDifference>.075||lightDifference>.12?'different':colorDifference<.025&&lightDifference<.035?'similar':'uncertain';
 const words={similar:['Benzer görünüyor','Bu çekimde iki sıvının rengi ve ışığı geçirme görünümü birbirine yakın. Aynı madde olduklarını bu görüntüyle doğrulayamıyoruz.'],different:['Belirgin fark var','Bu çekimde sıvıların rengi veya ışığı geçirme görünümü farklı. Önce kapları yer değiştirip yeniden dene; fark ışık ya da kaptan kaynaklanabilir.'],uncertain:['Net karşılaştırılamadı','Küçük bir fark var ama karar vermek için yeterince belirgin değil. Kapları yer değiştirip aynı ışıkta tekrar dene.'],insufficient:['Ölçüm yeterli değil','Sağlıklı bir karşılaştırma için çekimi düzeltip yeniden dene.']};
 return {state,title:words[state][0],explanation:words[state][1],issues,colorDifference,relativeOpticalDifference,method:COMPARISON_METHOD,identityConfirmed:false};
}
