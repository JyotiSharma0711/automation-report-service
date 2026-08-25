import { TestResult, Payload } from "../../../types/payload";
import { saveFromElement } from "../../../utils/specLoader";

export default async function select(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId: string
): Promise<TestResult> {
  const result: TestResult = {
    response: {},
    passed: [],
    failed: [],
  };

  const { jsonRequest, jsonResponse } = element;
  if (jsonResponse?.response) result.response = jsonResponse.response;

  try {
    const context = jsonRequest?.context;
    const message = jsonRequest?.message;
    const order = message?.order;

    // Validate domain
    if (context?.domain === "ONDC:TRV13") {
      result.passed.push("Domain is ONDC:TRV13");
    } else {
      result.failed.push(`Invalid domain: expected ONDC:TRV13, got ${context?.domain}`);
    }

    // Validate action
    if (context?.action === "select") {
      result.passed.push("Action is select");
    } else {
      result.failed.push(`Invalid action: expected select, got ${context?.action}`);
    }

    // Validate provider
    if (order?.provider?.id) {
      result.passed.push(`Provider ID: ${order.provider.id}`);
    }

    // Validate items
    const items = order?.items;
    if (items && Array.isArray(items) && items.length > 0) {
      result.passed.push(`${items.length} item(s) selected`);
      for (const item of items) {
        if (item?.id) {
          result.passed.push(`Item ID: ${item.id}`);
        }
        if (item?.quantity?.selected?.count !== undefined) {
          result.passed.push(`Item ${item.id} quantity: ${item.quantity.selected.count}`);
        }
        // Validate add_ons if selected
        if (item?.add_ons && item.add_ons.length > 0) {
          result.passed.push(`Item ${item.id} has ${item.add_ons.length} add-on(s) selected`);
        }
      }
    } else {
      result.failed.push("No items selected");
    }

    // Validate fulfillment stops
    const fulfillments = order?.fulfillments;
    if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
      const fulfillment = fulfillments[0];
      const stops = fulfillment?.stops;
      if (stops && Array.isArray(stops)) {
        const startStop = stops.find((s: any) => s?.type === "START");
        const endStop = stops.find((s: any) => s?.type === "END");
        if (startStop?.time?.timestamp) {
          result.passed.push(`Check-in time: ${startStop.time.timestamp}`);
        }
        if (endStop?.time?.timestamp) {
          result.passed.push(`Check-out time: ${endStop.time.timestamp}`);
        }
      }
    }
  } catch (error) {
    result.failed.push(`Validation error: ${error}`);
  }

  await saveFromElement(element, sessionID, flowId, "jsonRequest");
  return result;
}
