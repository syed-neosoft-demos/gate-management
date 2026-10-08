import { NextRequest, NextResponse } from "next/server";
import { getRedis, redisKeys as keys } from "@/lib/redis";
import { AdminAccount } from "@/lib/admin-types";
import {
  generatePassword,
  hashPassword,
  verifyPassword,
} from "@/lib/admin-password.cjs";
import {
  AdminError,
  audit,
  migrateLegacyAdmin,
  newSession,
  publicAdmin,
  removeSession,
  requireAdmin,
  SESSION_COOKIE,
  SESSION_SECONDS,
  tokenDigest,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: { action: string } };
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
const validPassword = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 10 && value.length <= 128;
const validUsername = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9][a-z0-9._-]{2,39}$/.test(value);
function cookie(response: NextResponse, token: string, request: NextRequest) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: token ? SESSION_SECONDS : 0,
  });
  return response;
}

async function handle(request: NextRequest, { params: { action } }: Context) {
  if (request.method !== "GET") {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== request.nextUrl.origin
    )
      return json({ error: "Invalid origin" }, 403);
    if (!request.headers.get("content-type")?.includes("application/json"))
      return json({ error: "JSON is required" }, 400);
  }
  try {
    const redis = await getRedis();
    await migrateLegacyAdmin();
    if (request.method === "GET") {
      if (action === "session")
        return json({
          user: publicAdmin(await requireAdmin(request, undefined, true)),
        });
      const actor = await requireAdmin(request, "superadmin");
      if (action === "accounts")
        return json(
          Object.values(await redis.hGetAll(keys.admins)).map((row) =>
            publicAdmin(JSON.parse(row)),
          ),
        );
      if (action === "audit")
        return json(
          (await redis.lRange(keys.audit, 0, 1999)).map((row) =>
            JSON.parse(row),
          ),
        );
      return json({ error: "Unknown admin action" }, 404);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return json({ error: "Invalid request" }, 400);
    if (action === "login") {
      const username =
        typeof body.username === "string"
          ? body.username.trim().toLowerCase()
          : "";
      if (
        !validUsername(username) ||
        typeof body.password !== "string" ||
        body.password.length > 128 ||
        !body.password.length
      )
        return json({ error: "Enter your username and password." }, 400);
      const rateKey = keys.ratePrefix + tokenDigest(username);
      const attempts = (await redis.eval(
        `local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], 900) end; return count`,
        { keys: [rateKey], arguments: [] },
      )) as number;
      if (attempts > 5) {
        await audit(request, null, "login_throttled", username, "failure");
        return json(
          { error: "Too many sign-in attempts. Try again in 15 minutes." },
          429,
        );
      }
      const raw = await redis.hGet(keys.admins, username);
      const account = raw ? (JSON.parse(raw) as AdminAccount) : null;
      const matches = account
        ? await verifyPassword(body.password, account.passwordHash)
        : (await hashPassword(body.password), false);
      if (!account || !matches) {
        await audit(request, null, "login_failed", username, "failure");
        return json({ error: "Incorrect username or password." }, 401);
      }
      const updated = { ...account, lastLoginAt: Date.now() };
      const saved = await redis.eval(
        `if redis.call('HGET', KEYS[1], ARGV[1]) ~= ARGV[2] then return 0 end; redis.call('HSET', KEYS[1], ARGV[1], ARGV[3]); return 1`,
        {
          keys: [keys.admins],
          arguments: [username, raw!, JSON.stringify(updated)],
        },
      );
      if (!saved) throw new AdminError("Account changed. Sign in again.");
      await redis.del(rateKey);
      await removeSession(request);
      const token = await newSession(updated);
      await audit(request, updated, "login_success");
      return cookie(json({ user: publicAdmin(updated) }), token, request);
    }
    if (action === "logout") {
      // An expired session can still be safely cleared.
      try {
        const actor = await requireAdmin(request, undefined, true);
        await audit(request, actor, "logout");
      } catch (error) {
        if (!(error instanceof AdminError)) throw error;
      }
      await removeSession(request);
      return cookie(json({ ok: true }), "", request);
    }
    if (action === "password") {
      const actor = await requireAdmin(request, undefined, true);
      const username =
        typeof body.username === "string"
          ? body.username.toLowerCase().trim()
          : actor.username;
      const self = username === actor.username;
      if (!self && (actor.role !== "superadmin" || actor.mustChangePassword))
        throw new AdminError("Super admin access is required.", 403);
      const passwordRateKey =
        keys.ratePrefix + "password:" + tokenDigest(actor.username);
      const passwordAttempts = (await redis.eval(
        `local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], 900) end; return count`,
        { keys: [passwordRateKey], arguments: [] },
      )) as number;
      if (passwordAttempts > 5)
        return json(
          { error: "Too many password attempts. Try again in 15 minutes." },
          429,
        );
      if (
        typeof body.currentPassword !== "string" ||
        body.currentPassword.length > 128 ||
        !(await verifyPassword(body.currentPassword, actor.passwordHash))
      ) {
        await audit(
          request,
          actor,
          "password_change_failed",
          username,
          "failure",
        );
        return json({ error: "Current password is incorrect." }, 400);
      }
      const raw = await redis.hGet(keys.admins, username);
      if (!raw) return json({ error: "Account not found" }, 404);
      const target = JSON.parse(raw) as AdminAccount;
      if (self && target.version !== actor.version)
        throw new AdminError("Account changed. Sign in again.");
      const generated = body.generate === true;
      const password = generated ? generatePassword() : body.password;
      if (!validPassword(password))
        return json({ error: "Use a password with 10–128 characters." }, 400);
      if (await verifyPassword(password, target.passwordHash))
        return json({ error: "Choose a different password." }, 400);
      const updated: AdminAccount = {
        ...target,
        passwordHash: await hashPassword(password),
        version: target.version + 1,
        mustChangePassword: !self,
      };
      const changed = await redis.eval(
        `if redis.call('HGET', KEYS[1], ARGV[1]) ~= ARGV[2] then return 0 end; redis.call('HSET', KEYS[1], ARGV[1], ARGV[3]); return 1`,
        {
          keys: [keys.admins],
          arguments: [username, raw, JSON.stringify(updated)],
        },
      );
      if (!changed)
        return json({ error: "Account changed. Reload and try again." }, 409);
      await redis.del(passwordRateKey);
      await audit(
        request,
        actor,
        self ? "password_changed" : "password_reset",
        username,
      );
      const response = json({
        user: self ? publicAdmin(updated) : undefined,
        generatedPassword: generated ? password : undefined,
      });
      if (self) {
        await removeSession(request);
        return cookie(response, await newSession(updated), request);
      }
      return response;
    }
    const actor = await requireAdmin(request, "superadmin");
    if (action === "accounts") {
      const username =
        typeof body.username === "string"
          ? body.username.toLowerCase().trim()
          : "";
      if (
        !validUsername(username) ||
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.length > 80 ||
        !["admin", "superadmin"].includes(body.role)
      )
        return json(
          {
            error:
              "Enter a name, a valid username (3–40 characters), and a role.",
          },
          400,
        );
      const generated = body.generate === true;
      const password = generated ? generatePassword() : body.password;
      if (!validPassword(password))
        return json({ error: "Use a password with 10–128 characters." }, 400);
      const account: AdminAccount = {
        username,
        name: body.name.trim(),
        role: body.role,
        passwordHash: await hashPassword(password),
        version: 1,
        mustChangePassword: true,
        createdAt: Date.now(),
      };
      if (!(await redis.hSetNX(keys.admins, username, JSON.stringify(account))))
        return json({ error: "Username already exists." }, 409);
      await audit(request, actor, "account_created", username);
      return json(
        {
          user: publicAdmin(account),
          generatedPassword: generated ? password : undefined,
        },
        201,
      );
    }
    return json({ error: "Unknown admin action" }, 404);
  } catch (error) {
    if (error instanceof AdminError)
      return json({ error: error.message }, error.status);
    console.error("Admin request failed");
    return json(
      { error: "Admin service unavailable. Check the Redis connection." },
      503,
    );
  }
}
export const GET = handle;
export const POST = handle;
