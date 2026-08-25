import { TestResult, Payload } from "../../../types/payload";

export default async function cancel(
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

    // Validate domain
    if (context?.domain === "ONDC:TRV13") {
      result.passed.push("Domain is ONDC:TRV13");
    } else {
      result.failed.push(`Invalid domain: expected ONDC:TRV13, got ${context?.domain}`);
    }

    // Validate action
    if (context?.action === "cancel") {
      result.passed.push("Action is cancel");
    } else {
      result.failed.push(`Invalid action: expected cancel, got ${context?.action}`);
    }

    // Validate order_id
    if (message?.order_id) {
      result.passed.push(`Order ID: ${message.order_id}`);
    }

    // Validate cancellation_reason_id
    if (message?.cancellation_reason_id) {
      result.passed.push(`Cancellation reason ID: ${message.cancellation_reason_id}`);
    }

    // Validate descriptor if present
    if (message?.descriptor?.short_desc) {
      result.passed.push(`Cancellation reason: ${message.descriptor.short_desc}`);
    }
  } catch (error) {
    result.failed.push(`Validation error: ${error}`);
  }

  return result;
}
