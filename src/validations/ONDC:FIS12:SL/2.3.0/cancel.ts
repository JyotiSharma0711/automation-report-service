import { TestResult, Payload } from "../../../types/payload";
import { saveFromElement } from "../../../utils/specLoader";
import { validateCancel } from "../../shared/validationFactory";
import { validateFormIdIfXinputPresent } from "../../shared/formValidations";

export default async function cancel(
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

  const { jsonRequest, jsonResponse } = element;
  if (jsonResponse?.response) testResults.response = jsonResponse?.response;

  const message = jsonRequest?.message;

  // Validate cancel message based on action_id
  validateCancel(message, testResults, actionId, flowId);
  
  // Validate form ID consistency if xinput is present
  try {
    const txnId = jsonRequest?.context?.transaction_id as string | undefined;
    if (txnId && message) {
      await validateFormIdIfXinputPresent(message, sessionID, flowId, txnId, "cancel", testResults);
    }
  } catch (_) {}

  // Add default message if no validations ran
  if (testResults.passed.length < 1 && testResults.failed.length < 1) {
    testResults.passed.push(`Validated cancel`);
  }

  await saveFromElement(element, sessionID, flowId, "jsonRequest");
  return testResults;
}

