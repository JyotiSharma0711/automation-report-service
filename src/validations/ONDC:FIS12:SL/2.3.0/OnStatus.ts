import { TestResult, Payload } from "../../../types/payload";
import { DomainValidators } from "../../shared/domainValidator";
import { saveFromElement } from "../../../utils/specLoader";
import { validateFormIdIfXinputPresent } from "../../shared/formValidations";

export default async function on_status(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId: string,
  usecaseId?: string
): Promise<TestResult> {
  const result = await DomainValidators.fis12OnStatus(element, sessionID, flowId, actionId, usecaseId);
  
  // Validate form ID consistency if xinput is present
  try {
    const txnId = element?.jsonRequest?.context?.transaction_id as string | undefined;
    const message = element?.jsonRequest?.message;
    if (txnId && message) {
      await validateFormIdIfXinputPresent(message, sessionID, flowId, txnId, "on_status", result);
    }
  } catch (_) {}
  
  await saveFromElement(element, sessionID, flowId, "jsonRequest");
  return result;
}

