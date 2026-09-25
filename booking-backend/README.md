# Sonder booking backend (local prototype)

The public GitHub Pages site remains an explicitly labeled design demo. This backend does not connect to that site yet and does not take real customer appointments. It is a local foundation for a future integrated booking system.

Run with Node 24.14 or newer in PowerShell:

```powershell
$env:SONDER_ADMIN_PASSWORD = 'a unique password of at least 12 characters'
node booking-backend/server.mjs
```

Open http://127.0.0.1:4343/admin. The SQLite database is stored in `booking-backend/data/` and ignored by Git. Keep a backup if you enter real configuration or appointments. The server listens only on localhost by default. The password is read from the environment; no password or customer record belongs in Git.

Gabriel can configure barbers, services, per-barber prices and durations, cleanup buffers, shop and barber weekly hours, breaks via split intervals, time off/closures, booking window and notice, and pending appointment acceptance. A preview shows resulting slots before launch. Pending and accepted appointments block time; declined and cancelled ones release it. "First available" assigns a specific free barber. New installations start with booking **off**, Gabriel and Erick inactive, no services, and no guessed prices/durations. Shop hours are prefilled from Sonder's published hours for review.

Run the scheduling checks with `node --test booking-backend/scheduler.test.mjs`. Node's `node:sqlite` module is still experimental in Node 24.14. This backend needs a production database/hosting, backups, customer notices, notification delivery, and a payment provider before launch. GitHub Pages cannot run the server. Existing appointments in the current booking system must be imported or the old system shut off before this one accepts customers, or double bookings are possible.
