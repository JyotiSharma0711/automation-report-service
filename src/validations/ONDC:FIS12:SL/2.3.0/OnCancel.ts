import { TestResult, Payload } from "../../../types/payload";
import { DomainValidators } from "../../shared/domainValidator";
import { saveFromElement } from "../../../utils/specLoader";
import { validateFormIdIfXinputPresent } from "../../shared/formValidations";

export default async function on_cancel(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId: string
): Promise<TestResult> {
  const result = await DomainValidators.trv10OnCancel(element, sessionID, flowId, actionId);

  // Validate form ID consistency if xinput is present
  try {
    const txnId = element?.jsonRequest?.context?.transaction_id as string | undefined;
    const message = element?.jsonRequest?.message;
    if (txnId && message) {
      await validateFormIdIfXinputPresent(message, sessionID, flowId, txnId, "on_cancel", result);
    }
  } catch (_) {}

  await saveFromElement(element, sessionID, flowId, "jsonRequest");
  return result;
}

