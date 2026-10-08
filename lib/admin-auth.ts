import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { getRedis, redisKeys as keys } from "@/lib/redis";
import { hashPassword } from "@/lib/admin-password.cjs";
import {
  AdminAccount,
  AdminAudit,
  AdminRole,
  AdminUser,
} from "@/lib/admin-types";

export const SESSION_COOKIE = "facegate_admin";
export const SESSION_SECONDS = 8 * 60 * 60;
export class AdminError extends Error {
  constructor(
    message: string,
    public status = 401,
  ) {
    super(message);
  }
}
export const publicAdmin = ({
  passwordHash: _hash,
  version: _version,
  ...user
}: AdminAccount): AdminUser => user;
export const tokenDigest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function audit(
  request: NextRequest,
  actor: AdminUser | null,
  action: string,
  target?: string,
  outcome: AdminAudit["outcome"] = "success",
) {
  const redis = await getRedis();
  const entry: AdminAudit = {
    id: randomUUID(),
    ts: Date.now(),
    actor: actor?.username || "anonymous",
    role: actor?.role || "anonymous",
    action,
    target: target?.slice(0, 128),
    outcome,
    ip: (
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    ).slice(0, 80),
    userAgent: (request.headers.get("user-agent") || "unknown").slice(0, 200),
  };
  await redis
    .multi()
    .lPush(keys.audit, JSON.stringify(entry))
    .lTrim(keys.audit, 0, 1999)
    .exec();
}

/** Upgrade an existing Redis PIN once; new installs use the bootstrap script. */
export async function migrateLegacyAdmin() {
  const redis = await getRedis();
  const raw = await redis.get(keys.settings);
  if (!raw) return;
  const settings = JSON.parse(raw);
  if (typeof settings.pin === "string" && settings.pin.length > 0) {
    if (!(await redis.hExists(keys.admins, "superadmin"))) {
      const account: AdminAccount = {
        username: "superadmin",
        name: "Super admin",
        role: "superadmin",
        passwordHash: await hashPassword(settings.pin),
        version: 1,
        mustChangePassword: true,
        createdAt: Date.now(),
      };
      await redis.hSetNX(
        keys.admins,
        account.username,
        JSON.stringify(account),
      );
    }
    // Strip only the legacy PIN. Concurrent settings changes take precedence.
    await redis.eval(
      `if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2]); return 1 end return 0`,
      {
        keys: [keys.settings],
        arguments: [
          raw,
          JSON.stringify({
            orgName: settings.orgName || "FaceGate",
            timeZone: settings.timeZone || "Asia/Kolkata",
          }),
        ],
      },
    );
  }
}

export function getSession(
  request: NextRequest,
  allowPasswordChange = false,
): Promise<AdminAccount> {
  return getSessionFromToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    allowPasswordChange,
  );
}

export async function getSessionFromToken(
  token: string | undefined,
  allowPasswordChange = false,
): Promise<AdminAccount> {
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new AdminError("Sign in to continue.");
  const redis = await getRedis();
  const raw = await redis.get(keys.sessionPrefix + tokenDigest(token));
  if (!raw) throw new AdminError("Your session expired. Sign in again.");
  const session = JSON.parse(raw) as { username: string; version: number };
  const accountRaw = await redis.hGet(keys.admins, session.username);
  if (!accountRaw) throw new AdminError("Your account is no longer available.");
  const account = JSON.parse(accountRaw) as AdminAccount;
  if (account.version !== session.version)
    throw new AdminError("Your password changed. Sign in again.");
  if (account.mustChangePassword && !allowPasswordChange)
    throw new AdminError(
      "Change your temporary password before continuing.",
      403,
    );
  return account;
}

export async function requireAdmin(
  request: NextRequest,
  role?: AdminRole,
  allowPasswordChange = false,
) {
  let account: AdminAccount | null = null;
  try {
    account = await getSession(request, allowPasswordChange);
    if (role === "superadmin" && account.role !== "superadmin")
      throw new AdminError("Super admin access is required.", 403);
    return account;
  } catch (error) {
    if (error instanceof AdminError)
      await audit(
        request,
        account,
        "access_denied",
        request.nextUrl.pathname,
        "failure",
      );
    throw error;
  }
}

export async function newSession(account: AdminAccount) {
  const token = randomBytes(32).toString("hex");
  const redis = await getRedis();
  await redis.set(
    keys.sessionPrefix + tokenDigest(token),
    JSON.stringify({ username: account.username, version: account.version }),
    { EX: SESSION_SECONDS },
  );
  return token;
}

export async function removeSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await (await getRedis()).del(keys.sessionPrefix + tokenDigest(token));
  }
}
