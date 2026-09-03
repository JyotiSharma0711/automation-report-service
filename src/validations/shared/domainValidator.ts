import {
  createConfirmValidator,
  createInitValidator,
  createUpdateValidator,
  createOnCancelValidator,
  createOnConfirmValidator,
  createOnInitValidator,
  createOnSearchValidator,
  createOnSelectValidator,
  createOnStatusValidator,
  createOnUpdateValidator,
  createSearchValidator,
  createSelectValidator,
  createIssueValidator,
  createOnIssueValidator,
  createIgm1IssueValidator,
  createIgm1OnIssueValidator,
  createIssueStatusValidator,
  createOnIssueStatusValidator,
} from "./validationFactory";
import { validatorConstant } from "./validatorConstant";

/**
 * Pre-configured validators for common domain patterns
 */
const fis11Validators = validatorConstant.beckn.ondc.fis.fis11.v200;
const fis10Validators = validatorConstant.beckn.ondc.fis.fis10.v210;
const trv11Validators = validatorConstant.beckn.ondc.trv.trv11.v201;
const fis12Validators = validatorConstant.beckn.ondc.fis.fis12.v202;
const fis12230Validators = validatorConstant.beckn.ondc.fis.fis12.v230;
const logValidators = validatorConstant.beckn.ondc.log.v125;
const trv10Validators = validatorConstant.beckn.ondc.trv.trv10.v210;
const igmValidators = validatorConstant.beckn.ondc.trv.igm.v200;
const igm1Validators = validatorConstant.beckn.ondc.trv.igm.v100;

