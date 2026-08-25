import assert from "assert";
import { TestResult, Payload } from "../../../types/payload";
import logger from "@ondc/automation-logger";
import { fetchData } from "../../../utils/redisUtils";

export async function checkStatus(
  element: Payload,
  sessionID: string,
  flowId: string,
  action_id: string
): Promise<TestResult> {
  const payload = element;
  const action = payload?.action.toLowerCase();
  logger.info(`Inside ${action} validations for LOG11`);

  const testResults: TestResult = {
    response: {},
    passed: [],
    failed: [],
  };

  const { jsonRequest, jsonResponse } = payload;
  if (jsonResponse?.response) testResults.response = jsonResponse?.response;

  const { context, message } = jsonRequest;
  const transactionId = context?.transaction_id;

  // --- Cross-call Comparison: on_confirm → status ---
  try {
    // Compare order_id from on_confirm → status
    const savedOrderId = await fetchData(sessionID, transactionId, "order_id");
    const statusOrderId = message?.order_id;

    if (savedOrderId && statusOrderId) {
      try {
        assert.strictEqual(
          statusOrderId,
          savedOrderId,
          `Order ID in status (${statusOrderId}) does not match on_confirm (${savedOrderId})`
        );
        testResults.passed.push("Order ID matches between on_confirm and status");
      } catch (error: any) {
        logger.error(`Error during ${action} validation: ${error.message}`);
        testResults.failed.push(error.message);
      }
    }
  } catch (error: any) {
    logger.error(`Error during ${action} cross-call comparison: ${error.message}`);
    testResults.failed.push(error.message);
  }

  if (testResults.passed.length < 1 && testResults.failed.length < 1)
    testResults.passed.push(`Validated ${action}`);

  return testResults;
}
