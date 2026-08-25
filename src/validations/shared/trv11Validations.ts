import { TestResult, Payload } from "../../types/payload";
import assert from "assert";

// Valid values
const VALID_VEHICLE_CATEGORIES = ["METRO", "BUS"];
const VALID_STOP_TYPES = ["START", "END"];
const VALID_COLLECTED_BY = ["BAP", "BPP"];
const GPS_REGEX = /^-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+$/;

export function validateTrv11Intent(
  message: any,
  testResults: TestResult
): void {
  const intent = message?.intent;
  if (!intent) {
    return;
  }

  // Validate Fulfillment
  const fulfillment = intent?.fulfillment;
  if (fulfillment) {
    // Validate Vehicle
    const vehicle = fulfillment?.vehicle;
    if (vehicle?.category) {
      if (!VALID_VEHICLE_CATEGORIES.includes(vehicle.category)) {
        testResults.failed.push(
          `Vehicle category should be one of ${VALID_VEHICLE_CATEGORIES.join(", ")}, found: ${vehicle.category}`
        );
      } else {
        testResults.passed.push(`Vehicle category is valid: ${vehicle.category}`);
      }
    }

    // Validate Stops (Optional for Broad Search, Required for Specific Search)
    const stops = fulfillment?.stops;
    if (stops && Array.isArray(stops) && stops.length > 0) {
      stops.forEach((stop: any, index: number) => {
        // Validate Stop Type
        if (stop.type) {
          if (!VALID_STOP_TYPES.includes(stop.type)) {
            testResults.failed.push(`Stop ${index}: type should be START or END, found: ${stop.type}`);
          } else {
            testResults.passed.push(`Stop ${index}: type is valid (${stop.type})`);
          }
        }

        // Validate Location (GPS or Descriptor Code)
        const gps = stop?.location?.gps;
        const descriptorCode = stop?.location?.descriptor?.code;

        if (gps) {
          if (!GPS_REGEX.test(gps)) {
            testResults.failed.push(`Stop ${index}: location.gps format is invalid (expected "lat,long"), found: ${gps}`);
          } else {
            testResults.passed.push(`Stop ${index}: location.gps is valid`);
          }
        } else if (descriptorCode) {
           testResults.passed.push(`Stop ${index}: location.descriptor.code is present (${descriptorCode})`);
        } else {
           testResults.failed.push(`Stop ${index}: location must have either gps or descriptor.code`);
        }
      });
    } else {
      // Broad Search (No stops)
      testResults.passed.push("Fulfillment stops are not present (Broad Search valid)");
    }
  }

  // Validate Payment
  const payment = intent?.payment;
  if (payment) {
    // Validate Collected By
    if (payment.collected_by) {
      if (!VALID_COLLECTED_BY.includes(payment.collected_by)) {
        testResults.failed.push(
          `Payment collected_by is invalid. Expected one of: ${VALID_COLLECTED_BY.join(", ")}, found: ${payment.collected_by}`
        );
      } else {
        testResults.passed.push(`Payment collected_by is valid: ${payment.collected_by}`);
      }
    }

    // Validate Tags (BFF and Settlement Terms)
    const tags = payment.tags;
    if (tags && Array.isArray(tags)) {
      // Check Buyer Finder Fees
      const bffTag = tags.find((t: any) => t?.descriptor?.code === "BUYER_FINDER_FEES");
      if (bffTag) {
        const percentage = bffTag.list?.find((l: any) => l?.descriptor?.code === "BUYER_FINDER_FEES_PERCENTAGE");
        if (percentage?.value) {
          testResults.passed.push(`BUYER_FINDER_FEES_PERCENTAGE is present: ${percentage.value}`);
        }
      }

      // Check Settlement Terms
      const termsTag = tags.find((t: any) => t?.descriptor?.code === "SETTLEMENT_TERMS");
      if (termsTag) {
        const delayInterest = termsTag.list?.find((l: any) => l?.descriptor?.code === "DELAY_INTEREST");
        const staticTerms = termsTag.list?.find((l: any) => l?.descriptor?.code === "STATIC_TERMS");

        if (delayInterest?.value && staticTerms?.value) {
           testResults.passed.push("SETTLEMENT_TERMS (DELAY_INTEREST and STATIC_TERMS) are present");
        }
      }
    }
  }
}

