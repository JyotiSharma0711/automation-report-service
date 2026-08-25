import { Validation, ValidationResult, UnitResult } from "../../types/payload";

function isIsoTimestamp(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  // 2024-11-23T05:42:20.651Z
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);
}

// bap_id/bpp_id: a bare domain/hostname, no scheme. bap_uri/bpp_uri: a full URI.
// Same shape Pramaan's per-domain context.js files assert (e.g. creditBuyerNPTest/v2.2.0/context.js).
const ID_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const URI_RE = /^https?:\/\/[^\s]+$/;

// pramaan-validation-parity skill: what report-service's session/domainConfig knows the
// current payload SHOULD be, independent of what the payload itself claims. Without this,
// there is no way to write a real domain/version exact-match check — checkPayload.ts's own
// `domain` argument is read straight off this same payload's context, so comparing against it
// is a tautology. Threaded down from validationModule.ts's sessionDetails.
export interface ExpectedContext {
  domain?: string;
  version?: string;
}

export function contextValidators(expected?: ExpectedContext): Validation[] {
  return [
    {
      name: 'context:required',
      run: (payload: any) => {
        const ctx = payload?.context;
        const missing: string[] = [];
        if (!ctx) missing.push('context');
        if (!ctx?.domain) missing.push('context.domain');
        if (!ctx?.action) missing.push('context.action');
        // Accept either version (2.x) or core_version (1.x)
        if (!ctx?.version && !ctx?.core_version) missing.push('context.version|core_version');
        if (!ctx?.message_id) missing.push('context.message_id');
        if (!ctx?.transaction_id) missing.push('context.transaction_id');
        if (!ctx?.timestamp) missing.push('context.timestamp');
        return missing.length
          ? { valid: false, results: missing.map(f => ({ valid: false, description: `${f} is required`, code: 400 })) }
          : { valid: true, results: [] };
      },
    },
    {
      name: 'context:timestamp-format',
      run: (payload: any) => {
        const ts = payload?.context?.timestamp;
        if (ts == null) return { valid: true, results: [] };
        return isIsoTimestamp(ts)
          ? { valid: true, results: [] }
          : { valid: false, results: [{ valid: false, description: 'context.timestamp must be ISO-8601 with milliseconds and Z', code: 400 }] };
      },
    },
    {
      name: 'context:country-city-required',
      run: (payload: any) => {
        const ctx = payload?.context;
        const country = ctx?.country ?? ctx?.location?.country?.code;
        const city = ctx?.city ?? ctx?.location?.city?.code;
        const missing: string[] = [];
        if (!country) missing.push('context.country|location.country.code');

        // City is optional for TRV11 master search (search without bpp_id)
        // and GPS-based search where city may not be provided.
        // Also optional for TRV11 on_search responding to master search.
        const isTrv11 = ctx?.domain === 'ONDC:TRV11';
        const action = ctx?.action;
        const isSearchOrOnSearch = action === 'search' || action === 'on_search';
        const hasBppId = !!ctx?.bpp_id;
        const cityOptional = isTrv11 && (
          (action === 'search' && !hasBppId) ||  // master/GPS search (no bpp_id)
          (action === 'on_search')                // on_search may or may not have city
        );

        if (!city && !cityOptional) missing.push('context.city|location.city.code');
        return missing.length
          ? { valid: false, results: missing.map(f => ({ valid: false, description: `${f} is required`, code: 400 })) }
          : { valid: true, results: [] };
      },
    },
    // pramaan-validation-parity skill: ported from Pramaan's per-domain context.js files
    // (e.g. creditBuyerNPTest/v2.2.0/context.js ONDC:FIS12_PURCHASE_FINANCE_context_test_02/03)
    // — exact domain/version match, not just presence. Only runs when the caller (checkPayload)
    // actually has an independently-sourced expected domain/version to compare against; silently
    // skipped otherwise rather than guessing, same policy as the existing checks above.
    {
      name: 'context:domain-exact-match',
      run: (payload: any) => {
        if (!expected?.domain) return { valid: true, results: [] };
        const actual = payload?.context?.domain;
        return actual === expected.domain
          ? { valid: true, results: [] }
          : { valid: false, results: [{ valid: false, description: `context.domain must be '${expected.domain}', found '${actual}'`, code: 400 }] };
      },
    },
    {
      name: 'context:version-exact-match',
      run: (payload: any) => {
        if (!expected?.version) return { valid: true, results: [] };
        const actual = payload?.context?.version ?? payload?.context?.core_version;
        return actual === expected.version
          ? { valid: true, results: [] }
          : { valid: false, results: [{ valid: false, description: `context.version|core_version must be '${expected.version}', found '${actual}'`, code: 400 }] };
      },
    },
    // pramaan-validation-parity skill: ported from Pramaan's per-domain context.js files —
    // bap_id/bap_uri format is checked on every action; bpp_id/bpp_uri only from the second
    // call onward (search doesn't know the bpp yet), matching Pramaan's own convention.
    {
      name: 'context:bap-id-uri-format',
      run: (payload: any) => {
        const ctx = payload?.context;
        const results: UnitResult[] = [];
        if (!ctx?.bap_id) results.push({ valid: false, description: 'context.bap_id is required', code: 400 });
        else if (!ID_RE.test(ctx.bap_id)) results.push({ valid: false, description: `context.bap_id must be a bare domain/hostname, found '${ctx.bap_id}'`, code: 400 });
        if (!ctx?.bap_uri) results.push({ valid: false, description: 'context.bap_uri is required', code: 400 });
        else if (!URI_RE.test(ctx.bap_uri)) results.push({ valid: false, description: `context.bap_uri must be a valid http(s) URI, found '${ctx.bap_uri}'`, code: 400 });
        return results.length ? { valid: false, results } : { valid: true, results: [] };
      },
    },
    {
      name: 'context:bpp-id-uri-format',
      run: (payload: any) => {
        const ctx = payload?.context;
        if (ctx?.action === 'search') return { valid: true, results: [] }; // bpp not known yet
        const results: UnitResult[] = [];
        if (!ctx?.bpp_id) results.push({ valid: false, description: 'context.bpp_id is required from the second call onward', code: 400 });
        else if (!ID_RE.test(ctx.bpp_id)) results.push({ valid: false, description: `context.bpp_id must be a bare domain/hostname, found '${ctx.bpp_id}'`, code: 400 });
        if (!ctx?.bpp_uri) results.push({ valid: false, description: 'context.bpp_uri is required from the second call onward', code: 400 });
        else if (!URI_RE.test(ctx.bpp_uri)) results.push({ valid: false, description: `context.bpp_uri must be a valid http(s) URI, found '${ctx.bpp_uri}'`, code: 400 });
        return results.length ? { valid: false, results } : { valid: true, results: [] };
      },
    },
  ];
}