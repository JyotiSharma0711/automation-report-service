import { TestResult, Payload } from "../../../types/payload";

export default async function on_search(
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
    const catalog = message?.catalog;

    // Validate domain
    if (context?.domain === "ONDC:TRV13") {
      result.passed.push("Domain is ONDC:TRV13");
    } else {
      result.failed.push(`Invalid domain: expected ONDC:TRV13, got ${context?.domain}`);
    }

    // Validate action
    if (context?.action === "on_search") {
      result.passed.push("Action is on_search");
    } else {
      result.failed.push(`Invalid action: expected on_search, got ${context?.action}`);
    }

    // Validate catalog descriptor
    if (catalog?.descriptor?.name) {
      result.passed.push(`Catalog name: ${catalog.descriptor.name}`);
    }

    // Check if fulfillment/fulfillments are sent additionally
    if (catalog?.fulfillments || catalog?.fulfillment) {
      result.failed.push("fulfillment is being sent additionally in catalog");
    }

    // Validate providers
    const providers = catalog?.providers;
    if (providers && Array.isArray(providers) && providers.length > 0) {
      result.passed.push(`${providers.length} provider(s) found`);

      for (const provider of providers) {
        // Check if fulfillment/fulfillments are sent additionally at provider level
        if (provider?.fulfillments || provider?.fulfillment) {
          result.failed.push("fulfillment is being sent additionally in provider");
        }

        // Validate provider descriptor
        if (provider?.descriptor?.name) {
          result.passed.push(`Provider: ${provider.descriptor.name}`);
        }

        // Validate provider.time
        if (provider?.time) {
          if (typeof provider.time !== "object") {
            result.failed.push("provider.time is incorrect: should be a valid Time object");
          }
        }

        // Validate locations
        if (provider?.locations && provider.locations.length > 0) {
          result.passed.push(`${provider.locations.length} location(s) found`);

          provider.locations.forEach((loc: any, idx: number) => {
            if (loc.gps) {
              const gps = String(loc.gps).trim();
              const gpsRegex = /^-?\d+\.\d{6},\s*-?\d+\.\d{6}$/;
              if (!gpsRegex.test(gps)) {
                result.failed.push(
                  `provider.location.gps should be precise up to 6 decimal places (e.g. 12.971598,77.594562), got: ${gps}`
                );
              } else {
                result.passed.push(`Provider location[${idx}].gps has 6 decimal precision`);
              }
            }
          });
        }

        // Validate categories
        if (provider?.categories && provider.categories.length > 0) {
          result.passed.push(`${provider.categories.length} category(ies) found`);
        }

        // Validate payments
        if (provider?.payments && provider.payments.length > 0) {
          result.passed.push(`${provider.payments.length} payment type(s) found`);
          for (const payment of provider.payments) {
            if (payment?.type) {
              const validTypes = ["PRE-ORDER", "ON-FULFILLMENT", "PART-PAYMENT"];
              if (validTypes.includes(payment.type)) {
                result.passed.push(`Valid payment type: ${payment.type}`);
              }
            }
          }
        }

        // Validate items
        if (provider?.items && provider.items.length > 0) {
          result.passed.push(`${provider.items.length} item(s) found`);
          for (const item of provider.items) {
            // Validate item price
            if (item?.price?.value && item?.price?.currency) {
              result.passed.push(`Item ${item.id} price: ${item.price.currency} ${item.price.value}`);
            }

            // Validate quantity
            if (item?.quantity?.available?.count !== undefined) {
              result.passed.push(`Item ${item.id} availability: ${item.quantity.available.count}`);
            }

            // Validate add_ons if present
            if (item?.add_ons && item.add_ons.length > 0) {
              result.passed.push(`Item ${item.id} has ${item.add_ons.length} add-on(s)`);
            }

            // Validate cancellation_terms
            if (item?.cancellation_terms && item.cancellation_terms.length > 0) {
              result.passed.push(`Item ${item.id} has cancellation terms`);
            }
          }
        }
      }
    }

    // Validate pagination tags if present
    const tags = catalog?.tags;
    if (tags && Array.isArray(tags)) {
      const pagination = tags.find((t: any) => t?.descriptor?.code === "PAGINATION");
      if (pagination) {
        result.passed.push("Pagination tag present");
      }
    }
  } catch (error) {
    result.failed.push(`Validation error: ${error}`);
  }

  return result;
}
