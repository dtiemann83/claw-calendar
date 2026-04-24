import { type EmailDomainsConfig } from "./types.js";
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
export declare function loadEmailDomainsConfig(path?: string): EmailDomainsConfig;
//# sourceMappingURL=config.d.ts.map