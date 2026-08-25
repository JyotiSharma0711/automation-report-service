import { TestResult, Payload } from "../../../types/payload";
import { DomainValidators } from "../../shared/domainValidator";
import { saveFromElement } from "../../../utils/specLoader";
import { getActionData } from "../../../services/actionDataService";
import { validateTermsTags } from "./commonChecks";

export default async function init(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId: string
): Promise<TestResult> {
  const result = await DomainValidators.trv11Init210(element, sessionID, flowId, actionId);

  // Agent flows (no search step) and Passes flow (starts at select) — suppress txnId false positive
  const isAgentFlow = !!flowId?.toUpperCase().includes("AGENT");
  const isPassesFlow = flowId === "IntraCity_Unlimited_Passes_Flow(Code Based)";
  if ((isAgentFlow || isPassesFlow) && result.failed.length > 0) {
    result.failed = result.failed.filter(
      (err: string) => !err.toLowerCase().includes("no transaction ids found")
    );
  }

  try {
    const message = element?.jsonRequest?.message;
    const order = message?.order;

    // Validate billing
    if (order?.billing) {
      if (order.billing.phone) {
        result.passed.push("init: billing.phone is present");
      }
    }

    // Validate payments
    if (order?.payments && Array.isArray(order.payments)) {
      for (const payment of order.payments) {
        if (payment.collected_by && !["BAP", "BPP"].includes(payment.collected_by)) {
          result.failed.push(`init: payment.collected_by '${payment.collected_by}' must be BAP or BPP`);
        }
        if (payment.type && !["PRE-ORDER", "ON-ORDER", "ON-FULFILLMENT", "POST-FULFILLMENT"].includes(payment.type)) {
          result.failed.push(`init: payment.type '${payment.type}' is invalid`);
        }
      }
    }

    // 2.1.0 specific: BAP_TERMS tags in order.tags
    if (order?.tags) {
      validateTermsTags(order.tags, result, "init");
    }

    // Cross-check with on_select
    const txnId = element?.jsonRequest?.context?.transaction_id as string | undefined;
    if (txnId) {
      const onSelectData = await getActionData(sessionID, flowId, txnId, "on_select");
      const initProviderId = order?.provider?.id;
      const onSelectProviderId = onSelectData?.order?.provider?.id || onSelectData?.provider?.id;
      if (initProviderId && onSelectProviderId && initProviderId === onSelectProviderId) {
        result.passed.push("Provider id matches ON_SELECT");
      } else if (initProviderId && onSelectProviderId) {
        result.failed.push("Provider id mismatch with ON_SELECT");
      }

      // Compare items
      const initItems: any[] = order?.items || [];
      const onSelectItems: any[] = onSelectData?.order?.items || onSelectData?.items || [];
      const onSelectPriceById = new Map<string, string>();
      for (const it of onSelectItems) if (it?.id && it?.price?.value !== undefined) onSelectPriceById.set(it.id, String(it.price.value));

      const priceMismatches: Array<{ id: string; on_select: string; init: string }> = [];
      for (const it of initItems) {
        const id = it?.id;
        if (!id || !onSelectPriceById.has(id)) continue;
        const sel = parseFloat(onSelectPriceById.get(id) as string);
        const ini = it?.price?.value !== undefined ? parseFloat(String(it.price.value)) : NaN;
        if (!Number.isNaN(sel) && !Number.isNaN(ini)) {
          if (sel === ini) result.passed.push(`Item '${id}' price matches ON_SELECT`);
          else priceMismatches.push({ id, on_select: String(sel), init: String(ini) });
        }
      }
      if (priceMismatches.length) {
        result.failed.push("Item price mismatches between ON_SELECT and init");
        (result.response as any) = {
          ...(result.response || {}),
          init_vs_on_select: { priceMismatches },
        };
      }
    }
  } catch (_) {}

  await saveFromElement(element, sessionID, flowId, "jsonRequest");
  return result;
}
