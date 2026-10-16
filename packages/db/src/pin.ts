import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// A 4-digit PIN has only 10,000 values, so the hash alone can't protect it:
// the real protection is the login lockout. scrypt is built into Node (no native module to compile on cPanel).
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 32;

function derive(pin: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/** Returns `scrypt$N$r$p$salt$key` (base64 salt and key). */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(pin, salt, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, key] = stored.split("$");
  if (algo !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await derive(pin, Buffer.from(salt, "base64"), { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