// Additional Valid Values for OnSearch
// Bus catalog also uses TICKET (preloaded tickets), STOPS (stop-only catalog), AGENT_TICKETING (agent login item)
const VALID_FULFILLMENT_TYPES = ["ROUTE", "TRIP", "ONLINE", "PASS", "TICKET", "STOPS", "AGENT_TICKETING"];
const VALID_ON_SEARCH_STOP_TYPES = ["START", "END", "INTERMEDIATE_STOP", "TRANSIT_STOP"];

export function validateTrv11OnSearch(
  message: any,
  testResults: TestResult
): void {
  const catalog = message?.catalog;
  if (!catalog) {
    return;
  }

  // Validate Providers
  const providers = catalog.providers;
  if (!providers || !Array.isArray(providers) || providers.length === 0) {
    return;
  }

  providers.forEach((provider: any, pIndex: number) => {
    // Validate Fulfillments
    const fulfillments = provider.fulfillments;
    if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
      fulfillments.forEach((fulfillment: any, fIndex: number) => {
        // Validate Type
        if (fulfillment.type) {
          if (!VALID_FULFILLMENT_TYPES.includes(fulfillment.type)) {
            testResults.failed.push(`Provider ${pIndex} Fulfillment ${fIndex}: type should be one of ${VALID_FULFILLMENT_TYPES.join(", ")}, found: ${fulfillment.type}`);
          }
        }

        // Validate Stops — strict validation only for ROUTE and TRIP fulfillments
        // PASS and ONLINE fulfillments have different/optional stop structures
        if (fulfillment.type === "ROUTE" || fulfillment.type === "TRIP") {
          const stops = fulfillment.stops;
          if (stops && Array.isArray(stops) && stops.length > 0) {
              // Check Stops Logic
              stops.forEach((stop: any, sIndex: number) => {
                  // Type check
                  if (stop.type) {
                      if (!VALID_ON_SEARCH_STOP_TYPES.includes(stop.type)) {
                          testResults.failed.push(`Provider ${pIndex} Fulfillment ${fIndex} Stop ${sIndex}: type is invalid. Found: ${stop.type}`);
                      }
                  }

                  // Location check (GPS + Descriptor)
                  // For Bus ROUTE/STOPS pagination, stops only carry id+type — location is optional
                   if (stop.location) {
                       const gps = stop.location.gps;
                       const code = stop.location.descriptor?.code;

                       if (!gps && !code) {
                           testResults.failed.push(`Provider ${pIndex} Fulfillment ${fIndex} Stop ${sIndex}: location must have gps or descriptor.code`);
                       }
                       if (gps && !GPS_REGEX.test(gps)) {
                           testResults.failed.push(`Provider ${pIndex} Fulfillment ${fIndex} Stop ${sIndex}: gps format invalid`);
                       }
                   }
              });
          }
        }
      });
    }

    // Validate Items (Optional for Route/Catalog flow)
    const items = provider.items;
    if (items && Array.isArray(items) && items.length > 0) {
        items.forEach((item: any, iIndex: number) => {
            if (item.price) {
                if (item.price.currency !== "INR") testResults.failed.push(`Provider ${pIndex} Item ${iIndex}: price.currency should be INR`);
            }
        });
        testResults.passed.push(`Provider ${pIndex}: items validated (${items.length} items)`);
    } else {
         testResults.passed.push(`Provider ${pIndex}: No items present (Acceptable for Route Catalog)`);
    }
  });
}

// Valid fulfillment types for OnSelect
// Bus on_select also uses ROUTE (route selection) and AGENT_TICKETING (agent login)
const VALID_ON_SELECT_FULFILLMENT_TYPES = ["TRIP", "TICKET", "ONLINE", "PASS", "ROUTE", "AGENT_TICKETING"];

/**
 * Validates TRV11 Select request
 */
