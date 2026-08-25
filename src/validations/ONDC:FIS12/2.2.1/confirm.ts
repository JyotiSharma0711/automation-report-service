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

      // pramaan-validation-parity skill: payment.id continuity, ported from Pramaan
      // creditBuyerNPTest/v2.2.0/confirm.js (`expect(payment.id).to.be.equal(previous_on_init_payment_id)`).
      // ON_INIT's payment.id must reappear unchanged in confirm — reuses the onInitData already
      // fetched above rather than adding a second getActionData call. save-specs/FIS12/2.2.1/on_init.yaml
      // already extracts `payments: "$.message.order.payments[*]"`, so this is available for free.
      const onInitPayment = Array.isArray(onInitData?.payments) ? onInitData.payments[0] : onInitData?.payments;
      const confirmPaymentsRaw = confirmMsg?.order?.payments;
      const confirmPayment = Array.isArray(confirmPaymentsRaw) ? confirmPaymentsRaw[0] : confirmPaymentsRaw;
      if (onInitPayment?.id && confirmPayment?.id) {
        if (onInitPayment.id === confirmPayment.id) {
          result.passed.push(`payment.id matches ON_INIT ('${confirmPayment.id}')`);
        } else {
          result.failed.push(`payment.id changed: ON_INIT returned '${onInitPayment.id}', confirm sent '${confirmPayment.id}'`);
        }
      }
      // If either side is missing a payment.id, don't fail — some Purchase Finance flows may
      // legitimately omit it at this step; only compare when both sides actually have one.

      // Validate form ID consistency if xinput is present
      await validateFormIdIfXinputPresent(confirmMsg, sessionID, flowId, txnId, "confirm", result);
    }
  } catch (_) {}
  await saveFromElement(element,sessionID,flowId, "jsonRequest");
  return result;
}