/**
 * Health Insurance Validation Utilities for FIS13
 *
 * Reusable, domain-guarded validation functions for ONDC FIS13 Health Insurance.
 * Each function internally checks the flowId against HEALTH_INSURANCE_FLOWS
 * so they are safe to call from any domain without side-effects.
 *
 * All functions follow the existing (message, testResults, ...) signature convention.
 */

import { TestResult } from "../../types/payload";
import { HEALTH_INSURANCE_FLOWS } from "../../utils/constants";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isHealthInsuranceFlow(flowId?: string): boolean {
    return !!flowId && HEALTH_INSURANCE_FLOWS.includes(flowId);
}

/** RFC 3339 / ISO 8601 timestamp pattern (loose) */
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** ISO 8601 duration pattern */
const ISO8601_DURATION_PATTERN = /^P(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/;

function getTagListValue(tags: any[], tagCode: string, itemCode: string): string | undefined {
    if (!tags || !Array.isArray(tags)) return undefined;
    const tag = tags.find((t: any) => t.descriptor?.code === tagCode);
    if (!tag?.list || !Array.isArray(tag.list)) return undefined;
    const item = tag.list.find((li: any) => li.descriptor?.code === itemCode);
    return item?.value;
}

// ─── Context Validation ──────────────────────────────────────────────────────

/**
 * Validates context-level attributes for health insurance:
 * domain, version, location.country.code, location.city.code, ttl
 */
export function validateInsuranceContext(
    context: any,
    testResults: TestResult,
    flowId?: string
): void {
    if (!isHealthInsuranceFlow(flowId) || !context) return;

    // domain
    if (context.domain) {
        if (context.domain === "ONDC:FIS13") {
            testResults.passed.push("Context domain is ONDC:FIS13");
        } else {
            testResults.failed.push(
                `Context domain should be ONDC:FIS13, found: ${context.domain}`
            );
        }
    }

    // version
    if (context.version) {
        if (context.version === "2.0.1") {
            testResults.passed.push("Context version is 2.0.1");
        } else {
            testResults.failed.push(
                `Context version should be 2.0.1, found: ${context.version}`
            );
        }
    }

    // location.country.code
    const countryCode = context.location?.country?.code;
    if (countryCode) {
        if (countryCode === "IND") {
            testResults.passed.push("Context location country code is IND");
        } else {
            testResults.failed.push(
                `Context location country code should be IND, found: ${countryCode}`
            );
        }
    }

    // location.city.code
    const cityCode = context.location?.city?.code;
    if (cityCode) {
        if (/^std:\d+$/.test(cityCode) || cityCode === "*") {
            testResults.passed.push(`Context location city code is valid: ${cityCode}`);
        } else {
            testResults.failed.push(
                `Context location city code should be std:* format or *, found: ${cityCode}`
            );
        }
    }

    // ttl
    if (context.ttl) {
        if (ISO8601_DURATION_PATTERN.test(context.ttl)) {
            testResults.passed.push(`Context ttl has valid ISO 8601 duration format: ${context.ttl}`);
        } else {
            testResults.failed.push(
                `Context ttl should be ISO 8601 duration format (e.g. PT30S), found: ${context.ttl}`
            );
        }
    }

    // timestamp
    if (context.timestamp) {
        if (RFC3339_PATTERN.test(context.timestamp)) {
            testResults.passed.push("Context timestamp has valid RFC 3339 format");
        } else {
            testResults.failed.push(
                `Context timestamp should be RFC 3339 format, found: ${context.timestamp}`
            );
        }
    }
}

// ─── Payment Tags Validation ─────────────────────────────────────────────────

/**
 * Validates BUYER_FINDER_FEES and SETTLEMENT_TERMS tags on payment objects.
 * Works for both search (intent.payment.tags) and order-level (order.payments[].tags).
 */
export function validateInsurancePaymentTags(
    message: any,
    testResults: TestResult,
    flowId?: string,
    source: "search" | "order" = "order"
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    let tagSets: any[][] = [];

    if (source === "search") {
        // search: message.intent.payment.tags or message.intent.tags
        const tags = message?.intent?.payment?.tags || message?.intent?.tags;
        if (tags && Array.isArray(tags)) tagSets.push(tags);
    } else {
        // order-level: message.order.payments[].tags
        const payments = message?.order?.payments;
        if (payments && Array.isArray(payments)) {
            payments.forEach((p: any) => {
                if (p.tags && Array.isArray(p.tags)) tagSets.push(p.tags);
            });
        }
    }

    for (const tags of tagSets) {
        // BUYER_FINDER_FEES
        const bffTag = tags.find((t: any) => t.descriptor?.code === "BUYER_FINDER_FEES");
        if (bffTag) {
            testResults.passed.push("BUYER_FINDER_FEES tag is present");

            const bffType = getTagListValue(tags, "BUYER_FINDER_FEES", "BUYER_FINDER_FEES_TYPE");
            const validTypes = ["amount", "percent", "percent-annualized"];
            if (bffType) {
                if (!validTypes.includes(bffType)) {
                    testResults.failed.push(
                        `BUYER_FINDER_FEES_TYPE should be one of: ${validTypes.join(", ")}, found: ${bffType}`
                    );
                } else {
                    testResults.passed.push(`BUYER_FINDER_FEES_TYPE is valid: ${bffType}`);
                }
            }

            const bffPerc = getTagListValue(tags, "BUYER_FINDER_FEES", "BUYER_FINDER_FEES_PERCENTAGE");
            if (bffPerc) {
                const pct = parseFloat(bffPerc);
                if (isNaN(pct) || pct < 0) {
                    testResults.failed.push(
                        `BUYER_FINDER_FEES_PERCENTAGE should be a valid positive number, found: ${bffPerc}`
                    );
                } else {
                    testResults.passed.push(`BUYER_FINDER_FEES_PERCENTAGE is valid: ${bffPerc}`);
                }
            }
        }

        // SETTLEMENT_TERMS
        const settlTag = tags.find((t: any) => t.descriptor?.code === "SETTLEMENT_TERMS");
        if (settlTag) {
            testResults.passed.push("SETTLEMENT_TERMS tag is present");

            const requiredSettlItems = [
                "SETTLEMENT_WINDOW",
                "SETTLEMENT_BASIS",
                "MANDATORY_ARBITRATION",
                "COURT_JURISDICTION",
                "DELAY_INTEREST",
                "STATIC_TERMS",
            ];

            for (const code of requiredSettlItems) {
                const val = getTagListValue(tags, "SETTLEMENT_TERMS", code);
                if (val) {
                    testResults.passed.push(`${code} is present in SETTLEMENT_TERMS: ${val}`);
                }
            }

            // Validate STATIC_TERMS is a valid URL
            const staticTerms = getTagListValue(tags, "SETTLEMENT_TERMS", "STATIC_TERMS");
            if (staticTerms) {
                try {
                    const url = new URL(staticTerms);
                    if (url.protocol !== "http:" && url.protocol !== "https:") {
                        testResults.failed.push(
                            `STATIC_TERMS should be a valid HTTP/HTTPS URL, found: ${staticTerms}`
                        );
                    }
                } catch {
                    testResults.failed.push(
                        `STATIC_TERMS should be a valid URL, found: ${staticTerms}`
                    );
                }
            }
        }
    }
}

// ─── Documents Validation ────────────────────────────────────────────────────

/**
 * Validates health-insurance-specific document types (POLICY_DOC, CLAIM_DOC)
 * instead of the default loan document types (LOAN_AGREEMENT, LOAN_CANCELLATION).
 */
export function validateInsuranceDocuments(
    message: any,
    testResults: TestResult,
    flowId?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const documents = message?.order?.documents;
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
        testResults.passed.push(
            "Insurance documents: documents array is optional (not present in order)"
        );
        return;
    }

    const validInsuranceDocTypes = ["POLICY_DOC", "CLAIM_DOC", "RENEW_DOC"];
    const foundTypes: string[] = [];

    documents.forEach((doc: any, index: number) => {
        const code = doc?.descriptor?.code;
        if (!code) {
            return;
        }

        foundTypes.push(code);

        // Validate document type is insurance-relevant
        if (!validInsuranceDocTypes.includes(code)) {
            testResults.failed.push(
                `Insurance document ${index}: descriptor.code should be one of ${validInsuranceDocTypes.join(", ")}, found: ${code}`
            );
        } else {
            testResults.passed.push(`Insurance document ${index}: valid type ${code}`);
        }

        // Validate URL
        if (doc.url) {
            const urlPattern = /^https?:\/\/.+/i;
            if (!urlPattern.test(doc.url)) {
                testResults.failed.push(
                    `Insurance document ${index} (${code}): invalid URL format "${doc.url}"`
                );
            } else {
                testResults.passed.push(
                    `Insurance document ${index} (${code}): valid URL`
                );
            }
        }

        // Validate mime_type
        if (doc.mime_type) {
            testResults.passed.push(
                `Insurance document ${index} (${code}): mime_type is ${doc.mime_type}`
            );
        }
    });

    // Check for POLICY_DOC presence (should be present for on_confirm/on_status)
    if (foundTypes.includes("POLICY_DOC")) {
        testResults.passed.push("Insurance document type POLICY_DOC is present");
    }
}

