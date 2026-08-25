import { TestResult, Payload } from "../../../types/payload";
import { DomainValidators } from "../../shared/domainValidator";
import { saveFromElement } from "../../../utils/specLoader";
import { validateGpsFormat, validateStops } from "./commonChecks";

export default async function search(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId: string
): Promise<TestResult> {
  const result = await DomainValidators.trv11Search210(element, sessionID, flowId, actionId);

  try {
    const message = element?.jsonRequest?.message;
    const intent = message?.intent;

    if (intent) {
      // Validate fulfillment
      const fulfillment = intent?.fulfillment;
      if (fulfillment) {
        // Validate vehicle.category
        const category = fulfillment?.vehicle?.category;
        if (["METRO", "BUS"].includes(category)) {
          result.passed.push(`search: vehicle.category '${category}' is valid`);
        } else {
          result.failed.push(`search: vehicle.category '${category}' must be METRO or BUS`);
        }

        // Validate stops (optional for master/broad search)
        if (fulfillment.stops && Array.isArray(fulfillment.stops) && fulfillment.stops.length > 0) {
          validateStops(fulfillment.stops, result, "search.intent.fulfillment");

          for (const stop of fulfillment.stops) {
            if (stop?.location?.gps) {
              validateGpsFormat(stop.location.gps, `search.stop[${stop.type}]`, result);
            }
          }
        } else {
          result.passed.push("search: no stops present (broad/master search)");
        }
      }

      // Validate payment
      const payment = intent?.payment;
      if (payment) {
        if (["BAP", "BPP"].includes(payment.collected_by)) {
          result.passed.push(`search: payment.collected_by '${payment.collected_by}' is valid`);
        } else {
          result.failed.push(`search: payment.collected_by '${payment.collected_by}' must be BAP or BPP`);
        }
      }

      // 2.1.0: BAP_TERMS in intent.tags (replaces payment.tags BUYER_FINDER_FEES/SETTLEMENT_TERMS)
      const tags = intent?.tags;
      if (tags && Array.isArray(tags)) {
        const bapTerms = tags.find((t: any) => t?.descriptor?.code === "BAP_TERMS");
        if (bapTerms) {
          result.passed.push("search: BAP_TERMS tag present in intent.tags");
          const list = bapTerms.list;
          if (list && Array.isArray(list)) {
            const bffPct = list.find((l: any) => l?.descriptor?.code === "BUYER_FINDER_FEES_PERCENTAGE");
            if (bffPct?.value) {
              result.passed.push(`search: BUYER_FINDER_FEES_PERCENTAGE is ${bffPct.value}`);
            }
          }
        }
      }
    }
  } catch (_) {}

  await saveFromElement(element, sessionID, flowId, "jsonRequest");
  return result;
}
