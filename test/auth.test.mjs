import {test} from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {createAuth} from '../auth.mjs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';import {unlink} from 'node:fs/promises';
test('Real accounts, profile isolation, password rotation, persistence and logout',async()=>{
 const path=join(tmpdir(),'liquid-lens-auth-'+randomUUID()+'.sqlite');let auth=createAuth(path),server;
 const start=async()=>{server=createServer((req,res)=>auth.handle(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;};let base=await start();
 async function request(route,method='GET',body,cookie,origin){const res=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0],headers:res.headers};}
 try{
 assert.equal((await request('/api/me','PATCH',{name:'x'})).status,401);
 const register=await request('/api/auth/register','POST',{name:'Batu',username:'batu_kaan',email:'batu@example.com',password:'initial-password-123'});assert.equal(register.status,201);let cookie=register.cookie;assert.ok(register.headers.get('set-cookie').includes('HttpOnly'));assert.equal(register.data.user.password,undefined);assert.equal(register.data.user.salt,undefined);
 assert.equal((await request('/api/auth/login','POST',{email:'batu@example.com',password:'wrong'})).status,401);
 assert.equal(register.data.user.username,'batu_kaan');
 assert.equal((await request('/api/auth/register','POST',{name:'Duplicate',username:'BATU_KAAN',email:'duplicate@example.com',password:'another-password-123'})).status,409);
 assert.equal((await request('/api/me','PATCH',{name:'Hacker'},cookie,'https://other.example')).status,403);
 const updated=await request('/api/me','PATCH',{name:'Batu Kaan',organization:'Lab',bio:'Sıvı deneyleri',scenario:'light',accent:'blue'},cookie);assert.equal(updated.status,200);assert.equal(updated.data.user.name,'Batu Kaan');
 const second=await request('/api/auth/register','POST',{name:'Other',username:'other_user',email:'other@example.com',password:'other-password-123'});assert.equal((await request('/api/me','GET',null,second.cookie)).data.user.name,'Other');assert.equal((await request('/api/me','GET',null,cookie)).data.user.name,'Batu Kaan');
 assert.equal((await request('/api/me','PATCH',{name:'Batu',username:'other_user',scenario:'stable',accent:'green'},cookie)).status,409);
 const peer=await request('/api/auth/login','POST',{identifier:'BATU_KAAN',password:'initial-password-123'});assert.equal(peer.status,200);assert.equal((await request('/api/auth/logout-others','POST',{},cookie)).data.count,1);assert.equal((await request('/api/me','GET',null,peer.cookie)).data.user,null);assert.equal((await request('/api/me','GET',null,second.cookie)).data.user.name,'Other');
 assert.equal((await request('/api/auth/password','POST',{currentPassword:'wrong',newPassword:'new-password-123'},cookie)).status,401);
 const changed=await request('/api/auth/password','POST',{currentPassword:'initial-password-123',newPassword:'new-password-123'},cookie);assert.equal(changed.status,200);assert.equal((await request('/api/me','GET',null,cookie)).data.user,null);cookie=changed.cookie;
 assert.equal((await request('/api/me','GET',null,cookie)).data.user.name,'Batu Kaan');
 await new Promise(r=>server.close(r));auth.close();auth=createAuth(path);base=await start();assert.equal((await request('/api/me','GET',null,cookie)).data.user.organization,'Lab');
 assert.equal((await request('/api/auth/login','POST',{email:'batu@example.com',password:'initial-password-123'})).status,401);
 const login=await request('/api/auth/login','POST',{email:'batu@example.com',password:'new-password-123'});assert.equal(login.status,200);await request('/api/auth/logout','POST',{},login.cookie);assert.equal((await request('/api/me','GET',null,login.cookie)).data.user,null);
 }finally{await new Promise(r=>server.close(r));auth.close();for(const suffix of ['','-wal','-shm'])await unlink(path+suffix).catch(()=>{});}
});
