import { TestResult, Payload } from "../../../types/payload";
import { saveFromElement } from "../../../utils/specLoader";

/**
 * Lien Marking Form step handler for FIS12 2.3.0 Unified Credit flows.
 * This step represents the lien marking form for LAMF (Loan Against Mutual Funds) flows.
 * Used in: lamf_credit_line_with_mfc
 */
export default async function lien_marking_form(
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
      testResults.passed.push("lien_marking_form: ACK received from server");
    } else if (responseMessage === "NACK") {
      testResults.failed.push(`lien_marking_form: NACK received - ${jsonResponse?.message?.ack?.tags || "no details"}`);
    }

    if (testResults.passed.length === 0 && testResults.failed.length === 0) {
      testResults.passed.push("lien_marking_form: lien marking form step recorded");
    }
  } catch (err: any) {
    testResults.failed.push(`lien_marking_form validation error: ${err?.message || err}`);
  }

  await saveFromElement(element, sessionID, flowId, "jsonRequest");
  return testResults;
}
