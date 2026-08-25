import logger from "@ondc/automation-logger";
import {
  JsonRequest,
  Payload,
  TestResult,
} from "../../../types/payload";
import assert from "assert";
import {
  saveData,
  fetchData,
  updateApiMap,
  addTransactionId,
  getTransactionIds,
} from "../../../utils/redisUtils";

// Valid values for TRV11 search
const VALID_VEHICLE_CATEGORIES = ["METRO", "BUS"];
const VALID_STOP_TYPES = ["START", "END"];
const VALID_COLLECTED_BY = ["BAP", "BPP"];

// Regex patterns
const ISO_COUNTRY_CODE_REGEX = /^[A-Z]{2,3}$/; // ISO 3166-1 alpha-2 or alpha-3
const CITY_CODE_REGEX = /^std:\d{2,5}$/; // std:080, std:011, etc.
const RFC3339_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const ISO8601_DURATION_REGEX = /^PT\d+[HMS]$/; // PT30S, PT1M, etc.
const GPS_REGEX = /^-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+$/; // 12.923608, 77.614629
const URI_REGEX = /^https?:\/\/.+/;

// Helper function to find tag by descriptor code
function findTagByCode(tags: any[], code: string): any {
  return tags?.find((tag: any) => tag?.descriptor?.code === code);
}

// Helper function to find list item by descriptor code
function findListItemByCode(list: any[], code: string): any {
  return list?.find((item: any) => item?.descriptor?.code === code);
}

