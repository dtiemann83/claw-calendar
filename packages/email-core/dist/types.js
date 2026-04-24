import { z } from "zod";
/** How subaddress (+<sub>) values are validated for a given route. */
export const SubAddressingSchema = z.object({
    enabled: z.boolean().default(false),
    /**
     * "person" — `sub` must match one of `allowed` (case-insensitive).
     * "free"   — any non-empty string is accepted; no validation.
     */
    schema: z.enum(["person", "free"]).optional(),
    allowed: z.array(z.string()).optional(),
});
/** One configured inbound address. */
export const EmailRouteSchema = z.object({
    /** Full address, e.g. "school@tiemannfamily.us". Matched case-insensitively. */
    address: z.string().min(3),
    /** Short deterministic tag threaded through the handoff, e.g. "school". */
    domainTag: z.string().min(1),
    description: z.string().optional(),
    subAddressing: SubAddressingSchema.optional(),
});
/** Top-level `emailDomains` block in openclaw.json. */
export const EmailDomainsConfigSchema = z.object({
    /** Domain tag to use when no route matches (e.g. "general"). */
    fallback: z.string().min(1),
    routes: z.array(EmailRouteSchema),
});
//# sourceMappingURL=types.js.map