import { Payload } from "../types/payload";
import logger from "@ondc/automation-logger";

// Function to sort payloads within each flowId group by createdAt
export function sortPayloadsByCreatedAt(
  grouped: Record<string, Payload[]>
): Record<string, Payload[]> {
  Object.keys(grouped).forEach((key) => {
    if (Array.isArray(grouped[key])) {
      grouped[key].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }
  });
  return grouped;
}
