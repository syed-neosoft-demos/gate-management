# FaceGate

Employee records, face descriptors, photos, attendance, organization settings, admin accounts, sessions, and access logs are stored in Redis. Server-side Next.js routes handle all persistence.

## Run locally

1. Copy `.env.example` to `.env.local` and configure `REDIS_URL` and `REDIS_PASSWORD` for your Redis server.
2. Start Redis, for example with `docker compose up -d redis`. The included Docker service has no password; leave `REDIS_PASSWORD` empty for that service.
3. Run `npm install`, then `npm run dev`.
4. Set the default admin credentials in `.env` or `.env.local`:

   ```dotenv
   DEFAULT_ADMIN_USERNAME=super-admin
   DEFAULT_ADMIN_PASSWORD=Admin@Super@123
   ```

   Starting the development or production server automatically creates this username in Redis with the `superadmin` role, a salted password hash, and a first-sign-in password change requirement. Sign in at **`/admin/login`** using these credentials. An existing account is preserved: restarting or changing the environment password does not reset its password, role, or sessions. An existing non-super-admin account with that username causes an explicit configuration error.

   Startup uses the Next.js instrumentation hook and skips database seeding during `next build`. If neither default admin variable is configured, automatic seeding is skipped; `npm run admin:bootstrap` remains available for manual setup.

If the previous admin PIN already exists in Redis settings, the app migrates it into the `superadmin` account automatically. Use username `superadmin` and your previous PIN for the first sign-in, then set a password with at least 10 characters. Public settings no longer expose the PIN. There is no hardcoded default admin password.

For operator recovery, `npm run admin:bootstrap -- --reset` explicitly resets the configured `DEFAULT_ADMIN_USERNAME` account password (or `superadmin` when the variable is absent) and invalidates its sessions. It prints a new temporary password and records the recovery in the audit log. Without `--reset`, the script preserves an existing account.

## Pages and project structure

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Face recognition check-in / check-out | Employees |
| `/admin/login` | Admin sign-in and first password change | Public sign-in page |
| `/admin` | Redirect to the dashboard | Admin / super admin |
| `/admin/attendance` | Monthly reports and charts | Admin / super admin |
| `/admin/logs` | Attendance records and exports | Admin / super admin |
| `/admin/employees` | Employee management | Admin / super admin |
| `/admin/employees/register` | Employee details and face enrollment | Admin / super admin |
| `/admin/settings` | Organization settings and data reset | Super admin |
| `/admin/access` | Own password; account management and access logs for super admins | Admin / super admin |

Protected pages check the Redis session on the server before rendering. The `(protected)` route group shares the admin layout, navigation, and data provider without adding another URL segment. Mutation APIs check authorization independently.

```text
app/
  page.tsx                       # Public employee kiosk
  admin/login/                   # Separate sign-in page
  admin/(protected)/             # Protected admin pages and layout
  api/admin/                     # Authentication and account APIs
  api/storage/                   # Redis data APIs
components/
  kiosk/                         # Employee scanner and kiosk screen
  admin/                         # Dashboard, reports, account management, registration
  shared/                        # Reusable avatars and form controls
hooks/                           # Camera, clock, and admin state
lib/                             # Redis, authorization, storage adapters, attendance calculations
scripts/                         # Admin bootstrap and recovery
tests/                          # Unit and Redis integration checks
```

The employee kiosk does not mount admin forms or the enrollment camera. It refreshes registration and attendance data every 30 seconds so new employees are recognized without a reload. Face models load only in the kiosk and the protected employee-registration page; reports and sign-in do not need the camera or model download.

## Monthly attendance

The `/admin/attendance` page opens with a month selector, organization totals, daily hours, and an employee comparison chart. Select an employee in the list, chart, or Employees page to see each day's first presence, last check-out, hours, check-ins, and scans. Reports export to CSV.

Hours sum IN/OUT pairs, excluding time between visits. Closed overnight visits are split at local midnight and clipped to the selected month. Current-day open visits count up to now and update every minute. Older unmatched check-ins contribute no hours and are flagged; unmatched check-outs, duplicate check-ins, and visits longer than 24 hours are also flagged for review. Days without records are shown as **No records**, not as confirmed absences. Former employees remain in historical reports.

The organization time zone defaults to `Asia/Kolkata` and can be changed in Settings using an IANA time zone. Refresh data to load records made on other kiosks. Daylight-saving changes use actual elapsed time.

## Admin access

| Permission | Admin | Super admin |
| --- | --- | --- |
| Attendance reports and exports | Yes | Yes |
| Employee management | Yes | Yes |
| Change or generate own password | Yes | Yes |
| Create admin/super-admin accounts | No | Yes |
| Reset other accounts' passwords | No | Yes |
| Organization settings and attendance reset | No | Yes |
| Account list and access logs | No | Yes |

Passwords use salted scrypt hashes in Redis. Sessions use HTTP-only, SameSite cookies and expire after eight hours; password changes invalidate all previous sessions. Login and password verification are limited to five attempts per account in 15 minutes. Generated passwords are returned once and never included in audit logs. New accounts and reset accounts must change their temporary password on first sign-in. Resetting a password requires the acting admin's current password.

Access logs include successful/failed logins, logout, permission failures, account creation, password changes/resets, employee registration/removal, legacy imports, settings changes, and attendance resets. Entries include the account, role, time, outcome, and request source. The latest 2,000 events are retained. Forwarded IP addresses are metadata supplied by the reverse proxy; only trust them when that proxy controls the header.

The employee kiosk at `/` only scans registered employees to check them in or out. Registration is available at `/admin/employees/register` and requires an authenticated admin or super admin in both the page and API. Legacy imports also require admin authorization. Loading recognition data and recording attendance remain available on the kiosk network. Deploy the kiosk service in a trusted environment, use HTTPS for remote access, and use authenticated network access if exposing it beyond that environment.

## Data and persistence

Use Redis with persistence enabled. The Docker service enables append-only persistence in a named volume. `docker compose down` stops it; adding `-v` deletes its data.

Existing `fg_*` browser data and the old `facegate` IndexedDB database import after an admin signs in. They are not imported from the public kiosk. Existing Redis rows take precedence; originals are retained if the import fails. Close other FaceGate tabs during migration. Legacy browser PIN values do not create or overwrite admin credentials; configure the startup default super admin if Redis had no existing admin PIN.

Erasing attendance and people deletes those records and photos for every kiosk. Organization settings, admin accounts, and access logs are retained.

## Verification

- `npm test`: attendance calculations, password hashing, validation, and browser migration.
- `FACEGATE_TEST_REDIS=1 node --test tests/admin-integration.test.cjs`: actual API handlers against Redis, using a unique temporary namespace that is deleted afterward. Verifies authentication, page guards, admin-only registration/imports, forced password changes, role checks, session revocation, throttling, and audit logs.
- `npm run build`: production compilation and type checks.

References: [Redis client connections](https://redis.io/docs/latest/develop/clients/nodejs/connect/), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
