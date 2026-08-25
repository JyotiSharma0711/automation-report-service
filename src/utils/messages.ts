// Centralized application messages (logs, errors, responses)
// Usage: import { MESSAGES } from "../utils/messages";

export const MESSAGES = {
  app: {
    serverStarted: (port: number) => `Server is running on http://localhost:${port}`,
    internalError: "Internal Server Error",
  },
  auth: {
    apiKeyMissing: "API key is missing in the request",
    apiKeyInvalid: "API key is invalid.",
    apiKeyNotConfigured: "API key is not set in the environment variables",
  },
  report: {
    enteringController: "Entering generateReportController function.  Generating report...",
    missingSessionId: "Missing sessionId parameter",
    utilityReportSent: "Exiting generateReportController function. Utility report generated and sent.",
    validationReportSent: "Exiting generateReportController function. Custom HTML report generated and sent.",
    reportSent: "Exiting generateReportController function. Report generated and sent.",
    errorGenerating: "Error generating report",
  },
  services: {
    fetchPayloadsEnter: "Entering fetchPayloads function. Fetching payloads...",
    fetchPayloadsExit: "Exiting fetchPayloads function. Fetched payloads.",
    fetchPayloadsError: "Error in fetchPayloads function",

    fetchSessionEnter: (sessionId: string) =>
      `Entering fetchSessionDetails function. Fetching session details for session ID: ${sessionId}`,
    fetchSessionExit: "Exiting fetchSessionDetails function. Fetched session details.",
    fetchSessionError: (sessionId: string) =>
      `Failed to fetch details for session ID ${sessionId}`,

    utilityEnter: "Entering utilityReport function. Generating utility report...",
    utilityExit: "Exiting utilityReport function. Generated utility report.",

    validationEnter: "Entering validationModule function.",
    validationExit: "Exiting validationModule function. Validation completed.",
  },
  validations: {
    checkingMandatoryFlows: "Checking if all the required flows are tested",
    mandatoryFlowsDone: "Mandatory flows check completed",
    actionValidationStart: (flowId: string) => `Validating ${flowId}...`,
    actionValidationDone: (flowId: string) => `Action sequence validation completed for ${flowId}`,
    payloadProcessingDone: (flowId: string) => `Payload processing completed for ${flowId} using checkMessage`,
  },
  responses: {
    missingSessionId: "Missing sessionId parameter",
    failedToGenerateReport: "Failed to generate report",
    generic500: "Something went wrong!",
  },
  logsController: {
    missingTransactionId: "Missing transaction_id in query parameters",
    transactionIdRequired: "transaction_id is required",
    internalServerError: "Internal server error",
  },
  flowData: {
    missingRequiredFields: "subscriberId, domain and version are required",
    checkingDomain: "fetchFlowData: checking domain",
    internalWorkbenchFlowMessage: "This domain/version has an internal workbench flow.",
    fetchingFromPramaan: "Fetching flow data from Pramaan",
    fetchError: "fetchFlowData: error",
  },
  callback: {
    missingData: "Missing data in callback",
    dataBaseUrlNotConfigured: "DATA_BASE_URL not defined in environment variables",
    reportForwardedSuccessfully: "Report forwarded successfully",
  },
};

export type Messages = typeof MESSAGES;


