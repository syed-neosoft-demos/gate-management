const { randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const derive = promisify(scrypt);

/** @param {string} password */
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt, 64);
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

/** @param {string} password @param {string} encoded */
async function verifyPassword(password, encoded) {
  const [algorithm, salt, expected] = encoded.split(":");
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/.test(salt || "") || !/^[a-f0-9]{128}$/.test(expected || "")) return false;
  const actual = await derive(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

function generatePassword() {
  return randomBytes(18).toString("base64url");
}
module.exports = { hashPassword, verifyPassword, generatePassword };
