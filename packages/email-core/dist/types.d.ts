import { z } from "zod";
/** How subaddress (+<sub>) values are validated for a given route. */
export declare const SubAddressingSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    schema: z.ZodOptional<z.ZodEnum<{
        person: "person";
        free: "free";
    }>>;
    allowed: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type SubAddressing = z.infer<typeof SubAddressingSchema>;
/** One configured inbound address. */
export declare const EmailRouteSchema: z.ZodObject<{
    address: z.ZodString;
    domainTag: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    subAddressing: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        schema: z.ZodOptional<z.ZodEnum<{
            person: "person";
            free: "free";
        }>>;
        allowed: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type EmailRoute = z.infer<typeof EmailRouteSchema>;
/** Top-level `emailDomains` block in openclaw.json. */
export declare const EmailDomainsConfigSchema: z.ZodObject<{
    fallback: z.ZodString;
    routes: z.ZodArray<z.ZodObject<{
        address: z.ZodString;
        domainTag: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        subAddressing: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            schema: z.ZodOptional<z.ZodEnum<{
                person: "person";
                free: "free";
            }>>;
            allowed: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type EmailDomainsConfig = z.infer<typeof EmailDomainsConfigSchema>;
/** Output of parseRecipient — the three fields threaded into Postie's envelope. */
export interface ParsedRecipient {
    domainTag: string;
    subTag: string | null;
    subTagKnown: boolean;
    matchedAddress: string | null;
}
//# sourceMappingURL=types.d.ts.map