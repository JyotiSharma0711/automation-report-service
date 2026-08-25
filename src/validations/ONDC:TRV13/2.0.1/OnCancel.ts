import { TestResult, Payload } from "../../../types/payload";

export default async function on_cancel(
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
    if (context?.action === "on_cancel") {
      result.passed.push("Action is on_cancel");
    } else {
      result.failed.push(`Invalid action: expected on_cancel, got ${context?.action}`);
    }

    // Validate order ID
    if (order?.id) {
      result.passed.push(`Order ID: ${order.id}`);
    }

    // Validate order state should be CANCELLED
    if (order?.state === "CANCELLED") {
      result.passed.push("Order state is CANCELLED");
    } else if (order?.state) {
      result.failed.push(`Expected order state CANCELLED, got ${order.state}`);
    }

    // Validate cancellation info
    const cancellation = order?.cancellation;
    if (cancellation) {
      if (cancellation?.cancelled_by) {
        result.passed.push(`Cancelled by: ${cancellation.cancelled_by}`);
      }
      if (cancellation?.reason?.descriptor?.code) {
        result.passed.push(`Cancellation reason code: ${cancellation.reason.descriptor.code}`);
      }
    }

    // Validate that order contains only allowed keys: id, state, status, cancellation, updated_at
    if (order) {
      const allowedKeys = ["id", "state", "status", "cancellation", "updated_at"];
      const orderKeys = Object.keys(order);
      const disallowedKeys = orderKeys.filter(key => !allowedKeys.includes(key));
      if (disallowedKeys.length > 0) {
        result.failed.push(
          `Disallowed fields found in order object: ${disallowedKeys.join(", ")}. As per Developer Guide, only order.id, order.state/status, and order.cancellation should be present.`
        );
      }
    }

    // Validate quote with refund
    const quote = order?.quote;
    if (quote?.price?.value) {
      result.passed.push(`Final quote: ${quote.price.currency} ${quote.price.value}`);
    }

    // Check for refund in quote breakup
    const breakup = quote?.breakup;
    if (breakup && Array.isArray(breakup)) {
      const refundItem = breakup.find((b: any) => 
        b?.title?.toLowerCase().includes("refund") || 
        b?.["@ondc/org/title_type"]?.toLowerCase().includes("refund")
      );
      if (refundItem) {
        result.passed.push(`Refund amount: ${refundItem.price?.currency} ${refundItem.price?.value}`);
      }
    }

    // Validate fulfillment state
    const fulfillments = order?.fulfillments;
    if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
      for (const fulfillment of fulfillments) {
        if (fulfillment?.state?.descriptor?.code) {
          result.passed.push(`Fulfillment state: ${fulfillment.state.descriptor.code}`);
        }
      }
    }

    // Validate payments with refund status
    const payments = order?.payments;
    if (payments && Array.isArray(payments) && payments.length > 0) {
      for (const payment of payments) {
        if (payment?.status) {
          result.passed.push(`Payment status: ${payment.status}`);
        }
      }
    }
  } catch (error) {
    result.failed.push(`Validation error: ${error}`);
  }

  return result;
}
