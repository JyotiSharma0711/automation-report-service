import { TestResult } from "../../types/payload";

// extractBySpec (src/utils/extract.ts) returns [] rather than undefined when a jsonpath query
// finds nothing (e.g. context.bpp_id on a broadcast `search`, where the BPP is legitimately
// unknown yet). Treat that — and any other "nothing here" shape — as not present, so a
// genuinely-absent field doesn't get compared as if it were a real value.
function normalizeContextField(value: any): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) return value.length ? String(value[0]) : undefined;
    if (value === "") return undefined;
    return String(value);
}

export function validateMfContextConsistency(
    ctx: any,
    priorData: any,
    result: TestResult,
    flowId: string,
    currentAction: string,
    priorAction: string
): void {
    if (!priorData) return;

    // bpp_id is unknown at broadcast `search` time by design — the gateway fans the request out
    // before any BPP has responded — so it can never legitimately match on_search's bpp_id.
    // Skip that specific pair instead of comparing "intentionally absent" against "now known".
    const fields: string[] = priorAction === "search"
        ? ["bap_id", "domain", "version"]
        : ["bap_id", "bpp_id", "domain", "version"];
    for (const field of fields) {
        const current = normalizeContextField(ctx?.[field]);
        const prior = normalizeContextField(priorData?.[field]);
        if (current !== undefined && prior !== undefined && current !== prior) {
            result.failed.push(
                `[${flowId}] MF-CTX-001: ${field} mismatch between ${currentAction} (${current}) and ${priorAction} (${prior})`
            );
        } else if (current !== undefined && prior !== undefined) {
            result.passed.push(`[${flowId}] MF-CTX-001: ${field} consistent across ${priorAction} → ${currentAction}`);
        }
    }
}

export function validateMfMessageIdMatch(
    ctx: any,
    priorData: any,
    result: TestResult,
    flowId: string,
    currentAction: string,
    priorAction: string
): void {
    if (!priorData) return;

    const currentMsgId = ctx?.message_id;
    const priorMsgId = priorData?.message_id;

    if (currentMsgId && priorMsgId) {
        if (currentMsgId === priorMsgId) {
            result.passed.push(`[${flowId}] MF-CTX-002: message_id matches between ${priorAction} and ${currentAction}`);
        } else {
            result.failed.push(
                `[${flowId}] MF-CTX-002: message_id mismatch — ${currentAction} has ${currentMsgId}, ${priorAction} had ${priorMsgId}`
            );
        }
    }
}

