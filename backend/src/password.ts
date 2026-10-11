import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const PREFIX = "scrypt$v1$";
const SALT_BYTES = 16;
const KEY_BYTES = 64;
// Version 1 fixes the work factors so stored hashes cannot request unbounded work.
const OPTIONS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, OPTIONS, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt);
  return `${PREFIX}${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  const match = /^scrypt\$v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(stored);
  if (!match) return false;
  const key = await deriveKey(password, Buffer.from(match[1], "hex"));
  return timingSafeEqual(key, Buffer.from(match[2], "hex"));
}
