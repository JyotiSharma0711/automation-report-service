import { TestResult, Payload } from "../../../types/payload";
import { DomainValidators } from "../../shared/domainValidator";
import { validateFIS12LoanQuote } from "../../shared/quoteValidations";
import { getActionData } from "../../../services/actionDataService";
import { validateErrorResponse } from "../../shared/validationFactory";
import { validateFormIdIfXinputPresent } from "../../shared/formValidations";
import { saveFromElement } from "../../../utils/specLoader";
import { PURCHASE_FINANCE_FLOWS } from "../../../utils/constants";

export default async function on_confirm(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId: string,
  usecaseId?: string
): Promise<TestResult> {
  // For error response scenarios (like on_confirm_driver_not_found), validate error first

  // For normal on_confirm, use domain validator
  const result = await DomainValidators.fis12OnConfirm(element, sessionID, flowId, actionId, usecaseId);

  try {
    const message = element?.jsonRequest?.message;
    // pramaan-validation-parity skill: generic quote-arithmetic call removed here — now runs
    // universally for every domain via flowContinuityValidators.ts's checkFlowContinuity() (see
    // that file, and OnSelect.ts in this same folder for the full explanation). FIS12's
    // loan-quote formula check (previously dead code — never called anywhere) wired in instead.
    if (message?.order?.quote && flowId && PURCHASE_FINANCE_FLOWS.includes(flowId)) {
      validateFIS12LoanQuote(message, result);
    }

    // Compare against CONFIRM request when available
    const txnId = element?.jsonRequest?.context?.transaction_id as string | undefined;
    if (txnId) {
      const confirmData = await getActionData(sessionID,flowId, txnId, "confirm");
      const onConfirmMsg = element?.jsonRequest?.message;

      const onConfirmItems: any[] = onConfirmMsg?.order?.items || [];
      const confirmItems: any[] = confirmData?.items || [];
      const confirmPriceById = new Map<string, string>();
      for (const it of confirmItems) if (it?.id && it?.price?.value !== undefined) confirmPriceById.set(it.id, String(it.price.value));

      const missingFromConfirm: string[] = [];
      const priceMismatches: Array<{ id: string; confirm: string; on_confirm: string }> = [];
      for (const it of onConfirmItems) {
        const id = it?.id;
        if (!id) continue;
        if (!confirmPriceById.has(id)) {
          missingFromConfirm.push(id);
          continue;
        }
        const cnf = parseFloat(confirmPriceById.get(id) as string);
        const onCnf = it?.price?.value !== undefined ? parseFloat(String(it.price.value)) : NaN;
        if (!Number.isNaN(cnf) && !Number.isNaN(onCnf)) {
          if (cnf === onCnf) result.passed.push(`Item '${id}' price matches CONFIRM`);
          else priceMismatches.push({ id, confirm: String(cnf), on_confirm: String(onCnf) });
        }
      }
      if (priceMismatches.length) result.failed.push("Item price mismatches between CONFIRM and on_confirm");
      if (missingFromConfirm.length || priceMismatches.length) {
        (result.response as any) = {
          ...(result.response || {}),
          on_confirm_vs_confirm: { missingFromConfirm, priceMismatches },
        };
      }
      
      // Validate form ID consistency if xinput is present
      await validateFormIdIfXinputPresent(onConfirmMsg, sessionID, flowId, txnId, "on_confirm", result);
    }
  } catch (_) {}
  await saveFromElement(element, sessionID, flowId, "jsonRequest");

  return result;
}