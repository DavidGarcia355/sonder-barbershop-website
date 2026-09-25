import { DatabaseSync } from 'node:sqlite';

const DAYS=['sun','mon','tue','wed','thu','fri','sat'];
const idOk=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9-]{0,39}$/.test(x);
export const dateOk=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;const d=new Date(x+'T12:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===x;};
export const clock=x=>{if(typeof x!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x))throw Error('Use HH:MM time.');return Number(x.slice(0,2))*60+Number(x.slice(3));};
export const time=x=>`${String(Math.floor(x/60)).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`;
export function chicagoNow(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute)};}
export function openDatabase(file=':memory:'){
 const db=new DatabaseSync(file);
 db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS barbers(id TEXT PRIMARY KEY,name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS services(id TEXT PRIMARY KEY,name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS offerings(barber_id TEXT NOT NULL REFERENCES barbers(id),service_id TEXT NOT NULL REFERENCES services(id),duration_min INTEGER NOT NULL CHECK(duration_min BETWEEN 5 AND 480),buffer_min INTEGER NOT NULL CHECK(buffer_min BETWEEN 0 AND 120),price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 0 AND 1000000),active INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(barber_id,service_id));
 CREATE TABLE IF NOT EXISTS hours(owner TEXT NOT NULL,day TEXT NOT NULL,start_min INTEGER NOT NULL,end_min INTEGER NOT NULL,PRIMARY KEY(owner,day,start_min),CHECK(start_min>=0 AND end_min<=1440 AND end_min>start_min));
 CREATE TABLE IF NOT EXISTS blocks(id INTEGER PRIMARY KEY,barber_id TEXT REFERENCES barbers(id),date TEXT NOT NULL,start_min INTEGER NOT NULL,end_min INTEGER NOT NULL,reason TEXT NOT NULL DEFAULT '',CHECK(end_min>start_min));
 CREATE TABLE IF NOT EXISTS bookings(id INTEGER PRIMARY KEY,barber_id TEXT NOT NULL REFERENCES barbers(id),service_id TEXT NOT NULL REFERENCES services(id),date TEXT NOT NULL,start_min INTEGER NOT NULL,end_min INTEGER NOT NULL,customer_name TEXT NOT NULL,customer_phone TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE INDEX IF NOT EXISTS booking_day ON bookings(barber_id,date,status,start_min);`);
 const insert=db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)');
 for(const [k,v] of Object.entries({booking_enabled:'0',slot_interval_min:'15',lead_time_hours:'2',horizon_days:'90'}))insert.run(k,v);
 const addBarber=db.prepare('INSERT OR IGNORE INTO barbers(id,name,active) VALUES (?,?,0)');
 addBarber.run('gabriel','Gabriel Salazar');addBarber.run('erick','Erick Rios');
 if(!db.prepare("SELECT 1 FROM hours WHERE owner='shop' LIMIT 1").get()){const add=db.prepare('INSERT INTO hours VALUES (?,?,?,?)');for(const d of ['tue','wed','thu','fri'])add.run('shop',d,600,1140);add.run('shop','sat',540,1020);}
 return db;
}
export const settings=db=>Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r=>[r.key,r.value]));
export const configuration=db=>({settings:settings(db),barbers:db.prepare('SELECT * FROM barbers ORDER BY name').all(),services:db.prepare('SELECT * FROM services ORDER BY name').all(),offerings:db.prepare('SELECT * FROM offerings ORDER BY barber_id,service_id').all(),hours:db.prepare('SELECT * FROM hours ORDER BY owner,day,start_min').all(),blocks:db.prepare('SELECT * FROM blocks ORDER BY date,start_min').all(),bookings:db.prepare('SELECT * FROM bookings ORDER BY date DESC,start_min DESC LIMIT 200').all()});
export function availability(db,{date,serviceId,barberId='any',now=chicagoNow()}={}){
 if(!dateOk(date)||!idOk(serviceId)||(barberId!=='any'&&!idOk(barberId)))throw Error('Invalid date, service, or barber.');
 const cfg=settings(db),distance=Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(now.date+'T12:00:00Z'))/86400000);
 if(distance<0||distance>Number(cfg.horizon_days))return [];
 const day=DAYS[new Date(date+'T12:00:00Z').getUTCDay()];
 const offers=db.prepare(`SELECT o.*,b.name barber_name FROM offerings o JOIN barbers b ON b.id=o.barber_id JOIN services s ON s.id=o.service_id WHERE o.service_id=? AND o.active=1 AND b.active=1 AND s.active=1 AND (?='any' OR o.barber_id=?)`).all(serviceId,barberId,barberId);
 const getHours=db.prepare('SELECT start_min,end_min FROM hours WHERE owner=? AND day=?');
 const shop=getHours.all('shop',day),rows=[];
 for(const offer of offers){
  const staff=getHours.all(offer.barber_id,day);
  const open=shop.flatMap(a=>staff.map(b=>[Math.max(a.start_min,b.start_min),Math.min(a.end_min,b.end_min)]).filter(([s,e])=>e>s));
  const busy=[...db.prepare('SELECT start_min,end_min FROM blocks WHERE date=? AND (barber_id=? OR barber_id IS NULL)').all(date,offer.barber_id),...db.prepare("SELECT start_min,end_min FROM bookings WHERE date=? AND barber_id=? AND status IN ('pending','accepted')").all(date,offer.barber_id)];
  for(let start=0;start<1440;start+=Number(cfg.slot_interval_min)){
   const end=start+offer.duration_min+offer.buffer_min;
   if(!open.some(([s,e])=>s<=start&&end<=e))continue;
   if(distance===0&&start<now.minute+Number(cfg.lead_time_hours)*60)continue;
   if(busy.some(b=>b.start_min<end&&b.end_min>start))continue;
   rows.push({barberId:offer.barber_id,barberName:offer.barber_name,serviceId,start:time(start),end:time(start+offer.duration_min),durationMin:offer.duration_min,priceCents:offer.price_cents});
  }
 }
 return rows.sort((a,b)=>a.start.localeCompare(b.start)||a.barberName.localeCompare(b.barberName));
}
export function createBooking(db,input,{now=chicagoNow()}={}){
 const {date,serviceId,barberId='any',start,customerName,customerPhone}=input;
 if(typeof customerName!=='string'||customerName.trim().length<2||customerName.length>100)throw Error('Enter a customer name.');
 if(typeof customerPhone!=='string'||!/^[+()\d\s-]{7,25}$/.test(customerPhone))throw Error('Enter a valid phone number.');
 if(settings(db).booking_enabled!=='1')throw Error('Live booking is not enabled.');
 db.exec('BEGIN IMMEDIATE');
 try{const slot=availability(db,{date,serviceId,barberId,now}).find(s=>s.start===start);if(!slot)throw Error('That time is no longer available.');
  const offer=db.prepare('SELECT duration_min,buffer_min FROM offerings WHERE barber_id=? AND service_id=?').get(slot.barberId,serviceId),minute=clock(start);
  const result=db.prepare('INSERT INTO bookings(barber_id,service_id,date,start_min,end_min,customer_name,customer_phone) VALUES (?,?,?,?,?,?,?)').run(slot.barberId,serviceId,date,minute,minute+offer.duration_min+offer.buffer_min,customerName.trim(),customerPhone.trim());
  db.exec('COMMIT');return {id:Number(result.lastInsertRowid),status:'pending',barberId:slot.barberId,date,start};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
