import { TestResult, Payload } from "../../../types/payload";

export default async function update(
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
    if (context?.action === "update") {
      result.passed.push("Action is update");
    } else {
      result.failed.push(`Invalid action: expected update, got ${context?.action}`);
    }

    // Validate order ID
    if (order?.id) {
      result.passed.push(`Order ID: ${order.id}`);
    }

    // Validate update_target tag
    const tags = order?.tags;
    if (tags && Array.isArray(tags)) {
      const updateTarget = tags.find((t: any) => t?.descriptor?.code === "UPDATE_TARGET");
      if (updateTarget) {
        result.passed.push("UPDATE_TARGET tag present");
      }
    }

    // Validate items if present
    const items = order?.items;
    if (items && Array.isArray(items) && items.length > 0) {
      result.passed.push(`${items.length} item(s) in update`);
    }

    // Validate fulfillments if present
    const fulfillments = order?.fulfillments;
    if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
      result.passed.push(`${fulfillments.length} fulfillment(s) in update`);
    }
  } catch (error) {
    result.failed.push(`Validation error: ${error}`);
  }

  return result;
}
