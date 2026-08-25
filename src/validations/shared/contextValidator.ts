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
// current payload SHOULD be, independent of what the payload itself claims — kept for any
// future check that legitimately needs it (see the L1 audit note below for why domain/version
// exact-match itself isn't implemented here). Threaded down from validationModule.ts's
// sessionDetails via checkPayload.ts.
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
    // pramaan-validation-parity skill — L1 AUDIT (Phase 1, run properly after the fact):
    // domain-exact-match, version-exact-match, and bap_id/bap_uri presence+format were
    // originally added here, ported from Pramaan's context.js. A Phase 1 read of
    // automation-specifications/config/validations/index.yaml for ONDC:FIS12 2.2.1 found all
    // of it already enforced at L1, under a `_RETURN_: &a1` block (SEARCH_CONTEXT) reused via
    // `*a1` across on_search/select/on_select/init/on_init/confirm/on_confirm/update/on_update —
    // i.e. every action in this domain's flows, not just search:
    //   - VALID_CONTEXT_DOMAIN   (enumList: [ONDC:FIS12])      -> duplicates domain-exact-match
    //   - VALID_CONTEXT_VERSION  (enumList: [2.2.1])            -> duplicates version-exact-match
    //   - REQUIRED_CONTEXT_BAP_ID / REQUIRED_CONTEXT_BAP_URI    -> duplicates bap presence
    //   - REGEX_CONTEXT_BAP_ID / REGEX_CONTEXT_BAP_URI          -> duplicates bap format
    // All three checks were removed rather than left as dead/duplicate code. bap_id/bap_uri
    // presence is still covered by 'context:required' above (it already checked presence, just
    // not format) — that part was never actually new.
    //
    // NOT found in the L1 file, so NOT removed:
    //   - anything cross-call (message_id uniqueness, timestamp monotonicity, bap/bpp identity
    //     stability across a flow) — L1 here is scoped one payload at a time, no flow history.
    //   - tag `display` field on BAP_TERMS/BPP_TERMS — zero matches for "display" in the file.
    //   - bpp_id/bpp_uri FORMAT (regex) — L1 has REQUIRED_CONTEXT_BPP_ID/URI (presence, with the
    //     same "not required on search" carve-out already matched below) but no
    //     REGEX_CONTEXT_BPP_ID/URI — so the presence check below is redundant with L1, but the
    //     format/regex check is not. Kept format-only.
    //
    // If this module gets reused for a domain that turns out NOT to have an equivalent L1 file
    // (see SKILL.md Phase 2b), domain/version-exact-match and bap format are legitimate checks
    // to bring back — that's what `expected: ExpectedContext` above is still kept for.
    {
      name: 'context:bpp-uri-format',
      run: (payload: any) => {
        const ctx = payload?.context;
        if (ctx?.action === 'search') return { valid: true, results: [] }; // bpp not known yet, and not required by L1 either
        const results: UnitResult[] = [];
        if (ctx?.bpp_id && !ID_RE.test(ctx.bpp_id)) results.push({ valid: false, description: `context.bpp_id must be a bare domain/hostname, found '${ctx.bpp_id}'`, code: 400 });
        if (ctx?.bpp_uri && !URI_RE.test(ctx.bpp_uri)) results.push({ valid: false, description: `context.bpp_uri must be a valid http(s) URI, found '${ctx.bpp_uri}'`, code: 400 });
        return results.length ? { valid: false, results } : { valid: true, results: [] };
      },
    },
  ];
}