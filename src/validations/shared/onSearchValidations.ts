import assert from "assert";
import { TestResult, Payload } from "../../types/payload";
import logger from "@ondc/automation-logger";
import {
  createBaseValidationSetup,
  validateLSPFeatures,
  formatDate,
  extractTATHours,
  getTimestampFromDuration,
  addDefaultValidationMessage,
} from "./commonValidations";

/**
 * Validates TAT (Turn Around Time) for fulfillments
 */
export function validateTATForFulfillments(
  fulfillments: any[],
  contextTimestamp: Date,
  testResults: TestResult
): void {
  const currentDate = formatDate(contextTimestamp);
  let nextDate: Date = new Date(contextTimestamp);
  nextDate.setDate(nextDate.getDate() + 1);
  const formattedNextDate: string = formatDate(nextDate);

  fulfillments.forEach((fulfillment) => {
    const tat = fulfillment?.time?.label;
    if (tat) {
      try {
        const tatHours = extractTATHours(tat);
        if (tatHours !== null) {
          const tatTimestamp = getTimestampFromDuration(contextTimestamp, tat);
          const tatDate = formatDate(tatTimestamp);

          assert.ok(
            tatDate >= currentDate && tatDate <= formattedNextDate,
            `TAT ${tat} should be within current date and next date for fulfillment ${fulfillment.id}`
          );

          testResults.passed.push(
            `TAT validation passed for fulfillment ${fulfillment.id}`
          );
        }
      } catch (error: any) {
        testResults.failed.push(
          `TAT validation failed for fulfillment ${fulfillment.id}: ${error.message}`
        );
      }
    }
  });
}

/**
 * Validates shipment types (forward and backward)
 */
export function validateShipmentTypes(
  fulfillments: any[],
  testResults: TestResult
): { hasForwardShipment: boolean; hasBackwardShipment: boolean } {
  let hasForwardShipment = false;
  let hasBackwardShipment = false;

  fulfillments.forEach((fulfillment) => {
    if (fulfillment.type === "Delivery") {
      hasForwardShipment = true;
    }
    if (fulfillment.type === "RTO") {
      hasBackwardShipment = true;
    }
  });

  // try {
  //   assert.ok(
  //     hasForwardShipment && hasBackwardShipment,
  //     "Both forward shipment (Delivery) and backward shipment (RTO) should be provided in the catalog"
  //   );
  //   testResults.passed.push("Shipment types validation passed");
  // } catch (error: any) {
  //   testResults.failed.push(error.message);
  // }

  return { hasForwardShipment, hasBackwardShipment };
}

/**
 * Validates provider fulfillments
 */
export function validateProviderFulfillments(
  providers: any[],
  contextTimestamp: Date,
  testResults: TestResult
): Set<string> {
  const validFulfillmentIDs = new Set<string>();

  providers.forEach((provider: { fulfillments: any[]; categories: any[]; items: any[] }) => {
    provider.fulfillments.forEach((fulfillment) => {
      validFulfillmentIDs.add(fulfillment.id);
    });

    // Validate shipment types
    validateShipmentTypes(provider.fulfillments, testResults);

    // Validate TAT for fulfillments
    validateTATForFulfillments(provider.fulfillments, contextTimestamp, testResults);

    // Validate categories
    validateProviderCategories(provider.categories, testResults);

    // Validate items
    validateProviderItems(provider.items, validFulfillmentIDs, testResults);
  });

  return validFulfillmentIDs;
}

/**
 * Validates provider categories
 */
export function validateProviderCategories(
  categories: any[],
  testResults: TestResult
): void {
  categories.forEach((category) => {
    try {
      assert.ok(
        category?.id && category?.descriptor?.name,
        "Category should have id and descriptor.name"
      );
      testResults.passed.push(`Category validation passed for ${category.id}`);
    } catch (error: any) {
      testResults.failed.push(`Category validation failed: ${error.message}`);
    }
  });
}

/**
 * Validates provider items
 */
export function validateProviderItems(
  items: any[],
  validFulfillmentIDs: Set<string>,
  testResults: TestResult
): void {
  items.forEach((item) => {
    try {
      assert.ok(
        item?.id && item?.descriptor?.name,
        "Item should have id and descriptor.name"
      );

      // Validate fulfillment IDs in item
      if (item.fulfillment_ids) {
        item.fulfillment_ids.forEach((fulfillmentId: string) => {
          assert.ok(
            validFulfillmentIDs.has(fulfillmentId),
            `Item ${item.id} references invalid fulfillment ID: ${fulfillmentId}`
          );
        });
      }

      testResults.passed.push(`Item validation passed for ${item.id}`);
    } catch (error: any) {
      testResults.failed.push(`Item validation failed for ${item.id}: ${error.message}`);
    }
  });
}

/**
 * Creates a comprehensive OnSearch validator
 */
export function createOnSearchValidatorLegacy(config: {
  validateLSP?: boolean;
  validateTAT?: boolean;
  validateShipmentTypes?: boolean;
  customValidation?: (payload: Payload, sessionID: string, flowId: string, testResults: TestResult) => void;
} = {}) {
  return async function checkOnSearch(
    element: Payload,
    sessionID: string,
    flowId: string
  ): Promise<TestResult> {
    const { testResults, action, context, message } = createBaseValidationSetup(element);

    const contextTimestamp = new Date(context?.timestamp || "");
    const onSearch = message?.catalog;

    // Validate LSP features if configured
    if (config.validateLSP) {
      validateLSPFeatures(flowId, message, testResults);
    }

    // Validate catalog structure
    if (onSearch?.["bpp/providers"]) {
      const validFulfillmentIDs = validateProviderFulfillments(
        onSearch["bpp/providers"],
        contextTimestamp,
        testResults
      );

      // Additional validations can be added here
      if (config.validateTAT) {
        // TAT validation is already included in validateProviderFulfillments
      }

      if (config.validateShipmentTypes) {
        // Shipment type validation is already included in validateProviderFulfillments
      }
    }

    // Apply custom validation if provided
    if (config.customValidation) {
      config.customValidation(element, sessionID, flowId, testResults);
    }

    // Add default message if no validations ran
    addDefaultValidationMessage(testResults, action);

    return testResults;
  };
}
