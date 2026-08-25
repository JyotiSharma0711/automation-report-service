import { TestResult, Payload } from "../../../types/payload";
import { DomainValidators } from "../../shared/domainValidator";
// pramaan-validation-parity skill: validateFIS12LoanQuote import removed 2026-08-25 — the call
// site below it was disabled at the user's request (see the doc comment further down). Re-add
// `import { validateFIS12LoanQuote } from "../../shared/quoteValidations";` if re-enabling it.
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
    // (validateOrderQuote — breakup sums to price.value) now runs universally for every domain
    // via flowContinuityValidators.ts's checkFlowContinuity(), called from checkPayload.ts
    // before any domain file (this one included) is even reached — see that file. The
    // FIS12-specific loan-quote formula check (validateFIS12LoanQuote — PRINCIPAL/INTEREST/EMI)
    // that was wired in here was disabled again 2026-08-25 at the user's explicit request: quote
    // validation kept to just the one common breakup-total check, not domain-specific ones, for
    // now. `validateFIS12LoanQuote` itself is untouched in quoteValidations.ts — re-add the
    // import and this block to re-enable it for Purchase Finance specifically.

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