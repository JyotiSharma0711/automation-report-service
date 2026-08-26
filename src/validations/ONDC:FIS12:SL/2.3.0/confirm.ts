import { TestResult, Payload } from "../../../types/payload";
import { DomainValidators } from "../../shared/domainValidator";
import { saveFromElement } from "../../../utils/specLoader";
import { getActionData } from "../../../services/actionDataService";
import { validateFormIdIfXinputPresent } from "../../shared/formValidations";

export default async function confirm(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId: string,
  usecaseId?: string
): Promise<TestResult> {
  const result = await DomainValidators.fis12Confirm(element, sessionID, flowId, actionId, usecaseId);

  try {
    const txnId = element?.jsonRequest?.context?.transaction_id as string | undefined;
    if (txnId) {
      const onInitData = await getActionData(sessionID,flowId, txnId, "on_init");
      const confirmMsg = element?.jsonRequest?.message;

      // Items present and price equals ON_INIT's item price
      const confirmItems: any[] = confirmMsg?.order?.items || [];
      const onInitBreakup: any[] = onInitData?.quote_breakup || [];

      // Build price map using ON_INIT breakup item.id when available, else items[]
      const onInitPriceById = new Map<string, string>();
      for (const b of onInitBreakup) {
        const id = b?.["@ondc/org/item_id"] || b?.item?.id;
        const val = b?.price?.value ?? b?.item?.price?.value;
        if (id && val !== undefined) onInitPriceById.set(String(id), String(val));
      }
      if (onInitPriceById.size === 0) {
        const onInitItems: any[] = onInitData?.items || [];
        for (const it of onInitItems) if (it?.id && it?.price?.value !== undefined) onInitPriceById.set(it.id, String(it.price.value));
      }

      const missingFromOnInit: string[] = [];
      const priceMismatches: Array<{ id: string; on_init: string; confirm: string }> = [];
      for (const it of confirmItems) {
        const id = it?.id;
        if (!id) continue;
        if (!onInitPriceById.has(id)) {
          missingFromOnInit.push(id);
          continue;
        }
        const ini = parseFloat(onInitPriceById.get(id) as string);
        const cnf = it?.price?.value !== undefined ? parseFloat(String(it.price.value)) : NaN;
        if (!Number.isNaN(ini) && !Number.isNaN(cnf)) {
          if (ini === cnf) result.passed.push(`Item '${id}' price matches ON_INIT`);
          else priceMismatches.push({ id, on_init: String(ini), confirm: String(cnf) });
        }
      }
      if (priceMismatches.length) result.failed.push("Item price mismatches between ON_INIT and confirm");
      if (missingFromOnInit.length || priceMismatches.length) {
        (result.response as any) = {
          ...(result.response || {}),
          confirm_vs_on_init: { missingFromOnInit, priceMismatches },
        };
      }
      
      // Validate form ID consistency if xinput is present
      await validateFormIdIfXinputPresent(confirmMsg, sessionID, flowId, txnId, "confirm", result);
    }
  } catch (_) {}
  await saveFromElement(element,sessionID,flowId, "jsonRequest");
  return result;
}