// ─── Fulfillments Validation ─────────────────────────────────────────────────

const VALID_INSURANCE_FULFILLMENT_STATES = [
    "GRANTED",
    "PROCESSING",
    "INITIATED",
    "PROCESSED",
    "REJECTED",
    "ONLINE_RENEW",
];

/**
 * Validates health-insurance-specific fulfillment attributes:
 * type, customer details, state descriptor enum.
 */
export function validateInsuranceFulfillments(
    message: any,
    testResults: TestResult,
    flowId?: string,
    actionId?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const fulfillments = message?.order?.fulfillments;
    if (!fulfillments || !Array.isArray(fulfillments)) return;

    fulfillments.forEach((ff: any, index: number) => {
        // Type
        if (ff.type) {
            testResults.passed.push(`Insurance fulfillment ${index}: type is ${ff.type}`);
        }

        // Customer details (for init/confirm actions)
        const customerActions = ["init", "init2", "init3", "confirm", "on_init", "on_confirm"];
        if (actionId && customerActions.some(a => actionId.startsWith(a))) {
            const customer = ff.customer;
            if (customer) {
                if (customer.person?.name) {
                    testResults.passed.push(`Insurance fulfillment ${index}: customer person name is present`);
                }

                if (customer.contact?.phone) {
                    testResults.passed.push(`Insurance fulfillment ${index}: customer contact phone is present`);
                }

                if (customer.contact?.email) {
                    testResults.passed.push(`Insurance fulfillment ${index}: customer contact email is present`);
                }
            }
        }

        // State descriptor code (for on_* actions)
        const stateActions = ["on_init", "on_confirm", "on_status", "on_update"];
        if (actionId && stateActions.some(a => actionId.startsWith(a))) {
            if (ff.state?.descriptor?.code) {
                if (VALID_INSURANCE_FULFILLMENT_STATES.includes(ff.state.descriptor.code)) {
                    testResults.passed.push(
                        `Insurance fulfillment ${index}: state ${ff.state.descriptor.code} is valid`
                    );
                } else {
                    testResults.failed.push(
                        `Insurance fulfillment ${index}: state should be one of ${VALID_INSURANCE_FULFILLMENT_STATES.join(", ")}, found: ${ff.state.descriptor.code}`
                    );
                }
            }
        }
    });
}

