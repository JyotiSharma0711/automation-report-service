import { TestResult, Payload } from "../../../types/payload";
import { DomainValidators } from "../../shared/domainValidator";
import { saveFromElement } from "../../../utils/specLoader";
import { getActionData } from "../../../services/actionDataService";
import { PURCHASE_FINANCE_FLOWS } from "../../../utils/constants";
import { validateFormIdIfXinputPresent } from "../../shared/formValidations";

export default async function on_search(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId: string
): Promise<TestResult> {
  const result = await DomainValidators.fis12OnSearch(element, sessionID, flowId, actionId);
  
  // Validate items consistency for purchase finance flows
  if (flowId && PURCHASE_FINANCE_FLOWS.includes(flowId)) {
    try {
      const txnId = element?.jsonRequest?.context?.transaction_id as string | undefined;
      if (txnId) {
        const searchData = await getActionData(sessionID, flowId, txnId, "search");
        const onSearchMessage = element?.jsonRequest?.message;
        
        // Get item IDs from search
        const searchItemIds: string[] = searchData?.items || [];
        
        // Get item IDs from on_search (from catalog.providers[].items[])
        const onSearchItemIds: string[] = [];
        if (onSearchMessage?.catalog?.providers) {
          for (const provider of onSearchMessage.catalog.providers) {
            if (provider.items && Array.isArray(provider.items)) {
              for (const item of provider.items) {
                if (item?.id) {
                  onSearchItemIds.push(item.id);
                }
              }
            }
          }
        }
        
        // Check if all search items exist in on_search
        const missingItems = searchItemIds.filter(id => !onSearchItemIds.includes(id));
        if (missingItems.length === 0 && searchItemIds.length > 0) {
          result.passed.push(`All items from search (${searchItemIds.length}) are present in on_search`);
        } else if (missingItems.length > 0) {
          result.failed.push(`Items from search missing in on_search: ${missingItems.join(", ")}`);
        }
        
        // Validate form ID consistency if xinput is present
        await validateFormIdIfXinputPresent(onSearchMessage, sessionID, flowId, txnId, "on_search", result);
      }
    } catch (error: any) {
      // Silently fail if validation cannot be performed
    }
  }
  
  await saveFromElement(element,sessionID,flowId, "jsonRequest");
  return result;
}