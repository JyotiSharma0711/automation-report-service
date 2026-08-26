import { TestResult, Payload } from "../../../types/payload";
import { saveFromElement } from "../../../utils/specLoader";

/**
 * Journey Offline Form step handler for FIS12 2.3.0 Unified Credit flows.
 * This step represents the offline journey form received by the borrower.
 * Used in: lamf_credit_line_with_mfc_offline_journey
 */
export default async function journey_offline_form(
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
      testResults.passed.push("journey_offline_form: ACK received from server");
    } else if (responseMessage === "NACK") {
      testResults.failed.push(
        `journey_offline_form: NACK received - ${jsonResponse?.message?.ack?.tags || "no details"}`
      );
    }

    if (testResults.passed.length === 0 && testResults.failed.length === 0) {
      testResults.passed.push("journey_offline_form: offline journey form step recorded");
    }
  } catch (err: any) {
    testResults.failed.push(`journey_offline_form validation error: ${err?.message || err}`);
  }

  await saveFromElement(element, sessionID, flowId, "jsonRequest");
  return testResults;
}
