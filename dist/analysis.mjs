export function measure(data,width,height){
 let r=0,g=0,b=0,clipped=0,gradient=0,count=width*height;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const i=(y*width+x)*4; r+=data[i];g+=data[i+1];b+=data[i+2];
 const l=(data[i]+data[i+1]+data[i+2])/3;if(l<15||l>245)clipped++;
 if(x>0)gradient+=Math.abs(l-(data[i-4]+data[i-3]+data[i-2])/3);
 }
 return {r:r/count,g:g/count,b:b/count,brightness:(r+g+b)/(count*3),clipped:clipped/count,gradient:gradient/count};
}
export function compare(a,b){return {distance:Math.hypot(a.r-b.r,a.g-b.g,a.b-b.b),brightness:Math.abs(a.brightness-b.brightness)};}
