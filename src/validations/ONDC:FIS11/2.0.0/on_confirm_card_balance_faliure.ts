import { TestResult, Payload } from "../../../types/payload";
import { DomainValidators } from "../../shared/domainValidator";

export default async function on_confirm_card_balance_faliure(
  element: Payload,
  sessionID: string,
  flowId: string,
  actionId?: string
): Promise<TestResult> {
  // For failure scenario, we expect an error response
  const result: TestResult = {
    response: {},
    passed: [],
    failed: [],
  };
  
  const error = element.jsonRequest?.error;
  
  // Check if error is present in the response (this is the main validation for failure scenario)
  if (error) {
    result.passed.push("Error response is present for balance check failure");
    
    // Validate error code
    if (error.code) {
      result.passed.push(`Error code is present: ${error.code}`);
      
      // Check for specific error code for invalid card details
      if (error.code === "80101") {
        result.passed.push("Correct error code for invalid card details");
      } else {
        result.failed.push(`Expected error code '80101' for invalid card details, got '${error.code}'`);
      }
    }

    // Validate error message
    if (error.message) {
      result.passed.push(`Error message is present: ${error.message}`);
      
      // Check for expected error message
      if (error.message === "Provided card details are invalid.") {
        result.passed.push("Error message matches expected text for invalid card details");
      } else {
        result.passed.push(`Error message is present but may differ from expected: ${error.message}`);
      }
    }

    // Validate that no message field is present (since this is an error response)
    if (element.jsonRequest?.message) {
      result.failed.push("Message field should not be present in error response");
    } else {
      result.passed.push("Message field is correctly absent in error response");
    }
  } else {
    // If no error, check if message is present (which would be unexpected for failure)
    if (element.jsonRequest?.message) {
      result.failed.push("Unexpected: Message field is present but error is missing for failure scenario");
    }
  }
  
  if (actionId) {
    (result.response as any) = { ...(result.response || {}), action_id: actionId };
  }
  return result;
}