export function validateTrv11Select(
  message: any,
  testResults: TestResult
): void {
  const order = message?.order;
  if (!order) {
    return;
  }

  // Validate Provider
  if (order.provider?.id) {
    testResults.passed.push(`Provider ID is present: ${order.provider.id}`);
  }

  // Validate Items
  const items = order.items;
  if (items && Array.isArray(items) && items.length > 0) {
    items.forEach((item: any, index: number) => {
      if (item.id) {
        testResults.passed.push(`Item ${index}: id is present (${item.id})`);
      }

      // Validate quantity
      const selectedCount = item.quantity?.selected?.count;
      if (selectedCount !== undefined && selectedCount !== null) {
        if (typeof selectedCount !== "number" || selectedCount < 1) {
          testResults.failed.push(`Item ${index}: quantity.selected.count must be a positive number`);
        } else {
          testResults.passed.push(`Item ${index}: quantity.selected.count is valid (${selectedCount})`);
        }
      }
    });
  }
}

/**
 * Validates TRV11 OnSelect response
 */
export function validateTrv11OnSelect(
  message: any,
  testResults: TestResult
): void {
  const order = message?.order;
  if (!order) {
    return;
  }

  // Validate Provider
  if (order.provider?.id) {
    testResults.passed.push(`Provider ID is present: ${order.provider.id}`);
  }

  // Validate Items
  const items = order.items;
  if (items && Array.isArray(items) && items.length > 0) {
    testResults.passed.push(`Items validated (${items.length} items)`);
  }

  // Validate Fulfillments
  const fulfillments = order.fulfillments;
  if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
    fulfillments.forEach((fulfillment: any, fIndex: number) => {
      if (fulfillment.type) {
        if (!VALID_ON_SELECT_FULFILLMENT_TYPES.includes(fulfillment.type)) {
          testResults.failed.push(`Fulfillment ${fIndex}: type must be one of ${VALID_ON_SELECT_FULFILLMENT_TYPES.join(", ")}, found: ${fulfillment.type}`);
        }
      }
    });
    testResults.passed.push(`Fulfillments validated (${fulfillments.length} fulfillments)`);
  }

  // Validate Quote
  const quote = order.quote;
  if (quote) {
    if (quote.breakup && Array.isArray(quote.breakup) && quote.breakup.length > 0) {
      testResults.passed.push(`Quote breakup validated (${quote.breakup.length} items)`);
    }
  }

  // Validate Cancellation Terms (optional but if present, check structure)
  const cancellationTerms = order.cancellation_terms;
  if (cancellationTerms && Array.isArray(cancellationTerms) && cancellationTerms.length > 0) {
    testResults.passed.push("Cancellation terms are present");
  }
}

// Valid payment statuses and types for TRV11
const VALID_PAYMENT_STATUSES = ["PAID", "NOT-PAID"];
const VALID_PAYMENT_TYPES = ["PRE-ORDER", "ON-ORDER", "ON-FULFILLMENT", "POST-FULFILLMENT"];

/**
 * Validates TRV11 Init request
 */
export function validateTrv11Init(
  message: any,
  testResults: TestResult
): void {
  const order = message?.order;
  if (!order) {
    return;
  }

  // Validate Provider
  if (order.provider?.id) {
    testResults.passed.push(`Provider ID is present: ${order.provider.id}`);
  }

  // Validate Items
  const items = order.items;
  if (items && Array.isArray(items) && items.length > 0) {
    testResults.passed.push(`Items validated (${items.length} items)`);
  }

  // Validate Billing
  const billing = order.billing;
  if (billing) {
    if (billing.name && billing.phone) {
      testResults.passed.push("Billing info is valid");
    }
  }

  // Validate Payments
  const payments = order.payments;
  if (payments && Array.isArray(payments) && payments.length > 0) {
    payments.forEach((payment: any, pIndex: number) => {
      if (payment.collected_by) {
        if (!VALID_COLLECTED_BY.includes(payment.collected_by)) {
          testResults.failed.push(`Payment ${pIndex}: collected_by must be BAP or BPP`);
        }
      }

      if (payment.status) {
        if (!VALID_PAYMENT_STATUSES.includes(payment.status)) {
          testResults.failed.push(`Payment ${pIndex}: status must be one of ${VALID_PAYMENT_STATUSES.join(", ")}`);
        }
      }

      if (payment.type) {
        if (!VALID_PAYMENT_TYPES.includes(payment.type)) {
          testResults.failed.push(`Payment ${pIndex}: type must be one of ${VALID_PAYMENT_TYPES.join(", ")}`);
        }
      }
    });
    testResults.passed.push(`Payments validated (${payments.length} payments)`);
  }
}

