import {test} from 'node:test';import assert from 'node:assert/strict';
import {dockPosition} from '../dist/floating-dock.mjs';
test('Capture panel starts at bottom center and stays within image bounds',()=>{assert.deepEqual(dockPosition(300,350,200,100),{x:50,y:242});assert.deepEqual(dockPosition(300,350,200,100,{x:-5,y:5}),{x:8,y:242});assert.deepEqual(dockPosition(300,350,200,100,{x:1,y:0}),{x:92,y:8});});
test('Narrow image layouts do not produce negative panel coordinates',()=>{assert.deepEqual(dockPosition(100,80,200,100),{x:8,y:8});});
