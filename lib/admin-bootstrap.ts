import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "@/lib/admin-password.cjs";
import { AdminAccount, AdminAudit } from "@/lib/admin-types";
import { getRedis, redisKeys as keys } from "@/lib/redis";

/** Seed once per username. Restarts never reset a password or overwrite an account. */
export async function ensureDefaultSuperAdmin(): Promise<boolean> {
  const configuredUsername = process.env.DEFAULT_ADMIN_USERNAME;
  const password = process.env.DEFAULT_ADMIN_PASSWORD;
  if (!configuredUsername && !password) return false;
  const username = configuredUsername?.trim().toLowerCase();
  if (!username || !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) {
    throw new Error(
      "Set DEFAULT_ADMIN_USERNAME to a valid username with 3–40 characters.",
    );
  }
  if (!password || password.length < 10 || password.length > 128) {
    throw new Error(
      "Set DEFAULT_ADMIN_PASSWORD to a password with 10–128 characters.",
    );
  }
  const redis = await getRedis();
  const existing = await redis.hGet(keys.admins, username);
  if (existing) {
    if ((JSON.parse(existing) as AdminAccount).role !== "superadmin") {
      throw new Error(
        "DEFAULT_ADMIN_USERNAME belongs to an existing non-super-admin account. Choose another username.",
      );
    }
    return false;
  }
  const account: AdminAccount = {
    username,
    name: "Super admin",
    role: "superadmin",
    passwordHash: await hashPassword(password),
    version: 1,
    mustChangePassword: true,
    createdAt: Date.now(),
  };
  const event: AdminAudit = {
    id: randomUUID(),
    ts: Date.now(),
    actor: "server-startup",
    role: "superadmin",
    action: "default_superadmin_created",
    target: username,
    outcome: "success",
    ip: "local",
    userAgent: "application startup",
  };
  const created = await redis.eval(
    `if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then return 0 end
     redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
     redis.call('LPUSH', KEYS[2], ARGV[3])
     redis.call('LTRIM', KEYS[2], 0, 1999)
     return 1`,
    {
      keys: [keys.admins, keys.audit],
      arguments: [username, JSON.stringify(account), JSON.stringify(event)],
    },
  );
  return created === 1;
}
