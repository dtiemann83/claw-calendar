import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { profiles } from "./schema";
import path from "path";
import os from "os";
import fs from "fs";

// Database lives at ~/Library/Application Support/claw-calendar/family.db on macOS
// or at DATABASE_PATH env var if set (useful for tests)
function getDbPath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  const appSupport = path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "claw-calendar"
  );
  fs.mkdirSync(appSupport, { recursive: true });
  return path.join(appSupport, "family.db");
}

// Singleton DB connection
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const sqlite = new Database(getDbPath());
    sqlite.pragma("journal_mode = WAL");
    _db = drizzle(sqlite, { schema: { profiles } });
    // Run migrations inline (create tables if not exist)
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#3b82f6',
        avatar_url TEXT,
        created_at INTEGER NOT NULL
      )
    `);
  }
  return _db;
}

export { profiles };
