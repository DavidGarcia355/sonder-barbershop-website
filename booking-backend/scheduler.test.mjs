import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,availability,createBooking,dateOk} from './scheduler.mjs';

function setup(){
 const db=openDatabase();
 db.prepare('UPDATE barbers SET active=1').run();
 db.prepare('INSERT INTO services VALUES (?,?,1)').run('cut','Haircut');
 db.prepare('INSERT INTO offerings VALUES (?,?,?,?,?,1)').run('gabriel','cut',45,15,5000);
 db.prepare('INSERT INTO offerings VALUES (?,?,?,?,?,1)').run('erick','cut',30,0,4500);
 db.prepare('INSERT INTO hours VALUES (?,?,?,?)').run('gabriel','wed',600,720);
 db.prepare('INSERT INTO hours VALUES (?,?,?,?)').run('erick','wed',660,780);
 db.prepare("UPDATE settings SET value='1' WHERE key='booking_enabled'").run();
 return db;
}
const query={date:'2026-10-07',serviceId:'cut',now:{date:'2026-10-01',minute:0}};
test('dates reject impossible calendar days',()=>{assert.equal(dateOk('2026-02-30'),false);assert.equal(dateOk('2026-10-07'),true)});
test('per-barber duration, buffer and hours determine availability',()=>{
 const db=setup(),slots=availability(db,query);
 assert(slots.some(s=>s.barberId==='gabriel'&&s.start==='10:00'&&s.end==='10:45'));
 assert(!slots.some(s=>s.barberId==='gabriel'&&s.start==='11:15'));
 assert(slots.some(s=>s.barberId==='erick'&&s.start==='12:30'));
 assert(!slots.some(s=>s.barberId==='erick'&&s.start==='10:00'));
 db.close();
});
test('pending booking blocks overlap; decline releases time',()=>{
 const db=setup();
 const input={date:query.date,serviceId:'cut',barberId:'gabriel',start:'10:00',customerName:'Test Client',customerPhone:'3125550123'};
 const booking=createBooking(db,input,{now:query.now});assert.equal(booking.status,'pending');
 assert(!availability(db,{...query,barberId:'gabriel'}).some(s=>s.start==='10:15'));
 assert.throws(()=>createBooking(db,input,{now:query.now}),/no longer available/);
 assert(availability(db,{...query,barberId:'erick'}).some(s=>s.start==='11:00'));
 db.prepare("UPDATE bookings SET status='declined' WHERE id=?").run(booking.id);
 assert(availability(db,{...query,barberId:'gabriel'}).some(s=>s.start==='10:00'));
 db.close();
});
test('time off and shop closure remove slots; notice and horizon apply',()=>{
 const db=setup();
 db.prepare('INSERT INTO blocks(barber_id,date,start_min,end_min) VALUES (?,?,?,?)').run('erick',query.date,660,780);
 assert(!availability(db,{...query,barberId:'erick'}).length);
 db.prepare('INSERT INTO blocks(barber_id,date,start_min,end_min) VALUES (?,?,?,?)').run(null,query.date,600,1140);
 assert(!availability(db,query).length);
 assert(!availability(db,{...query,date:'2027-10-07'}).length);
 db.close();
});
test('first available assigns an actual barber and respects booking switch',()=>{
 const db=setup();
 const result=createBooking(db,{date:query.date,serviceId:'cut',barberId:'any',start:'10:00',customerName:'Test Client',customerPhone:'3125550123'},{now:query.now});
 assert.equal(result.barberId,'gabriel');
 db.prepare("UPDATE settings SET value='0' WHERE key='booking_enabled'").run();
 assert.throws(()=>createBooking(db,{date:query.date,serviceId:'cut',barberId:'any',start:'11:00',customerName:'Test Client',customerPhone:'3125550123'},{now:query.now}),/not enabled/);
 db.close();
});