/**
 * Validates TRV11 OnInit response
 */
export function validateTrv11OnInit(
  message: any,
  testResults: TestResult
): void {
  const order = message?.order;
  if (!order) {
    return;
  }

  // Validate Provider
  if (order.provider?.id) {
    testResults.passed.push(`Provider ID is present: ${order.provider.id}`);
  }

  // Validate Items
  const items = order.items;
  if (items && Array.isArray(items) && items.length > 0) {
    testResults.passed.push(`Items validated (${items.length} items)`);
  }

  // Validate Fulfillments
  const fulfillments = order.fulfillments;
  if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
    testResults.passed.push(`Fulfillments validated (${fulfillments.length} fulfillments)`);
  }

  // Validate Billing
  const billing = order.billing;
  if (billing) {
    if (billing.name && billing.phone) {
      testResults.passed.push("Billing info is valid");
    }
  }

  // Validate Quote
  const quote = order.quote;
  if (quote) {
    if (quote.breakup && Array.isArray(quote.breakup) && quote.breakup.length > 0) {
      testResults.passed.push(`Quote breakup validated (${quote.breakup.length} items)`);
    }
  }

  // Validate Payments
  const payments = order.payments;
  if (payments && Array.isArray(payments) && payments.length > 0) {
    testResults.passed.push(`Payments validated (${payments.length} payments)`);
  }

  // Validate Cancellation Terms (optional)
  const cancellationTerms = order.cancellation_terms;
  if (cancellationTerms && Array.isArray(cancellationTerms) && cancellationTerms.length > 0) {
    testResults.passed.push("Cancellation terms are present");
  }
}

// Valid order statuses for TRV11
const VALID_ORDER_STATUSES = ["ACTIVE", "COMPLETE", "COMPLETED", "CANCELLED"];

/**
 * Validates TRV11 Confirm request
 */
export function validateTrv11Confirm(
  message: any,
  testResults: TestResult
): void {
  const order = message?.order;
  if (!order) {
    return;
  }

  // Validate Provider
  if (order.provider?.id) {
    testResults.passed.push(`Provider ID is present: ${order.provider.id}`);
  }

  // Validate Items
  const items = order.items;
  if (items && Array.isArray(items) && items.length > 0) {
    testResults.passed.push(`Items validated (${items.length} items)`);
  }

  // Validate Billing
  const billing = order.billing;
  if (billing) {
    if (billing.name && billing.phone) {
      testResults.passed.push("Billing info is valid");
    }
  }

  // Validate Payments (should be PAID in confirm)
  const payments = order.payments;
  if (payments && Array.isArray(payments) && payments.length > 0) {
    payments.forEach((payment: any, pIndex: number) => {
      // Status should be PAID in confirm
      if (payment.status !== "PAID") {
        testResults.failed.push(`Payment ${pIndex}: status should be PAID in confirm, found: ${payment.status}`);
      } else {
        testResults.passed.push(`Payment ${pIndex}: status is PAID`);
      }

      // Validate payment params (transaction details)
      const params = payment.params;
      if (params) {
        if (params.transaction_id && params.amount) {
          testResults.passed.push(`Payment ${pIndex}: transaction params are valid`);
        }
      }
    });
    testResults.passed.push(`Payments validated (${payments.length} payments)`);
  }
}

/**
 * Validates TRV11 OnConfirm response
 */
