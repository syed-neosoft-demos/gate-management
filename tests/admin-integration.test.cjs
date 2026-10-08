const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { NextRequest } = require("next/server");
const { typescriptLoader } = require("./load-typescript.cjs");
const { verifyPassword } = require("../lib/admin-password.cjs");

test(
  "Redis-backed admin authentication, role checks, reset revocation and access auditing",
  { skip: process.env.FACEGATE_TEST_REDIS !== "1", timeout: 30000 },
  async () => {
    require("@next/env").loadEnvConfig(process.cwd(), true);
    // Every write and cleanup uses a freshly generated namespace, never production keys.
    const prefix = `facegate-test:${randomUUID()}`;
    process.env.FACEGATE_REDIS_PREFIX = prefix;
    const load = typescriptLoader();
    const { getRedis, redisKeys: keys } = load("lib/redis.ts");
    const redis = await getRedis();
    const admin = load("app/api/admin/[action]/route.ts");
    const storage = load("app/api/storage/[resource]/route.ts");
    let pageToken;
    const pageLoad = typescriptLoader({
      react: { cache: (operation) => operation },
      "next/headers": {
        cookies: () => ({
          get: () => (pageToken ? { value: pageToken } : undefined),
        }),
      },
      "next/navigation": {
        redirect: (path) => {
          throw new Error(`Redirect:${path}`);
        },
      },
    });
    const { requireAdminPage, currentAdmin } = pageLoad(
      "lib/admin-page-auth.ts",
    );
    const pageSession = (cookie) => {
      pageToken = cookie ? cookie.slice(cookie.indexOf("=") + 1) : undefined;
    };
    const call = async (kind, action, body, cookie = "", method) => {
      const verb = method || (body === undefined ? "GET" : "POST");
      const request = new NextRequest(
        `http://localhost/api/${kind}/${action}`,
        {
          method: verb,
          headers: {
            "content-type": "application/json",
            cookie,
            origin: "http://localhost",
            "user-agent": "FaceGate integration test",
          },
          body:
            body === undefined || verb === "GET"
              ? undefined
              : JSON.stringify(body),
        },
      );
      const [name] = action.split("?");
      const route = kind === "admin" ? admin : storage;
      const response = await route[verb](request, {
        params: kind === "admin" ? { action: name } : { resource: name },
      });
      const data = await response.json();
      return {
        status: response.status,
        data,
        cookie: response.headers.get("set-cookie")?.split(";")[0] || cookie,
        setCookie: response.headers.get("set-cookie") || "",
      };
    };
    const superPassword = "Superadmin-test-password!";
    const adminPassword = "Admin-test-password!";
    const resetPassword = "Admin-reset-password!";
    try {
      assert.equal(await currentAdmin(), null);
      await assert.rejects(requireAdminPage(), /Redirect:\/admin\/login/);
      await redis.set(
        keys.settings,
        JSON.stringify({ orgName: "Test Org", pin: "4821" }),
      );
      const settings = await call("storage", "settings");
      assert.equal(settings.status, 200);
      assert.equal(settings.data.pin, undefined);
      assert.equal(settings.data.timeZone, "Asia/Kolkata");
      assert.equal(JSON.parse(await redis.get(keys.settings)).pin, undefined);
      const initial = JSON.parse(await redis.hGet(keys.admins, "superadmin"));
      assert.equal(await verifyPassword("4821", initial.passwordHash), true);
      assert.equal(
        (await call("storage", "reset", undefined, "", "DELETE")).status,
        401,
      );
      assert.equal(
        (
          await call("admin", "login", {
            username: "superadmin",
            password: "wrong",
          })
        ).status,
        401,
      );
      const firstLogin = await call("admin", "login", {
        username: "superadmin",
        password: "4821",
      });
      assert.equal(firstLogin.status, 200);
      assert.equal(firstLogin.data.user.mustChangePassword, true);
      pageSession(firstLogin.cookie);
      await assert.rejects(requireAdminPage(), /Redirect:\/admin\/login/);
      assert.match(firstLogin.setCookie, /HttpOnly/i);
      assert.match(firstLogin.setCookie, /SameSite=strict/i);
      assert.equal(
        (await call("admin", "accounts", undefined, firstLogin.cookie)).status,
        403,
      );
      const changed = await call(
        "admin",
        "password",
        { currentPassword: "4821", password: superPassword },
        firstLogin.cookie,
      );
      assert.equal(changed.status, 200);
      const superCookie = changed.cookie;
      pageSession(superCookie);
      assert.equal(
        (await requireAdminPage("superadmin")).username,
        "superadmin",
      );
      assert.notEqual(superCookie, firstLogin.cookie);
      assert.equal(
        (await call("admin", "session", undefined, firstLogin.cookie)).status,
        401,
      );
      const created = await call(
        "admin",
        "accounts",
        {
          username: "office-admin",
          name: "Office admin",
          role: "admin",
          generate: true,
        },
        superCookie,
      );
      assert.equal(created.status, 201);
      assert.equal(created.data.generatedPassword.length, 24);
      assert.equal(created.data.user.passwordHash, undefined);
      const temporary = created.data.generatedPassword;
      const adminLogin = await call("admin", "login", {
        username: "office-admin",
        password: temporary,
      });
      assert.equal(adminLogin.status, 200);
      const adminChange = await call(
        "admin",
        "password",
        { currentPassword: temporary, password: adminPassword },
        adminLogin.cookie,
      );
      assert.equal(adminChange.status, 200);
      const adminCookie = adminChange.cookie;
      pageSession(adminCookie);
      assert.equal((await requireAdminPage()).username, "office-admin");
      await assert.rejects(
        requireAdminPage("superadmin"),
        /Redirect:\/admin\/attendance/,
      );
      for (const action of ["accounts", "audit"])
        assert.equal(
          (await call("admin", action, undefined, adminCookie)).status,
          403,
        );
      assert.equal(
        (await call("storage", "reset", undefined, adminCookie, "DELETE"))
          .status,
        403,
      );
      assert.equal(
        (
          await call(
            "storage",
            "settings",
            { orgName: "Forbidden", timeZone: "UTC" },
            adminCookie,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await call(
            "admin",
            "accounts",
            {
              username: "another-admin",
              name: "Another",
              role: "admin",
              generate: true,
            },
            adminCookie,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await call(
            "admin",
            "password",
            { currentPassword: "incorrect", password: "another-long-password" },
            adminCookie,
          )
        ).status,
        400,
      );
      const employee = {
        id: "test-person",
        name: "Test Person",
        extId: "1",
        dept: "IT",
        descriptor: Array(128).fill(0.1),
        photo: "",
        createdAt: 1,
      };
      assert.equal(
        (
          await call("storage", "attendance", {
            id: "unknown-person-log",
            empId: "not-registered",
            name: "Unknown Person",
            type: "IN",
            ts: 1,
          })
        ).status,
        404,
      );
      assert.equal(await redis.hLen(keys.attendance), 0);
      assert.equal((await call("storage", "employees", employee)).status, 401);
      assert.equal(
        Boolean(await redis.hExists(keys.employees, employee.id)),
        false,
      );
      assert.equal(
        (await call("storage", "employees", employee, firstLogin.cookie))
          .status,
        401,
      );
      assert.equal(
        (await call("storage", "employees", employee, superCookie)).status,
        201,
      );
      assert.equal(
        (
          await call(
            "storage",
            "employees",
            { ...employee, id: "admin-person" },
            adminCookie,
          )
        ).status,
        201,
      );
      const snapshot = {
        employees: [{ ...employee, id: "import-person" }],
        logs: [],
      };
      assert.equal((await call("storage", "migrate", snapshot)).status, 401);
      assert.equal(
        Boolean(await redis.hExists(keys.employees, "import-person")),
        false,
      );
      assert.equal(
        (await call("storage", "migrate", snapshot, adminCookie)).status,
        200,
      );
      const attendance = await call("storage", "attendance", {
        id: "test-log",
        empId: employee.id,
        name: "Spoofed name",
        extId: "Spoofed ID",
        type: "IN",
        ts: 1,
      });
      assert.equal(attendance.status, 201);
      assert.equal(attendance.data.name, employee.name);
      assert.equal(attendance.data.extId, employee.extId);
      assert.equal(
        (
          await call(
            "storage",
            `employees?key=${employee.id}`,
            undefined,
            adminCookie,
            "DELETE",
          )
        ).status,
        200,
      );
      assert.equal(await redis.hLen(keys.attendance), 1);
      const reset = await call(
        "admin",
        "password",
        {
          username: "office-admin",
          currentPassword: superPassword,
          password: resetPassword,
        },
        superCookie,
      );
      assert.equal(reset.status, 200);
      pageSession(adminCookie);
      await assert.rejects(requireAdminPage(), /Redirect:\/admin\/login/);
      assert.equal(
        (await call("admin", "session", undefined, adminCookie)).status,
        401,
      );
      const resetLogin = await call("admin", "login", {
        username: "office-admin",
        password: resetPassword,
      });
      assert.equal(resetLogin.status, 200);
      assert.equal(resetLogin.data.user.mustChangePassword, true);
      for (let attempt = 0; attempt < 6; attempt++) {
        const failure = await call("admin", "login", {
          username: "missing-account",
          password: "wrong",
        });
        assert.equal(failure.status, attempt < 5 ? 401 : 429);
      }
      assert.equal(
        (
          await call(
            "storage",
            "settings",
            { orgName: "Updated Org", timeZone: "Europe/London" },
            superCookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (await call("storage", "reset", undefined, superCookie, "DELETE"))
          .status,
        200,
      );
      assert.equal(await redis.hLen(keys.attendance), 0);
      assert.equal(await redis.hLen(keys.admins), 2);
      const audit = await call("admin", "audit", undefined, superCookie);
      assert.equal(audit.status, 200);
      assert.ok(
        audit.data.some(
          (event) => event.action === "login_success" && event.role === "admin",
        ),
      );
      assert.ok(
        audit.data.some(
          (event) =>
            event.action === "login_success" && event.role === "superadmin",
        ),
      );
      assert.ok(
        audit.data.some(
          (event) =>
            event.action === "password_reset" &&
            event.target === "office-admin",
        ),
      );
      assert.ok(
        audit.data.some(
          (event) =>
            event.action === "login_failed" && event.target === "superadmin",
        ),
      );
      assert.ok(audit.data.some((event) => event.action === "data_reset"));
      assert.ok(
        audit.data.some(
          (event) =>
            event.action === "employee_registered" && event.role === "admin",
        ),
      );
      assert.ok(
        audit.data.some(
          (event) =>
            event.action === "employee_registered" &&
            event.role === "superadmin",
        ),
      );
      assert.ok(
        audit.data.some((event) => event.action === "legacy_data_imported"),
      );
      assert.ok(audit.data.some((event) => event.action === "login_throttled"));
      for (const password of [
        superPassword,
        adminPassword,
        resetPassword,
        temporary,
      ])
        assert.equal(JSON.stringify(audit.data).includes(password), false);
      const accounts = await call("admin", "accounts", undefined, superCookie);
      assert.equal(accounts.status, 200);
      assert.ok(
        accounts.data.every(
          (account) =>
            account.passwordHash === undefined && account.version === undefined,
        ),
      );
      const logout = await call("admin", "logout", {}, superCookie);
      assert.equal(logout.status, 200);
      assert.equal(
        (await call("admin", "session", undefined, superCookie)).status,
        401,
      );
      const csrfRequest = new NextRequest("http://localhost/api/admin/login", {
        method: "POST",
        headers: {
          origin: "http://other-site",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username: "superadmin",
          password: superPassword,
        }),
      });
      assert.equal(
        (await admin.POST(csrfRequest, { params: { action: "login" } })).status,
        403,
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
    }
  },
);
