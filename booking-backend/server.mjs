import http from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {openDatabase,configuration,settings,availability,createBooking,dateOk,clock} from './scheduler.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const host=process.env.SONDER_HOST||'127.0.0.1';
const port=Number(process.env.SONDER_PORT||4343);
const dataFile=process.env.SONDER_DB||join(here,'data','sonder.sqlite');
if(dataFile!==':memory:')mkdirSync(dirname(dataFile),{recursive:true});
const db=openDatabase(dataFile);
const password=process.env.SONDER_ADMIN_PASSWORD;
if(!password||password.length<12)throw Error('Set SONDER_ADMIN_PASSWORD to a unique password of at least 12 characters.');
const salt=randomBytes(32),passwordHash=scryptSync(password,salt,64);
const sessions=new Map(),failures=new Map();
function send(res,status,body,headers={}){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(body));}
function html(res){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(readFileSync(join(here,'admin.html')));}
function auth(req){const token=/^.*(?:^|; )sonder_session=([a-f0-9]{64})/.exec(req.headers.cookie||'')?.[1];if(!token)return false;const expires=sessions.get(token);if(!expires||expires<Date.now()){sessions.delete(token);return false;}return true;}
async function body(req){let raw='';for await(const part of req){raw+=part;if(raw.length>20000)throw Error('Request too large.');}return JSON.parse(raw||'{}');}
function string(x,max=100){if(typeof x!=='string'||!x.trim()||x.length>max)throw Error('Invalid text value.');return x.trim();}
function id(x){if(typeof x!=='string'||!/^[a-z0-9][a-z0-9-]{0,39}$/.test(x))throw Error('Use a lowercase ID with letters, numbers, or hyphens.');return x;}
function int(x,min,max){const n=Number(x);if(!Number.isInteger(n)||n<min||n>max)throw Error(`Number must be ${min}–${max}.`);return n;}
function bool(x){return x===true||x===1||x==='1'?1:0;}
function sameOrigin(req){const origin=req.headers.origin;return !origin||origin===`http://${req.headers.host}`||origin===`https://${req.headers.host}`;}
function update(req,url,x){
 if(url.pathname==='/api/admin/settings'){
  const allowed={booking_enabled:v=>String(bool(v)),slot_interval_min:v=>String(int(v,5,60)),lead_time_hours:v=>String(int(v,0,72)),horizon_days:v=>String(int(v,1,365))};
  for(const [key,value] of Object.entries(x)){if(!allowed[key])throw Error('Unknown setting.');db.prepare('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,allowed[key](value));}
 }else if(url.pathname==='/api/admin/barber'){
  db.prepare('INSERT INTO barbers(id,name,active) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=excluded.active').run(id(x.id),string(x.name),bool(x.active));
 }else if(url.pathname==='/api/admin/service'){
  db.prepare('INSERT INTO services(id,name,active) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=excluded.active').run(id(x.id),string(x.name),bool(x.active));
 }else if(url.pathname==='/api/admin/offering'){
  db.prepare('INSERT INTO offerings VALUES (?,?,?,?,?,?) ON CONFLICT(barber_id,service_id) DO UPDATE SET duration_min=excluded.duration_min,buffer_min=excluded.buffer_min,price_cents=excluded.price_cents,active=excluded.active').run(id(x.barberId),id(x.serviceId),int(x.durationMin,5,480),int(x.bufferMin,0,120),int(x.priceCents,0,1000000),bool(x.active));
 }else if(url.pathname==='/api/admin/hours'){
  const owner=x.owner==='shop'?'shop':id(x.owner),day=string(x.day,3);
  if(!['sun','mon','tue','wed','thu','fri','sat'].includes(day))throw Error('Invalid weekday.');
  const start=clock(x.start),end=x.end==='24:00'?1440:clock(x.end);
  if(end<=start)throw Error('Closing time must be after opening time.');
  db.prepare('INSERT INTO hours VALUES (?,?,?,?) ON CONFLICT(owner,day,start_min) DO UPDATE SET end_min=excluded.end_min').run(owner,day,start,end);
 }else if(url.pathname==='/api/admin/block'){
  if(!dateOk(x.date))throw Error('Invalid date.');
  const start=clock(x.start),end=x.end==='24:00'?1440:clock(x.end);
  if(end<=start)throw Error('End must be after start.');
  db.prepare('INSERT INTO blocks(barber_id,date,start_min,end_min,reason) VALUES (?,?,?,?,?)').run(x.barberId? id(x.barberId):null,x.date,start,end,typeof x.reason==='string'?x.reason.slice(0,200):'');
 }else if(url.pathname==='/api/admin/booking-status'){
  const status=string(x.status,10);if(!['pending','accepted','declined','cancelled'].includes(status))throw Error('Invalid status.');
  const result=db.prepare('UPDATE bookings SET status=? WHERE id=?').run(status,int(x.id,1,1000000000));if(!result.changes)throw Error('Booking not found.');
 }else if(url.pathname==='/api/admin/remove'){
  if(x.type==='hours')db.prepare('DELETE FROM hours WHERE owner=? AND day=? AND start_min=?').run(x.owner==='shop'?'shop':id(x.owner),string(x.day,3),int(x.startMin,0,1439));
  else if(x.type==='block')db.prepare('DELETE FROM blocks WHERE id=?').run(int(x.id,1,1000000000));
  else throw Error('Unknown item.');
 }else throw Error('Unknown action.');
}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if(url.pathname==='/admin'&&req.method==='GET')return html(res);
  if(req.method==='POST'&&!sameOrigin(req))return send(res,403,{error:'Origin rejected.'});
  if(url.pathname==='/api/admin/login'&&req.method==='POST'){
   const ip=req.socket.remoteAddress,record=failures.get(ip)||{count:0,until:0};
   if(record.until>Date.now())return send(res,429,{error:'Try again later.'});
   const x=await body(req),guess=scryptSync(String(x.password||''),salt,64);
   if(!timingSafeEqual(guess,passwordHash)){
    record.count++;record.until=record.count>=5?Date.now()+60000:0;failures.set(ip,record);
    return send(res,401,{error:'Incorrect password.'});
   }
   failures.delete(ip);const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+8*3600000);
   return send(res,200,{ok:true},{'set-cookie':`sonder_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`});
  }
  if(url.pathname==='/api/admin/logout'&&req.method==='POST'){
   const token=/sonder_session=([a-f0-9]{64})/.exec(req.headers.cookie||'')?.[1];if(token)sessions.delete(token);
   return send(res,200,{ok:true},{'set-cookie':'sonder_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
  }
  if(url.pathname==='/api/availability'&&req.method==='GET'){
   if(settings(db).booking_enabled!=='1')return send(res,200,{enabled:false,slots:[]});
   return send(res,200,{enabled:true,slots:availability(db,{date:url.searchParams.get('date'),serviceId:url.searchParams.get('service'),barberId:url.searchParams.get('barber')||'any'})});
  }
  if(url.pathname==='/api/bookings'&&req.method==='POST')return send(res,201,createBooking(db,await body(req)));
  if(url.pathname.startsWith('/api/admin/')){
   if(!auth(req))return send(res,401,{error:'Sign in first.'});
   if(url.pathname==='/api/admin/config'&&req.method==='GET')return send(res,200,configuration(db));
   if(url.pathname==='/api/admin/preview'&&req.method==='GET')return send(res,200,{slots:availability(db,{date:url.searchParams.get('date'),serviceId:url.searchParams.get('service'),barberId:url.searchParams.get('barber')||'any'})});
   if(req.method==='POST'){update(req,url,await body(req));return send(res,200,configuration(db));}
  }
  send(res,404,{error:'Not found.'});
 }catch(error){send(res,400,{error:error.message});}
});
server.listen(port,host,()=>console.log(`Sonder local admin: http://${host}:${port}/admin`));
