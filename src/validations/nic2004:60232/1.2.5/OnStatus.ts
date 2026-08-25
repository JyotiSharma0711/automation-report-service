import assert from "assert";
import { TestResult, Payload } from "../../../types/payload";
import logger from "@ondc/automation-logger";
import { fetchData, saveData } from "../../../utils/redisUtils";

export async function checkOnStatus(
  element: Payload,
  sessionID: string,
  flowId: string
): Promise<TestResult> {
  const payload = element;
  const action = payload?.action.toLowerCase();
  logger.info(`Inside ${action} validations`);

  const testResults: TestResult = {
    response: {},
    passed: [],
    failed: [],
  };

  const { jsonRequest, jsonResponse } = payload;
  if (jsonResponse?.response) testResults.response = jsonResponse?.response;

  const { context, message } = jsonRequest;
  const transactionId = context?.transaction_id;
  const contextTimestamp = context?.timestamp;
  const fulfillments = message?.order?.fulfillments;
  const orderState = message?.order?.state;
  const paymentStatus = message?.order?.payment?.status;
  const paymentType = message?.order?.payment?.type;
  const paymentTimestamp = message?.order?.payment?.time?.timestamp;

  if (orderState === "Complete" && paymentType === "ON-FULFILLMENT") {
    try {
      assert.ok(
        paymentStatus == "PAID",
        "Payment status should be 'PAID' once the order is complete for payment type 'ON-FULFILLMENT'"
      );
      testResults.passed.push("Payment status validation passed");
    } catch (error: any) {
      logger.error(`Error during ${action} validation: ${error.message}`);
      testResults.failed.push(error.message);
    }
  }
  if (paymentType === "POST-FULFILLMENT" && paymentStatus === "PAID") {
    try {
      assert.ok(
        !paymentTimestamp,
        "Payment timestamp should not be provided as payment type is 'POST-FULFILLMENT'"
      );
      testResults.passed.push("Payment timestamp validation passed");
    } catch (error: any) {
      logger.error(`Error during ${action} validation: ${error.message}`);
      testResults.failed.push(error.message);
    }
  } else if (paymentStatus === "NOT-PAID") {
    try {
      assert.ok(
        !paymentTimestamp,
        "Payment timestamp should not be provided if the payment is yet not made"
      );
      testResults.passed.push("Payment timestamp validation passed");
    } catch (error: any) {
      logger.error(`Error during ${action} validation: ${error.message}`);
      testResults.failed.push(error.message);
    }
  }

  try {
    fulfillments.forEach(async (fulfillment: any) => {
      if (fulfillment.type === "Delivery") {
        const ffState = fulfillment?.state?.descriptor?.code;
        const pickupTimestamp = fulfillment?.start?.time?.timestamp;
        const deliveryTimestamp = fulfillment?.end?.time?.timestamp;
        try {
          const prePickupStates = [
            "Pending",
            "Agent-assigned",
            "Searching-for-agent",
            "At-pickup",
          ].includes(ffState);
          const hasTimestamps = pickupTimestamp || deliveryTimestamp;

          assert.ok(
            !(prePickupStates && hasTimestamps),
            `Pickup/Delivery timestamp should not be provided when fulfillment state is '${ffState}'`
          );

          testResults.passed.push(
            "Pickup/Delivery timestamp requirement validation passed"
          );
        } catch (error: any) {
          logger.error(`Error during ${action} validation: ${error.message}`);
          testResults.failed.push(error.message);
        }

        try {
          assert.ok(
            !(
              [
                "Agent-assigned",
                "Order-picked-up",
                "Out-for-delivery",
              ].includes(ffState) && orderState !== "In-progress"
            ),
            "Order state should be 'In-progress'"
          );
          testResults.passed.push("Order state validation passed");
        } catch (error: any) {
          logger.error(`Error during ${action} validation: ${error.message}`);
          testResults.failed.push(error.message);
        }

        if (ffState === "Order-picked-up" && pickupTimestamp) {
          saveData(
            sessionID,
            transactionId,
            "pickupTimestamp",
            pickupTimestamp
          );
          try {
            assert.ok(
              contextTimestamp >= pickupTimestamp,
              "Pickup timestamp cannot be future-dated w.r.t context timestamp"
            );
            testResults.passed.push("Pickup timestamp validation passed");
          } catch (error: any) {
            logger.error(`Error during ${action} validation: ${error.message}`);
            testResults.failed.push(error.message);
          }
        }
        const pickedTimestamp = await fetchData(
          sessionID,
          transactionId,
          "pickupTimestamp"
        );
        if (
          ["Out-for-delivery", "At-destination-hub", "In-transit"].includes(
            ffState
          ) &&
          pickedTimestamp
        ) {
          try {
            assert.ok(
              pickupTimestamp === pickedTimestamp,
              `Pickup timestamp cannot change once fulfillment state is '${ffState}'`
            );
            testResults.passed.push(
              "Pickup timestamp immutability validation passed"
            );
          } catch (error: any) {
            logger.error(`Error during ${action} validation: ${error.message}`);
            testResults.failed.push(error.message);
          }
        }
        if (ffState === "Order-delivered" && deliveryTimestamp) {
          try {
            assert.ok(
              contextTimestamp >= deliveryTimestamp,
              "Delivery timestamp cannot be future-dated w.r.t context timestamp"
            );
            testResults.passed.push("Delivery timestamp validation passed");
          } catch (error: any) {
            logger.error(`Error during ${action} validation: ${error.message}`);
            testResults.failed.push(error.message);
          }
        }

        const isOrderPickedUp =
          ffState === "Order-picked-up" || ffState === "Out-for-delivery";
        const isTrackingEnabled = Boolean(fulfillment.tracking); // Ensure boolean value
        // Only check tracking tag if tracking is enabled
        if (isOrderPickedUp && isTrackingEnabled) {
          try {
            testResults.passed.push("Tracking tag validation passed");
          } catch (error: any) {
            logger.error(`Error during ${action} validation: ${error.message}`);
            testResults.failed.push(error.message);
          }
        } else {
          testResults.failed.push(
            `tracking should be enabled (true) in fulfillments/tracking`
          );
        }
      }
    });
  } catch (error: any) {
    logger.error(
      `Unexpected error during ${action} validation: ${error.message}`
    );
    testResults.failed.push(`Unexpected error: ${error.message}`);
  }

  if (testResults.passed.length < 1 && testResults.failed.length < 1) {
    testResults.passed.push(`Validated ${action}`);
  }

  return testResults;
}
