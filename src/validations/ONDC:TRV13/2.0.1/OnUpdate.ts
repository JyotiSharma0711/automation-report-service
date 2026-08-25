import { TestResult, Payload } from "../../../types/payload";

export default async function on_update(
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
    if (context?.action === "on_update") {
      result.passed.push("Action is on_update");
    } else {
      result.failed.push(`Invalid action: expected on_update, got ${context?.action}`);
    }

    // Validate order ID
    if (order?.id) {
      result.passed.push(`Order ID: ${order.id}`);
    }

    // Validate order state
    if (order?.state) {
      result.passed.push(`Order state: ${order.state}`);
    }

    // Validate updated quote if present
    const quote = order?.quote;
    if (quote?.price?.value) {
      result.passed.push(`Updated quote: ${quote.price.currency} ${quote.price.value}`);
    }

    // Validate items
    const items = order?.items;
    if (items && Array.isArray(items) && items.length > 0) {
      result.passed.push(`${items.length} item(s) in response`);
    }

    // Validate fulfillments
    const fulfillments = order?.fulfillments;
    if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
      for (const fulfillment of fulfillments) {
        if (fulfillment?.state?.descriptor?.code) {
          result.passed.push(`Fulfillment state: ${fulfillment.state.descriptor.code}`);
        }
      }
    }

    // Validate updated_at
    if (order?.updated_at) {
      result.passed.push("Order updated_at present");
    }
  } catch (error) {
    result.failed.push(`Validation error: ${error}`);
  }

  return result;
}
