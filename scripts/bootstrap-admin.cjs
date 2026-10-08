require("@next/env").loadEnvConfig(process.cwd(), true);
const { createClient } = require("redis");
const { hashPassword, generatePassword } = require("../lib/admin-password.cjs");
const { randomUUID } = require("node:crypto");

(async () => {
  if (!process.env.REDIS_URL) throw new Error("Set REDIS_URL in .env.local first.");
  const redis = createClient({ url: process.env.REDIS_URL, password: process.env.REDIS_PASSWORD || undefined, socket: { connectTimeout: 5000, reconnectStrategy: false } });
  redis.on("error", () => {});
  try {
    await redis.connect();
    const prefix = process.env.FACEGATE_REDIS_PREFIX || "facegate";
    const accountKey = `${prefix}:admins`;
    const raw = await redis.hGet(accountKey, "superadmin");
    if (raw && !process.argv.includes("--reset")) {
      console.log("The superadmin account already exists. Sign in with its current password; --reset explicitly resets it if you need recovery.");
      return;
    }
    const previous = raw ? JSON.parse(raw) : null;
    const password = generatePassword();
    const account = { username: "superadmin", name: "Super admin", role: "superadmin", passwordHash: await hashPassword(password), version: (previous?.version || 0) + 1, mustChangePassword: true, createdAt: previous?.createdAt || Date.now() };
    const changed = await redis.eval(`local old = redis.call('HGET', KEYS[1], ARGV[1]); if (old or '') ~= ARGV[2] then return 0 end; redis.call('HSET', KEYS[1], ARGV[1], ARGV[3]); return 1`, { keys: [accountKey], arguments: ["superadmin", raw || "", JSON.stringify(account)] });
    if (!changed) throw new Error("Account changed concurrently. Run the command again.");
    const event = { id: randomUUID(), ts: Date.now(), actor: "server-operator", role: "superadmin", action: raw ? "bootstrap_password_reset" : "bootstrap_account_created", target: "superadmin", outcome: "success", ip: "local", userAgent: "bootstrap CLI" };
    await redis.multi().lPush(`${prefix}:admin:audit`, JSON.stringify(event)).lTrim(`${prefix}:admin:audit`, 0, 1999).exec();
    console.log("Username: superadmin");
    console.log(`Temporary password (shown once): ${password}`);
    console.log("Sign in and change this password. Keep it private.");
  } finally { if (redis.isOpen) redis.destroy(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