export function validateTrv11OnConfirm(
  message: any,
  testResults: TestResult
): void {
  const order = message?.order;
  if (!order) {
    return;
  }

  // Validate Order ID (required in on_confirm)
  if (order.id) {
    testResults.passed.push(`Order ID is present: ${order.id}`);
  }

  // Validate Order Status
  if (order.status) {
    if (!VALID_ORDER_STATUSES.includes(order.status)) {
      testResults.failed.push(`Order status must be one of ${VALID_ORDER_STATUSES.join(", ")}, found: ${order.status}`);
    } else {
      testResults.passed.push(`Order status is valid: ${order.status}`);
    }
  }

  // Validate Provider
  if (order.provider?.id) {
    testResults.passed.push(`Provider ID is present: ${order.provider.id}`);
  }

  // Validate Items
  const items = order.items;
  if (items && Array.isArray(items) && items.length > 0) {
    testResults.passed.push(`Items validated (${items.length} items)`);
  }

  // Validate Fulfillments
  const fulfillments = order.fulfillments;
  if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
    fulfillments.forEach((fulfillment: any, fIndex: number) => {
      // For TICKET fulfillment, validate authorization (QR code)
      if (fulfillment.type === "TICKET") {
        // Check for authorization in stops
        const stops = fulfillment.stops;
        if (stops && stops.length > 0) {
          const startStop = stops.find((s: any) => s.type === "START");
          if (startStop?.authorization) {
            const auth = startStop.authorization;
            if (auth.type && auth.token) {
              testResults.passed.push(`Fulfillment ${fIndex} (TICKET): authorization is valid (${auth.type})`);
            }
          }
        }

        // Check for TICKET_INFO tag
        const ticketInfoTag = fulfillment.tags?.find((t: any) => t?.descriptor?.code === "TICKET_INFO");
        if (ticketInfoTag) {
          testResults.passed.push(`Fulfillment ${fIndex} (TICKET): TICKET_INFO tag is present`);
        }
      }
    });
    testResults.passed.push(`Fulfillments validated (${fulfillments.length} fulfillments)`);
  }

  // Validate Billing
  const billing = order.billing;
  if (billing) {
    if (billing.name && billing.phone) {
      testResults.passed.push("Billing info is valid");
    }
  }

  // Validate Quote
  const quote = order.quote;
  if (quote) {
    if (quote.breakup && Array.isArray(quote.breakup) && quote.breakup.length > 0) {
      testResults.passed.push(`Quote breakup validated (${quote.breakup.length} items)`);
    }
  }

  // Validate Payments
  const payments = order.payments;
  if (payments && Array.isArray(payments) && payments.length > 0) {
    payments.forEach((payment: any, pIndex: number) => {
      // Validate payment params
      const params = payment.params;
      if (params) {
        if (params.transaction_id) {
          testResults.passed.push(`Payment ${pIndex}: transaction_id is present`);
        }
      }
    });
    testResults.passed.push(`Payments validated (${payments.length} payments)`);
  }

  // Validate timestamps
  if (order.created_at && order.updated_at) {
    testResults.passed.push("Order timestamps are present");
  }

  // Validate Cancellation Terms (optional)
  const cancellationTerms = order.cancellation_terms;
  if (cancellationTerms && Array.isArray(cancellationTerms) && cancellationTerms.length > 0) {
    testResults.passed.push("Cancellation terms are present");
  }
}

/**
 * Validates TRV11 Status request
 * Accepts either order_id (normal flow) or ref_id (technical/delayed cancellation flows)
 */
export function validateTrv11Status(
  message: any,
  testResults: TestResult
): void {
  // Status request can have order_id OR ref_id
  const orderId = message?.order_id;
  const refId = message?.ref_id;

  if (orderId) {
    testResults.passed.push(`order_id is present: ${orderId}`);
  } else if (refId) {
    testResults.passed.push(`ref_id is present: ${refId} (technical/delayed cancellation flow)`);
  }
}

/**
 * Validates TRV11 OnStatus response
 */
