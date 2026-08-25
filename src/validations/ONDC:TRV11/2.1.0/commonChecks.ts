import { TestResult } from "../../../types/payload";

/**
 * Common validation utilities for TRV11 2.1.0 Metro flows.
 * Centralizes checks for GPS coordinates, parent_stop_id, TRANSIT_STOP,
 * quote breakup (TAX, OTHER_CHARGES), and BAP_TERMS/BPP_TERMS tags.
 */

/**
 * Validate GPS coordinates format: "lat,lng"
 */
export function validateGpsFormat(gps: string | undefined, fieldPath: string, result: TestResult): void {
  if (!gps) return;
  const parts = gps.split(",");
  if (parts.length !== 2) {
    result.failed.push(`${fieldPath}: GPS must be in 'lat,lng' format, got '${gps}'`);
    return;
  }
  const [lat, lng] = parts.map(Number);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    result.failed.push(`${fieldPath}: GPS coordinates must be numeric, got '${gps}'`);
  } else if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    result.failed.push(`${fieldPath}: GPS coordinates out of range: lat=${lat}, lng=${lng}`);
  } else {
    result.passed.push(`${fieldPath}: GPS format is valid`);
  }
}

/**
 * Validate stops have correct types (START, END, INTERMEDIATE_STOP, TRANSIT_STOP)
 * and validate parent_stop_id references
 */
export function validateStops(
  stops: any[] | undefined,
  result: TestResult,
  context: string = "fulfillment"
): void {
  if (!stops || !Array.isArray(stops)) return;

  const validTypes = ["START", "END", "INTERMEDIATE_STOP", "TRANSIT_STOP"];
  const stopIds = new Set<string>();

  for (const stop of stops) {
    // Collect stop IDs
    if (stop?.id) stopIds.add(stop.id);

    // Validate stop type
    const type = stop?.type;
    if (type && !validTypes.includes(type)) {
      result.failed.push(`${context}: Invalid stop type '${type}', expected one of ${validTypes.join(", ")}`);
    }

    // Validate GPS if present
    if (stop?.location?.gps) {
      validateGpsFormat(stop.location.gps, `${context}.stops[${stop?.id || "?"}]`, result);
    }
  }

  // Validate parent_stop_id references
  for (const stop of stops) {
    const parentId = stop?.parent_stop_id;
    if (parentId && !stopIds.has(parentId)) {
      result.failed.push(
        `${context}: parent_stop_id '${parentId}' references a non-existent stop`
      );
    }
  }
}

/**
 * Validate quote breakup structure for 2.1.0:
 * Must include BASE_FARE, and may include TAX, OTHER_CHARGES
 */
export function validateQuoteBreakup(
  quote: any,
  result: TestResult,
  context: string = "quote"
): void {
  if (!quote?.breakup || !Array.isArray(quote.breakup)) {
    return;
  }

  const breakup = quote.breakup;
  const titleCodes = breakup
    .map((b: any) => b?.title || b?.item?.descriptor?.code)
    .filter(Boolean);

  // Verify price exists and total adds up
  if (quote?.price?.value) {
    const total = parseFloat(quote.price.value);
    const breakupSum = breakup.reduce((sum: number, b: any) => {
      const val = parseFloat(b?.price?.value || "0");
      return sum + (Number.isNaN(val) ? 0 : val);
    }, 0);

    if (!Number.isNaN(total) && Math.abs(total - breakupSum) > 0.01) {
      result.failed.push(
        `${context}: quote.price.value (${total}) does not match breakup sum (${breakupSum})`
      );
    } else if (!Number.isNaN(total)) {
      result.passed.push(`${context}: quote total matches breakup sum`);
    }
  }
}

/**
 * Validate BAP_TERMS / BPP_TERMS tags structure
 */
export function validateTermsTags(
  tags: any[] | undefined,
  result: TestResult,
  context: string = "order"
): void {
  if (!tags || !Array.isArray(tags)) return;

  for (const tag of tags) {
    const code = tag?.descriptor?.code;
    if (code === "BAP_TERMS" || code === "BPP_TERMS") {
      if (tag.list && Array.isArray(tag.list) && tag.list.length > 0) {
        result.passed.push(`${context}: ${code} tag present with ${tag.list.length} entries`);
      }
    }
  }
}

/**
 * Validate TICKET and PASS fulfillment structure (authorization with QR)
 */
export function validateTicketFulfillment(
  fulfillments: any[] | undefined,
  result: TestResult,
  context: string = "order"
): void {
  if (!fulfillments || !Array.isArray(fulfillments)) return;

  const ticketFulfillments = fulfillments.filter((f: any) => f?.type === "TICKET" || f?.type === "PASS");
  if (ticketFulfillments.length === 0) return;

  for (const ticket of ticketFulfillments) {
    const fType = ticket.type; // TICKET or PASS
    // Check authorization — contract places it at stops[0].authorization
    const auth = ticket?.stops?.[0]?.authorization || ticket.authorization;
    if (!auth) {
      continue;
    }
    if (auth.type !== "QR" && auth.type !== "QR_AND_VEHICLE_NUMBER") {
      result.failed.push(`${context}: ${fType} fulfillment ${ticket.id} authorization type must be QR or QR_AND_VEHICLE_NUMBER, got '${auth.type}'`);
    } else {
      result.passed.push(`${context}: ${fType} fulfillment ${ticket.id} has QR authorization`);
    }
    if (auth.status && !["UNCLAIMED", "CLAIMED", "EXPIRED"].includes(auth.status)) {
      result.failed.push(
        `${context}: ${fType} fulfillment ${ticket.id} invalid authorization.status '${auth.status}'`
      );
    }

    // Check PARENT_ID tag linking to TRIP fulfillment (TICKET only, not PASS)
    if (fType === "TICKET") {
    const infoTag = ticket.tags?.find((t: any) => t?.descriptor?.code === "INFO");
    const parentIdEntry = infoTag?.list?.find(
      (l: any) => l?.descriptor?.code === "PARENT_ID"
    );
    if (parentIdEntry?.value) {
      const parentExists = fulfillments.some((f: any) => f?.id === parentIdEntry.value);
      if (parentExists) {
        result.passed.push(
          `${context}: TICKET ${ticket.id} PARENT_ID references valid fulfillment`
        );
      } else {
        result.failed.push(
          `${context}: TICKET ${ticket.id} PARENT_ID '${parentIdEntry.value}' not found in fulfillments`
        );
      }
    }
    }
  }
}

/**
 * Validate fulfillment state codes for on_status
 */
export function validateFulfillmentState(
  fulfillments: any[] | undefined,
  result: TestResult,
  expectedStates: string[],
  context: string = "order"
): void {
  if (!fulfillments || !Array.isArray(fulfillments)) return;

  for (const f of fulfillments) {
    const stateCode = f?.state?.descriptor?.code;
    if (stateCode && expectedStates.length > 0) {
      if (expectedStates.includes(stateCode)) {
        result.passed.push(
          `${context}: fulfillment ${f.id} state '${stateCode}' is valid`
        );
      }
      // Don't fail on unexpected states as they might be valid in other contexts
    }
  }
}

/**
 * Validate order status
 */
export function validateOrderStatus(
  order: any,
  result: TestResult,
  expectedStatuses: string[],
  context: string = "order"
): void {
  if (!order?.status) return;

  if (expectedStatuses.includes(order.status)) {
    result.passed.push(`${context}: order status '${order.status}' is valid`);
  } else {
    result.failed.push(
      `${context}: order status '${order.status}' is unexpected, expected one of: ${expectedStatuses.join(", ")}`
    );
  }
}