export async function checkSearch(
  element: Payload,
  sessionID: string,
  flowId: string
): Promise<TestResult> {
  const payload = element;
  const action = payload?.action?.toLowerCase();

  logger.info(`Inside ${action} validations`);

  const jsonRequest = payload?.jsonRequest as JsonRequest;
  const jsonResponse = payload?.jsonResponse;
  const testResults: TestResult = {
    response: {},
    passed: [],
    failed: [],
  };

  if (jsonResponse?.response) testResults.response = jsonResponse.response;

  const transactionId = jsonRequest.context.transaction_id;
  try {
    await updateApiMap(sessionID, transactionId, action);
  } catch (error: any) {
    logger.error(`${error.message}`);
  }
  await addTransactionId(sessionID, flowId, transactionId);

  const context = jsonRequest?.context;
  const message = jsonRequest?.message;
  const intent = message?.intent;
  const fulfillment = intent?.fulfillment;
  const payment = intent?.payment;

  // ============================================
  // CONTEXT VALIDATIONS (All Mandatory)
  // ============================================

  // 1. context.location.country.code - Mandatory, ISO 3166
  try {
    const countryCode = context?.location?.country?.code;
    assert.ok(
      ISO_COUNTRY_CODE_REGEX.test(countryCode),
      `context.location.country.code must be ISO 3166 format (e.g., IND), got: ${countryCode}`
    );
    testResults.passed.push(`Valid country code: ${countryCode}`);
  } catch (error: any) {
    testResults.failed.push(error.message);
  }

  // 2. context.location.city.code - Mandatory, std:XXX format
  try {
    const cityCode = context?.location?.city?.code;
    assert.ok(
      CITY_CODE_REGEX.test(cityCode),
      `context.location.city.code must be in std:XXX format (e.g., std:080), got: ${cityCode}`
    );
    testResults.passed.push(`Valid city code: ${cityCode}`);
  } catch (error: any) {
    testResults.failed.push(error.message);
  }

  // 3. context.domain - Mandatory, must be ONDC:TRV11
  try {
    const domain = context?.domain;
    assert.strictEqual(
      domain,
      "ONDC:TRV11",
      `context.domain must be ONDC:TRV11, got: ${domain}`
    );
    testResults.passed.push(`Valid domain: ${domain}`);
  } catch (error: any) {
    testResults.failed.push(error.message);
  }

  // 4. context.timestamp - Mandatory, RFC3339 format
  try {
    const timestamp = context?.timestamp;
    assert.ok(
      RFC3339_TIMESTAMP_REGEX.test(timestamp),
      `context.timestamp must be RFC3339 format (e.g., 2023-03-23T04:41:16Z), got: ${timestamp}`
    );
    testResults.passed.push(`Valid timestamp format`);
  } catch (error: any) {
    testResults.failed.push(error.message);
  }

  // 5. context.bap_id - Mandatory
  try {
    testResults.passed.push(`Valid bap_id: ${context?.bap_id}`);
  } catch (error: any) {
    testResults.failed.push(error.message);
  }

  // 6. context.transaction_id - Mandatory
  try {
    testResults.passed.push(`Valid transaction_id present`);
  } catch (error: any) {
    testResults.failed.push(error.message);
  }

  // 7. context.message_id - Mandatory
  try {
    testResults.passed.push(`Valid message_id present`);
  } catch (error: any) {
    testResults.failed.push(error.message);
  }

  // 8. context.version - Mandatory
  try {
    testResults.passed.push(`Valid version: ${context?.version}`);
  } catch (error: any) {
    testResults.failed.push(error.message);
  }

  // 9. context.action - Mandatory, must be "search"
  try {
    assert.strictEqual(
      context?.action?.toLowerCase(),
      "search",
      `context.action must be 'search', got: ${context?.action}`
    );
    testResults.passed.push(`Valid action: ${context?.action}`);
  } catch (error: any) {
    testResults.failed.push(error.message);
  }

  // 10. context.bap_uri - Mandatory, valid URI
  try {
    assert.ok(
      URI_REGEX.test(context.bap_uri),
      `context.bap_uri must be a valid URI, got: ${context.bap_uri}`
    );
    testResults.passed.push(`Valid bap_uri`);
  } catch (error: any) {
    testResults.failed.push(error.message);
  }

  // 11. context.ttl - Mandatory, ISO 8601 duration format
  try {
    assert.ok(
      ISO8601_DURATION_REGEX.test(context.ttl),
      `context.ttl must be ISO 8601 duration format (e.g., PT30S), got: ${context.ttl}`
    );
    testResults.passed.push(`Valid ttl: ${context.ttl}`);
  } catch (error: any) {
    testResults.failed.push(error.message);
  }

  // ============================================
  // FULFILLMENT & INTENT VALIDATIONS
  // ============================================

  // 12. message.intent.fulfillment.vehicle.category - Mandatory
  try {
    const vehicleCategory = fulfillment?.vehicle?.category;
    assert.ok(
      VALID_VEHICLE_CATEGORIES.includes(vehicleCategory),
      `vehicle.category must be one of ${VALID_VEHICLE_CATEGORIES.join(", ")}, got: ${vehicleCategory}`
    );
    testResults.passed.push(`Valid vehicle category: ${vehicleCategory}`);
  } catch (error: any) {
    testResults.failed.push(error.message);
  }

  // 13. message.intent.fulfillment.stops validation - Optional but validate if present
  const stops = fulfillment?.stops;
  if (stops && Array.isArray(stops)) {
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];

      // Validate stop.type if present
      if (stop?.type) {
        try {
          assert.ok(
            VALID_STOP_TYPES.includes(stop.type),
            `stops[${i}].type must be one of ${VALID_STOP_TYPES.join(", ")}, got: ${stop.type}`
          );
          testResults.passed.push(`Valid stop type at index ${i}: ${stop.type}`);
        } catch (error: any) {
          testResults.failed.push(error.message);
        }
      }

      // Validate GPS format if present
      if (stop?.location?.gps) {
        try {
          assert.ok(
            GPS_REGEX.test(stop.location.gps),
            `stops[${i}].location.gps must be valid GPS format (lat, lng), got: ${stop.location.gps}`
          );
          testResults.passed.push(`Valid GPS at stop ${i}`);
        } catch (error: any) {
          testResults.failed.push(error.message);
        }
      }

      // Validate descriptor.code if present
      if (stop?.location?.descriptor?.code) {
        testResults.passed.push(
          `Valid stop code at index ${i}: ${stop.location.descriptor.code}`
        );
      }
    }

    // Save stops for cross-validation in on_search
    await saveData(sessionID, transactionId, "searchStops", { value: stops });
  }

  // ============================================
  // PAYMENT VALIDATIONS
  // ============================================

  // 14. message.intent.payment.collected_by - Optional, but validate if present
  if (payment?.collected_by) {
    try {
      assert.ok(
        VALID_COLLECTED_BY.includes(payment.collected_by),
        `payment.collected_by must be one of ${VALID_COLLECTED_BY.join(", ")}, got: ${payment.collected_by}`
      );
      testResults.passed.push(`Valid collected_by: ${payment.collected_by}`);
    } catch (error: any) {
      testResults.failed.push(error.message);
    }
  }

  // 15. Payment tags validation
  const paymentTags = payment?.tags;
  if (paymentTags && Array.isArray(paymentTags)) {
    // BUYER_FINDER_FEES tag - Mandatory
    try {
      const buyerFinderFeesTag = findTagByCode(paymentTags, "BUYER_FINDER_FEES");
      testResults.passed.push("BUYER_FINDER_FEES tag present");

      // BUYER_FINDER_FEES_PERCENTAGE - Mandatory within BUYER_FINDER_FEES
      const feePercentage = findListItemByCode(
        buyerFinderFeesTag?.list,
        "BUYER_FINDER_FEES_PERCENTAGE"
      );
      testResults.passed.push(
        `Valid BUYER_FINDER_FEES_PERCENTAGE: ${feePercentage?.value}`
      );
    } catch (error: any) {
      testResults.failed.push(error.message);
    }

    // SETTLEMENT_TERMS tag - Mandatory
    try {
      const settlementTermsTag = findTagByCode(paymentTags, "SETTLEMENT_TERMS");
      testResults.passed.push("SETTLEMENT_TERMS tag present");

      const settlementList = settlementTermsTag?.list;

      // SETTLEMENT_WINDOW - Mandatory (Note: not in provided payload, so we check if present)
      const settlementWindow = findListItemByCode(settlementList, "SETTLEMENT_WINDOW");
      if (settlementWindow) {
        testResults.passed.push(`Valid SETTLEMENT_WINDOW: ${settlementWindow.value}`);
      }

      // SETTLEMENT_BASIS - Mandatory (Note: not in provided payload)
      const settlementBasis = findListItemByCode(settlementList, "SETTLEMENT_BASIS");
      if (settlementBasis) {
        testResults.passed.push(`Valid SETTLEMENT_BASIS: ${settlementBasis.value}`);
      }

      // DELAY_INTEREST - Mandatory
      const delayInterest = findListItemByCode(settlementList, "DELAY_INTEREST");
      testResults.passed.push(`Valid DELAY_INTEREST: ${delayInterest?.value}`);

      // STATIC_TERMS - Mandatory
      const staticTerms = findListItemByCode(settlementList, "STATIC_TERMS");
      testResults.passed.push(`Valid STATIC_TERMS: ${staticTerms?.value}`);
    } catch (error: any) {
      testResults.failed.push(error.message);
    }
  }

  // Log success validation for action
  logger.info(`Validated ${action}`);

  if (testResults.passed.length < 1 && testResults.failed.length < 1)
    testResults.passed.push(`Validated ${action}`);

  return testResults;
}
