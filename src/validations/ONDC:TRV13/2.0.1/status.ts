import { TestResult, Payload } from "../../../types/payload";

export default async function status(
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
    if (context?.action === "status") {
      result.passed.push("Action is status");
    } else {
      result.failed.push(`Invalid action: expected status, got ${context?.action}`);
    }

    // Validate order_id
    if (message?.order_id) {
      result.passed.push(`Order ID: ${message.order_id}`);
    }
  } catch (error) {
    result.failed.push(`Validation error: ${error}`);
  }

  return result;
}
