import { expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/password";

it("salts passwords independently and verifies the full password", async () => {
  const password = "a-secure-password-123";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  expect(first).not.toBe(second);
  expect(first).not.toContain(password);
  expect(await verifyPassword(first, password)).toBe(true);
  expect(await verifyPassword(second, password)).toBe(true);
  expect(await verifyPassword(first, `${password}!`)).toBe(false);
});

it.each(["", "$argon2id$v=19$m=65536,t=3,p=1$salt$hash", "scrypt$v2$abc$def", "scrypt$v1$00$00", `scrypt$v1$${"0".repeat(32)}$${"z".repeat(128)}`])(
  "rejects unsupported or malformed hashes: %s", async stored => {
    expect(await verifyPassword(stored, "a-secure-password-123")).toBe(false);
  }
);
