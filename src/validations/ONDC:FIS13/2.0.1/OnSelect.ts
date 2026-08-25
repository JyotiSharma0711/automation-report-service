import { TestResult, Payload } from "../../../types/payload";
import { DomainValidators } from "../../shared/domainValidator";
import { validateOrderQuote } from "../../shared/quoteValidations";
import { getActionData } from "../../../services/actionDataService";
import { validateFormIdIfXinputPresent } from "../../shared/formValidations";
import { saveFromElement } from "../../../utils/specLoader";
import {
  validateInsuranceContext,
  validateBreakupTitleEnum,
  validateInsuranceOnSelectXinput,
} from "../../shared/healthInsuranceValidations";

export default async function on_select(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId: string,
  usecaseId?: string
): Promise<TestResult> {
  const result = await DomainValidators.fis13OnSelect(element, sessionID, flowId, actionId, usecaseId);

  try {
    const context = element?.jsonRequest?.context;
    const message = element?.jsonRequest?.message;

    // Health insurance context validation
    validateInsuranceContext(context, result, flowId);

    // Health insurance breakup title enum
    if (message) validateBreakupTitleEnum(message, result, flowId);

    // Health insurance on_select xinput
    if (message) validateInsuranceOnSelectXinput(message, result, flowId);

    // Quote calculation check
    if (message?.order?.quote) {
      validateOrderQuote(message, result, {
        validateDecimalPlaces: true,
        validateTotalMatch: true,
        validateItemPriceConsistency: false,
        flowId,
      });
    }

    const txnId = context?.transaction_id as string | undefined;
    if (txnId) {
      // Item ID + price comparison: select → on_select
      const selectData = await getActionData(sessionID, flowId, txnId, "select");
      const selItems: any[] = selectData?.order?.items || selectData?.items || [];
      const onSelItems: any[] = message?.order?.items || [];

      const selectPriceById = new Map<string, string>();
      const selectItemIds: string[] = [];
      for (const it of selItems) {
        if (it?.id) {
          selectItemIds.push(it.id);
          if (it?.price?.value !== undefined) selectPriceById.set(it.id, String(it.price.value));
        }
      }

      const onSelectItemIds = onSelItems.map((it: any) => it?.id).filter(Boolean) as string[];
      const missingItems = selectItemIds.filter(id => !onSelectItemIds.includes(id));
      if (selectItemIds.length > 0) {
        if (missingItems.length === 0) {
          result.passed.push(`All items from select (${selectItemIds.length}) are present in on_select`);
        } else {
          if (missingItems.length) result.failed.push(`Items from select missing in on_select: ${missingItems.join(", ")}`);
        }
      }

      const priceMismatches: Array<{ id: string; select: string; on_select: string }> = [];
      for (const it of onSelItems) {
        const id: string | undefined = it?.id;
        if (!id || !selectPriceById.has(id)) continue;
        const selPrice = parseFloat(selectPriceById.get(id) as string);
        const onSelPrice = it?.price?.value !== undefined ? parseFloat(String(it.price.value)) : NaN;
        if (!Number.isNaN(selPrice) && !Number.isNaN(onSelPrice)) {
          if (selPrice === onSelPrice) result.passed.push(`Item '${id}' price matches SELECT`);
          else priceMismatches.push({ id, select: String(selPrice), on_select: String(onSelPrice) });
        }
      }
      if (priceMismatches.length) {
        result.failed.push("Item price mismatches between SELECT and on_select");
        (result.response as any) = { ...(result.response || {}), on_select_vs_select: { priceMismatches } };
      }

      // Form ID (xinput) check
      await validateFormIdIfXinputPresent(message, sessionID, flowId, txnId, "on_select", result);
    }
  } catch (_) { }

  await saveFromElement(element, sessionID, flowId, "jsonRequest");
  return result;
}
