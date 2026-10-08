import { NextRequest, NextResponse } from "next/server";
import { getRedis, redisKeys as keys } from "@/lib/redis";
import {
  isEmployee,
  isImage,
  isLogEntry,
  isSettings,
} from "@/lib/storage-validation";
import { Employee, LogEntry, Settings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const defaults: Settings = { pin: "1234", orgName: "FaceGate" };
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
        const value = await redis.get(keys.settings);
        return json(value ? JSON.parse(value) : defaults);
      }
      if (resource === "images" && key)
        return json((await redis.hGet(keys.images, key)) ?? null);
      return invalid();
    }
    if (request.method === "DELETE") {
      if (resource === "reset") {
        await redis.del([keys.employees, keys.attendance, keys.images]);
        return json({ ok: true });
      }
      if (resource === "employees" && key) {
        await redis
          .multi()
          .hDel(keys.employees, key)
          .hDel(keys.images, `employees/${key}/profile`)
          .exec();
        return json({ ok: true });
      }
      if (resource === "images" && key) {
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
      return json({ ...row, photo }, 201);
    }
    if (resource === "attendance" && isLogEntry(body)) {
      if (
        !(await redis.hSetNX(keys.attendance, body.id, JSON.stringify(body)))
      ) {
        return json({ error: "Attendance entry already exists" }, 409);
      }
      return json({ ok: true }, 201);
    }
    if (resource === "settings" && isSettings(body)) {
      await redis.set(
        keys.settings,
        JSON.stringify({ pin: body.pin, orgName: body.orgName }),
      );
      return json({ ok: true });
    }
    if (resource === "images" && key && isImage(body)) {
      await redis.hSet(keys.images, key, body);
      return json({ ok: true });
    }
    if (resource === "migrate" && typeof body === "object" && body !== null) {
      const snapshot = body as {
        employees: Employee[];
        logs: LogEntry[];
        settings?: Settings;
      };
      if (
        !Array.isArray(snapshot.employees) ||
        !snapshot.employees.every(isEmployee) ||
        !Array.isArray(snapshot.logs) ||
        !snapshot.logs.every(isLogEntry) ||
        (snapshot.settings !== undefined && !isSettings(snapshot.settings))
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
        transaction.set(keys.settings, JSON.stringify(snapshot.settings), {
          NX: true,
        });
      await transaction.exec();
      return json({ ok: true });
    }
    return invalid();
  } catch {
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
