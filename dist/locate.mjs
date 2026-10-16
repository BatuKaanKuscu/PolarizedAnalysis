// Heuristic region suggestions, not object recognition or oil identification.
export function suggestRegions(data,width,height){
 if(width<20||height<20||data.length!==width*height*4)return null;
 const found={};
 for(const [role,left,right]of [['reference',.06,.32],['sample',.55,.77]]){
  let best=null;
  for(let y=.30;y<=.66;y+=.04)for(let x=left;x<=right;x+=.025){
   let r=0,g=0,b=0,sq=0,n=0,clipped=0;
   for(let py=Math.floor(y*height);py<Math.floor((y+.22)*height);py++)for(let px=Math.floor(x*width);px<Math.floor((x+.18)*width);px++){
    const i=(py*width+px)*4,a=data[i],c=data[i+1],d=data[i+2];r+=a;g+=c;b+=d;sq+=a*a+c*c+d*d;n++;if(Math.min(a,c,d)<=3||Math.max(a,c,d)>=252)clipped++;
   }
   r/=n;g/=n;b/=n;const brightness=(r+g+b)/3,chroma=Math.max(r,g,b)-Math.min(r,g,b),spread=Math.sqrt(Math.max(0,sq/n-r*r-g*g-b*b));
   if(chroma<20||brightness<30||brightness>230||spread>30||clipped/n>.1)continue;
   const score=chroma*.35-spread*2-Math.abs(y-.45)*4;
   if(!best||score>best.score)best={score,region:{x,y,w:.18,h:.22}};
  }
  if(!best)return null;found[role]=best.region;
 }
 return found;
}
