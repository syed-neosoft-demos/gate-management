# FaceGate

Employee records, face descriptors, profile photos, attendance logs, and settings are stored in Redis through server-side Next.js API routes. Redis credentials stay on the server; browsers do not connect to Redis directly.

## Run locally

1. Copy `.env.example` to `.env.local` (or set `REDIS_URL` to your Redis server's connection URL).
2. Start persistent local Redis: `docker compose up -d redis`.
3. Install dependencies with `npm install`, then run `npm run dev`.

Use a Redis instance with persistence enabled for deployed installations. The included Docker configuration enables append-only persistence and stores it in a named volume. Stop it with `docker compose down`; adding `-v` deletes the stored data.

On first successful startup, existing `fg_*` local-storage data and the legacy `facegate` IndexedDB database are imported. Existing Redis records take precedence. Browser data is removed only after Redis confirms the import; a failed import retains the originals for retry. Close other FaceGate tabs during migration.

Kiosks using the same server share the database. Resetting people and attendance clears those records and profile photos for every kiosk, while retaining settings. Open kiosks load records on startup; reload to see changes made on another kiosk.

The existing admin PIN is a client-side UI gate. The storage API does not provide server-side user authentication; deploy within a trusted network or behind authenticated access.

Redis client reference: [node-redis connection documentation](https://redis.io/docs/latest/develop/clients/nodejs/connect/).
