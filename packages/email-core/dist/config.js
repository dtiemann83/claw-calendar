import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { EmailDomainsConfigSchema } from "./types.js";
const DEFAULT_CONFIG = {
    fallback: "general",
    routes: [],
};
/**
 * Load the `emailDomains` block from an openclaw.json file.
 *
 * Resolution order for the path argument:
 *   1. Explicit `path` parameter.
 *   2. `OPENCLAW_CONFIG` env var.
 *   3. `~/.openclaw/openclaw.json`.
 *
 * If the file exists but has no `emailDomains` key, a safe default is returned
 * (`fallback=general`, no routes) so the caller can treat missing config as
 * "everything is general."
 */
export function loadEmailDomainsConfig(path) {
    const resolved = path ?? process.env.OPENCLAW_CONFIG ?? join(homedir(), ".openclaw", "openclaw.json");
    const raw = readFileSync(resolved, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("emailDomains" in parsed)) {
        return DEFAULT_CONFIG;
    }
    const result = EmailDomainsConfigSchema.safeParse(parsed.emailDomains);
    if (!result.success) {
        throw new Error(`invalid emailDomains block in ${resolved}: ${result.error.message}`);
    }
    return result.data;
}
//# sourceMappingURL=config.js.map