// ─── On_Search Items Validation ──────────────────────────────────────────────

const GENERAL_INFO_REQUIRED_ITEMS = [
    "COVERAGE_AMOUNT",
    "CO_PAYMENT",
    "ROOM_CATEGORY",
    "RESTORATION",
    "CLAIM_SETTLEMENT_RATIO",
    "PRE_HOSPITALIZATION",
    "POST_HOSPITALIZATION",
    "MATERNITY_COVERAGE",
    "INITIAL_WAITING_PERIOD",
    "CASHLESS_HOSPITALS",
];

/**
 * Validates on_search-specific item attributes for health insurance:
 * descriptor.name, time.duration, category_ids, price.currency, GENERAL_INFO tags
 */
export function validateInsuranceItemsOnSearch(
    message: any,
    testResults: TestResult,
    flowId?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const providers = message?.catalog?.providers;
    if (!providers || !Array.isArray(providers)) return;

    for (const provider of providers) {
        const items = provider.items;
        if (!items || !Array.isArray(items)) continue;

        // Validate categories
        const categories = provider.categories;
        if (categories && Array.isArray(categories)) {
            const validCategoryCodes = ["HEALTH_INSURANCE", "INDIVIDUAL_INSURANCE", "FAMILY_INSURANCE"];
            categories.forEach((cat: any, ci: number) => {
                if (cat.descriptor?.code) {
                    if (!validCategoryCodes.includes(cat.descriptor.code)) {
                        testResults.failed.push(
                            `Category ${ci}: descriptor.code should be one of ${validCategoryCodes.join(", ")}, found: ${cat.descriptor.code}`
                        );
                    } else {
                        testResults.passed.push(
                            `Category ${ci}: descriptor.code is valid: ${cat.descriptor.code}`
                        );
                    }
                }
            });
        }

        items.forEach((item: any, idx: number) => {
            // descriptor.name
            if (item.descriptor?.name) {
                testResults.passed.push(`on_search item ${idx}: descriptor.name is present`);
            }

            // time.duration
            if (item.time?.duration) {
                if (ISO8601_DURATION_PATTERN.test(item.time.duration)) {
                    testResults.passed.push(
                        `on_search item ${idx}: time.duration is valid: ${item.time.duration}`
                    );
                } else {
                    testResults.failed.push(
                        `on_search item ${idx}: time.duration should be ISO 8601 format, found: ${item.time.duration}`
                    );
                }
            }

            // category_ids
            if (item.category_ids && Array.isArray(item.category_ids) && item.category_ids.length > 0) {
                testResults.passed.push(`on_search item ${idx}: category_ids present (${item.category_ids.length})`);
            }

            // price.currency
            if (item.price?.currency) {
                if (item.price.currency !== "INR") {
                    testResults.failed.push(
                        `on_search item ${idx}: price.currency should be INR, found: ${item.price.currency}`
                    );
                } else {
                    testResults.passed.push(`on_search item ${idx}: price.currency is INR`);
                }
            }

            // GENERAL_INFO tag
            if (item.tags && Array.isArray(item.tags)) {
                const generalInfoTag = item.tags.find(
                    (t: any) => t.descriptor?.code === "GENERAL_INFO"
                );
                if (generalInfoTag) {
                    testResults.passed.push(`on_search item ${idx}: GENERAL_INFO tag is present`);
                    for (const code of GENERAL_INFO_REQUIRED_ITEMS) {
                        const val = getTagListValue(item.tags, "GENERAL_INFO", code);
                        if (val) {
                            testResults.passed.push(
                                `on_search item ${idx}: ${code} is present in GENERAL_INFO`
                            );
                        }
                    }
                }
            }

            // xinput form validation
            if (item.xinput?.form) {
                if (item.xinput.form.url) {
                    try {
                        new URL(item.xinput.form.url);
                        testResults.passed.push(`on_search item ${idx}: xinput form url is valid`);
                    } catch {
                        testResults.failed.push(
                            `on_search item ${idx}: xinput form url is not a valid URL`
                        );
                    }
                }

                if (item.xinput.form.mime_type) {
                    const validMimeTypes = ["text/html", "application/html"];
                    if (!validMimeTypes.includes(item.xinput.form.mime_type)) {
                        testResults.failed.push(
                            `on_search item ${idx}: xinput form mime_type should be text/html or application/html, found: ${item.xinput.form.mime_type}`
                        );
                    } else {
                        testResults.passed.push(
                            `on_search item ${idx}: xinput form mime_type is valid`
                        );
                    }
                }
            }
        });
    }
}