export function validateTrv11OnStatus(
  message: any,
  testResults: TestResult
): void {
  const order = message?.order;
  if (!order) {
    return;
  }

  // Validate Order ID
  if (order.id) {
    testResults.passed.push(`Order ID is present: ${order.id}`);
  }

  // Validate Order Status
  if (order.status) {
    if (!VALID_ORDER_STATUSES.includes(order.status)) {
      testResults.failed.push(`Order status must be one of ${VALID_ORDER_STATUSES.join(", ")}, found: ${order.status}`);
    } else {
      testResults.passed.push(`Order status is valid: ${order.status}`);
    }
  }

  // Validate Provider
  if (order.provider?.id) {
    testResults.passed.push(`Provider ID is present: ${order.provider.id}`);
  }

  // Validate Items
  const items = order.items;
  if (items && Array.isArray(items) && items.length > 0) {
    testResults.passed.push(`Items validated (${items.length} items)`);
  }

  // Validate Fulfillments
  const fulfillments = order.fulfillments;
  if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
    fulfillments.forEach((fulfillment: any, fIndex: number) => {
      // For TICKET fulfillment, validate authorization
      if (fulfillment.type === "TICKET") {
        // Check for authorization in stops
        const stops = fulfillment.stops;
        if (stops && stops.length > 0) {
          const startStop = stops.find((s: any) => s.type === "START");
          if (startStop?.authorization) {
            const auth = startStop.authorization;
            if (auth.type && auth.token && auth.status) {
              testResults.passed.push(`Fulfillment ${fIndex} (TICKET): authorization is valid (${auth.type}, ${auth.status})`);
            }
          }
        }
      }
    });
    testResults.passed.push(`Fulfillments validated (${fulfillments.length} fulfillments)`);
  }

  // Validate Billing
  const billing = order.billing;
  if (billing) {
    if (billing.name && billing.phone) {
      testResults.passed.push("Billing info is valid");
    }
  }

  // Validate Quote
  const quote = order.quote;
  if (quote) {
    if (quote.breakup && Array.isArray(quote.breakup) && quote.breakup.length > 0) {
      testResults.passed.push(`Quote breakup validated (${quote.breakup.length} items)`);
    }
  }

  // Validate Payments
  const payments = order.payments;
  if (payments && Array.isArray(payments) && payments.length > 0) {
    testResults.passed.push(`Payments validated (${payments.length} payments)`);
  }

  // Validate timestamps
  if (order.created_at && order.updated_at) {
    testResults.passed.push("Order timestamps are present");
  }

  // Validate Cancellation Terms (optional)
  const cancellationTerms = order.cancellation_terms;
  if (cancellationTerms && Array.isArray(cancellationTerms) && cancellationTerms.length > 0) {
    testResults.passed.push("Cancellation terms are present");
  }
}

// Valid cancel descriptor codes for TRV11
const VALID_CANCEL_CODES = ["SOFT_CANCEL", "CONFIRM_CANCEL"];
// Valid cancel statuses (for on_cancel response)
const VALID_CANCEL_STATUSES = ["SOFT_CANCEL", "CANCELLED"];

/**
 * Validates TRV11 Cancel request
 */
export function validateTrv11Cancel(
  message: any,
  testResults: TestResult
): void {
  // Validate order_id
  const orderId = message?.order_id;
  if (orderId) {
    testResults.passed.push(`order_id is present: ${orderId}`);
  }

  // Validate cancellation_reason_id
  const reasonId = message?.cancellation_reason_id;
  if (reasonId) {
    testResults.passed.push(`cancellation_reason_id is present: ${reasonId}`);
  }

  // Validate descriptor with cancel type
  const descriptor = message?.descriptor;
  if (descriptor) {
    if (descriptor.code) {
      if (!VALID_CANCEL_CODES.includes(descriptor.code)) {
        testResults.failed.push(`descriptor.code must be one of ${VALID_CANCEL_CODES.join(", ")}, found: ${descriptor.code}`);
      } else {
        testResults.passed.push(`Cancel type is valid: ${descriptor.code}`);
      }
    }
  }
}

/**
 * Validates TRV11 OnCancel response
 */
