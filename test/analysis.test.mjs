import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measure,compare,quality,summarize,cropRect,overlap} from '../dist/analysis.mjs';
const color=(r,g,b)=>measure(new Uint8ClampedArray([r,g,b,255]),1,1);
const frame=(sample=color(170,150,80),ref=color(160,150,70))=>({reference:ref,sample,white:color(210,210,210)});
test('Known pixels yield mean and spatial spread',()=>{
 const s=measure(new Uint8ClampedArray([90,120,150,255,150,180,210,255]),2,1);
 assert.deepEqual([s.r,s.g,s.b,s.brightness],[120,150,180,150]);assert.equal(s.spread,30);assert.equal(s.clipped,0);
 assert.throws(()=>measure([],0,0));assert.throws(()=>measure([1],1,1));
});
test('RGB bounds and signed channel differences',()=>{
 const a=color(0,0,0),b=color(255,255,255);
 assert.equal(compare(a,a).distance,0);assert.ok(Math.abs(compare(a,b).distance-Math.sqrt(3*255**2))<1e-10);assert.equal(compare(a,b).brightness,255);
 assert.deepEqual(compare(color(100,110,120),color(130,90,120)).channels,[30,-20,0]);
});
test('Quality rejects channel clipping, uneven and non-neutral background',()=>{
 assert.deepEqual(quality(frame()),[]);
 assert.ok(quality(frame(color(255,150,80))).some(x=>x.includes('kırpılıyor')));
 assert.ok(quality({...frame(),white:color(200,140,100)}).some(x=>x.includes('renkli')));
 assert.ok(quality({...frame(),white:{...color(210,210,210),spread:35}}).some(x=>x.includes('homojen')));
 assert.ok(quality(frame(color(10,10,10))).some(x=>x.includes('karanlık')));
});
test('Eight frames use median and expose unstable or temporarily bad captures',()=>{
 const steady=summarize(Array.from({length:8},()=>frame()));assert.equal(steady.frames,8);assert.equal(steady.range,0);assert.deepEqual(steady.issues,[]);
 const frames=Array.from({length:8},()=>frame());frames[7]=frame(color(220,200,130));
 const result=summarize(frames);assert.equal(result.sample.r,170);assert.ok(result.issues.some(x=>x.includes('değişken')));
 const clipped=Array.from({length:8},()=>frame());clipped[4]=frame(color(255,150,80));assert.ok(summarize(clipped).issues.some(x=>x.includes('kırpılıyor')));
});
test('Common exposure drift is caught even when pair difference stays zero',()=>{
 const frames=Array.from({length:8},(_,i)=>{const c=color(90+i*10,100+i*10,70+i*10);return frame(c,c);});
 const report=summarize(frames);assert.equal(report.range,0);assert.ok(report.issues.some(x=>x.includes('değişken')));
});
test('Object-fit cover cropping maps visible mobile area to source',()=>{
 const r=cropRect({x:.25,y:.25,w:.5,h:.5},1920,1080,360,360);
 assert.deepEqual(r,{x:690,y:270,width:540,height:540});
 const portrait=cropRect({x:0,y:0,w:1,h:1},1080,1920,600,300);
 assert.equal(portrait.x,0);assert.equal(portrait.y,690);assert.equal(portrait.width,1080);assert.equal(portrait.height,540);
 assert.equal(overlap({x:0,y:0,w:.2,h:.2},{x:.2,y:0,w:.2,h:.2}),false);
 assert.equal(overlap({x:0,y:0,w:.3,h:.2},{x:.2,y:0,w:.2,h:.2}),true);
});
