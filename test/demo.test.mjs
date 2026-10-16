import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoColors} from '../dist/demo.mjs';
import {summarize} from '../dist/analysis.mjs';
const stats=rgb=>({r:rgb[0],g:rgb[1],b:rgb[2],brightness:rgb.reduce((a,b)=>a+b)/3,clipped:0,spread:0});
function sequence(scenario,start){return Array.from({length:8},(_,i)=>{const c=demoColors(scenario,start+i*180);return {reference:stats(c.reference),sample:stats(c.sample)};});}
test('Stable scenario passes and variable scenarios fail across animation phases',()=>{
 for(let start=0;start<1600;start+=80){
 assert.deepEqual(summarize(sequence('stable',start)).issues,[]);
 for(const scenario of ['color','light'])assert.ok(summarize(sequence(scenario,start)).issues.some(i=>i.includes('değişken')),scenario+' at '+start);
 }
});