export const DomainValidators = {
  fis11Search: createSearchValidator(
    fis11Validators.intent.validate_intent,
    fis11Validators.payment.validate_payment_collected_by,
    fis11Validators.tags.validate_tags
  ),

  fis11OnSearch: createOnSearchValidator(
    fis11Validators.catalog.validate_catalog,
    fis11Validators.providers.validate_providers,
    fis11Validators.items.validate_items,
    fis11Validators.fulfillments.validate_fulfillments,
    fis11Validators.payments.validate_payments
  ),

  fis11Select: createSelectValidator(
    fis11Validators.order.validate_order,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis11Validators.fulfillments.validate_fulfillments
  ),

  fis11OnSelect: createOnSelectValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis11Validators.fulfillments.validate_fulfillments
  ),

  fis11Init: createInitValidator(
    fis11Validators.order.validate_order,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis11Validators.fulfillments.validate_fulfillments,
    fis11Validators.payments.validate_payments,
    fis11Validators.billing.validate_billing
  ),

  fis11OnInit: createOnInitValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis11Validators.fulfillments.validate_fulfillments,
    fis11Validators.payments.validate_payments,
    fis11Validators.billing.validate_billing
  ),

  fis11Confirm: createConfirmValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis11Validators.fulfillments.validate_fulfillments,
    fis11Validators.payments.validate_payments,
    fis11Validators.billing.validate_billing
  ),

  fis11OnConfirm: createOnConfirmValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis11Validators.fulfillments.validate_fulfillments,
    fis11Validators.payments.validate_payments,
    fis11Validators.billing.validate_billing,
    fis11Validators.order_status.validate_order_status
  ),

  fis11OnConfirmSuccess: createOnConfirmValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis11Validators.fulfillments.validate_fulfillments,
    fis11Validators.billing.validate_billing,
    fis11Validators.order_status.validate_order_status
  ),

  ondclogSearch: createSearchValidator(
    logValidators.holidays.validate_holidays,
    logValidators.lbnp.validate_lbnp,
    logValidators.prepaid_payment.validate_prepaid_payment,
    logValidators.cod.validate_cod,
    logValidators.sla_metrics.validate_sla_metrics
  ),

  ondclogOnSearch: createOnSearchValidator(
    logValidators.lsp.validate_lsp,
    logValidators.tat.validate_tat,
    logValidators.shipment_types.validate_shipment_types,
    logValidators.cod.validate_cod,
    logValidators.tax_type_rcm.validate_np_tax_type_rcm,
    // logValidators.codified_static_terms.validate_codified_static_terms,
  ),

  nic2004Search: createSearchValidator(
    logValidators.holidays.validate_holidays
  ),

  ondclogSelect: createSelectValidator(
    logValidators.holidays.validate_holidays,
    logValidators.lbnp.validate_lbnp,
    logValidators.prepaid_payment.validate_prepaid_payment,
    logValidators.cod.validate_cod
  ),

  /**
   * ONDC LOG10/LOG11 on_select validator with comprehensive validations
   */
  ondclogOnSelect: createOnSelectValidator(
    logValidators.lsp.validate_lsp,
    logValidators.tat.validate_tat,
    logValidators.shipment_types.validate_shipment_types
  ),

  /**
   * ONDC LOG10/LOG11 init validator with all validations
   */
  ondclogInit: createInitValidator(
    logValidators.holidays.validate_holidays,
    // logValidators.lbnp.validate_lbnp,
    logValidators.prepaid_payment.validate_prepaid_payment,
    logValidators.cod.validate_cod
  ),

  /**
   * ONDC LOG10/LOG11 on_init validator with comprehensive validations
   */
  ondclogOnInit: createOnInitValidator(
    // logValidators.lsp.validate_lsp,
    logValidators.tat.validate_tat,
    logValidators.shipment_types.validate_shipment_types
  ),

  ondclogConfirm: createConfirmValidator(
    logValidators.holidays.validate_holidays,
    // logValidators.lbnp.validate_lbnp,
    logValidators.prepaid_payment.validate_prepaid_payment,
    logValidators.sla_metrics.validate_sla_metrics,
    logValidators.seller_creds.validate_seller_creds
  ),

  ondclogOnConfirm: createOnConfirmValidator(
    // logValidators.lsp.validate_lsp,
    logValidators.tat.validate_tat,
    logValidators.shipment_types.validate_shipment_types,
    logValidators.sla_metrics.validate_sla_metrics,
    logValidators.tax_type_rcm.validate_np_tax_type_rcm,
    logValidators.codified_static_terms.validate_codified_static_terms,
  ),

  /**
   * TRV10 validators - reuse the same validation functions as FIS11
   * since TRV10 and FIS11 share similar structures
   */
  trv10Search: createSearchValidator(
    trv10Validators.intent.validate_intent,
    trv10Validators.payment.validate_payment_collected_by,
    trv10Validators.tags.validate_tags,
    trv10Validators.fulfillment_stops.validate_fulfillment_stops
  ),

  trv10OnSearch: createOnSearchValidator(
    trv10Validators.catalog.validate_catalog,
    trv10Validators.providers_trv10.validate_providers_trv10,
    trv10Validators.items.validate_items,
    trv10Validators.fulfillments.validate_fulfillments,
    trv10Validators.payments.validate_payments,
    trv10Validators.fulfillment_stops_catalog.validate_fulfillment_stops_catalog
  ),

  trv10Select: createSelectValidator(
    trv10Validators.order.validate_order,
    trv10Validators.providers_trv10.validate_providers_trv10,
    trv10Validators.items_trv10.validate_items_trv10,
    trv10Validators.fulfillments_trv10.validate_fulfillments_trv10
  ),

  trv10OnSelect: createOnSelectValidator(
    trv10Validators.order.validate_order,
    trv10Validators.quote_trv10.validate_quote_trv10,
    trv10Validators.provider_trv10.validate_provider_trv10,
    trv10Validators.items.validate_items,
    trv10Validators.fulfillments.validate_fulfillments,
    trv10Validators.fulfillment_stops_order.validate_fulfillment_stops_order
  ),

  trv10Init: createInitValidator(
    trv10Validators.order.validate_order,
    trv10Validators.provider_trv10.validate_provider_trv10,
    trv10Validators.items_trv10.validate_items_trv10,
    trv10Validators.fulfillments_trv10.validate_fulfillments_trv10,
    trv10Validators.payments_trv10.validate_payments_trv10,
    trv10Validators.billing_trv10.validate_billing_trv10,
    trv10Validators.fulfillment_stops_order.validate_fulfillment_stops_order
  ),

  trv10OnInit: createOnInitValidator(
    trv10Validators.order.validate_order,
    trv10Validators.quote_trv10.validate_quote_trv10,
    trv10Validators.provider_trv10.validate_provider_trv10,
    trv10Validators.items.validate_items,
    trv10Validators.fulfillments.validate_fulfillments,
    trv10Validators.payments_trv10.validate_payments_trv10,
    trv10Validators.billing_trv10.validate_billing_trv10,
    trv10Validators.fulfillment_stops_order.validate_fulfillment_stops_order
  ),

  trv10Confirm: createConfirmValidator(
    trv10Validators.order.validate_order,
    trv10Validators.quote_trv10.validate_quote_trv10,
    trv10Validators.provider_trv10.validate_provider_trv10,
    trv10Validators.items_trv10.validate_items_trv10,
    trv10Validators.fulfillments.validate_fulfillments,
    trv10Validators.payments_trv10.validate_payments_trv10,
    trv10Validators.billing_trv10.validate_billing_trv10
  ),

  trv10OnConfirm: createOnConfirmValidator(
    trv10Validators.order.validate_order,
    trv10Validators.quote_trv10.validate_quote_trv10,
    trv10Validators.provider_trv10.validate_provider_trv10,
    trv10Validators.items.validate_items,
    trv10Validators.fulfillments.validate_fulfillments,
    trv10Validators.payments_trv10.validate_payments_trv10,
    trv10Validators.billing_trv10.validate_billing_trv10,
    trv10Validators.order_status.validate_order_status
  ),

  trv10OnStatus: createOnStatusValidator(
    trv10Validators.order.validate_order,
    trv10Validators.quote_trv10.validate_quote_trv10,
    trv10Validators.provider_trv10.validate_provider_trv10,
    trv10Validators.items.validate_items,
    trv10Validators.fulfillments.validate_fulfillments,
    trv10Validators.payments_trv10.validate_payments_trv10,
    trv10Validators.billing_trv10.validate_billing_trv10,
    trv10Validators.order_status.validate_order_status,
    trv10Validators.fulfillment_stops_order.validate_fulfillment_stops_order
  ),

  trv10OnUpdate: createOnUpdateValidator(
    trv10Validators.order.validate_order,
    trv10Validators.quote_trv10.validate_quote_trv10,
    trv10Validators.provider_trv10.validate_provider_trv10,
    trv10Validators.items.validate_items,
    trv10Validators.fulfillments.validate_fulfillments,
    trv10Validators.payments_trv10.validate_payments_trv10,
    trv10Validators.billing_trv10.validate_billing_trv10,
    trv10Validators.order_status.validate_order_status,
    trv10Validators.fulfillment_stops_order.validate_fulfillment_stops_order
  ),

  trv10OnCancel: createOnCancelValidator(
    trv10Validators.order.validate_order,
    trv10Validators.quote_trv10.validate_quote_trv10,
    trv10Validators.provider_trv10.validate_provider_trv10,
    trv10Validators.items.validate_items,
    trv10Validators.fulfillments.validate_fulfillments,
    trv10Validators.payments_trv10.validate_payments_trv10,
    trv10Validators.billing_trv10.validate_billing_trv10,
    trv10Validators.order_status.validate_order_status,
    trv10Validators.fulfillment_stops_order.validate_fulfillment_stops_order
  ),

  trv10Update: createUpdateValidator(
    trv10Validators.update_request_trv10.validate_update_request_trv10,
    trv10Validators.fulfillment_stops_order.validate_fulfillment_stops_order,
    trv10Validators.fulfillments_trv10.validate_fulfillments_trv10,
  ),

  fis12Search: createSearchValidator(
    fis11Validators.intent.validate_intent,
    fis11Validators.payment.validate_payment_collected_by,
    fis11Validators.tags.validate_tags
  ),

  fis10Search: createSearchValidator(
    fis11Validators.intent.validate_intent,
  ),

  fis10OnSearch: createOnSearchValidator(
    fis11Validators.catalog.validate_catalog,
    fis11Validators.providers.validate_providers,
    fis10Validators.items.validate_onsearch_items,
    fis12Validators.catalog.providers.categories,
  ),

  fis10Select: createSelectValidator(
    fis11Validators.order.validate_order,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
  ),

  fis10OnSelect: createOnSelectValidator(
    trv10Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    trv10Validators.provider_trv10.validate_provider_trv10,
    fis11Validators.items.validate_items,
  ),
  fis10Init: createInitValidator(
    fis11Validators.order.validate_order,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.payments.validate_payments,
  ),

  fis10OnInit: createOnInitValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
  ),

  fis10Confirm: createConfirmValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis12Validators.payments.validate_payments
  ),

  fis10OnConfirm: createOnConfirmValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis12Validators.payments.validate_payments,
    fis11Validators.order_status.validate_order_status,
  ),

  fis10OnStatus: createOnStatusValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis11Validators.order_status.validate_order_status
  ),

  fis10Update: createUpdateValidator(
    trv10Validators.update_request_trv10.validate_update_request_trv10,
    fis12Validators.update.validate_update_payments,
    fis12Validators.update.validate_fulfillment_state
  ),

  fis10OnUpdate: createOnUpdateValidator(
    trv10Validators.order.validate_order,
    trv10Validators.quote_trv10.validate_quote_trv10,
    trv10Validators.provider_trv10.validate_provider_trv10,
    trv10Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis12Validators.payments.validate_payments,
    fis12Validators.documents.validate_documents,
    fis12Validators.update.validate_fulfillment_state
  ),

  fis10OnCancel: createOnCancelValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis12Validators.payments.validate_payments,
    fis12Validators.documents.validate_documents,
    fis11Validators.order_status.validate_order_status
  ),

  fis12OnSearch: createOnSearchValidator(
    fis11Validators.catalog.validate_catalog,
    fis11Validators.providers.validate_providers,
    fis12Validators.items.validate_onsearch_items,
    fis12Validators.payments.validate_payments,
    fis12Validators.catalog.providers.categories,
    fis12Validators.items.validate_xinput
  ),

  fis12UnifiedCreditSearch: createSearchValidator(
    // Unified credit search uses xinput-based form data, not BAP_TERMS/payment tags
    // Only validate intent presence (via validateIntent which is skipped for UNIFIED_CREDIT_FLOWS)
    fis11Validators.intent.validate_intent,
  ),

  fis12UnifiedCreditOnSearch: createOnSearchValidator(
    // fis11Validators.catalog.validate_catalog,
    // fis11Validators.providers.validate_providers,
    fis12230Validators.items.validate_onsearch_items,
    // fis11Validators.payments.validate_payments,
    // fis12Validators.catalog.providers.categories,
  ),

  fis12Select: createSelectValidator(
    fis11Validators.order.validate_order,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.items.select_validate_xinput
  ),

  fis12OnSelect: createOnSelectValidator(
    trv10Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    trv10Validators.provider_trv10.validate_provider_trv10,
    fis11Validators.items.validate_items,
    fis12Validators.items.validate_xinput
  ),

  fis12Init: createInitValidator(
    fis11Validators.order.validate_order,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.payments.validate_payments,
    fis12Validators.items.select_validate_xinput
  ),

  fis12OnInit: createOnInitValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis12Validators.payments.validate_payments,
    fis12Validators.items.loan_info_oninit
  ),

  fis12Confirm: createConfirmValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis12Validators.payments.validate_payments
  ),

  fis12OnConfirm: createOnConfirmValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis12Validators.payments.validate_payments,
    fis11Validators.order_status.validate_order_status,
    fis12Validators.documents.validate_documents
  ),

  fis12OnStatus: createOnStatusValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis11Validators.order_status.validate_order_status
  ),

  fis12Update: createUpdateValidator(
    trv10Validators.update_request_trv10.validate_update_request_trv10,
    fis12Validators.update.validate_update_payments,
    fis12Validators.update.validate_fulfillment_state
  ),

  fis12OnUpdate: createOnUpdateValidator(
    trv10Validators.order.validate_order,
    trv10Validators.quote_trv10.validate_quote_trv10,
    trv10Validators.provider_trv10.validate_provider_trv10,
    trv10Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis12Validators.payments.validate_payments,
    fis12Validators.documents.validate_documents,
    fis12Validators.update.validate_fulfillment_state
  ),

  fis12OnCancel: createOnCancelValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis12Validators.payments.validate_payments,
    fis12Validators.documents.validate_documents,
    fis11Validators.order_status.validate_order_status
  ),

  // FIS13 Health Insurance validators (similar to FIS12)
  fis13Search: createSearchValidator(
    fis11Validators.intent.validate_intent,
    fis11Validators.payment.validate_payment_collected_by,
    fis11Validators.tags.validate_tags
  ),

  fis13OnSearch: createOnSearchValidator(
    fis11Validators.catalog.validate_catalog,
    fis11Validators.providers.validate_providers,
    fis11Validators.items.validate_items,
    fis11Validators.payments.validate_payments,
    fis12Validators.catalog.providers.categories,
    fis12Validators.items.validate_xinput
  ),

  fis13Select: createSelectValidator(
    fis11Validators.order.validate_order,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
  ),

  fis13OnSelect: createOnSelectValidator(
    trv10Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    trv10Validators.provider_trv10.validate_provider_trv10,
    fis11Validators.items.validate_items,
    fis12Validators.items.validate_xinput
  ),

  fis13Init: createInitValidator(
    fis11Validators.order.validate_order,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.payments.validate_payments,
    fis12Validators.items.select_validate_xinput
  ),

  fis13OnInit: createOnInitValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.payments.validate_payments
  ),

  fis13Confirm: createConfirmValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis12Validators.payments.validate_payments
  ),

  fis13OnConfirm: createOnConfirmValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis12Validators.payments.validate_payments,
    fis11Validators.order_status.validate_order_status,
    fis12Validators.documents.validate_documents
  ),

  fis13OnStatus: createOnStatusValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis12Validators.payments.validate_payments,
    fis12Validators.documents.validate_documents,
    fis11Validators.order_status.validate_order_status
  ),

  fis13Update: createUpdateValidator(
    trv10Validators.update_request_trv10.validate_update_request_trv10,
    fis12Validators.update.validate_update_payments,
    fis12Validators.update.validate_fulfillment_state
  ),

  fis13OnUpdate: createOnUpdateValidator(
    trv10Validators.order.validate_order,
    trv10Validators.quote_trv10.validate_quote_trv10,
    trv10Validators.provider_trv10.validate_provider_trv10,
    trv10Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis12Validators.payments.validate_payments,
    fis12Validators.documents.validate_documents,
    fis12Validators.update.validate_fulfillment_state
  ),

  fis13OnCancel: createOnCancelValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis12Validators.payments.validate_payments,
    fis12Validators.documents.validate_documents,
    fis11Validators.order_status.validate_order_status
  ),
  trv11Search: createSearchValidator(
    trv11Validators.search.validate_intent
  ),
  // TRV11 2.1.0: tags moved from payment.tags to intent.tags (BAP_TERMS)
  // Skip shared payment.tags validation; 2.1.0/search.ts handles BAP_TERMS
  trv11Search210: createSearchValidator(),
  trv11OnSearch: createOnSearchValidator(
    trv11Validators.on_search.validate_catalog
  ),
  trv11Select: createSelectValidator(
    trv11Validators.select.validate_order
  ),
  trv11OnSelect: createOnSelectValidator(
    trv11Validators.on_select.validate_order
  ),
  trv11Init: createInitValidator(
    trv11Validators.init.validate_order
  ),
  // TRV11 2.1.0: tags moved from payment[].tags to order.tags (BAP_TERMS)
  trv11Init210: createInitValidator(),
  trv11OnInit: createOnInitValidator(
    trv11Validators.on_init.validate_order
  ),
  // TRV11 2.1.0: tags moved from payment[].tags to order.tags (BPP_TERMS)
  trv11OnInit210: createOnInitValidator(),
  trv11Confirm: createConfirmValidator(
    trv11Validators.confirm.validate_order
  ),
  // TRV11 2.1.0: tags in order.tags (BAP_TERMS + BPP_TERMS)
  trv11Confirm210: createConfirmValidator(),
  trv11OnConfirm: createOnConfirmValidator(
    trv11Validators.on_confirm.validate_order
  ),
  // TRV11 2.1.0: tags in order.tags (BAP_TERMS + BPP_TERMS)
  trv11OnConfirm210: createOnConfirmValidator(),
  trv11OnStatus: createOnStatusValidator(
    trv11Validators.on_status.validate_order
  ),
  trv11OnCancel: createOnCancelValidator(
    trv11Validators.on_cancel.validate_order
  ),
  trv11OnUpdate: createOnUpdateValidator(
    trv11Validators.on_update.validate_order
  ),

  // IGM 2.0.0 Validators (reusable across domains)
  igmIssue: createIssueValidator(
    igmValidators.issue.validate_issue
  ),
  igmOnIssue: createOnIssueValidator(
    igmValidators.on_issue.validate_on_issue
  ),

  // IGM 1.0.0 Validators (reusable across domains)
  igm1Issue: createIgm1IssueValidator(
    igm1Validators.issue.validate_issue
  ),
  igm1OnIssue: createIgm1OnIssueValidator(
    igm1Validators.on_issue.validate_on_issue
  ),
  igm1IssueStatus: createIssueStatusValidator(
    igm1Validators.issue_status.validate_issue_status
  ),
  igm1OnIssueStatus: createOnIssueStatusValidator(
    igm1Validators.on_issue_status.validate_on_issue_status
  ),

  fis14Search: createSearchValidator(
    fis11Validators.intent.validate_intent,
  ),

  fis14OnSearch: createOnSearchValidator(
    fis11Validators.catalog.validate_catalog,
    fis11Validators.providers.validate_providers,
    fis12Validators.catalog.providers.categories,
  ),

  fis14Select: createSelectValidator(
    fis11Validators.order.validate_order,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
  ),

  fis14OnSelect: createOnSelectValidator(
    trv10Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    trv10Validators.provider_trv10.validate_provider_trv10,
    fis11Validators.items.validate_items,
  ),

  fis14Init: createInitValidator(
    fis11Validators.order.validate_order,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.payments.validate_payments,
  ),

  fis14OnInit: createOnInitValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.payments.validate_payments,
  ),

  fis14Confirm: createConfirmValidator(
    fis11Validators.order.validate_order,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.payments.validate_payments,
  ),

  fis14OnConfirm: createOnConfirmValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis12Validators.payments.validate_payments,
    fis11Validators.order_status.validate_order_status,
  ),

  fis14Status: createSearchValidator(
    fis11Validators.intent.validate_intent,
  ),

  fis14OnStatus: createOnStatusValidator(
    fis11Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    fis11Validators.provider.validate_provider,
    fis11Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis11Validators.order_status.validate_order_status,
  ),

  fis14Update: createUpdateValidator(
    trv10Validators.update_request_trv10.validate_update_request_trv10,
  ),

  fis14OnUpdate: createOnUpdateValidator(
    trv10Validators.order.validate_order,
    fis11Validators.quote.validate_quote,
    trv10Validators.provider_trv10.validate_provider_trv10,
    fis11Validators.items.validate_items,
    fis12Validators.fulfillments.validate_fulfillments,
    fis12Validators.payments.validate_payments,
    fis11Validators.order_status.validate_order_status,
  ),
};

