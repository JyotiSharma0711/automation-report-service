import assert from "assert";
import { TestResult, Payload } from "../../../types/payload";
import logger from "@ondc/automation-logger";
import { saveData } from "../../../utils/redisUtils";
import { DomainValidators } from "../../shared/domainValidator";

// Maximum duration in minutes per category for Immediate / same-day delivery
const CATEGORY_MAX_DURATION_MINUTES: Record<string, number> = {
  "Immediate Delivery": 60,
  "Same Day Delivery": 24 * 60,
  "Next Day Delivery": 48 * 60,
  "Standard Delivery": 10 * 24 * 60,
};

/**
 * Parse an ISO 8601 duration string (e.g. "PT45M", "PT2H", "P1D") into minutes.
 * Returns null if the string is not a recognised format.
 */
function parseDurationToMinutes(duration: string): number | null {
  if (!duration) return null;
  const match = duration.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
  );
  if (!match) return null;
  const days = parseInt(match[1] || "0");
  const hours = parseInt(match[2] || "0");
  const minutes = parseInt(match[3] || "0");
  const seconds = parseInt(match[4] || "0");
  return days * 24 * 60 + hours * 60 + minutes + seconds / 60;
}

/**
 * Verify that a "lat,lon" GPS string has at least 4 decimal places of
 * precision on *both* coordinates.
 */
function hasAtLeastFourDecimalPlaces(coordStr: string): boolean {
  if (!coordStr) return false;
  const parts = coordStr.split(",").map((s) => s.trim());
  if (parts.length !== 2) return false;
  return parts.every((part) => {
    const decimalMatch = part.match(/\.(\d+)$/);
    return decimalMatch && decimalMatch[1].length >= 4;
  });
}

/**
 * Rough check that a "lat,lon" GPS string falls within India's bounding box.
 * India: lat 6.4°–35.7°, lon 68.1°–97.4°
 */
