import {test} from 'node:test';import assert from 'node:assert/strict';
import {opticalDensity,massDensity} from '../dist/science.mjs';
test('Dark-corrected transmittance and decadic absorbance',()=>{const r=opticalDensity(1000,550,100);assert.equal(r.transmittance,.5);assert.ok(Math.abs(r.absorbance-.30102999566)<1e-10);assert.equal(r.warning,null);assert.equal(opticalDensity(100,100,0).absorbance,0);assert.ok(opticalDensity(100,120,0).warning);});
test('Optical invalid readings are rejected instead of clipped or invented',()=>{for(const v of [[0,0,0],[100,0,0],[100,50,50],[50,100,60],[-1,2,0],[NaN,2,0]])assert.throws(()=>opticalDensity(...v));});
test('Density subtracts tare and converts g/mL to kg/m3',()=>{const r=massDensity(15,65,50,20);assert.equal(r.mass,50);assert.equal(r.gramsPerMl,1);assert.equal(r.kgPerM3,1000);assert.equal(r.temperature,20);assert.equal(massDensity(10,20,20,25).gramsPerMl,.5);});
test('Density refuses missing, impossible and nonfinite values',()=>{for(const v of [[10,5,50,20],[10,10,50,20],[0,10,0,20],[0,10,50,NaN],[0,10,50,-274],[0,1,Number.MIN_VALUE,20]])assert.throws(()=>massDensity(...v));});
