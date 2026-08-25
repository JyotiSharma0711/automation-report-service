import { TestResult, Payload } from "../../../types/payload";
import { DomainValidators } from "../../shared/domainValidator";
import { validateFIS12LoanQuote } from "../../shared/quoteValidations";
import { getActionData } from "../../../services/actionDataService";
import { validateFormIdIfXinputPresent } from "../../shared/formValidations";
import { saveFromElement } from "../../../utils/specLoader";
import { PURCHASE_FINANCE_FLOWS } from "../../../utils/constants";

export default async function on_select(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId: string,
  usecaseId?: string
): Promise<TestResult> {
  const result = await DomainValidators.fis12OnSelect(element, sessionID, flowId, actionId, usecaseId);

  try {
    const message = element?.jsonRequest?.message;
    // pramaan-validation-parity skill: the generic quote-arithmetic call that used to be here
    // (validateOrderQuote — breakup sums to price.value, ≤2 decimal places) now runs
    // universally for every domain via flowContinuityValidators.ts's checkFlowContinuity(),
    // called from checkPayload.ts before any domain file (this one included) is even reached —
    // see that file for the consolidated version, so it's not duplicated here. Kept/added: the
    // FIS12-specific loan-quote formula check (PRINCIPAL/INTEREST/EMI/PMT — see
    // quoteValidations.ts's validateFIS12LoanQuote doc comment), which existed in that file but
    // had no call site anywhere until now. Purchase-Finance-gated since FIS12 2.2.1 also covers
    // other usecases (e.g. Credit Card) whose quote.breakup won't have PRINCIPAL/INTEREST titles.
    if (message?.order?.quote && flowId && PURCHASE_FINANCE_FLOWS.includes(flowId)) {
      validateFIS12LoanQuote(message, result);
    }

    // Compare item ids and prices with prior SELECT request if available
    const txnId = element?.jsonRequest?.context?.transaction_id as string | undefined;
    if (txnId) {
      const selectData = await getActionData(sessionID,flowId, txnId, "select");
      const selItems: any[] = selectData?.order?.items || selectData?.items || [];
      const onSelItems: any[] = message?.order?.items || [];

      // Build price map from SELECT
      const selectPriceById = new Map<string, string>();
      const selectItemIds: string[] = [];
      for (const it of selItems) {
        if (it?.id) {
          selectItemIds.push(it.id);
          if (it?.price?.value !== undefined) {
            selectPriceById.set(it.id, String(it.price.value));
          }
        }
      }

      // Validate items consistency for purchase finance flows
      if (flowId && PURCHASE_FINANCE_FLOWS.includes(flowId)) {
        const onSelectItemIds = onSelItems.map(it => it?.id).filter(Boolean) as string[];
        const missingItems = selectItemIds.filter(id => !onSelectItemIds.includes(id));
        const extraItems = onSelectItemIds.filter(id => !selectItemIds.includes(id));
        
        if (missingItems.length === 0 && extraItems.length === 0 && selectItemIds.length > 0) {
          result.passed.push(`All items from select (${selectItemIds.length}) are present in on_select`);
        } else {
          if (missingItems.length > 0) {
            result.failed.push(`Items from select missing in on_select: ${missingItems.join(", ")}`);
          }
          if (extraItems.length > 0) {
            result.failed.push(`Extra items in on_select not present in select: ${extraItems.join(", ")}`);
          }
        }
        
        // Validate form ID consistency if xinput is present
        await validateFormIdIfXinputPresent(message, sessionID, flowId, txnId, "on_select", result);
      }

      const missingInSelect: string[] = [];
      const priceMismatches: Array<{ id: string; select: string; on_select: string }> = [];
      for (const it of onSelItems) {
        const id: string | undefined = it?.id;
        if (!id) continue;
        if (!selectPriceById.has(id)) {
          missingInSelect.push(id);
          continue;
        }
        const selPrice = parseFloat(selectPriceById.get(id) as string);
        const onSelPrice = it?.price?.value !== undefined ? parseFloat(String(it.price.value)) : NaN;
        if (!Number.isNaN(selPrice) && !Number.isNaN(onSelPrice)) {
          if (selPrice === onSelPrice) {
            result.passed.push(`Item '${id}' price matches SELECT`);
          } else {
            priceMismatches.push({ id, select: String(selPrice), on_select: String(onSelPrice) });
          }
        }
      }

      if (priceMismatches.length) {
        result.failed.push("Item price mismatches between SELECT and on_select");
        (result.response as any) = {
          ...(result.response || {}),
          on_select_vs_select: {
            ...(result.response as any)?.on_select_vs_select,
            priceMismatches,
          },
        };
      }
    }
  } catch (_) {}
  await saveFromElement(element,sessionID,flowId, "jsonRequest");
  return result;
}