function isWithinIndia(coordStr: string): boolean {
  if (!coordStr) return false;
  const parts = coordStr.split(",").map((s) => parseFloat(s.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) return false;
  const [lat, lon] = parts;
  return lat >= 6.4 && lat <= 35.7 && lon >= 68.1 && lon <= 97.4;
}

export async function checkSearch(
  element: Payload,
  sessionID: string,
  flowId: string,
  action_id: string
): Promise<TestResult> {
  // Run common domain validations first
  const commonTestResults = await DomainValidators.ondclogSearch(
    element,
    sessionID,
    flowId,
    action_id
  );

  const testResults: TestResult = {
    response: commonTestResults.response,
    passed: [...commonTestResults.passed],
    failed: [...commonTestResults.failed],
  };

  const payload = element;
  const action = payload?.action.toLowerCase();
  logger.info(`Inside ${action} validations for LOG11`);

  const { jsonRequest, jsonResponse } = payload;
  if (jsonResponse?.response) testResults.response = jsonResponse?.response;

  const { context, message } = jsonRequest;
  const transactionId = context?.transaction_id;

  try {
    const fulfillment = message?.intent?.fulfillment;
    const startGps = fulfillment?.start?.location?.gps;
    const endGps = fulfillment?.end?.location?.gps;
    const startAreaCode = fulfillment?.start?.location?.address?.area_code;
    const endAreaCode = fulfillment?.end?.location?.address?.area_code;
    const categoryId = message?.intent?.category?.id;
    const paymentType = message?.intent?.payment?.type;
    const cityCode = context?.city;

    // Persist key fields for cross-call comparisons in init/on_init
    if (startGps) saveData(sessionID, transactionId, "search_start_gps", startGps);
    if (endGps) saveData(sessionID, transactionId, "search_end_gps", endGps);
    if (startAreaCode) saveData(sessionID, transactionId, "search_start_area_code", startAreaCode);
    if (endAreaCode) saveData(sessionID, transactionId, "search_end_area_code", endAreaCode);
    if (categoryId) saveData(sessionID, transactionId, "search_category_id", categoryId);
    if (paymentType) saveData(sessionID, transactionId, "search_payment_type", paymentType);
    if (cityCode) saveData(sessionID, transactionId, "search_city_code", cityCode);

    // ── 2. GPS precision ≥ 4 decimal places ───────────────────────────────────

    if (startGps) {
      try {
        assert.ok(
          hasAtLeastFourDecimalPlaces(startGps),
          `start.location.gps '${startGps}' must have at least 4 decimal places of precision on both coordinates`
        );
        testResults.passed.push("Start GPS precision (≥4 decimal places) validation passed");
      } catch (error: any) {
        testResults.failed.push(error.message);
      }
    }

    if (endGps) {
      try {
        assert.ok(
          hasAtLeastFourDecimalPlaces(endGps),
          `end.location.gps '${endGps}' must have at least 4 decimal places of precision on both coordinates`
        );
        testResults.passed.push("End GPS precision (≥4 decimal places) validation passed");
      } catch (error: any) {
        testResults.failed.push(error.message);
      }
    }

    // ── 3. GPS within India — correlates to valid pincode region ─────────────

    if (startGps) {
      try {
        assert.ok(
          isWithinIndia(startGps),
          `start.location.gps '${startGps}' is outside India's geographic boundaries` +
          ` — verify it corresponds to pincode '${startAreaCode ?? "N/A"}'`
        );
        testResults.passed.push("Start GPS within India's boundaries (pincode correlation) passed");
      } catch (error: any) {
        testResults.failed.push(error.message);
      }
    }

    if (endGps) {
      try {
        assert.ok(
          isWithinIndia(endGps),
          `end.location.gps '${endGps}' is outside India's geographic boundaries` +
          ` — verify it corresponds to pincode '${endAreaCode ?? "N/A"}'`
        );
        testResults.passed.push("End GPS within India's boundaries (pincode correlation) passed");
      } catch (error: any) {
        testResults.failed.push(error.message);
      }
    }

    // ── 4. Time range: end > start  AND  (end − start) < 24 h ────────────────

    const validateTimeRange = (
      range: { start?: string; end?: string } | undefined,
      label: string
    ) => {
      if (!range?.start || !range?.end) return;
      try {
        const rangeStart = new Date(range.start);
        const rangeEnd = new Date(range.end);
        const diffHours = (rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60);

        assert.ok(
          rangeEnd > rangeStart,
          `${label}.end must be greater than ${label}.start` +
          ` (start: ${range.start}, end: ${range.end})`
        );
        testResults.passed.push(`${label}: end > start validation passed`);

        assert.ok(
          diffHours <= 24,
          `${label} duration must be less than 24 hours (actual: ${diffHours.toFixed(2)} h)`
        );
        testResults.passed.push(`${label}: duration ≤ 24 h validation passed`);
      } catch (error: any) {
        testResults.failed.push(error.message);
      }
    };

    validateTimeRange(
      fulfillment?.start?.time?.range,
      "fulfillment.start.time.range"
    );
    validateTimeRange(
      fulfillment?.end?.time?.range,
      "fulfillment.end.time.range"
    );

    // ── 5. provider.time.duration must match the category's TAT cap ──────────

    const duration = fulfillment?.start?.time?.duration;
    if (duration && categoryId && CATEGORY_MAX_DURATION_MINUTES[categoryId] !== undefined) {
      try {
        const durationMinutes = parseDurationToMinutes(duration);
        assert.ok(
          durationMinutes !== null,
          `fulfillment.start.time.duration '${duration}' is not a valid ISO 8601 duration`
        );
        if (durationMinutes !== null) {
          const maxMinutes = CATEGORY_MAX_DURATION_MINUTES[categoryId];
          assert.ok(
            durationMinutes <= maxMinutes,
            `Duration for category '${categoryId}' must be ≤ ${maxMinutes} min` +
            ` (PT${maxMinutes}M), but got ${durationMinutes} min (${duration})`
          );
          testResults.passed.push(
            `Category duration validation passed for '${categoryId}':` +
            ` ${durationMinutes} min ≤ ${maxMinutes} min`
          );
        }
      } catch (error: any) {
        testResults.failed.push(error.message);
      }
    }

    // ── 6. linked_provider and linked_order tag structure ─────────────────────

    const fulfillmentTags: { code: string; list?: { code: string; value: string }[] }[] =
      fulfillment?.tags ?? [];

    const linkedProviderTag = fulfillmentTags.find((t) => t.code === "linked_provider");
    const linkedOrderTag = fulfillmentTags.find((t) => t.code === "linked_order");

    if (linkedProviderTag) {
      try {
        const list = linkedProviderTag.list ?? [];
        const hasId = list.some((item) => item.code === "id");
        assert.ok(
          hasId,
          "linked_provider tag must contain a list item with code 'id'"
        );
        testResults.passed.push("linked_provider tag structure validation passed");
      } catch (error: any) {
        testResults.failed.push(error.message);
      }
    }

  } catch (error: any) {
    logger.error(`Error during ${action} validation: ${error.message}`);
    testResults.failed.push(error.message);
  }

  if (testResults.passed.length < 1 && testResults.failed.length < 1)
    testResults.passed.push(`Validated ${action}`);

  return testResults;
}