export function validateTrv11OnCancel(
  message: any,
  testResults: TestResult
): void {
  const order = message?.order;
  if (!order) {
    return;
  }

  // Validate Order ID
  if (order.id) {
    testResults.passed.push(`Order ID is present: ${order.id}`);
  }

  // Validate Order Status (should be SOFT_CANCEL or CANCELLED)
  if (order.status) {
    if (!VALID_CANCEL_STATUSES.includes(order.status)) {
      testResults.failed.push(`Order status must be one of ${VALID_CANCEL_STATUSES.join(", ")}, found: ${order.status}`);
    } else {
      testResults.passed.push(`Order status is valid: ${order.status}`);
    }
  }

  // Validate Provider
  if (order.provider?.id) {
    testResults.passed.push(`Provider ID is present: ${order.provider.id}`);
  }

  // Validate Items
  const items = order.items;
  if (items && Array.isArray(items) && items.length > 0) {
    testResults.passed.push(`Items validated (${items.length} items)`);
  }

  // Validate Fulfillments
  const fulfillments = order.fulfillments;
  if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
    testResults.passed.push(`Fulfillments validated (${fulfillments.length} fulfillments)`);
  }

  // Validate Billing
  const billing = order.billing;
  if (billing) {
    if (billing.name && billing.phone) {
      testResults.passed.push("Billing info is valid");
    }
  }

  // Validate Quote (should include REFUND and CANCELLATION_CHARGES in breakup)
  const quote = order.quote;
  if (quote) {
    if (quote.breakup && Array.isArray(quote.breakup) && quote.breakup.length > 0) {
      // Check for REFUND in breakup
      const hasRefund = quote.breakup.some((b: any) => b.title === "REFUND");
      if (hasRefund) {
        testResults.passed.push("Quote breakup includes REFUND");
      }
      // Check for CANCELLATION_CHARGES in breakup
      const hasCancellationCharges = quote.breakup.some((b: any) => b.title === "CANCELLATION_CHARGES");
      if (hasCancellationCharges) {
        testResults.passed.push("Quote breakup includes CANCELLATION_CHARGES");
      }
      testResults.passed.push(`Quote breakup validated (${quote.breakup.length} items)`);
    }
  }

  // Validate Payments
  const payments = order.payments;
  if (payments && Array.isArray(payments) && payments.length > 0) {
    testResults.passed.push(`Payments validated (${payments.length} payments)`);
  }

  // Validate Cancellation object
  const cancellation = order.cancellation;
  if (cancellation) {
    if (cancellation.cancelled_by) {
      testResults.passed.push(`Cancelled by: ${cancellation.cancelled_by}`);
    }

    if (cancellation.reason?.descriptor?.code) {
      testResults.passed.push(`Cancellation reason code: ${cancellation.reason.descriptor.code}`);
    }
  }

  // Validate timestamps
  if (order.created_at && order.updated_at) {
    testResults.passed.push("Order timestamps are present");
  }

  // Validate Cancellation Terms (optional)
  const cancellationTerms = order.cancellation_terms;
  if (cancellationTerms && Array.isArray(cancellationTerms) && cancellationTerms.length > 0) {
    testResults.passed.push("Cancellation terms are present");
  }
}

// Valid update targets for TRV11
// Bus also uses order.billing (billing update) and order.quote (quote update)
const VALID_UPDATE_TARGETS = ["order.fulfillments", "payments", "order.billing", "order.quote"];
// Bus on_update uses ACTIVE (vehicle confirmation flows) and COMPLETED (journey completion)
const VALID_UPDATE_STATUSES = ["SOFT_UPDATE", "CONFIRM_UPDATE", "UPDATED", "CANCELLED", "CANCELLATION_INITIATED", "ACTIVE", "COMPLETED", "COMPLETE"];

/**
 * Validates TRV11 Update request
 */
