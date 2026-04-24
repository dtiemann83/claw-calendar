import Database from "better-sqlite3";
export interface OpenDbOptions {
    /** Absolute file path, or ":memory:" for tests. Falls back to CHEF_DB env var, then ~/.openclaw/workspace/data/chef.sqlite */
    path?: string;
}
export declare function resolveDbPath(override?: string): string;
export declare function openDb(opts?: OpenDbOptions): Database.Database;
/**
 * Run every .sql file in migrations/ in filename order, idempotently.
 * Migrations use CREATE TABLE IF NOT EXISTS / INSERT OR IGNORE so re-running is safe.
 */
export declare function migrate(db: Database.Database): void;
//# sourceMappingURL=db.d.ts.map