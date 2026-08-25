import { TestResult, Payload } from "../../../types/payload";
import { DomainValidators } from "../../shared/domainValidator";
import { saveFromElement } from "../../../utils/specLoader";
import { getActionData } from "../../../services/actionDataService";
import { validateFormIdIfXinputPresent } from "../../shared/formValidations";
import {
  validateInsuranceContext,
  validateInsuranceOrderStatus,
  validateInsuranceDocuments,
} from "../../shared/healthInsuranceValidations";

export default async function on_update(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId: string
): Promise<TestResult> {
  const result = await DomainValidators.fis13OnUpdate(element, sessionID, flowId, actionId);

  try {
    const context = element?.jsonRequest?.context;
    const message = element?.jsonRequest?.message;

    // Health insurance domain checks
    validateInsuranceContext(context, result, flowId);
    if (message) validateInsuranceOrderStatus(message, result, flowId);
    if (message) validateInsuranceDocuments(message, result, flowId);

    const txnId = context?.transaction_id as string | undefined;
    if (txnId) {
      // Item consistency vs select/on_select
      const selectData = await getActionData(sessionID, flowId, txnId, "select");
      const onSelectData = await getActionData(sessionID, flowId, txnId, "on_select");
      const referenceItems: any[] = selectData?.order?.items || selectData?.items || onSelectData?.items || [];
      const refIds = referenceItems.map((it: any) => it?.id).filter(Boolean) as string[];
      const onUpdateItems: any[] = message?.order?.items || [];
      const onUpdIds = onUpdateItems.map((it: any) => it?.id).filter(Boolean) as string[];

      if (refIds.length > 0) {
        const missing = refIds.filter(id => !onUpdIds.includes(id));
        if (missing.length === 0) {
          result.passed.push(`All items from select/on_select (${refIds.length}) are present in on_update`);
        } else {
          if (missing.length) result.failed.push(`Items from select/on_select missing in on_update: ${missing.join(", ")}`);
        }
      }

      // Form ID (xinput) check
      await validateFormIdIfXinputPresent(message, sessionID, flowId, txnId, "on_update", result);
    }
  } catch (_) { }

  await saveFromElement(element, sessionID, flowId, "jsonRequest");
  return result;
}
