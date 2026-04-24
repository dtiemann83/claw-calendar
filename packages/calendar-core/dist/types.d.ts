import { z } from "zod";
export declare const CalendarEventSchema: z.ZodObject<{
    uid: z.ZodString;
    summary: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    start: z.ZodString;
    end: z.ZodString;
    allDay: z.ZodDefault<z.ZodBoolean>;
    href: z.ZodOptional<z.ZodString>;
    etag: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export declare const EventPatchSchema: z.ZodObject<{
    summary: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    location: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    start: z.ZodOptional<z.ZodString>;
    end: z.ZodOptional<z.ZodString>;
    allDay: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, z.core.$strip>;
export type EventPatch = z.infer<typeof EventPatchSchema>;
//# sourceMappingURL=types.d.ts.map