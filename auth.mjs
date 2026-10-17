import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback),hash=s=>createHash('sha256').update(s).digest('hex');
const lifetime=7*24*60*60*1000;
export function createAuth(path=process.env.AUTH_DB_PATH||resolve('.data/accounts.sqlite')){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
 db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,organization TEXT NOT NULL DEFAULT '',bio TEXT NOT NULL DEFAULT '',scenario TEXT NOT NULL DEFAULT 'stable',accent TEXT NOT NULL DEFAULT 'green',salt TEXT NOT NULL,password TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);`);
 const limits=new Map(),dummySalt=randomBytes(16).toString('hex');
 const publicUser=u=>u?{id:u.id,email:u.email,name:u.name,organization:u.organization,bio:u.bio,scenario:u.scenario,accent:u.accent,createdAt:u.created_at}:null;
 const cookieToken=req=>{const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('ll_session='));return cookie?.slice(11)||'';};
 function userFor(req){return db.prepare('SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?').get(hash(cookieToken(req)),Date.now());}
 function cookie(req,value,age){const secure=process.env.NODE_ENV==='production'||req.headers['x-forwarded-proto']==='https'||req.socket.encrypted;return `ll_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure?'; Secure':''}`;}
 function session(req,res,id){db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),id,Date.now()+lifetime);res.setHeader('Set-Cookie',cookie(req,token,lifetime/1000));}
 function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
 function fail(status,message){const e=new Error(message);e.status=status;throw e;}
 async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16384)fail(413,'İstek çok büyük.');chunks.push(chunk);}try{const value=JSON.parse(Buffer.concat(chunks).toString());if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Geçersiz istek.');return value;}catch{fail(400,'Geçersiz istek.');}}
 function password(value){if(typeof value!=='string'||value.length<10||value.length>128)fail(400,'Parola 10–128 karakter olmalı.');return value;}
 async function matches(value,u){const result=await scrypt(value,u?.salt||dummySalt,64);return !!u&&timingSafeEqual(result,Buffer.from(u.password,'hex'));}
 function rate(req){const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim(),now=Date.now();for(const [key,v]of limits)if(v.until<now)limits.delete(key);const entry=limits.get(ip)||{n:0,until:now+60000};entry.n++;limits.set(ip,entry);if(entry.n>15)fail(429,'Çok fazla deneme. Bir dakika sonra tekrar deneyin.');}
 function profile(data){const name=String(data.name||'').trim();if(!name||name.length>60)fail(400,'Ad 1–60 karakter olmalı.');const organization=String(data.organization||'').trim(),bio=String(data.bio||'').trim();if(organization.length>80||bio.length>300)fail(400,'Profil metni çok uzun.');if(!['stable','color','light','glare'].includes(data.scenario))fail(400,'Geçersiz tercih.');if(!['green','blue','amber'].includes(data.accent))fail(400,'Geçersiz renk.');return {name,organization,bio,scenario:data.scenario,accent:data.accent};}
 return {close:()=>db.close(),async handle(req,res){
  const path=new URL(req.url,'http://localhost').pathname;if(!path.startsWith('/api/'))return false;
  try{
   if(!['GET','POST','PATCH'].includes(req.method))fail(405,'Desteklenmeyen işlem.');
   if(req.method!=='GET'){
    const origin=req.headers.origin;
    if(origin){let host;try{host=new URL(origin).host;}catch{fail(403,'Geçersiz kaynak.');}if(host!==req.headers.host)fail(403,'Bu kaynaktan istek kabul edilmedi.');}
    if(req.headers['sec-fetch-site']==='cross-site')fail(403,'Bu kaynaktan istek kabul edilmedi.');
    if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'JSON istek gerekli.');
   }
   if(path==='/api/me'&&req.method==='GET'){send(res,200,{user:publicUser(userFor(req))});return true;}
   if(path==='/api/auth/register'&&req.method==='POST'){
    rate(req);const data=await body(req),email=String(data.email||'').trim().toLowerCase(),name=String(data.name||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)fail(400,'Geçerli bir e-posta yazın.');if(!name||name.length>60)fail(400,'Ad 1–60 karakter olmalı.');const value=password(data.password);
    if(db.prepare('SELECT id FROM users WHERE email=?').get(email))fail(409,'Bu e-posta ile hesap oluşturulamıyor. Giriş yapmayı deneyin.');
    const salt=randomBytes(16).toString('hex'),digest=await scrypt(value,salt,64),id=randomUUID();
    try{db.prepare('INSERT INTO users(id,email,name,salt,password,created_at) VALUES(?,?,?,?,?,?)').run(id,email,name,salt,digest.toString('hex'),new Date().toISOString());}catch(e){if(String(e.code).includes('CONSTRAINT'))fail(409,'Bu e-posta ile hesap oluşturulamıyor.');throw e;}
    session(req,res,id);send(res,201,{user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id))});return true;
   }
   if(path==='/api/auth/login'&&req.method==='POST'){
    rate(req);const data=await body(req);if(typeof data.password!=='string'||data.password.length>128)fail(400,'Geçersiz giriş bilgileri.');const email=String(data.email||'').trim().toLowerCase(),user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if(!await matches(data.password,user))fail(401,'E-posta veya parola hatalı.');session(req,res,user.id);send(res,200,{user:publicUser(user)});return true;
   }
   if(path==='/api/auth/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(hash(cookieToken(req)));res.setHeader('Set-Cookie',cookie(req,'',0));send(res,200,{ok:true});return true;}
   const user=userFor(req);if(!user)fail(401,'Bu işlem için giriş yapın.');
   if(path==='/api/me'&&req.method==='PATCH'){const p=profile(await body(req));db.prepare('UPDATE users SET name=?,organization=?,bio=?,scenario=?,accent=? WHERE id=?').run(p.name,p.organization,p.bio,p.scenario,p.accent,user.id);send(res,200,{user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id))});return true;}
   if(path==='/api/auth/password'&&req.method==='POST'){
    rate(req);const data=await body(req);if(typeof data.currentPassword!=='string'||data.currentPassword.length>128||!await matches(data.currentPassword,user))fail(401,'Mevcut parola hatalı.');const next=password(data.newPassword),salt=randomBytes(16).toString('hex'),digest=await scrypt(next,salt,64);
    db.exec('BEGIN');try{db.prepare('UPDATE users SET salt=?,password=? WHERE id=?').run(salt,digest.toString('hex'),user.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
    session(req,res,user.id);send(res,200,{ok:true});return true;
   }
   fail(404,'İşlem bulunamadı.');
  }catch(error){if(!res.headersSent)send(res,error.status||500,{error:error.status?error.message:'İşlem tamamlanamadı. Tekrar deneyin.'});else res.end();}
  return true;
 }};
}
