const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { typescriptLoader } = require("./load-typescript.cjs");
const { verifyPassword } = require("../lib/admin-password.cjs");

test(
  "startup seeds one hashed super admin and preserves existing accounts on restart",
  { skip: process.env.FACEGATE_TEST_REDIS !== "1", timeout: 30000 },
  async () => {
    require("@next/env").loadEnvConfig(process.cwd(), true);
    const before = {
      DEFAULT_ADMIN_USERNAME: process.env.DEFAULT_ADMIN_USERNAME,
      DEFAULT_ADMIN_PASSWORD: process.env.DEFAULT_ADMIN_PASSWORD,
      FACEGATE_REDIS_PREFIX: process.env.FACEGATE_REDIS_PREFIX,
    };
    const prefix = `facegate-startup-test:${randomUUID()}`;
    process.env.FACEGATE_REDIS_PREFIX = prefix;
    process.env.DEFAULT_ADMIN_USERNAME = "env-super-admin";
    process.env.DEFAULT_ADMIN_PASSWORD = "Startup-test-password!";
    const load = typescriptLoader();
    const { getRedis, redisKeys: keys } = load("lib/redis.ts");
    const { ensureDefaultSuperAdmin } = load("lib/admin-bootstrap.ts");
    const redis = await getRedis();
    try {
      const results = await Promise.all([
        ensureDefaultSuperAdmin(),
        ensureDefaultSuperAdmin(),
        ensureDefaultSuperAdmin(),
      ]);
      assert.equal(results.filter(Boolean).length, 1);
      const raw = await redis.hGet(keys.admins, "env-super-admin");
      const account = JSON.parse(raw);
      assert.equal(account.role, "superadmin");
      assert.equal(account.mustChangePassword, true);
      assert.equal(
        await verifyPassword("Startup-test-password!", account.passwordHash),
        true,
      );
      assert.equal(raw.includes("Startup-test-password!"), false);
      const events = (await redis.lRange(keys.audit, 0, 1999)).map((row) =>
        JSON.parse(row),
      );
      assert.equal(events.length, 1);
      assert.equal(events[0].action, "default_superadmin_created");
      assert.equal(events[0].target, "env-super-admin");
      assert.equal(
        JSON.stringify(events).includes("Startup-test-password!"),
        false,
      );
      process.env.DEFAULT_ADMIN_PASSWORD = "Changed-env-password!";
      assert.equal(await ensureDefaultSuperAdmin(), false);
      assert.equal(await redis.hGet(keys.admins, "env-super-admin"), raw);
      const changedAccount = JSON.stringify({
        ...account,
        version: 2,
        mustChangePassword: false,
      });
      await redis.hSet(keys.admins, "env-super-admin", changedAccount);
      assert.equal(await ensureDefaultSuperAdmin(), false);
      assert.equal(
        await redis.hGet(keys.admins, "env-super-admin"),
        changedAccount,
      );
      process.env.DEFAULT_ADMIN_USERNAME = "existing-admin";
      const regularAdmin = JSON.stringify({
        ...account,
        username: "existing-admin",
        role: "admin",
      });
      await redis.hSet(keys.admins, "existing-admin", regularAdmin);
      await assert.rejects(
        ensureDefaultSuperAdmin(),
        /non-super-admin account/,
      );
      assert.equal(
        await redis.hGet(keys.admins, "existing-admin"),
        regularAdmin,
      );
    } finally {
      for await (const batch of redis.scanIterator({
        MATCH: `${prefix}:*`,
        COUNT: 100,
      })) {
        if (batch.length) await redis.del(batch);
      }
      if (redis.isOpen) redis.destroy();
      delete globalThis.faceGateRedis;
      delete globalThis.faceGateRedisConnection;
      for (const [key, value] of Object.entries(before)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  },
);
