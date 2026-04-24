import Database from "better-sqlite3";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Migrations live next to this file (in dist/ after build, in src/ during dev).
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");
export function resolveDbPath(override) {
    if (override)
        return override;
    const envPath = process.env.CHEF_DB;
    if (envPath)
        return envPath;
    const home = process.env.HOME || "/tmp";
    return join(home, ".openclaw", "workspace", "data", "chef.sqlite");
}
export function openDb(opts = {}) {
    const path = resolveDbPath(opts.path);
    if (path !== ":memory:") {
        mkdirSync(dirname(path), { recursive: true });
    }
    const db = new Database(path);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    return db;
}
/**
 * Run every .sql file in migrations/ in filename order, idempotently.
 * Migrations use CREATE TABLE IF NOT EXISTS / INSERT OR IGNORE so re-running is safe.
 */
export function migrate(db) {
    if (!existsSync(MIGRATIONS_DIR)) {
        throw new Error(`migrations dir missing: ${MIGRATIONS_DIR}`);
    }
    const files = readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort();
    for (const f of files) {
        const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf-8");
        db.exec(sql);
    }
}
//# sourceMappingURL=db.js.map