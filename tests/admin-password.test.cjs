const { test } = require("node:test");
const assert = require("node:assert/strict");
const { hashPassword, verifyPassword, generatePassword } = require("../lib/admin-password.cjs");

test("password hashes use unique salts and reject incorrect or malformed credentials", async () => {
  const password = "a-long-test-password";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong-password", first), false);
  assert.equal(await verifyPassword(password, "broken"), false);
});

test("generated passwords are long and unique", () => {
  const passwords = Array.from({ length: 30 }, generatePassword);
  assert.equal(new Set(passwords).size, passwords.length);
  assert.ok(passwords.every((password) => password.length === 24));
});
