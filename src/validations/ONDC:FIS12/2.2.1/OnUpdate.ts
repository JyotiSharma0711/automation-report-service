import { TestResult, Payload } from "../../../types/payload";
import { DomainValidators } from "../../shared/domainValidator";
import { saveFromElement } from "../../../utils/specLoader";
import { getActionData } from "../../../services/actionDataService";
import { PURCHASE_FINANCE_FLOWS } from "../../../utils/constants";
import { validateFormIdIfXinputPresent } from "../../shared/formValidations";

export default async function on_update(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId: string
): Promise<TestResult> {
  const result = await DomainValidators.fis12OnUpdate(element, sessionID, flowId, actionId);

  // Validate items consistency for purchase finance flows
  if (flowId && PURCHASE_FINANCE_FLOWS.includes(flowId)) {
    try {
      const txnId = element?.jsonRequest?.context?.transaction_id as string | undefined;
      if (txnId) {
        const selectData = await getActionData(sessionID, flowId, txnId, "select");
        const onSelectData = await getActionData(sessionID, flowId, txnId, "on_select");
        const onUpdateMessage = element?.jsonRequest?.message;
        const onUpdateItems = onUpdateMessage?.order?.items || [];
        
        // Get item IDs from select (preferred) or on_select
        const referenceItems: any[] = selectData?.order?.items || selectData?.items || onSelectData?.items || [];
        const referenceItemIds: string[] = referenceItems.map(it => it?.id).filter(Boolean) as string[];
        
        // Get item IDs from on_update
        const onUpdateItemIds = onUpdateItems.map((it: any) => it?.id).filter(Boolean) as string[];
        
        // Validate items consistency
        const missingItems = referenceItemIds.filter(id => !onUpdateItemIds.includes(id));

        if (missingItems.length === 0 && referenceItemIds.length > 0) {
          result.passed.push(`All items from select/on_select (${referenceItemIds.length}) are present in on_update`);
        } else {
          if (missingItems.length > 0) {
            result.failed.push(`Items from select/on_select missing in on_update: ${missingItems.join(", ")}`);
          }
        }
        
        // Validate form ID consistency if xinput is present
        await validateFormIdIfXinputPresent(onUpdateMessage, sessionID, flowId, txnId, "on_update", result);
      }
    } catch (error: any) {
      // Silently fail if validation cannot be performed
    }
  }

  await saveFromElement(element, sessionID, flowId, "jsonRequest");
  return result;
}

