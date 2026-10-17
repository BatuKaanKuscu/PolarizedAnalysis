import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
test('Render server serves assets, rejects traversal and does not expose source',async()=>{
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',AUTH_DB_PATH:':memory:'},stdio:['ignore','pipe','pipe']});
 try{
 const port=await new Promise((resolve,reject)=>{let output='';const timeout=setTimeout(()=>reject(new Error('Startup timeout')),8000);child.stdout.on('data',data=>{output+=data;const match=output.match(/port (\d+)/);if(match){clearTimeout(timeout);resolve(match[1]);}});child.once('error',reject);child.once('exit',()=>{clearTimeout(timeout);reject(new Error('Early exit'));});});
 const base=`http://127.0.0.1:${port}`;
 for(const [path,status,type]of [['/',200,'text/html'],['/app.js',200,'text/javascript'],['/analysis.mjs',200,'text/javascript'],['/style.css',200,'text/css'],['/package.json',404,null],['/..%2fpackage.json',403,null],['/%zz',400,null]]){
 const res=await fetch(base+path);assert.equal(res.status,status,path);if(type)assert.ok(res.headers.get('content-type').startsWith(type));if(path==='/')assert.ok((await res.text()).includes('Sıvıya başka bir gözle bak.'));
 }
 assert.equal((await fetch(base,{method:'POST'})).status,405);
 const head=await fetch(base,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 }finally{child.kill();}
});
