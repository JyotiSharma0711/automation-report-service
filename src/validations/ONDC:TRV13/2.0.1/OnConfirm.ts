import { TestResult, Payload } from "../../../types/payload";
import { validateOrderQuote } from "../../shared/quoteValidations";

export default async function on_confirm(
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
    if (context?.action === "on_confirm") {
      result.passed.push("Action is on_confirm");
    } else {
      result.failed.push(`Invalid action: expected on_confirm, got ${context?.action}`);
    }

    // Validate order ID
    if (order?.id) {
      result.passed.push(`Order ID: ${order.id}`);
    }

    // Validate order state
    if (order?.state) {
      const validStates = ["ACTIVE", "COMPLETE", "CANCELLED"];
      if (validStates.includes(order.state)) {
        result.passed.push(`Order state: ${order.state}`);
      } else {
        result.failed.push(`Invalid order state: ${order.state}`);
      }
    }

    // Validate provider
    if (order?.provider?.id) {
      result.passed.push(`Provider ID: ${order.provider.id}`);
    }

    if (order?.provider?.tags && Array.isArray(order.provider.tags) && order.provider.tags.length > 0) {
      result.passed.push("provider.tags are present");
    }

    // Validate items
    const items = order?.items;
    if (items && Array.isArray(items) && items.length > 0) {
      result.passed.push(`${items.length} item(s) confirmed`);
    }

    // Validate quote
    const quote = order?.quote;
    if (quote?.price?.value) {
      result.passed.push(`Total quote: ${quote.price.currency} ${quote.price.value}`);
    }

    // Validate fulfillments
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
      const validStatuses = ["PAID", "NOT-PAID"];
      const paymentStatuses: string[] = [];
      let totalPaymentAmount = 0;
      // In split-payment flows, PART-PAYMENT is the aggregate envelope.
      // Sub-payments (PRE-ORDER, ON-FULFILLMENT) may be NOT-PAID or carry amount=0
      const hasPartPayment = payments.some((p: any) => p.type === "PART-PAYMENT");
      
      for (const payment of payments) {
        // PART-PAYMENT is a meta/aggregate envelope that links sub-payments via LINKED-PAYMENTS tags.
        // Per the TRV13 2.0.1 API contract, it intentionally carries no params at any API stage.
        if (payment.type === "PART-PAYMENT") {
          result.passed.push(
            `Payment [${payment.id || 'unknown'}] is PART-PAYMENT (aggregate envelope) — params validation skipped per contract`
          );
          continue;
        }

        if (payment?.status) {
          // Validate status is valid
          if (validStatuses.includes(payment.status)) {
            result.passed.push(`Payment [${payment.id || 'unknown'}] (${payment.type || 'unknown'}) status: ${payment.status}`);
            paymentStatuses.push(payment.status);
          } else {
            result.failed.push(`Invalid payment status: ${payment.status}. Must be PAID or NOT-PAID`);
          }
          
          // Only enforce PRE-ORDER = PAID when not in a split-payment (PART-PAYMENT) flow
          if (payment.type === "PRE-ORDER" && payment.status === "NOT-PAID" && !hasPartPayment) {
            result.failed.push(`PRE-ORDER payment should be PAID in on_confirm, found NOT-PAID`);
          }
        }

        // Validate payment.params
        const params = payment?.params;
        if (!params) {
          continue;
        }

        // Validate params.amount
        if (params.amount) {
          const amount = parseFloat(params.amount);
          // ON-FULFILLMENT payments collected at hotel checkout — amount can be 0 at on_confirm stage.
          // In split-payment flows, amount is tracked in PART-PAYMENT tags, not on the sub-payment.
          if (isNaN(amount) || (amount <= 0 && !hasPartPayment && payment.type !== "ON-FULFILLMENT")) {
            result.failed.push(`Invalid payment amount: ${params.amount}. Must be a positive number`);
          } else {
            result.passed.push(`Payment ${payment.type} amount: ${params.currency || ''} ${params.amount}`);
            totalPaymentAmount += amount;
          }
        }

        // Validate params.currency
        if (params.currency) {
          if (quote?.price?.currency && params.currency !== quote.price.currency) {
            result.failed.push(
              `Payment currency mismatch: expected ${quote.price.currency}, found ${params.currency}`
            );
          } else {
            result.passed.push(`Payment currency: ${params.currency}`);
          }
        }

        // Validate transaction_id for PAID payments
        if (payment.status === "PAID") {
          if (params.transaction_id) {
            result.passed.push(`Transaction ID present for PAID payment: ${params.transaction_id}`);
          }
        }
      }
      
      // Check for conflicting statuses (unless split payment)
      const hasPaid = paymentStatuses.includes("PAID");
      const hasNotPaid = paymentStatuses.includes("NOT-PAID");
      
      if (hasPaid && hasNotPaid && payments.length === 1) {
        result.failed.push(
          `Inconsistent payment status: Single payment cannot be both PAID and NOT-PAID`
        );
      } else if (hasPaid && hasNotPaid && payments.length > 1) {
        // Split payment scenario — show consolidated summary with payment IDs
        const paidIds = payments
          .filter((p: any) => p.status === "PAID")
          .map((p: any) => p.id || 'unknown')
          .join(', ');
        const notPaidIds = payments
          .filter((p: any) => p.status === "NOT-PAID")
          .map((p: any) => p.id || 'unknown')
          .join(', ');
        result.passed.push(
          `Split payment summary: PAID [${paidIds}], NOT-PAID [${notPaidIds}] — expected for split payment flows`
        );
      }
      
      // Validate total payment amount matches quote
      if (quote?.price?.value) {
        const quoteTotal = parseFloat(quote.price.value);
        if (!isNaN(quoteTotal)) {
          const paidPayments = payments.filter(p => p.status === "PAID");
          
          if (paidPayments.length === 1 && payments.length === 1) {
            // Single full payment
            if (Math.abs(totalPaymentAmount - quoteTotal) > 0.01) {
              result.failed.push(
                `Payment amount mismatch: quote total ${quoteTotal}, payment amount ${totalPaymentAmount.toFixed(2)}`
              );
            } else {
              result.passed.push(`Payment amount matches quote total: ${quoteTotal}`);
            }
          } else if (payments.length > 1) {
            // Split payment — validate sum of payment amounts equals quote total
            const paymentsWithAmount = payments.filter(
              (p: any) => p.params?.amount && !isNaN(parseFloat(p.params.amount))
            );
            const sumOfAmounts = paymentsWithAmount.reduce(
              (sum: number, p: any) => sum + parseFloat(p.params.amount), 0
            );

            if (Math.abs(sumOfAmounts - quoteTotal) > 0.01) {
              result.failed.push(
                `Split payment amount mismatch: sum of payments (${sumOfAmounts.toFixed(2)}) does not match quote total (${quoteTotal})`
              );
            } else {
              result.passed.push(
                `Split payment audit trail: ${paymentsWithAmount.length} payment(s) with amounts, total ${sumOfAmounts.toFixed(2)} matches quote ${quoteTotal}`
              );
            }
          }
        }
      }
    }

    // Validate created_at and updated_at
    if (order?.created_at) {
      result.passed.push("Order created_at present");
    }
    if (order?.updated_at) {
      result.passed.push("Order updated_at present");
    }

    // Use shared quote validation
    if (message?.order?.quote) {
      validateOrderQuote(message, result, {
        validateDecimalPlaces: true,
        validateTotalMatch: true,
        validateItemPriceConsistency: false,
        flowId,
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
  } catch (error) {
    result.failed.push(`Validation error: ${error}`);
  }

  return result;
}