// ─── Order Status Validation ─────────────────────────────────────────────────

const VALID_ORDER_STATUSES = [
    "ACTIVE",
    "COMPLETE",
    "CANCELLED",
    "CANCELLATION_INITIATED",
];

/**
 * Validates order.status against health insurance enum values.
 */
export function validateInsuranceOrderStatus(
    message: any,
    testResults: TestResult,
    flowId?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const status = message?.order?.status;
    if (!status) {
        return;
    }

    if (VALID_ORDER_STATUSES.includes(status)) {
        testResults.passed.push(`Insurance order status is valid: ${status}`);
    } else {
        testResults.failed.push(
            `Insurance order status should be one of ${VALID_ORDER_STATUSES.join(", ")}, found: ${status}`
        );
    }
}

// ─── Billing Validation ──────────────────────────────────────────────────────

/**
 * Validates billing fields (name, phone, email) for health insurance init.
 */
export function validateInsuranceBilling(
    message: any,
    testResults: TestResult,
    flowId?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const billing = message?.order?.billing;
    if (!billing) {
        return;
    }

    if (billing.name) {
        testResults.passed.push(`Billing name is present: ${billing.name}`);
    }

    if (billing.phone) {
        testResults.passed.push("Billing phone is present");
    }

    if (billing.email) {
        testResults.passed.push("Billing email is present");
    }
}

