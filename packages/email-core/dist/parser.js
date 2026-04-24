/**
 * Parse an inbound `To:` string into the three fields Postie threads into its
 * envelope. Deterministic, pure, no I/O. Call with the Resend envelope `to`
 * when available; the raw `To:` header works too because display-name stripping
 * is handled here.
 */
export function parseRecipient(to, config) {
    const addresses = extractAddresses(to);
    // First, try to match any address against a configured route.
    for (const addr of addresses) {
        const match = matchRoute(addr, config.routes);
        if (match) {
            const { route, base, sub } = match;
            const { subTag, subTagKnown } = resolveSubTag(sub, route);
            return {
                domainTag: route.domainTag,
                subTag,
                subTagKnown,
                matchedAddress: route.address.toLowerCase(),
            };
        }
    }
    // No configured route matched → fallback.
    return {
        domainTag: config.fallback,
        subTag: null,
        subTagKnown: true,
        matchedAddress: null,
    };
}
/**
 * Pull bare email addresses out of a `To:`-style string that may include
 * display names, multiple addresses, or angle brackets.
 *
 * Examples:
 *   "School <school+james@tiemannfamily.us>"           → ["school+james@tiemannfamily.us"]
 *   "a@x.com, B <b@y.com>"                             → ["a@x.com", "b@y.com"]
 */
function extractAddresses(to) {
    const out = [];
    // Angle-bracketed addresses first.
    const angled = to.match(/<([^>]+)>/g);
    if (angled) {
        for (const a of angled)
            out.push(a.slice(1, -1).trim());
    }
    // Then comma-split fallback for bare addresses without angle brackets.
    for (const chunk of to.split(",")) {
        const cleaned = chunk.replace(/<[^>]*>/g, "").trim();
        if (cleaned && cleaned.includes("@") && !cleaned.includes(" ")) {
            out.push(cleaned);
        }
    }
    // Dedup preserving first-seen order.
    return [...new Set(out.map(s => s.trim()).filter(s => s.length > 0))];
}
/**
 * Try to match a single email address against any configured route.
 * Matching is case-insensitive on (base, domain); subaddress is preserved.
 */
function matchRoute(address, routes) {
    const atIdx = address.lastIndexOf("@");
    if (atIdx < 0)
        return null;
    const local = address.slice(0, atIdx);
    const domain = address.slice(atIdx + 1).toLowerCase();
    const plusIdx = local.indexOf("+");
    const base = (plusIdx >= 0 ? local.slice(0, plusIdx) : local).toLowerCase();
    const subRaw = plusIdx >= 0 ? local.slice(plusIdx + 1) : "";
    const sub = subRaw.length > 0 ? subRaw.toLowerCase() : null;
    for (const route of routes) {
        const [rBase, rDomain] = splitAtSign(route.address);
        if (rBase.toLowerCase() === base && rDomain.toLowerCase() === domain) {
            return { route, base, sub };
        }
    }
    return null;
}
function splitAtSign(address) {
    const i = address.lastIndexOf("@");
    return i < 0 ? [address, ""] : [address.slice(0, i), address.slice(i + 1)];
}
/**
 * Apply a route's subAddressing rules to a parsed `sub`.
 * Returns the tag to emit and whether it was recognized.
 */
function resolveSubTag(sub, route) {
    const sa = route.subAddressing;
    if (!sub || !sa?.enabled)
        return { subTag: null, subTagKnown: true };
    if (sa.schema === "person") {
        const allowed = (sa.allowed ?? []).map(s => s.toLowerCase());
        return { subTag: sub, subTagKnown: allowed.includes(sub) };
    }
    // "free" or unspecified: accept anything non-empty.
    return { subTag: sub, subTagKnown: true };
}
//# sourceMappingURL=parser.js.map