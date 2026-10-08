import { NextRequest, NextResponse } from "next/server";
import { getRedis, redisKeys as keys } from "@/lib/redis";
import {
  isEmployee,
  isImage,
  isLogEntry,
  isSettings,
  isLegacySettings,
} from "@/lib/storage-validation";
import {
  AdminError,
  audit,
  migrateLegacyAdmin,
  requireAdmin,
} from "@/lib/admin-auth";
import { Employee, LogEntry, Settings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const defaults: Settings = { orgName: "FaceGate", timeZone: "Asia/Kolkata" };
type Context = { params: { resource: string } };
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
const invalid = () => json({ error: "Invalid storage request" }, 400);

async function handle(request: NextRequest, { params }: Context) {
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin)
      return json({ error: "Invalid origin" }, 403);
  }
  const resource = params.resource;
  if (
    ![
      "employees",
      "attendance",
      "settings",
      "images",
      "initialize",
      "migrate",
      "reset",
    ].includes(resource)
  ) {
    return json({ error: "Unknown storage resource" }, 404);
  }
  try {
    const redis = await getRedis();
    const key = request.nextUrl.searchParams.get("key");
    if (request.method === "GET") {
      if (resource === "initialize") {
        await redis.ping();
        await migrateLegacyAdmin();
        await redis.set(keys.settings, JSON.stringify(defaults), { NX: true });
        return json({ ok: true });
      }
      if (resource === "employees") {
        const [rows, images] = await Promise.all([
          redis.hGetAll(keys.employees),
          redis.hGetAll(keys.images),
        ]);
        return json(
          Object.values(rows).map((row) => {
            const employee = JSON.parse(row) as Employee;
            return {
              ...employee,
              photo: employee.photoKey ? images[employee.photoKey] || "" : "",
            };
          }),
        );
      }
      if (resource === "attendance")
        return json(
          Object.values(await redis.hGetAll(keys.attendance)).map((row) =>
            JSON.parse(row),
          ),
        );
      if (resource === "settings") {
        await migrateLegacyAdmin();
        const value = await redis.get(keys.settings);
        const saved = value ? JSON.parse(value) : defaults;
        return json({
          orgName: saved.orgName || defaults.orgName,
          timeZone: saved.timeZone || defaults.timeZone,
        });
      }
      if (resource === "images" && key)
        return json((await redis.hGet(keys.images, key)) ?? null);
      return invalid();
    }
    if (request.method === "DELETE") {
      if (resource === "reset") {
        const actor = await requireAdmin(request, "superadmin");
        await redis.del([keys.employees, keys.attendance, keys.images]);
        await audit(request, actor, "data_reset");
        return json({ ok: true });
      }
      if (resource === "employees" && key) {
        const actor = await requireAdmin(request);
        await redis
          .multi()
          .hDel(keys.employees, key)
          .hDel(keys.images, `employees/${key}/profile`)
          .exec();
        await audit(request, actor, "employee_removed", key);
        return json({ ok: true });
      }
      if (resource === "images" && key) {
        await requireAdmin(request);
        await redis.hDel(keys.images, key);
        return json({ ok: true });
      }
      return invalid();
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalid();
    }
    if (resource === "employees" && isEmployee(body)) {
      const actor = await requireAdmin(request);
      const { photo, photoKey: _oldKey, ...data } = body;
      const photoKey = photo ? `employees/${body.id}/profile` : undefined;
      const row = { ...data, photoKey };
      const created = await redis.eval(
        `if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then return 0 end
         redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
         if ARGV[3] ~= '' then redis.call('HSET', KEYS[2], ARGV[3], ARGV[4]) end
         return 1`,
        {
          keys: [keys.employees, keys.images],
          arguments: [body.id, JSON.stringify(row), photoKey || "", photo],
        },
      );
      if (!created) return json({ error: "Employee already exists" }, 409);
      await audit(request, actor, "employee_registered", body.id);
      return json({ ...row, photo }, 201);
    }
    if (resource === "attendance" && isLogEntry(body)) {
      // Only registered employees can record attendance; identity labels come from Redis.
      const saved = await redis.eval(
        `local person = redis.call('HGET', KEYS[1], ARGV[1])
         if not person then return -1 end
         if redis.call('HEXISTS', KEYS[2], ARGV[2]) == 1 then return 0 end
         local employee = cjson.decode(person)
         local entry = cjson.decode(ARGV[3])
         entry.name = employee.name
         entry.extId = employee.extId
         local value = cjson.encode(entry)
         redis.call('HSET', KEYS[2], ARGV[2], value)
         return value`,
        {
          keys: [keys.employees, keys.attendance],
          arguments: [
            body.empId,
            body.id,
            JSON.stringify({
              id: body.id,
              empId: body.empId,
              type: body.type,
              ts: body.ts,
            }),
          ],
        },
      );
      if (saved === -1)
        return json(
          {
            error:
              "Employee is not registered. Ask an administrator to register them.",
          },
          404,
        );
      if (saved === 0)
        return json({ error: "Attendance entry already exists" }, 409);
      return json(JSON.parse(String(saved)), 201);
    }
    if (resource === "settings" && isSettings(body)) {
      const actor = await requireAdmin(request, "superadmin");
      await redis.set(
        keys.settings,
        JSON.stringify({ orgName: body.orgName, timeZone: body.timeZone }),
      );
      await audit(request, actor, "settings_updated");
      return json({ ok: true });
    }
    if (resource === "images" && key && isImage(body)) {
      await requireAdmin(request);
      await redis.hSet(keys.images, key, body);
      return json({ ok: true });
    }
    if (resource === "migrate" && typeof body === "object" && body !== null) {
      const actor = await requireAdmin(request);
      const snapshot = body as {
        employees: Employee[];
        logs: LogEntry[];
        settings?: { orgName: string; pin?: string; timeZone?: string };
      };
      if (
        !Array.isArray(snapshot.employees) ||
        !snapshot.employees.every(isEmployee) ||
        !Array.isArray(snapshot.logs) ||
        !snapshot.logs.every(isLogEntry) ||
        (snapshot.settings !== undefined &&
          !isLegacySettings(snapshot.settings))
      )
        return invalid();
      const transaction = redis.multi();
      for (const employee of snapshot.employees) {
        const { photo, photoKey: _oldKey, ...data } = employee;
        const photoKey = photo ? `employees/${employee.id}/profile` : undefined;
        transaction.hSetNX(
          keys.employees,
          employee.id,
          JSON.stringify({ ...data, photoKey }),
        );
        if (photoKey) transaction.hSetNX(keys.images, photoKey, photo);
      }
      for (const entry of snapshot.logs)
        transaction.hSetNX(keys.attendance, entry.id, JSON.stringify(entry));
      if (snapshot.settings)
        transaction.set(
          keys.settings,
          JSON.stringify({
            orgName: snapshot.settings.orgName,
            timeZone: snapshot.settings.timeZone || defaults.timeZone,
          }),
          {
            NX: true,
          },
        );
      await transaction.exec();
      await audit(request, actor, "legacy_data_imported");
      return json({ ok: true });
    }
    return invalid();
  } catch (error) {
    if (error instanceof AdminError)
      return json({ error: error.message }, error.status);
    console.error("Redis storage request failed");
    return json(
      {
        error:
          "Storage unavailable. Check the server Redis configuration and connection.",
      },
      503,
    );
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
