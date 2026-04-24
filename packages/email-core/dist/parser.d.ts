import type { EmailDomainsConfig, ParsedRecipient } from "./types.js";
/**
 * Parse an inbound `To:` string into the three fields Postie threads into its
 * envelope. Deterministic, pure, no I/O. Call with the Resend envelope `to`
 * when available; the raw `To:` header works too because display-name stripping
 * is handled here.
 */
export declare function parseRecipient(to: string, config: EmailDomainsConfig): ParsedRecipient;
//# sourceMappingURL=parser.d.ts.map