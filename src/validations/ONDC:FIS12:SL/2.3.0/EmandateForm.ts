import { TestResult, Payload } from "../../../types/payload";
import { saveFromElement } from "../../../utils/specLoader";

/**
 * eMandate Form step handler for FIS12 2.3.0 Unified Credit flows.
 * This step represents the borrower completing the eMandate setup form.
 * Used in: business_term_loan_without_aa, lamf_credit_line_with_mfc
 */
export default async function emandate_form(
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
      testResults.passed.push("emandate_form: ACK received from server");
    } else if (responseMessage === "NACK") {
      testResults.failed.push(`emandate_form: NACK received - ${jsonResponse?.message?.ack?.tags || "no details"}`);
    }

    if (testResults.passed.length === 0 && testResults.failed.length === 0) {
      testResults.passed.push("emandate_form: eMandate form step recorded");
    }
  } catch (err: any) {
    testResults.failed.push(`emandate_form validation error: ${err?.message || err}`);
  }

  await saveFromElement(element, sessionID, flowId, "jsonRequest");
  return testResults;
}
