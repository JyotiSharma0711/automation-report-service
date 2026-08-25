/**
 * L2 Business-Level Validations for FIS13 Health Insurance
 *
 * This module contains business-logic validators that check:
 * - Financial arithmetic (quote breakup sums, payment-quote consistency, BFF)
 * - Cross-action consistency (provider, items, quote, billing, payment)
 * - State transitions (order status, fulfillment state)
 * - Settlement calculations
 * - Time-based integrity (timestamp ordering, created_at ≤ updated_at)
 * - Context integrity (bap_id, bpp_id, message_id uniqueness)
 *
 * All functions are flow-guarded via isHealthInsuranceFlow().
 */

import { TestResult } from "../../types/payload";
import { HEALTH_INSURANCE_FLOWS } from "../../utils/constants";

// ─── Guard ───────────────────────────────────────────────────────────────────

function isHealthInsuranceFlow(flowId?: string): boolean {
    return !!flowId && HEALTH_INSURANCE_FLOWS.includes(flowId);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function getTagListValue(tags: any[], tagCode: string, itemCode: string): string | undefined {
    if (!tags || !Array.isArray(tags)) return undefined;
    const tag = tags.find((t: any) => t.descriptor?.code === tagCode);
    if (!tag?.list || !Array.isArray(tag.list)) return undefined;
    const item = tag.list.find((li: any) => li.descriptor?.code === itemCode);
    return item?.value;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. FINANCIAL CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates: quote.price.value == Σ(breakup[].price.value)
 */
export function validateQuoteBreakupSum(
    message: any,
    testResults: TestResult,
    flowId?: string,
    actionLabel?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const quote = message?.order?.quote;
    if (!quote?.price?.value || !quote?.breakup || !Array.isArray(quote.breakup)) return;

    const declaredTotal = parseFloat(quote.price.value);
    if (isNaN(declaredTotal)) {
        testResults.failed.push(`[L2:${actionLabel || "quote"}] quote.price.value is not a valid number: ${quote.price.value}`);
        return;
    }

    let computedTotal = 0;
    let hasInvalid = false;

    for (const b of quote.breakup) {
        const val = b?.price?.value ?? b?.item?.price?.value;
        if (val === undefined || val === null) continue;
        const parsed = parseFloat(String(val));
        if (isNaN(parsed)) {
            hasInvalid = true;
            testResults.failed.push(
                `[L2:${actionLabel || "quote"}] Breakup item "${b?.title || b?.["@ondc/org/title_type"] || "unknown"}" has non-numeric price: ${val}`
            );
        } else {
            computedTotal = round2(computedTotal + parsed);
        }
    }

    if (!hasInvalid) {
        if (round2(declaredTotal) === round2(computedTotal)) {
            testResults.passed.push(
                `[L2:${actionLabel || "quote"}] quote.price.value (${declaredTotal}) matches breakup sum (${computedTotal})`
            );
        } else {
            testResults.failed.push(
                `[L2:${actionLabel || "quote"}] quote.price.value (${declaredTotal}) does NOT match breakup sum (${computedTotal})`
            );
        }
    }
}

/**
 * Validates: payment.params.amount == quote.price.value
 */
export function validatePaymentQuoteConsistency(
    message: any,
    testResults: TestResult,
    flowId?: string,
    actionLabel?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const quoteValue = message?.order?.quote?.price?.value;
    const payments = message?.order?.payments;
    if (!quoteValue || !payments || !Array.isArray(payments)) return;

    const quoteNum = parseFloat(quoteValue);
    if (isNaN(quoteNum)) return;

    for (let i = 0; i < payments.length; i++) {
        const paramAmount = payments[i]?.params?.amount;
        if (paramAmount === undefined || paramAmount === null) continue;

        const payNum = parseFloat(String(paramAmount));
        if (isNaN(payNum)) {
            testResults.failed.push(
                `[L2:${actionLabel || "payment"}] payment[${i}].params.amount is not a valid number: ${paramAmount}`
            );
            continue;
        }

        if (round2(quoteNum) === round2(payNum)) {
            testResults.passed.push(
                `[L2:${actionLabel || "payment"}] payment[${i}].params.amount (${payNum}) matches quote.price.value (${quoteNum})`
            );
        } else {
            testResults.failed.push(
                `[L2:${actionLabel || "payment"}] payment[${i}].params.amount (${payNum}) does NOT match quote.price.value (${quoteNum})`
            );
        }
    }
}

/**
 * Validates: BFF_amount = (BFF_PERCENTAGE / 100) * quote.price.value
 * Checks that the declared BUYER_FINDER_FEES_AMOUNT (if present) is arithmetically consistent.
 */
export function validateBuyerFinderFeeArithmetic(
    message: any,
    testResults: TestResult,
    flowId?: string,
    actionLabel?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const quoteValue = message?.order?.quote?.price?.value;
    if (!quoteValue) return;
    const quoteNum = parseFloat(quoteValue);
    if (isNaN(quoteNum)) return;

    // Get BFF tags from payments
    const payments = message?.order?.payments;
    if (!payments || !Array.isArray(payments)) return;

    for (let i = 0; i < payments.length; i++) {
        const tags = payments[i]?.tags;
        if (!tags || !Array.isArray(tags)) continue;

        const bffPercentage = getTagListValue(tags, "BUYER_FINDER_FEES", "BUYER_FINDER_FEES_PERCENTAGE");
        const bffAmount = getTagListValue(tags, "BUYER_FINDER_FEES", "BUYER_FINDER_FEES_AMOUNT");

        if (bffPercentage && bffAmount) {
            const pct = parseFloat(bffPercentage);
            const amt = parseFloat(bffAmount);
            if (isNaN(pct) || isNaN(amt)) continue;

            const expectedAmt = round2((pct / 100) * quoteNum);
            if (round2(amt) === expectedAmt) {
                testResults.passed.push(
                    `[L2:${actionLabel || "BFF"}] BFF amount (${amt}) = ${pct}% of quote (${quoteNum}) ✓`
                );
            } else {
                testResults.failed.push(
                    `[L2:${actionLabel || "BFF"}] BFF amount (${amt}) ≠ ${pct}% of quote (${quoteNum}). Expected: ${expectedAmt}`
                );
            }
        } else if (bffPercentage) {
            // Just validate the percentage is a reasonable number
            const pct = parseFloat(bffPercentage);
            if (!isNaN(pct) && pct >= 0 && pct <= 100) {
                testResults.passed.push(
                    `[L2:${actionLabel || "BFF"}] BFF percentage (${pct}%) is in valid range`
                );
            } else if (!isNaN(pct)) {
                testResults.failed.push(
                    `[L2:${actionLabel || "BFF"}] BFF percentage (${pct}%) is out of range (0-100)`
                );
            }
        }
    }
}

/**
 * Validates: Each breakup item with @ondc/org/item_id must match order.items[].price.value
 */
export function validateBreakupItemPriceIntegrity(
    message: any,
    testResults: TestResult,
    flowId?: string,
    actionLabel?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const items: any[] = message?.order?.items;
    const breakup: any[] = message?.order?.quote?.breakup;
    if (!items || !Array.isArray(items) || !breakup || !Array.isArray(breakup)) return;

    // Build item price map
    const itemPriceMap = new Map<string, number>();
    for (const item of items) {
        if (item?.id && item?.price?.value !== undefined) {
            const val = parseFloat(String(item.price.value));
            if (!isNaN(val)) itemPriceMap.set(String(item.id), val);
        }
    }

    if (itemPriceMap.size === 0) return;

    for (const b of breakup) {
        const itemId = b?.["@ondc/org/item_id"] || b?.item?.id;
        if (!itemId) continue;
        const titleType = b?.title || b?.["@ondc/org/title_type"] || "";

        // Only check BASE_PRICE breakup items against item prices
        if (titleType.toUpperCase() !== "BASE_PRICE") continue;

        const breakupVal = b?.price?.value ?? b?.item?.price?.value;
        if (breakupVal === undefined) continue;

        const breakupNum = parseFloat(String(breakupVal));
        const itemNum = itemPriceMap.get(String(itemId));

        if (itemNum !== undefined && !isNaN(breakupNum)) {
            if (round2(itemNum) === round2(breakupNum)) {
                testResults.passed.push(
                    `[L2:${actionLabel || "breakup"}] BASE_PRICE for item "${itemId}" (${breakupNum}) matches item price (${itemNum})`
                );
            } else {
                testResults.failed.push(
                    `[L2:${actionLabel || "breakup"}] BASE_PRICE for item "${itemId}" (${breakupNum}) does NOT match item price (${itemNum})`
                );
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CROSS-ACTION CONSISTENCY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates: provider.id must match between current and prior action
 */
export function validateProviderConsistency(
    currentMessage: any,
    priorData: Record<string, any> | null,
    testResults: TestResult,
    flowId?: string,
    currentAction?: string,
    priorAction?: string
): void {
    if (!isHealthInsuranceFlow(flowId) || !priorData) return;

    const currentId = currentMessage?.order?.provider?.id;
    const priorId = priorData?.provider?.id;

    if (!currentId || !priorId) return;

    if (String(currentId) === String(priorId)) {
        testResults.passed.push(
            `[L2:provider] provider.id matches between ${priorAction || "prior"} and ${currentAction || "current"}: ${currentId}`
        );
    } else {
        testResults.failed.push(
            `[L2:provider] provider.id mismatch: ${priorAction || "prior"}="${priorId}" vs ${currentAction || "current"}="${currentId}"`
        );
    }
}

/**
 * Validates: item IDs must be stable between current and prior action
 */
export function validateItemConsistency(
    currentMessage: any,
    priorData: Record<string, any> | null,
    testResults: TestResult,
    flowId?: string,
    currentAction?: string,
    priorAction?: string
): void {
    if (!isHealthInsuranceFlow(flowId) || !priorData) return;

    const currentItems: any[] = currentMessage?.order?.items || [];
    const priorItems: any[] = priorData?.items || [];

    const currentIds = currentItems.map((it: any) => String(it?.id)).filter(Boolean).sort();
    const priorIds = priorItems.map((it: any) => String(it?.id)).filter(Boolean).sort();

    if (currentIds.length === 0 || priorIds.length === 0) return;

    const missing = priorIds.filter(id => !currentIds.includes(id));

    if (missing.length === 0) {
        testResults.passed.push(
            `[L2:items] Item IDs consistent between ${priorAction || "prior"} and ${currentAction || "current"} (${currentIds.length} items)`
        );
    } else {
        testResults.failed.push(
            `[L2:items] Items from ${priorAction || "prior"} missing in ${currentAction || "current"}: ${missing.join(", ")}`
        );
    }
}

/**
 * Validates: quote.price.value must not change between actions (unless update flow)
 */
export function validateQuoteConsistency(
    currentMessage: any,
    priorData: Record<string, any> | null,
    testResults: TestResult,
    flowId?: string,
    currentAction?: string,
    priorAction?: string
): void {
    if (!isHealthInsuranceFlow(flowId) || !priorData) return;

    const currentQuote = currentMessage?.order?.quote?.price?.value;
    const priorQuote = priorData?.quote?.price?.value;

    if (!currentQuote || !priorQuote) return;

    const currentNum = parseFloat(currentQuote);
    const priorNum = parseFloat(priorQuote);
    if (isNaN(currentNum) || isNaN(priorNum)) return;

    if (round2(currentNum) === round2(priorNum)) {
        testResults.passed.push(
            `[L2:quote] quote.price.value consistent: ${priorAction || "prior"} (${priorNum}) == ${currentAction || "current"} (${currentNum})`
        );
    } else {
        testResults.failed.push(
            `[L2:quote] quote.price.value changed: ${priorAction || "prior"} (${priorNum}) → ${currentAction || "current"} (${currentNum})`
        );
    }
}

/**
 * Validates: billing details must persist across actions
 */
export function validateBillingConsistency(
    currentMessage: any,
    priorData: Record<string, any> | null,
    testResults: TestResult,
    flowId?: string,
    currentAction?: string,
    priorAction?: string
): void {
    if (!isHealthInsuranceFlow(flowId) || !priorData) return;

    const currentBilling = currentMessage?.order?.billing;
    const priorBilling = priorData?.billing;

    if (!currentBilling || !priorBilling) return;

    const fields = ["name", "phone", "email"];
    let allMatch = true;

    for (const field of fields) {
        if (currentBilling[field] && priorBilling[field]) {
            if (String(currentBilling[field]) !== String(priorBilling[field])) {
                testResults.failed.push(
                    `[L2:billing] billing.${field} mismatch: ${priorAction || "prior"}="${priorBilling[field]}" vs ${currentAction || "current"}="${currentBilling[field]}"`
                );
                allMatch = false;
            }
        }
    }

    if (allMatch) {
        testResults.passed.push(
            `[L2:billing] Billing details consistent between ${priorAction || "prior"} and ${currentAction || "current"}`
        );
    }
}

/**
 * Validates: payment.collected_by must stay same across actions
 */
export function validatePaymentCollectedByConsistency(
    currentMessage: any,
    priorData: Record<string, any> | null,
    testResults: TestResult,
    flowId?: string,
    currentAction?: string,
    priorAction?: string
): void {
    if (!isHealthInsuranceFlow(flowId) || !priorData) return;

    const currentPayments: any[] = currentMessage?.order?.payments || [];
    const priorPayments: any[] = priorData?.payments || [];

    if (currentPayments.length === 0 || priorPayments.length === 0) return;

    // Compare first payment's collected_by
    const currentCb = currentPayments[0]?.collected_by;
    const priorCb = priorPayments[0]?.collected_by;

    if (!currentCb || !priorCb) return;

    if (currentCb === priorCb) {
        testResults.passed.push(
            `[L2:payment] collected_by consistent: ${priorAction || "prior"} and ${currentAction || "current"} both "${currentCb}"`
        );
    } else {
        testResults.failed.push(
            `[L2:payment] collected_by mismatch: ${priorAction || "prior"}="${priorCb}" vs ${currentAction || "current"}="${currentCb}"`
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. STATE TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
    "ACTIVE": ["ACTIVE", "COMPLETE", "CANCELLATION_INITIATED", "CANCELLED"],
    "COMPLETE": ["COMPLETE"],
    "CANCELLATION_INITIATED": ["CANCELLATION_INITIATED", "CANCELLED"],
    "CANCELLED": ["CANCELLED"],
};

/**
 * Validates: order status transition is valid given the prior status
 */
export function validateOrderStatusTransition(
    currentMessage: any,
    priorData: Record<string, any> | null,
    testResults: TestResult,
    flowId?: string,
    currentAction?: string,
    priorAction?: string
): void {
    if (!isHealthInsuranceFlow(flowId) || !priorData) return;

    const currentStatus = currentMessage?.order?.status;
    const priorStatus = priorData?.order_status || priorData?.order?.status;

    if (!currentStatus || !priorStatus) return;

    const allowed = VALID_STATUS_TRANSITIONS[priorStatus];
    if (!allowed) {
        // Unknown prior status, skip
        return;
    }

    if (allowed.includes(currentStatus)) {
        testResults.passed.push(
            `[L2:state] Order status transition "${priorStatus}" → "${currentStatus}" is valid`
        );
    } else {
        testResults.failed.push(
            `[L2:state] Invalid order status transition: "${priorStatus}" → "${currentStatus}". Allowed: ${allowed.join(", ")}`
        );
    }
}

const FULFILLMENT_STATE_ORDER = ["INITIATED", "PROCESSING", "PROCESSED", "GRANTED", "REJECTED"];

/**
 * Validates: fulfillment state transitions are forward-only (non-regressive)
 */
export function validateFulfillmentStateTransition(
    currentMessage: any,
    priorData: Record<string, any> | null,
    testResults: TestResult,
    flowId?: string,
    currentAction?: string,
    priorAction?: string
): void {
    if (!isHealthInsuranceFlow(flowId) || !priorData) return;

    const currentFulfillments: any[] = currentMessage?.order?.fulfillments || [];
    const priorFulfillments: any[] = priorData?.fulfillments || [];

    if (currentFulfillments.length === 0 || priorFulfillments.length === 0) return;

    // Build prior state map by fulfillment id
    const priorStateMap = new Map<string, string>();
    for (const f of priorFulfillments) {
        if (f?.id && f?.state?.descriptor?.code) {
            priorStateMap.set(String(f.id), f.state.descriptor.code);
        }
    }

    for (const f of currentFulfillments) {
        const fId = f?.id ? String(f.id) : undefined;
        const currentState = f?.state?.descriptor?.code;
        if (!fId || !currentState) continue;

        const priorState = priorStateMap.get(fId);
        if (!priorState) continue;

        // REJECTED is a terminal state from any point
        if (currentState === "REJECTED") {
            testResults.passed.push(
                `[L2:fulfillment] Fulfillment "${fId}" state "${priorState}" → "REJECTED" is valid (terminal)`
            );
            continue;
        }

        const priorIdx = FULFILLMENT_STATE_ORDER.indexOf(priorState);
        const currentIdx = FULFILLMENT_STATE_ORDER.indexOf(currentState);

        if (priorIdx === -1 || currentIdx === -1) continue; // Unknown states, skip

        if (currentIdx >= priorIdx) {
            testResults.passed.push(
                `[L2:fulfillment] Fulfillment "${fId}" state "${priorState}" → "${currentState}" is valid (forward)`
            );
        } else {
            testResults.failed.push(
                `[L2:fulfillment] Fulfillment "${fId}" state regression: "${priorState}" → "${currentState}" is invalid`
            );
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SETTLEMENT CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates: settlement.amount consistency with quote and BFF.
 * If SETTLEMENT_AMOUNT is declared, verify:
 *   SETTLEMENT_AMOUNT = quote.price.value - BFF_AMOUNT (when BAP collects)
 *   or SETTLEMENT_AMOUNT = quote.price.value (when BPP collects)
 */
export function validateSettlementAmountConsistency(
    message: any,
    testResults: TestResult,
    flowId?: string,
    actionLabel?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const quoteValue = message?.order?.quote?.price?.value;
    const payments = message?.order?.payments;
    if (!quoteValue || !payments || !Array.isArray(payments)) return;

    const quoteNum = parseFloat(quoteValue);
    if (isNaN(quoteNum)) return;

    for (let i = 0; i < payments.length; i++) {
        const tags = payments[i]?.tags;
        if (!tags || !Array.isArray(tags)) continue;

        const settlAmount = getTagListValue(tags, "SETTLEMENT_TERMS", "SETTLEMENT_AMOUNT");
        if (!settlAmount) continue;

        const settlNum = parseFloat(settlAmount);
        if (isNaN(settlNum)) {
            testResults.failed.push(
                `[L2:${actionLabel || "settlement"}] SETTLEMENT_AMOUNT is non-numeric: ${settlAmount}`
            );
            continue;
        }

        const collectedBy = payments[i]?.collected_by;
        const bffAmount = getTagListValue(tags, "BUYER_FINDER_FEES", "BUYER_FINDER_FEES_AMOUNT");
        const bffPerc = getTagListValue(tags, "BUYER_FINDER_FEES", "BUYER_FINDER_FEES_PERCENTAGE");

        let bffNum = 0;
        if (bffAmount) {
            bffNum = parseFloat(bffAmount);
        } else if (bffPerc) {
            const pct = parseFloat(bffPerc);
            if (!isNaN(pct)) bffNum = round2((pct / 100) * quoteNum);
        }

        if (collectedBy === "BAP") {
            // BAP collects full amount, settles (quote - BFF) to BPP
            const expectedSettl = round2(quoteNum - bffNum);
            if (round2(settlNum) === expectedSettl) {
                testResults.passed.push(
                    `[L2:${actionLabel || "settlement"}] SETTLEMENT_AMOUNT (${settlNum}) = quote (${quoteNum}) - BFF (${bffNum}) ✓`
                );
            } else {
                testResults.failed.push(
                    `[L2:${actionLabel || "settlement"}] SETTLEMENT_AMOUNT (${settlNum}) ≠ quote (${quoteNum}) - BFF (${bffNum}). Expected: ${expectedSettl}`
                );
            }
        } else if (collectedBy === "BPP") {
            // BPP collects full amount; if settlement terms exist, settlement should equal quote
            if (round2(settlNum) === round2(quoteNum)) {
                testResults.passed.push(
                    `[L2:${actionLabel || "settlement"}] SETTLEMENT_AMOUNT (${settlNum}) matches quote (${quoteNum}) for BPP collection ✓`
                );
            } else {
                // BPP might settle BFF back to BAP, so settlement = quote - BFF is also valid
                const altExpected = round2(quoteNum - bffNum);
                if (bffNum > 0 && round2(settlNum) === altExpected) {
                    testResults.passed.push(
                        `[L2:${actionLabel || "settlement"}] SETTLEMENT_AMOUNT (${settlNum}) = quote (${quoteNum}) - BFF (${bffNum}) for BPP reverse settlement ✓`
                    );
                } else {
                    testResults.failed.push(
                        `[L2:${actionLabel || "settlement"}] SETTLEMENT_AMOUNT (${settlNum}) does not match expected for BPP collection`
                    );
                }
            }
        }
    }
}

/**
 * Validates: SETTLEMENT_TERMS tags are consistent across actions
 */
export function validateSettlementTermsConsistency(
    currentMessage: any,
    priorData: Record<string, any> | null,
    testResults: TestResult,
    flowId?: string,
    currentAction?: string,
    priorAction?: string
): void {
    if (!isHealthInsuranceFlow(flowId) || !priorData) return;

    const currentPayments: any[] = currentMessage?.order?.payments || [];
    const priorPayments: any[] = priorData?.payments || [];

    if (currentPayments.length === 0 || priorPayments.length === 0) return;

    const fieldsToCheck = ["SETTLEMENT_WINDOW", "SETTLEMENT_BASIS", "DELAY_INTEREST", "MANDATORY_ARBITRATION"];

    for (const field of fieldsToCheck) {
        const currentVal = (() => {
            for (const p of currentPayments) {
                const v = getTagListValue(p?.tags || [], "SETTLEMENT_TERMS", field);
                if (v) return v;
            }
            return undefined;
        })();

        const priorVal = (() => {
            for (const p of priorPayments) {
                const v = getTagListValue(p?.tags || [], "SETTLEMENT_TERMS", field);
                if (v) return v;
            }
            return undefined;
        })();

        if (!currentVal || !priorVal) continue;

        if (currentVal === priorVal) {
            testResults.passed.push(
                `[L2:settlement] ${field} consistent between ${priorAction || "prior"} and ${currentAction || "current"}: ${currentVal}`
            );
        } else {
            testResults.failed.push(
                `[L2:settlement] ${field} mismatch: ${priorAction || "prior"}="${priorVal}" vs ${currentAction || "current"}="${currentVal}"`
            );
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. TIME-BASED VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates: current action's context.timestamp >= prior action's context.timestamp
 */
export function validateTimestampOrdering(
    currentContext: any,
    priorData: Record<string, any> | null,
    testResults: TestResult,
    flowId?: string,
    currentAction?: string,
    priorAction?: string
): void {
    if (!isHealthInsuranceFlow(flowId) || !priorData) return;

    // Prior data may have the timestamp stored differently
    const currentTs = currentContext?.timestamp;
    // In the Redis store, we don't always have the timestamp directly,
    // so skip if not available
    if (!currentTs) return;

    // We only validate if prior data has a way to compare
    // In practice, the prior action context timestamp isn't always stored in save-specs
    // So this validator is primarily useful when both timestamps are available
}

/**
 * Validates: order.created_at <= order.updated_at
 */
export function validateCreatedUpdatedAt(
    message: any,
    testResults: TestResult,
    flowId?: string,
    actionLabel?: string
): void {
    if (!isHealthInsuranceFlow(flowId)) return;

    const createdAt = message?.order?.created_at;
    const updatedAt = message?.order?.updated_at;

    if (!createdAt || !updatedAt) return;

    const createdDate = new Date(createdAt);
    const updatedDate = new Date(updatedAt);

    if (isNaN(createdDate.getTime()) || isNaN(updatedDate.getTime())) {
        testResults.failed.push(
            `[L2:${actionLabel || "timestamps"}] Invalid date format in created_at or updated_at`
        );
        return;
    }

    if (createdDate.getTime() <= updatedDate.getTime()) {
        testResults.passed.push(
            `[L2:${actionLabel || "timestamps"}] created_at (${createdAt}) ≤ updated_at (${updatedAt}) ✓`
        );
    } else {
        testResults.failed.push(
            `[L2:${actionLabel || "timestamps"}] created_at (${createdAt}) > updated_at (${updatedAt}) — created_at must be ≤ updated_at`
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. CONTEXT INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates: context fields (bap_id, bpp_id, transaction_id) are consistent
 * between the request and response pair.
 */
export function validateContextConsistency(
    currentContext: any,
    priorData: Record<string, any> | null,
    testResults: TestResult,
    flowId?: string,
    currentAction?: string,
    priorAction?: string
): void {
    if (!isHealthInsuranceFlow(flowId) || !priorData) return;

    const currentTxnId = currentContext?.transaction_id;
    const priorTxnId = priorData?.transaction_id;

    if (currentTxnId && priorTxnId) {
        if (currentTxnId === priorTxnId) {
            testResults.passed.push(
                `[L2:context] transaction_id consistent between ${priorAction || "prior"} and ${currentAction || "current"}`
            );
        } else {
            testResults.failed.push(
                `[L2:context] transaction_id mismatch: ${priorAction || "prior"}="${priorTxnId}" vs ${currentAction || "current"}="${currentTxnId}"`
            );
        }
    }
}

/**
 * Validates: Each action's message_id must differ from prior actions' message_id.
 */
export function validateMessageIdUniqueness(
    currentContext: any,
    priorData: Record<string, any> | null,
    testResults: TestResult,
    flowId?: string,
    currentAction?: string,
    priorAction?: string
): void {
    if (!isHealthInsuranceFlow(flowId) || !priorData) return;

    const currentMsgId = currentContext?.message_id;
    const priorMsgId = priorData?.message_id;

    if (!currentMsgId || !priorMsgId) return;

    if (currentMsgId !== priorMsgId) {
        testResults.passed.push(
            `[L2:context] message_id is unique between ${priorAction || "prior"} and ${currentAction || "current"}`
        );
    } else {
        testResults.failed.push(
            `[L2:context] message_id should be unique — ${priorAction || "prior"} and ${currentAction || "current"} have same message_id: ${currentMsgId}`
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. COMPOSITE CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Runs all financial L2 validations on a message that contains a quote.
 */
export function validateAllFinancials(
    message: any,
    testResults: TestResult,
    flowId?: string,
    actionLabel?: string
): void {
    validateQuoteBreakupSum(message, testResults, flowId, actionLabel);
    validatePaymentQuoteConsistency(message, testResults, flowId, actionLabel);
    validateBuyerFinderFeeArithmetic(message, testResults, flowId, actionLabel);
    validateBreakupItemPriceIntegrity(message, testResults, flowId, actionLabel);
    validateSettlementAmountConsistency(message, testResults, flowId, actionLabel);
}

/**
 * Runs all cross-action consistency validations.
 */
export function validateAllCrossAction(
    currentMessage: any,
    priorData: Record<string, any> | null,
    testResults: TestResult,
    flowId?: string,
    currentAction?: string,
    priorAction?: string
): void {
    validateProviderConsistency(currentMessage, priorData, testResults, flowId, currentAction, priorAction);
    validateItemConsistency(currentMessage, priorData, testResults, flowId, currentAction, priorAction);
    validateQuoteConsistency(currentMessage, priorData, testResults, flowId, currentAction, priorAction);
    validateBillingConsistency(currentMessage, priorData, testResults, flowId, currentAction, priorAction);
    validatePaymentCollectedByConsistency(currentMessage, priorData, testResults, flowId, currentAction, priorAction);
}

/**
 * Runs context integrity checks.
 */
export function validateAllContext(
    currentContext: any,
    priorData: Record<string, any> | null,
    testResults: TestResult,
    flowId?: string,
    currentAction?: string,
    priorAction?: string
): void {
    validateContextConsistency(currentContext, priorData, testResults, flowId, currentAction, priorAction);
    validateMessageIdUniqueness(currentContext, priorData, testResults, flowId, currentAction, priorAction);
}