// ─── Payment Params Validation ───────────────────────────────────────────────

/**
 * Validates payment params (bank_account_number, bank_code, amount, currency, transaction_id)
 * for on_init and on_confirm actions in health insurance.
 */
export function validateInsurancePaymentParams(
    message: any,
    testResults: TestResult,
    flowId?: string,
    actionId?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const payments = message?.order?.payments;
    if (!payments || !Array.isArray(payments)) return;

    payments.forEach((payment: any, index: number) => {
        // Type enum
        if (payment.type) {
            const validTypes = ["PRE-FULFILLMENT", "ON-ORDER", "PRE-ORDER", "ON-FULFILLMENT"];
            if (!validTypes.includes(payment.type)) {
                testResults.failed.push(
                    `Insurance payment ${index}: type should be one of ${validTypes.join(", ")}, found: ${payment.type}`
                );
            } else {
                testResults.passed.push(`Insurance payment ${index}: type is valid: ${payment.type}`);
            }
        }

        // Status enum
        if (payment.status) {
            const validStatuses = ["PAID", "NOT-PAID", "FAILED", "OVERDUE", "DEFAULTED"];
            if (!validStatuses.includes(payment.status)) {
                testResults.failed.push(
                    `Insurance payment ${index}: status should be one of ${validStatuses.join(", ")}, found: ${payment.status}`
                );
            } else {
                testResults.passed.push(`Insurance payment ${index}: status is valid: ${payment.status}`);
            }
        }

        // collected_by enum
        if (payment.collected_by) {
            const validCollectors = ["BAP", "BPP"];
            if (!validCollectors.includes(payment.collected_by)) {
                testResults.failed.push(
                    `Insurance payment ${index}: collected_by should be BAP or BPP, found: ${payment.collected_by}`
                );
            } else {
                testResults.passed.push(
                    `Insurance payment ${index}: collected_by is valid: ${payment.collected_by}`
                );
            }
        }

        // Params validation for on_init
        if (actionId && actionId.startsWith("on_init")) {
            if (payment.params?.bank_account_number) {
                testResults.passed.push(
                    `Insurance payment ${index}: params.bank_account_number is present`
                );
            }

            if (payment.params?.bank_code) {
                testResults.passed.push(
                    `Insurance payment ${index}: params.bank_code is present`
                );
            }

            if (payment.params?.amount) {
                testResults.passed.push(
                    `Insurance payment ${index}: params.amount is present: ${payment.params.amount}`
                );
            }

            if (payment.params?.currency) {
                if (payment.params.currency !== "INR") {
                    testResults.failed.push(
                        `Insurance payment ${index}: params.currency should be INR, found: ${payment.params.currency}`
                    );
                } else {
                    testResults.passed.push(
                        `Insurance payment ${index}: params.currency is INR`
                    );
                }
            }
        }

        // Transaction ID for on_confirm
        if (actionId && actionId.startsWith("on_confirm")) {
            if (payment.params?.transaction_id) {
                testResults.passed.push(
                    `Insurance payment ${index}: params.transaction_id is present`
                );
            }
        }
    });
}

