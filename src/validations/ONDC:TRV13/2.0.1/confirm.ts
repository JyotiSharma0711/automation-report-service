import { TestResult, Payload } from "../../../types/payload";
import { saveFromElement } from "../../../utils/specLoader";

export default async function confirm(
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
    if (context?.action === "confirm") {
      result.passed.push("Action is confirm");
    } else {
      result.failed.push(`Invalid action: expected confirm, got ${context?.action}`);
    }

    // Validate provider
    if (order?.provider?.id) {
      result.passed.push(`Provider ID: ${order.provider.id}`);
    }

    // Validate items
    const items = order?.items;
    if (items && Array.isArray(items) && items.length > 0) {
      result.passed.push(`${items.length} item(s) confirmed`);
      for (const item of items) {
        if (item?.id) {
          result.passed.push(`Item ID: ${item.id}`);
        }
        if (item?.quantity?.selected?.count !== undefined) {
          result.passed.push(`Item ${item.id} quantity: ${item.quantity.selected.count}`);
        }
      }
    }

    // Validate billing
    const billing = order?.billing;
    if (billing?.name) {
      result.passed.push(`Billing name: ${billing.name}`);
    }

    // Validate fulfillments with customer
    const fulfillments = order?.fulfillments;
    if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
      const fulfillment = fulfillments[0];
      if (fulfillment?.customer?.person?.name) {
        result.passed.push(`Customer name: ${fulfillment.customer.person.name}`);
      }
      if (fulfillment?.customer?.contact?.phone) {
        result.passed.push("Customer phone present");
      }
    }

    // Validate payments
    const payments = order?.payments;
    if (payments && Array.isArray(payments) && payments.length > 0) {
      for (const payment of payments) {
        if (payment?.type) {
          result.passed.push(`Payment type: ${payment.type}`);
        }
        if (payment?.status) {
          result.passed.push(`Payment status: ${payment.status}`);
        }
        if (payment?.params?.transaction_id) {
          result.passed.push("Transaction ID present");
        }
      }
    }
  } catch (error) {
    result.failed.push(`Validation error: ${error}`);
  }

  await saveFromElement(element, sessionID, flowId, "jsonRequest");
  return result;
}
