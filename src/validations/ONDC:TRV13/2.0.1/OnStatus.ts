import { TestResult, Payload } from "../../../types/payload";

export default async function on_status(
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
    if (context?.action === "on_status") {
      result.passed.push("Action is on_status");
    } else {
      result.failed.push(`Invalid action: expected on_status, got ${context?.action}`);
    }

    // Validate order ID
    if (order?.id) {
      result.passed.push(`Order ID: ${order.id}`);
    }

    // Validate order state
    if (order?.state) {
      result.passed.push(`Order state: ${order.state}`);
    }

    // Validate provider
    if (order?.provider?.id) {
      result.passed.push(`Provider ID: ${order.provider.id}`);
    }

    if (order?.provider?.tags && Array.isArray(order.provider.tags) && order.provider.tags.length > 0) {
      result.passed.push("provider.tags are present");
    }

    // Validate fulfillments with state
    const fulfillments = order?.fulfillments;
    if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
      fulfillments.forEach((fulfillment: any, fIdx: number) => {
        if (fulfillment.type) {
          result.passed.push(`Fulfillment[${fIdx}] type: ${fulfillment.type}`);
        }
        if (fulfillment.state?.descriptor?.code) {
          result.passed.push(`Fulfillment[${fIdx}] state: ${fulfillment.state.descriptor.code}`);
        }

        // Validate stops (START and END check-in/check-out) only if stops are present
        const stops = fulfillment.stops;
        if (stops && Array.isArray(stops) && stops.length > 0) {
          const startStop = stops.find((s: any) => s.type === "START");
          const endStop = stops.find((s: any) => s.type === "END");
          if (startStop) {
            if (startStop.location && startStop.location.gps) {
              const gps = String(startStop.location.gps).trim();
              const gpsRegex = /^-?\d+\.\d{6},\s*-?\d+\.\d{6}$/;
              if (!gpsRegex.test(gps)) {
                result.failed.push(`Fulfillment[${fIdx}] START stop location.gps should have 6 decimal precision, got: ${gps}`);
              } else {
                result.passed.push(`Fulfillment[${fIdx}] START stop location.gps is correct`);
              }
            }
          }
          if (endStop) {
            if (endStop.location && endStop.location.gps) {
              const gps = String(endStop.location.gps).trim();
              const gpsRegex = /^-?\d+\.\d{6},\s*-?\d+\.\d{6}$/;
              if (!gpsRegex.test(gps)) {
                result.failed.push(`Fulfillment[${fIdx}] END stop location.gps should have 6 decimal precision, got: ${gps}`);
              } else {
                result.passed.push(`Fulfillment[${fIdx}] END stop location.gps is correct`);
              }
            }
          }
        }
      });
    }

    // Validate payments
    const payments = order?.payments;
    if (payments && Array.isArray(payments) && payments.length > 0) {
      payments.forEach((payment: any, pIdx: number) => {
        if (payment.type === "PART-PAYMENT") {
          result.passed.push(
            `Payment [${payment.id || 'unknown'}] is PART-PAYMENT (aggregate envelope) — validation skipped`
          );
          return;
        }
        if (payment.collected_by && !["BAP", "BPP"].includes(payment.collected_by)) {
          result.failed.push(`Payment[${pIdx}].collected_by must be BAP or BPP, got: ${payment.collected_by}`);
        }
        if (payment.type && !["PRE-ORDER", "ON-FULFILLMENT", "PART-PAYMENT"].includes(payment.type)) {
          result.failed.push(`Payment[${pIdx}].type must be PRE-ORDER, ON-FULFILLMENT, or PART-PAYMENT, got: ${payment.type}`);
        }
        if (payment.status && !["NOT-PAID", "PAID"].includes(payment.status)) {
          result.failed.push(`Payment[${pIdx}].status must be NOT-PAID or PAID, got: ${payment.status}`);
        }
      });
    }

    // Validate BAP_TERMS & BPP_TERMS
    let allTags: any[] = [];
    if (order?.tags && Array.isArray(order.tags)) {
      allTags.push(...order.tags);
    }
    if (payments && Array.isArray(payments)) {
      payments.forEach((p: any) => {
        if (p.tags && Array.isArray(p.tags)) {
          allTags.push(...p.tags);
        }
      });
    }

    const bapTerms = allTags.find((t: any) => t?.descriptor?.code === "BAP_TERMS");
    const bppTerms = allTags.find((t: any) => t?.descriptor?.code === "BPP_TERMS");

    if (bapTerms) {
      result.passed.push("BAP_TERMS tag is present");
    }

    if (bppTerms) {
      result.passed.push("BPP_TERMS tag is present");
    }

    // Validate updated_at
    if (order?.updated_at) {
      result.passed.push("Order updated_at present");
    }
  } catch (error) {
    result.failed.push(`Validation error: ${error}`);
  }

  return result;
}