// ─── Breakup Title Enum Validation ───────────────────────────────────────────

const VALID_BREAKUP_TITLES = [
    "BASE_PRICE",
    "CONVIENCE_FEE",
    "CONVENIENCE_FEE",
    "TAX",
    "PROCESSING_FEE",
    "ADD_ONS",
    "OFFER",
];

/**
 * Validates quote breakup title enum for health insurance on_select.
 */
export function validateBreakupTitleEnum(
    message: any,
    testResults: TestResult,
    flowId?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const breakup = message?.order?.quote?.breakup;
    if (!breakup || !Array.isArray(breakup)) return;

    breakup.forEach((item: any, index: number) => {
        const title = item?.title;
        if (title) {
            if (!VALID_BREAKUP_TITLES.includes(title)) {
                testResults.failed.push(
                    `Insurance quote breakup ${index}: title should be one of ${VALID_BREAKUP_TITLES.join(", ")}, found: ${title}`
                );
            } else {
                testResults.passed.push(
                    `Insurance quote breakup ${index}: title is valid: ${title}`
                );
            }
        }
    });

    // price.currency
    const currency = message?.order?.quote?.price?.currency;
    if (currency) {
        if (currency !== "INR") {
            testResults.failed.push(
                `Insurance quote price currency should be INR, found: ${currency}`
            );
        } else {
            testResults.passed.push("Insurance quote price currency is INR");
        }
    }
}

// ─── Select Items Validation ─────────────────────────────────────────────────

/**
 * Validates select-specific item attributes for health insurance:
 * parent_item_id, xinput form_response
 */
export function validateInsuranceSelectItems(
    message: any,
    testResults: TestResult,
    flowId?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const items = message?.order?.items;
    if (!items || !Array.isArray(items)) return;

    items.forEach((item: any, index: number) => {
        // parent_item_id is mandatory for health insurance select
        if (item.parent_item_id) {
            testResults.passed.push(
                `Insurance select item ${index}: parent_item_id is present: ${item.parent_item_id}`
            );
        }

        // xinput form_response validation
        if (item.xinput?.form_response) {
            if (item.xinput.form_response.submission_id) {
                testResults.passed.push(
                    `Insurance select item ${index}: xinput form_response.submission_id is present`
                );
            }

            if (item.xinput.form_response.status && item.xinput.form_response.status !== "SUCCESS") {
                testResults.failed.push(
                    `Insurance select item ${index}: xinput form_response.status should be SUCCESS, found: ${item.xinput.form_response.status}`
                );
            }
        }
    });
}

// ─── On_Select Xinput Validation ─────────────────────────────────────────────

/**
 * Validates on_select xinput form attributes for health insurance:
 * form.id, form.url, form.mime_type, required flag
 */
export function validateInsuranceOnSelectXinput(
    message: any,
    testResults: TestResult,
    flowId?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const items = message?.order?.items;
    if (!items || !Array.isArray(items)) return;

    items.forEach((item: any, index: number) => {
        if (!item.xinput) return;

        // form.id
        if (item.xinput.form?.id) {
            testResults.passed.push(
                `Insurance on_select item ${index}: xinput form.id is present`
            );
        }

        // required flag
        if (item.xinput.required !== undefined && item.xinput.required !== null) {
            testResults.passed.push(
                `Insurance on_select item ${index}: xinput.required is ${item.xinput.required}`
            );
        }

        // form.url
        if (item.xinput.form?.url) {
            try {
                new URL(item.xinput.form.url);
                testResults.passed.push(
                    `Insurance on_select item ${index}: xinput form.url is valid`
                );
            } catch {
                testResults.failed.push(
                    `Insurance on_select item ${index}: xinput form.url is not a valid URL`
                );
            }
        }

        // form.mime_type
        if (item.xinput.form?.mime_type) {
            const validMimeTypes = ["text/html", "application/html"];
            if (!validMimeTypes.includes(item.xinput.form.mime_type)) {
                testResults.failed.push(
                    `Insurance on_select item ${index}: xinput form.mime_type should be text/html or application/html, found: ${item.xinput.form.mime_type}`
                );
            } else {
                testResults.passed.push(
                    `Insurance on_select item ${index}: xinput form.mime_type is valid`
                );
            }
        }
    });
}

