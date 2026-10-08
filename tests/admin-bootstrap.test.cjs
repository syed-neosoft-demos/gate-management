const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PHASE_PRODUCTION_BUILD } = require("next/constants");
const { typescriptLoader } = require("./load-typescript.cjs");

function restore(values) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("validates startup credentials and skips seeding when neither value is configured", async () => {
  const before = {
    DEFAULT_ADMIN_USERNAME: process.env.DEFAULT_ADMIN_USERNAME,
    DEFAULT_ADMIN_PASSWORD: process.env.DEFAULT_ADMIN_PASSWORD,
  };
  const { ensureDefaultSuperAdmin } = typescriptLoader()(
    "lib/admin-bootstrap.ts",
  );
  try {
    delete process.env.DEFAULT_ADMIN_USERNAME;
    delete process.env.DEFAULT_ADMIN_PASSWORD;
    assert.equal(await ensureDefaultSuperAdmin(), false);
    process.env.DEFAULT_ADMIN_USERNAME = "invalid username";
    process.env.DEFAULT_ADMIN_PASSWORD = "Long-enough-password";
    await assert.rejects(ensureDefaultSuperAdmin(), /DEFAULT_ADMIN_USERNAME/);
    process.env.DEFAULT_ADMIN_USERNAME = "super-admin";
    delete process.env.DEFAULT_ADMIN_PASSWORD;
    await assert.rejects(ensureDefaultSuperAdmin(), /DEFAULT_ADMIN_PASSWORD/);
    process.env.DEFAULT_ADMIN_PASSWORD = "short";
    await assert.rejects(ensureDefaultSuperAdmin(), /DEFAULT_ADMIN_PASSWORD/);
  } finally {
    restore(before);
  }
});

test("startup initializes only Node servers and never seeds during builds or Edge startup", async () => {
  const before = {
    NEXT_RUNTIME: process.env.NEXT_RUNTIME,
    NEXT_PHASE: process.env.NEXT_PHASE,
  };
  let calls = 0;
  const load = typescriptLoader({
    "@/lib/admin-bootstrap": {
      ensureDefaultSuperAdmin: async () => {
        calls++;
      },
    },
  });
  const { register } = load("instrumentation.ts");
  try {
    process.env.NEXT_RUNTIME = "edge";
    delete process.env.NEXT_PHASE;
    await register();
    assert.equal(calls, 0);
    process.env.NEXT_RUNTIME = "nodejs";
    process.env.NEXT_PHASE = PHASE_PRODUCTION_BUILD;
    await register();
    assert.equal(calls, 0);
    delete process.env.NEXT_PHASE;
    await register();
    assert.equal(calls, 1);
  } finally {
    restore(before);
  }
});
