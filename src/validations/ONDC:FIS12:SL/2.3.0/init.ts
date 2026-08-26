import { TestResult, Payload } from "../../../types/payload";
import { DomainValidators } from "../../shared/domainValidator";
import { saveFromElement } from "../../../utils/specLoader";
import { getActionData } from "../../../services/actionDataService";
import { validateFormIdIfXinputPresent } from "../../shared/formValidations";

export default async function init(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId: string,
  usecaseId?: string
): Promise<TestResult> {
  const result = await DomainValidators.fis12Init(element, sessionID, flowId, actionId, usecaseId);

  try {
    const txnId = element?.jsonRequest?.context?.transaction_id as string | undefined;
    if (txnId) {
      const selectData = await getActionData(sessionID,flowId, txnId, "select");
      const initMsg = element?.jsonRequest?.message;
      // Basic consistency checks w.r.t. SELECT
      const initProviderId = initMsg?.order?.provider?.id;
      const selectProviderId = selectData?.order?.provider?.id || selectData?.provider?.id;
      if (initProviderId && selectProviderId && initProviderId === selectProviderId) {
        result.passed.push("Provider id matches SELECT");
      } else if (initProviderId && selectProviderId) {
        result.failed.push("Provider id mismatch with SELECT");
      }
      // If either is missing, don't fail (optional check)

      const initItems: any[] = initMsg?.order?.items || [];
      const selectItems: any[] = selectData?.order?.items || selectData?.items || [];
      const selectPriceById = new Map<string, string>();
      for (const it of selectItems) if (it?.id && it?.price?.value !== undefined) selectPriceById.set(it.id, String(it.price.value));

      const missingFromSelect: string[] = [];
      const priceMismatches: Array<{ id: string; select: string; init: string }> = [];
      for (const it of initItems) {
        const id = it?.id;
        if (!id) continue;
        if (!selectPriceById.has(id)) {
          missingFromSelect.push(id);
          continue;
        }
        const sel = parseFloat(selectPriceById.get(id) as string);
        const ini = it?.price?.value !== undefined ? parseFloat(String(it.price.value)) : NaN;
        if (!Number.isNaN(sel) && !Number.isNaN(ini)) {
          if (sel === ini) result.passed.push(`Item '${id}' price matches SELECT`);
          else priceMismatches.push({ id, select: String(sel), init: String(ini) });
        }
      }
      if (priceMismatches.length) result.failed.push("Item price mismatches between SELECT and init");
      if (missingFromSelect.length || priceMismatches.length) {
        (result.response as any) = {
          ...(result.response || {}),
          init_vs_select: { missingFromSelect, priceMismatches },
        };
      }

      // Validate form ID consistency if xinput is present
      await validateFormIdIfXinputPresent(element?.jsonRequest?.message, sessionID, flowId, txnId, "init", result);
    }
  } catch (_) {}

  await saveFromElement(element,sessionID,flowId, "jsonRequest");
  return result;
}