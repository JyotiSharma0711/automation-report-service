import { TestResult, Payload } from "../../../types/payload";
import { DomainValidators } from "../../shared/domainValidator";
import { saveFromElement } from "../../../utils/specLoader";
import { getActionData } from "../../../services/actionDataService";
import { validateFormIdIfXinputPresent } from "../../shared/formValidations";

export default async function select(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId: string,
  usecaseId?: string
): Promise<TestResult> {
  // Log all received parameters to debug
  const result = await DomainValidators.fis12Select(element, sessionID, flowId, actionId, usecaseId);
  try {
    const txnId = element?.jsonRequest?.context?.transaction_id as string | undefined;
    if (txnId) {
      const onSearchData = await getActionData(sessionID,flowId, txnId, "on_search");
      (result.response as any) = { ...(result.response || {}), on_search: onSearchData };

      // pramaan-validation-parity skill: the provider/item/fulfillment-vs-ON_SEARCH check that
      // used to run here (compareSelectVsOnSearch, in actionDataService.ts) had a real bug —
      // it treated `onSearch.providers` as a single object when reading items/fulfillments
      // (`onSearch?.providers?.items`) even though it correctly handled `providers` as an array
      // for the provider-id check two lines above it. On a real catalog (`providers` is always
      // an array), that made every select falsely report ALL its items/fulfillments as "missing
      // in ON_SEARCH". Replaced by the fixed, generic version in
      // flowContinuityValidators.ts's checkOrderTrailAgainstOnSearch() — runs universally via
      // checkPayload.ts, for every domain and every action with a message.order, not just
      // FIS12's select. `compareSelectVsOnSearch` itself is left in actionDataService.ts,
      // unused, in case something else still references it — not deleted outright.

      // Validate form ID consistency if xinput is present
      await validateFormIdIfXinputPresent(element?.jsonRequest?.message, sessionID, flowId, txnId, "select", result);
    }
  } catch (_) {}
  await saveFromElement(element,sessionID,flowId, "jsonRequest");
  return result;
}