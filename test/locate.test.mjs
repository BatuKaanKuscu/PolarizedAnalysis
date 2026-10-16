import {test} from 'node:test';
import assert from 'node:assert/strict';
import {suggestRegions} from '../dist/locate.mjs';
function image(){const w=120,h=90,data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const color=y>h*.33&&y<h*.89&&((x>w*.09&&x<w*.42)||(x>w*.58&&x<w*.90))?[163,156,66]:[210,210,210];data.set([...color,255],(y*w+x)*4);}return {data,w,h};}
test('Suggestions stay inside two separated colored regions',()=>{const {data,w,h}=image(),r=suggestRegions(data,w,h);assert.ok(r);assert.ok(r.reference.x>=.08&&r.reference.x+r.reference.w<=.43);assert.ok(r.sample.x>=.57&&r.sample.x+r.sample.w<=.91);assert.ok(r.reference.y>=.33);});
test('Neutral or clipped images produce no invented region',()=>{const {data,w,h}=image();data.fill(255);assert.equal(suggestRegions(data,w,h),null);for(let i=0;i<data.length;i+=4)data.set([210,210,210,255],i);assert.equal(suggestRegions(data,w,h),null);assert.equal(suggestRegions([],0,0),null);});
