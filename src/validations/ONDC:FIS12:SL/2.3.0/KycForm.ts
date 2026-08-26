import { TestResult, Payload } from "../../../types/payload";
import { saveFromElement } from "../../../utils/specLoader";

/**
 * KYC Form step handler for FIS12 2.3.0 Unified Credit flows.
 * This step represents the borrower receiving the KYC form URL.
 * The payload is typically a form submission response (ACK) — no structured message to validate.
 */
export default async function kyc_form(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId: string
): Promise<TestResult> {
  const testResults: TestResult = {
    response: {},
    passed: [],
    failed: [],
  };

  try {
    const { jsonResponse } = element;
    if (jsonResponse?.response) {
      testResults.response = jsonResponse.response;
    }

    // Validate ACK response
    const responseMessage = jsonResponse?.message?.ack?.status;
    if (responseMessage === "ACK") {
      testResults.passed.push("kyc_form: ACK received from server");
    } else if (responseMessage === "NACK") {
      testResults.failed.push(`kyc_form: NACK received - ${jsonResponse?.message?.ack?.tags || "no details"}`);
    }

    if (testResults.passed.length === 0 && testResults.failed.length === 0) {
      testResults.passed.push("kyc_form: form step recorded");
    }
  } catch (err: any) {
    testResults.failed.push(`kyc_form validation error: ${err?.message || err}`);
  }

  await saveFromElement(element, sessionID, flowId, "jsonRequest");
  return testResults;
}
