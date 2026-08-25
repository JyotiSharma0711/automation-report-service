import { Payload, TestResult } from "../types/payload";
import logger from "@ondc/automation-logger";
import { runValidations } from "../validations/shared/schemaValidator";
import { contextValidators, ExpectedContext } from "../validations/shared/contextValidator";
import { checkFlowContinuity } from "../validations/shared/flowContinuityValidators";

// A function to dynamically load and execute a validation function based on the provided module path and function name
const dynamicValidator = async (
  modulePathWithFunc: string, // The full path to the module and function (e.g., 'module#function')
  element: any, // The payload or element to be validated
  sessionID: string,
  flowId: string,
  usecaseId?: string
) => {
  // Splitting the modulePathWithFunc string into module path and function name
  const [modulePath, functionName] = modulePathWithFunc.split("#");

  try {
    // Dynamically require the module using the resolved path
    const validatorModule = require(modulePath);

    // Retrieve the validation function from the module
    const validatorFunc = functionName ? validatorModule[functionName] : null;

    // Extract action_id from element - ensure it's a string, not null/undefined
    const actionId = element?.action_id || element?.action || "";

    // Ensure usecaseId is passed correctly (could be undefined, which is fine for optional param)
    const finalUsecaseId = usecaseId;

    // Log all parameters before calling the function
    logger.info("dynamicValidator - About to call function:", {
      functionName,
      functionLength: validatorFunc.length,
      expectedParams: 5,
      params: {
        element: !!element,
        sessionID: typeof sessionID,
        flowId: typeof flowId,
        actionId: typeof actionId,
        usecaseId: typeof finalUsecaseId,
        actionIdValue: actionId,
        usecaseIdValue: finalUsecaseId
      }
    });

    // If the function exists and is valid, invoke it with the element and action
    // Pass usecaseId if the function accepts it (for backward compatibility)
    if (typeof validatorFunc === "function") {
      // Call with all 5 parameters explicitly
      const result = await validatorFunc(
        element,      // param 1
        sessionID,    // param 2
        flowId,       // param 3
        actionId,     // param 4
        finalUsecaseId // param 5 (usecaseId)
      );
      return result;

    } else {
      // Throw an error if the function is not found within the module

      throw new Error(
        `Validator function '${functionName}' not found in '${modulePath}'`
      );
    }
  } catch (error) {
    // Log any error encountered while loading the module or executing the function
    // logger.error("Error loading validator:", error);
    logger.error("Error in dynamicValidator function. ", {
      error,
      modulePath,
      functionName,
    });
    throw error; // Rethrow the error to be handled by the calling function
  }
};

// Main function that checks the message validation based on the domain and action
export const checkPayload = async (
  domain: string, // The domain (e.g., 'search', 'select') to determine the appropriate validation module
  element: Payload, // The payload or element to be validated
  sessionId: string,
  flowId: string,
  domainConfig: any,
  usecaseId?: string,
  // pramaan-validation-parity skill: everything already processed for this flow, before
  // `element`, in chronological order — the input the old one-payload-at-a-time signature
  // couldn't carry. Optional so every existing caller keeps compiling; callers that don't
  // pass it just don't get cross-call continuity checks for that payload.
  priorPayloadsInFlow?: Payload[],
  // pramaan-validation-parity skill: what the session/domainConfig independently knows this
  // payload's domain/version SHOULD be, so context:domain-exact-match and
  // context:version-exact-match have something real to compare against instead of comparing
  // the payload to itself. See contextValidator.ts's ExpectedContext doc comment.
  expectedDomainVersion?: ExpectedContext
): Promise<object> => {
  logger.info("Entering checkPayload function for test cases.", {
    domain,
    sessionId,
    flowId,
    usecaseId,
  });
  // 0) Always validate common context before any domain/action-specific checks
  const commonCtxResult = await runValidations(contextValidators(expectedDomainVersion), element?.jsonRequest);
  if (!commonCtxResult.ok) {
    return {
      response: {},
      passed: [],
      failed: commonCtxResult.errors,
    };
  }

  // 0b) pramaan-validation-parity skill: cross-call continuity checks (message_id uniqueness,
  // timestamp monotonicity, bap/bpp id+uri stability) — see flowContinuityValidators.ts.
  // Every domain gets these for free; failures here don't block the domain-specific checks
  // below the way a context failure does, they're just merged into the final result, so a
  // continuity issue doesn't hide whatever else the payload gets right or wrong.
  const continuityResult = checkFlowContinuity(element, priorPayloadsInFlow ?? []);

  // Get the module path and function name based on the version, or fall back to the default configuration
  const modulePathWithFunc = domainConfig?.validationModules;
  // Call the dynamicValidator to load and execute the validation function for the given domain, element, and action
  const domainResult = await dynamicValidator(
    modulePathWithFunc,
    element,
    sessionId,
    flowId,
    usecaseId
  );

  if (continuityResult.passed.length === 0 && continuityResult.failed.length === 0) {
    return domainResult;
  }

  const domainTestResult = domainResult as Partial<TestResult> | undefined;
  return {
    response: domainTestResult?.response ?? {},
    passed: [...(domainTestResult?.passed ?? []), ...continuityResult.passed],
    failed: [...(domainTestResult?.failed ?? []), ...continuityResult.failed],
  };
};
