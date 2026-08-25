import { Payload, TestResult } from "../../types/payload";

// pramaan-validation-parity skill: cross-call continuity checks, ported from Pramaan's
// bussinessTests/commonBussiness.js (contextBussinessTests). This is the layer report-service
// never had — checkPayload() only ever saw one payload at a time, so nothing could compare
// "this call" against "the flow so far". These checks are protocol-level (true for every
// ONDC beckn domain by definition of the beckn context object), so they're written once here
// and wired into checkPayload.ts for every domain, not duplicated per domain.
//
// `priorPayloadsInFlow` is everything already processed for this flow, in chronological order,
// BEFORE the current element. It does not include the current element itself.

function ctx(p: Payload | undefined | null): any {
  return p?.jsonRequest?.context;
}

// pramaan-validation-parity skill: a message_id-uniqueness-across-the-flow check (ported from
// commonBussiness.js's messageIdsMap) was here and was removed at the user's explicit request —
// not needed for this domain. If it's ever wanted back, the pattern is the same shape as
// checkBapIdentityStability below: compare `ctx(element)?.message_id` against every prior
// payload's, using `priorPayloadsInFlow`.

/**
 * timestamp must strictly increase from one request to the next.
 * Ported from commonBussiness.js's timestamp-monotonicity check (compares against the
 * immediately preceding logged request, not the whole history).
 */
function checkTimestampMonotonicity(element: Payload, priorPayloadsInFlow: Payload[]): { passed: string[]; failed: string[] } {
  const passed: string[] = [];
  const failed: string[] = [];
  if (priorPayloadsInFlow.length === 0) return { passed, failed }; // first call in the flow, nothing to compare
  const currentTs = ctx(element)?.timestamp;
  const previousTs = ctx(priorPayloadsInFlow[priorPayloadsInFlow.length - 1])?.timestamp;
  if (!currentTs || !previousTs) return { passed, failed }; // presence is contextValidators' job
  const currentMs = Date.parse(currentTs);
  const previousMs = Date.parse(previousTs);
  if (Number.isNaN(currentMs) || Number.isNaN(previousMs)) return { passed, failed }; // format is contextValidators' job
  if (currentMs <= previousMs) {
    failed.push(`context.timestamp '${currentTs}' must be strictly after the previous call's timestamp '${previousTs}'`);
  } else {
    passed.push(`context.timestamp '${currentTs}' is strictly after the previous call's timestamp`);
  }
  return { passed, failed };
}

/**
 * bap_id/bap_uri must stay identical to what the flow's first call declared.
 * Ported from commonBussiness.js (compares against logs[0], the flow's first entry).
 */
function checkBapIdentityStability(element: Payload, priorPayloadsInFlow: Payload[]): { passed: string[]; failed: string[] } {
  const passed: string[] = [];
  const failed: string[] = [];
  if (priorPayloadsInFlow.length === 0) return { passed, failed };
  const first = ctx(priorPayloadsInFlow[0]);
  const current = ctx(element);
  if (first?.bap_id && current?.bap_id && current.bap_id !== first.bap_id) {
    failed.push(`context.bap_id changed mid-flow: was '${first.bap_id}' at the first call, now '${current.bap_id}'`);
  } else if (first?.bap_id) {
    passed.push(`context.bap_id is stable since the first call ('${first.bap_id}')`);
  }
  if (first?.bap_uri && current?.bap_uri && current.bap_uri !== first.bap_uri) {
    failed.push(`context.bap_uri changed mid-flow: was '${first.bap_uri}' at the first call, now '${current.bap_uri}'`);
  } else if (first?.bap_uri) {
    passed.push(`context.bap_uri is stable since the first call`);
  }
  return { passed, failed };
}

/**
 * bpp_id/bpp_uri must stay identical to what the flow's first on_search response declared,
 * for every call from the second one onward (search doesn't know the bpp yet).
 * Ported from commonBussiness.js (compares against logs[1], the flow's first response).
 */
function checkBppIdentityStability(element: Payload, priorPayloadsInFlow: Payload[]): { passed: string[]; failed: string[] } {
  const passed: string[] = [];
  const failed: string[] = [];
  const current = ctx(element);
  if (current?.action === 'search') return { passed, failed }; // bpp not known yet
  const firstOnSearch = priorPayloadsInFlow
    .map((p) => ctx(p))
    .find((c) => c?.action === 'on_search');
  if (!firstOnSearch) return { passed, failed }; // no on_search seen yet in this flow, nothing to compare
  if (firstOnSearch?.bpp_id && current?.bpp_id && current.bpp_id !== firstOnSearch.bpp_id) {
    failed.push(`context.bpp_id changed mid-flow: was '${firstOnSearch.bpp_id}' at the first on_search, now '${current.bpp_id}'`);
  } else if (firstOnSearch?.bpp_id) {
    passed.push(`context.bpp_id is stable since the first on_search ('${firstOnSearch.bpp_id}')`);
  }
  if (firstOnSearch?.bpp_uri && current?.bpp_uri && current.bpp_uri !== firstOnSearch.bpp_uri) {
    failed.push(`context.bpp_uri changed mid-flow: was '${firstOnSearch.bpp_uri}' at the first on_search, now '${current.bpp_uri}'`);
  } else if (firstOnSearch?.bpp_uri) {
    passed.push(`context.bpp_uri is stable since the first on_search`);
  }
  return { passed, failed };
}

/**
 * Runs all universal cross-call continuity checks for one payload against everything already
 * processed for its flow. Called from checkPayload.ts right after the existing
 * runValidations(contextValidators(), ...) call — every domain gets this for free.
 */
export function checkFlowContinuity(element: Payload, priorPayloadsInFlow: Payload[]): TestResult {
  const checks = [
    checkTimestampMonotonicity,
    checkBapIdentityStability,
    checkBppIdentityStability,
  ];
  const passed: string[] = [];
  const failed: string[] = [];
  for (const check of checks) {
    const result = check(element, priorPayloadsInFlow);
    passed.push(...result.passed);
    failed.push(...result.failed);
  }
  return { response: {}, passed, failed };
}
