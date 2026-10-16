export const scenarios={
 stable:{name:'Sabit numuneler',expected:'Beklenen: 8 karelik seri kontrolü geçer; sabit renk farkı raporlanır.'},
 color:{name:'Değişen numune rengi',expected:'Beklenen: renk seri boyunca değiştiği için ölçüm reddedilir.'},
 light:{name:'Dalgalanan ışık',expected:'Beklenen: değişen aydınlatma nedeniyle seri kontrolü ölçümü reddeder.'},
 glare:{name:'Hareketli parlama',expected:'Beklenen: aşırı parlak pikseller nedeniyle ölçüm reddedilir.'}
};
export function demoColors(scenario,time){
 const base=[163,156,66],sample=[192,165,78];
 if(scenario==='color')sample[0]+=Math.sin(time/220)*35;
 const factor=scenario==='light'?.85+Math.sin(time/240)*.25:1;
 return {reference:base.map(v=>v*factor),sample:sample.map(v=>v*factor)};
}
export function drawDemo(canvas,scenario,time){
 const d=canvas.getContext('2d'),w=canvas.width,h=canvas.height,colors=demoColors(scenario,time);
 d.clearRect(0,0,w,h);d.fillStyle='#d7d7d0';d.fillRect(0,0,w,h);
 for(const [x,role]of [[.08,'reference'],[.57,'sample']]){
  d.fillStyle='rgba(50,70,30,.14)';d.fillRect(w*x,h*.25,w*.35,h*.67);
  d.fillStyle=`rgb(${colors[role].join(',')})`;d.fillRect(w*(x+.015),h*.34,w*.32,h*.55);
  // Bubbles move outside the default measurement regions.
  d.strokeStyle='rgba(255,255,230,.55)';d.lineWidth=1.5;
  for(let i=0;i<4;i++){const y=.84-((time/7000+i*.16)%.45);d.beginPath();d.arc(w*(x+.035),h*y,2+i%2,0,Math.PI*2);d.stroke();}
  d.strokeStyle='rgba(255,255,255,.4)';d.beginPath();d.moveTo(w*(x+.01),h*.27);d.lineTo(w*(x+.01),h*.9);d.stroke();
 }
 if(scenario==='glare'){d.fillStyle='#fff';d.fillRect(w*(.64+Math.sin(time/280)*.035),h*.34,w*.15,h*.55);}
 // Surface motion is kept above the oil regions.
 d.strokeStyle='rgba(255,255,220,.5)';d.lineWidth=2;for(const x of [.095,.585]){d.beginPath();for(let i=0;i<=24;i++){const px=x+i*.32/24,py=.346+Math.sin(i*.6+time/450)*.003;i?d.lineTo(px*w,py*h):d.moveTo(px*w,py*h);}d.stroke();}
}
