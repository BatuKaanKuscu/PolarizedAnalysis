import {test} from 'node:test';import assert from 'node:assert/strict';
import {measure,summarize} from '../dist/analysis.mjs';import {compareRepeat} from '../dist/repeat.mjs';
const c=(r,g=r,b=r)=>measure(new Uint8ClampedArray([r,g,b,255]),1,1);
const r=(a,b)=>({...summarize(Array.from({length:8},()=>({reference:a,sample:b}))),source:'camera',demo:false});
test('Two stable similar captures remain a visual comparison, never identity proof',()=>{const a=r(c(150),c(150)),v=compareRepeat(a,a,true);assert.equal(v.state,'similar');assert.equal(v.identityConfirmed,false);});
test('Material difference follows the same labeled liquids after swapping positions',()=>{const a=r(c(180),c(110));assert.equal(compareRepeat(a,a,true).state,'different');});
test('A difference that flips with position is flagged as setup influence',()=>{const a=r(c(180),c(110)),b=r(c(110),c(180));assert.equal(compareRepeat(a,b,true).state,'setup-effect');const x=r(c(150,110,80),c(80,110,150)),y=r(c(80,110,150),c(150,110,80));assert.equal(compareRepeat(x,y,true).state,'setup-effect');});
test('Missing confirmation, poor captures, photo/camera or demo mixing cannot validate',()=>{const a=r(c(150),c(150));assert.equal(compareRepeat(a,a).state,'insufficient');for(const b of [{...a,source:'photo'},{...a,demo:true},{...a,frames:1},r(c(0),c(0))])assert.equal(compareRepeat(a,b,true).state,'insufficient');});
test('Borderline results stay uncertain after repetition',()=>{const a=r(c(150),c(140));assert.equal(compareRepeat(a,a,true).state,'uncertain');});