// ─── Init Xinput Form Response Validation ────────────────────────────────────

/**
 * Validates init xinput form_response for health insurance.
 */
export function validateInsuranceInitXinput(
    message: any,
    testResults: TestResult,
    flowId?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const items = message?.order?.items;
    if (!items || !Array.isArray(items)) return;

    items.forEach((item: any, index: number) => {
        if (item.xinput?.form_response) {
            if (item.xinput.form_response.submission_id) {
                testResults.passed.push(
                    `Insurance init item ${index}: xinput form_response.submission_id is present`
                );
            }
        }
    });
}

// ─── On_Init Xinput Form Validation ──────────────────────────────────────────

/**
 * Validates on_init xinput form attributes (next form id, cancellation_terms).
 */
export function validateInsuranceOnInitExtras(
    message: any,
    testResults: TestResult,
    flowId?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    // Cancellation terms
    const cancellationTerms = message?.order?.cancellation_terms;
    if (cancellationTerms && Array.isArray(cancellationTerms)) {
        cancellationTerms.forEach((term: any, index: number) => {
            if (term.external_ref?.url) {
                try {
                    new URL(term.external_ref.url);
                    testResults.passed.push(
                        `Cancellation term ${index}: external_ref.url is valid`
                    );
                } catch {
                    testResults.failed.push(
                        `Cancellation term ${index}: external_ref.url is not a valid URL`
                    );
                }
            }

            if (term.external_ref?.mimetype && !term.external_ref.mimetype.includes("/")) {
                testResults.failed.push(
                    `Cancellation term ${index}: external_ref.mimetype has invalid format: ${term.external_ref.mimetype}`
                );
            }
        });
    }

    // Timestamps
    if (message?.order?.created_at) {
        if (!RFC3339_PATTERN.test(message.order.created_at)) {
            testResults.failed.push(
                `order.created_at should be RFC 3339 format, found: ${message.order.created_at}`
            );
        } else {
            testResults.passed.push("order.created_at has valid RFC 3339 format");
        }
    }

    if (message?.order?.updated_at) {
        if (!RFC3339_PATTERN.test(message.order.updated_at)) {
            testResults.failed.push(
                `order.updated_at should be RFC 3339 format, found: ${message.order.updated_at}`
            );
        } else {
            testResults.passed.push("order.updated_at has valid RFC 3339 format");
        }
    }
}

// ─── Confirm Xinput Form Response Validation ─────────────────────────────────

/**
 * Validates confirm xinput form_response for health insurance.
 */
export function validateInsuranceConfirmXinput(
    message: any,
    testResults: TestResult,
    flowId?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const items = message?.order?.items;
    if (!items || !Array.isArray(items)) return;

    items.forEach((item: any, index: number) => {
        if (item.xinput?.form_response) {
            if (item.xinput.form_response.submission_id) {
                testResults.passed.push(
                    `Insurance confirm item ${index}: xinput form_response.submission_id is present`
                );
            }
        }
    });
}

// ─── On_Confirm Order ID Validation ──────────────────────────────────────────

/**
 * Validates on_confirm order.id (policy ID) for health insurance.
 */
export function validateInsuranceOrderId(
    message: any,
    testResults: TestResult,
    flowId?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    if (message?.order?.id) {
        testResults.passed.push(`Insurance order.id is present: ${message.order.id}`);
    }
}
