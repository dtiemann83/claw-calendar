import { DAVClient } from "tsdav";
import type { CalendarEvent, EventPatch } from "./types.js";
export interface CalendarClientOptions {
    calendarName: string;
    /** Override server URL (for tests) */
    serverUrl?: string;
    /** Override credentials resolver (for tests) */
    credentials?: {
        username: string;
        password: string;
    };
    /** Override DAVClient factory (for tests) */
    clientFactory?: () => DAVClient;
}
export declare class CalendarClient {
    private opts;
    private client;
    private calendar;
    private loggedIn;
    constructor(opts: CalendarClientOptions);
    private ensureCalendar;
    list(rangeStart?: Date, rangeEnd?: Date): Promise<CalendarEvent[]>;
    add(event: CalendarEvent): Promise<CalendarEvent>;
    update(uid: string, patch: EventPatch): Promise<CalendarEvent>;
    delete(uid: string): Promise<void>;
    ctag(): Promise<string>;
    private findByUid;
}
//# sourceMappingURL=caldav.d.ts.map