import { TestResult, Payload } from "../../../types/payload";
import { saveFromElement } from "../../../utils/specLoader";

export default async function init(
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
    if (context?.action === "init") {
      result.passed.push("Action is init");
    } else {
      result.failed.push(`Invalid action: expected init, got ${context?.action}`);
    }

    // Validate provider
    if (order?.provider?.id) {
      result.passed.push(`Provider ID: ${order.provider.id}`);
    }

    // Validate items
    const items = order?.items;
    if (items && Array.isArray(items) && items.length > 0) {
      result.passed.push(`${items.length} item(s) in init`);
      for (const item of items) {
        if (item?.id) {
          result.passed.push(`Item ID: ${item.id}`);
        }
      }
    }

    // Validate billing info
    const billing = order?.billing;
    if (billing) {
      if (billing?.name) {
        result.passed.push(`Billing name: ${billing.name}`);
      }
      if (billing?.phone) {
        result.passed.push("Billing phone present");
      }
      if (billing?.email) {
        result.passed.push("Billing email present");
      }
    }

    // Validate fulfillments
    const fulfillments = order?.fulfillments;
    if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
      const fulfillment = fulfillments[0];
      
      // Validate customer info
      if (fulfillment?.customer?.person?.name) {
        result.passed.push(`Customer name: ${fulfillment.customer.person.name}`);
      }
      if (fulfillment?.customer?.contact?.phone) {
        result.passed.push("Customer phone present");
      }

      // Validate stops
      const stops = fulfillment?.stops;
      if (stops && Array.isArray(stops)) {
        const startStop = stops.find((s: any) => s?.type === "START");
        const endStop = stops.find((s: any) => s?.type === "END");
        if (startStop) result.passed.push("Check-in stop present");
        if (endStop) result.passed.push("Check-out stop present");
      }
    }

    // Validate payments
    const payments = order?.payments;
    if (payments && Array.isArray(payments) && payments.length > 0) {
      result.passed.push(`${payments.length} payment method(s) specified`);
    }
  } catch (error) {
    result.failed.push(`Validation error: ${error}`);
  }

  await saveFromElement(element, sessionID, flowId, "jsonRequest");
  return result;
}
