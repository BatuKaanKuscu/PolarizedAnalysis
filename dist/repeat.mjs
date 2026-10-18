import {cameraFeatures,verdict} from './verdict.mjs';
export function compareRepeat(first,second,confirmed=false){
 const a=verdict(first),b=verdict(second),base={method:'swapped-pair-v1',identityConfirmed:false};
 if(!confirmed||a.issues.length||b.issues.length||first.source!==second.source||first.demo!==second.demo||(first.demo&&first.demoScenario!==second.demoScenario))return {...base,state:'insufficient',title:'Tekrar kontrolü tamamlanamadı',explanation:'İki çekim de uygun olmalı ve aynı sıvılar yer değiştirilerek çekilmeli. Farklı kaynaklar veya demo senaryoları birlikte değerlendirilemez.'};
 const vector=r=>{const x=cameraFeatures(r.reference).color,y=cameraFeatures(r.sample).color;return x.map((v,i)=>y[i]-v);},v1=vector(first),v2=vector(second);
 const colorChange=Math.hypot(...v1.map((v,i)=>v-v2[i])),positionEffect=Math.abs(a.relativeOpticalDifference-b.relativeOpticalDifference)/2,combinedLight=(a.relativeOpticalDifference+b.relativeOpticalDifference)/2,combinedColor=Math.hypot(...v1.map((v,i)=>(v+v2[i])/2));
 const details={colorChange,positionEffect,combinedLight,combinedColor};
 if(colorChange>.05||positionEffect>.06)return {...base,...details,state:'setup-effect',title:'Çekim düzeni sonucu etkiliyor',explanation:'Kapların yeri değişince ölçüm de belirgin değişti. Işığı iki tarafa eşit dağıt, kapları ve sıvı seviyelerini kontrol ederek yeniden dene.'};
 if(a.state==='similar'&&b.state==='similar')return {...base,...details,state:'similar',title:'Benzer görünüm iki çekimde de tekrarlandı',explanation:'Yerlerini değiştirdiğinde de renk ve ışık görünümü yakın kaldı. Bu, aynı madde veya saflık onayı değildir.'};
 if(a.state==='different'&&b.state==='different'&&(combinedColor>.075||Math.abs(combinedLight)>.12))return {...base,...details,state:'different',title:'Görünür fark iki çekimde de tekrarlandı',explanation:'Yerlerini değiştirdiğinde de fark devam etti. Farkın nedeni bu kamerayla belirlenemez; kimyasal içerik hakkında karar verilemez.'};
 return {...base,...details,state:'uncertain',title:'İki çekim birlikte net sonuç vermedi',explanation:'Sonuçlar yeterince tutarlı değil. Aynı kap ve eşit seviyelerle, daha dengeli ışıkta tekrar dene.'};
}
