import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { openDb } from "./db";
import { resetPassword } from "./auth";

async function main() {
  const username = process.argv[2];
  if (!username) throw new Error("Usage: npm run auth:reset-password -- <username>");
  if (!process.stdin.isTTY) throw new Error("Run this command in an interactive terminal");
  let muted = false;
  const output = new Writable({ write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  } });
  const prompt = createInterface({ input: process.stdin, output, terminal: true });
  prompt.on("SIGINT", () => { prompt.close(); process.stdout.write("\n"); process.exit(130); });
  let password: string;
  try {
    process.stdout.write("New password (12-256 characters, hidden): ");
    muted = true;
    password = await prompt.question("");
    process.stdout.write("\nConfirm password: ");
    const confirmation = await prompt.question("");
    if (confirmation !== password) throw new Error("Passwords do not match");
  } finally {
    prompt.close();
    process.stdout.write("\n");
  }
  const db = openDb();
  try {
    await resetPassword(db, username, password);
    console.log("Password updated. Account and study data preserved.");
  } finally { db.close(); }
}

void main().catch(error => { console.error(error.message); process.exitCode = 1; });