export function validateTrv11Update(
  message: any,
  testResults: TestResult
): void {
  // Validate update_target
  const updateTarget = message?.update_target;
  if (updateTarget) {
    if (!VALID_UPDATE_TARGETS.includes(updateTarget)) {
      testResults.failed.push(`update_target must be one of ${VALID_UPDATE_TARGETS.join(", ")}, found: ${updateTarget}`);
    } else {
      testResults.passed.push(`update_target is valid: ${updateTarget}`);
    }
  }

  // Validate order
  const order = message?.order;
  if (!order) {
    return;
  }

  // Validate Order ID
  if (order.id) {
    testResults.passed.push(`Order ID is present: ${order.id}`);
  }

  // Validate based on update_target
  if (updateTarget === "order.fulfillments") {
    // For fulfillment updates, validate status and fulfillments
    if (order.status) {
      if (order.status !== "SOFT_UPDATE" && order.status !== "CONFIRM_UPDATE") {
        testResults.failed.push(`Order status for fulfillment update must be SOFT_UPDATE or CONFIRM_UPDATE, found: ${order.status}`);
      } else {
        testResults.passed.push(`Update type: ${order.status}`);
      }
    }

    // Validate fulfillments are present
    const fulfillments = order.fulfillments;
    if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
      fulfillments.forEach((fulfillment: any, fIndex: number) => {
        // Check for stops with END type (destination change)
        const stops = fulfillment.stops;
        if (stops && Array.isArray(stops)) {
          const hasEnd = stops.some((s: any) => s.type === "END");
          if (hasEnd) {
            testResults.passed.push(`Fulfillment ${fIndex}: END stop update specified`);
          }
        }
      });
      testResults.passed.push(`Fulfillments validated (${fulfillments.length} fulfillments)`);
    }
  } else if (updateTarget === "payments") {
    // For payment updates, validate payments array
    const payments = order.payments;
    if (payments && Array.isArray(payments) && payments.length > 0) {
      payments.forEach((payment: any, pIndex: number) => {
        // For payment updates, params with transaction details are expected
        if (payment.status === "PAID") {
          const params = payment.params;
          if (params) {
            if (params.transaction_id && params.amount) {
              testResults.passed.push(`Payment ${pIndex}: transaction params are valid`);
            }
          }
        }
      });
      testResults.passed.push(`Payments validated (${payments.length} payments)`);
    }
  }
}

/**
 * Validates TRV11 OnUpdate response
 */
export function validateTrv11OnUpdate(
  message: any,
  testResults: TestResult
): void {
  const order = message?.order;
  if (!order) {
    return;
  }

  // Validate Order ID
  if (order.id) {
    testResults.passed.push(`Order ID is present: ${order.id}`);
  }

  // Validate Order Status
  if (order.status) {
    if (!VALID_UPDATE_STATUSES.includes(order.status)) {
      testResults.failed.push(`Order status must be one of ${VALID_UPDATE_STATUSES.join(", ")}, found: ${order.status}`);
    } else {
      testResults.passed.push(`Order status is valid: ${order.status}`);
    }
  }

  // Validate Provider
  if (order.provider?.id) {
    testResults.passed.push(`Provider ID is present: ${order.provider.id}`);
  }

  // Validate Items
  const items = order.items;
  if (items && Array.isArray(items) && items.length > 0) {
    testResults.passed.push(`Items validated (${items.length} items)`);
  }

  // Validate Fulfillments
  const fulfillments = order.fulfillments;
  if (fulfillments && Array.isArray(fulfillments) && fulfillments.length > 0) {
    fulfillments.forEach((fulfillment: any, fIndex: number) => {
      // For TICKET fulfillment, validate authorization
      if (fulfillment.type === "TICKET") {
        // Check for authorization in stops
        const stops = fulfillment.stops;
        if (stops && stops.length > 0) {
          const startStop = stops.find((s: any) => s.type === "START");
          if (startStop?.authorization) {
            const auth = startStop.authorization;
            if (auth.type && auth.token) {
              testResults.passed.push(`Fulfillment ${fIndex} (TICKET): authorization is present`);
            }
          }
        }
      }
    });
    testResults.passed.push(`Fulfillments validated (${fulfillments.length} fulfillments)`);
  }

  // Validate Billing
  const billing = order.billing;
  if (billing) {
    if (billing.name && billing.phone) {
      testResults.passed.push("Billing info is valid");
    }
  }

  // Validate Quote
  const quote = order.quote;
  if (quote) {
    if (quote.breakup && Array.isArray(quote.breakup) && quote.breakup.length > 0) {
      testResults.passed.push(`Quote breakup validated (${quote.breakup.length} items)`);
    }
  }

  // Validate Payments
  const payments = order.payments;
  if (payments && Array.isArray(payments) && payments.length > 0) {
    testResults.passed.push(`Payments validated (${payments.length} payments)`);
  }

  // Validate timestamps
  if (order.created_at && order.updated_at) {
    testResults.passed.push("Order timestamps are present");
  }

  // Validate Cancellation Terms (optional)
  const cancellationTerms = order.cancellation_terms;
  if (cancellationTerms && Array.isArray(cancellationTerms) && cancellationTerms.length > 0) {
    testResults.passed.push("Cancellation terms are present");
  }
}