export function validateMfTransactionId(
    ctx: any,
    priorData: any,
    result: TestResult,
    flowId: string,
    currentAction: string,
    priorAction: string
): void {
    if (!priorData) return;

    const currentTxn = ctx?.transaction_id;
    const priorTxn = priorData?.transaction_id;

    if (currentTxn && priorTxn && currentTxn !== priorTxn) {
        result.failed.push(
            `[${flowId}] MF-CTX-003: transaction_id changed — ${currentAction} ${currentTxn} ≠ ${priorAction} ${priorTxn}`
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Consistency
// ─────────────────────────────────────────────────────────────────────────────

export function validateMfOrderIdConsistency(
    message: any,
    priorData: any,
    result: TestResult,
    flowId: string,
    currentAction: string,
    priorAction: string
): void {
    if (!priorData) return;

    const currentOrderId = message?.order?.id;
    const priorOrderId = priorData?.order_id;

    if (currentOrderId && priorOrderId) {
        if (currentOrderId === priorOrderId) {
            result.passed.push(`[${flowId}] MF-ORD-001: order.id consistent from ${priorAction} to ${currentAction}`);
        } else {
            result.failed.push(
                `[${flowId}] MF-ORD-001: order.id changed — ${currentAction} (${currentOrderId}) ≠ ${priorAction} (${priorOrderId})`
            );
        }
    }
}

export function validateMfProviderConsistency(
    message: any,
    priorData: any,
    result: TestResult,
    flowId: string,
    currentAction: string,
    priorAction: string
): void {
    if (!priorData) return;

    const currentProvider = message?.order?.provider?.id;
    const priorProvider = priorData?.provider_id;

    if (currentProvider && priorProvider) {
        if (currentProvider === priorProvider) {
            result.passed.push(`[${flowId}] MF-ORD-002: provider.id consistent from ${priorAction} to ${currentAction}`);
        } else {
            result.failed.push(
                `[${flowId}] MF-ORD-002: provider.id changed — ${currentAction} (${currentProvider}) ≠ ${priorAction} (${priorProvider})`
            );
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fulfillment State Progression
// ─────────────────────────────────────────────────────────────────────────────

const MF_FULFILLMENT_STATE_ORDER: Record<string, number> = {
    CREATED: 0,
    PENDING: 1,
    INITIATED: 2,
    ACTIVE: 3,
    ONGOING: 4,
    SIP_MANDATE_REGISTERED: 5,
    SIP_DEDUCTION_INITIATED: 6,
    INSTALMENT_SUCCESSFUL: 7,
    INSTALMENT_FAILED: 7,
    SUCCESSFUL: 8,
    FAILED: 8,
    COMPLETED: 9,
    CANCELLED: 10,
    PAUSED: 4,
};

export function validateMfFulfillmentStateProgression(
    message: any,
    priorData: any,
    result: TestResult,
    flowId: string,
    currentAction: string,
    priorAction: string
): void {
    if (!priorData?.fulfillment_states) return;

    const currentFulfillments: any[] = message?.order?.fulfillments || [];
    const priorStates: string[] = Array.isArray(priorData.fulfillment_states)
        ? priorData.fulfillment_states
        : [priorData.fulfillment_states];

    for (const fulfillment of currentFulfillments) {
        const currentState = fulfillment?.state?.descriptor?.code;
        if (!currentState) continue;

        const matchingPriorState = priorStates.find((s) => s !== undefined);
        if (!matchingPriorState) continue;

        // Allow terminal states at any point
        if (currentState === "CANCELLED" || currentState === "PAUSED") continue;

        const currentRank = MF_FULFILLMENT_STATE_ORDER[currentState] ?? -1;
        const priorRank = MF_FULFILLMENT_STATE_ORDER[matchingPriorState] ?? -1;

        if (currentRank < priorRank) {
            result.failed.push(
                `[${flowId}] MF-FUL-001: Fulfillment ${fulfillment.id} state regressed: ${priorAction} (${matchingPriorState}) → ${currentAction} (${currentState})`
            );
        } else {
            result.passed.push(
                `[${flowId}] MF-FUL-001: Fulfillment ${fulfillment.id} state progression valid: ${matchingPriorState} → ${currentState}`
            );
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote / Financial Consistency
// ─────────────────────────────────────────────────────────────────────────────

export function validateMfQuoteConsistency(
    message: any,
    priorData: any,
    result: TestResult,
    flowId: string,
    currentAction: string,
    priorAction: string
): void {
    if (!priorData?.quote) return;

    const currentPrice = message?.order?.quote?.price?.value;
    const priorPrice = priorData?.quote?.price?.value;

    if (currentPrice !== undefined && priorPrice !== undefined) {
        if (String(currentPrice) === String(priorPrice)) {
            result.passed.push(`[${flowId}] MF-QOT-001: quote.price.value consistent from ${priorAction} to ${currentAction}`);
        } else {
            result.failed.push(
                `[${flowId}] MF-QOT-001: quote.price changed — ${currentAction} (${currentPrice}) ≠ ${priorAction} (${priorPrice})`
            );
        }
    }
}

export function validateMfPaymentConsistency(
    message: any,
    priorData: any,
    result: TestResult,
    flowId: string,
    currentAction: string,
    priorAction: string
): void {
    if (!priorData?.payments) return;

    const currentPayments: any[] = message?.order?.payments || [];
    if (currentPayments.length === 0) return;

    const priorPayments: any[] = Array.isArray(priorData.payments)
        ? priorData.payments
        : [priorData.payments];

    // Check payment IDs persist from on_confirm to lifecycle actions
    const priorPaymentIds = priorPayments.map((p: any) => p?.id).filter(Boolean);
    const currentPaymentIds = currentPayments.map((p: any) => p?.id).filter(Boolean);

    for (const priorId of priorPaymentIds) {
        if (currentPaymentIds.includes(priorId)) {
            result.passed.push(`[${flowId}] MF-PAY-001: payment id ${priorId} persists from ${priorAction} to ${currentAction}`);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Items Consistency
// ─────────────────────────────────────────────────────────────────────────────

export function validateMfItemsInCatalog(
    selectMessage: any,
    onSearchData: any,
    result: TestResult,
    flowId: string
): void {
    if (!onSearchData?.items) return;

    const selectedItems: any[] = selectMessage?.order?.items || [];
    const catalogItemIds: string[] = Array.isArray(onSearchData.items)
        ? onSearchData.items.map((i: any) => i?.id).filter(Boolean)
        : [];

    for (const item of selectedItems) {
        if (!item?.id) continue;
        if (catalogItemIds.includes(item.id)) {
            result.passed.push(`[${flowId}] MF-ITEM-001: item ${item.id} exists in on_search catalog`);
        } else {
            result.failed.push(`[${flowId}] MF-ITEM-001: item ${item.id} from select not found in on_search catalog`);
        }
    }
}

export function validateMfItemsPersistence(
    message: any,
    priorData: any,
    result: TestResult,
    flowId: string,
    currentAction: string,
    priorAction: string
): void {
    if (!priorData?.items) return;

    const currentItems: any[] = message?.order?.items || [];
    const priorItems: any[] = Array.isArray(priorData.items) ? priorData.items : [priorData.items];

    const priorItemIds = priorItems.map((i: any) => i?.id).filter(Boolean);
    const currentItemIds = currentItems.map((i: any) => i?.id).filter(Boolean);

    for (const id of priorItemIds) {
        if (currentItemIds.includes(id)) {
            result.passed.push(`[${flowId}] MF-ITEM-002: item ${id} persists from ${priorAction} to ${currentAction}`);
        } else {
            result.failed.push(`[${flowId}] MF-ITEM-002: item ${id} missing in ${currentAction} (present in ${priorAction})`);
        }
    }
}
