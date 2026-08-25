import axios from "axios";
import { Payload, WrappedPayload } from "../types/payload";
import dotenv from "dotenv";
import logger from "@ondc/automation-logger";
import { MESSAGES } from "../utils/messages";

// Load environment variables
dotenv.config();

const API_URL = `${process.env.DATA_BASE_URL}/payload/ids`;

export async function fetchPayloads(requestBody: Record<string, string[]>): Promise<Record<string, Payload[]>> {

  try {
    const results = await Promise.all(
      Object.entries(requestBody).map(async ([flowId, payloadIds]) => {
        try {
          const response = await axios.post<{ payloads: Payload[] }>(API_URL, { payload_ids: payloadIds }, {
            headers: { "Content-Type": "application/json",
              "x-api-key": process.env.API_SERVICE_KEY
             },
          });
          return { [flowId]: response.data.payloads };
        } catch (error) {
          logger.error(`Error fetching payloads for flow ID ${flowId}`,
            {error,
            meta: {
              flowId,
              error,
            }}
          );
          return { [flowId]: [] }; // Return an empty array in case of an error
        }
      })
    );
    return Object.assign({}, ...results);
  } catch (error) {
    logger.error(MESSAGES.services.fetchPayloadsError,
      {error: new Error("Failed to fetch payloads"),
      meta: {
        error,
      },
    });
    throw new Error("Failed to fetch payloads");
  }
}

export async function fetchSessionDetails(sessionID: string): Promise<any> {
  try {
    const storageUrl = `${process.env.AUTOMATION_BACKEND}/sessions`;
    const response = await axios.get<WrappedPayload[]>(storageUrl, {
      headers: {
        "x-api-key": process.env.API_SERVICE_KEY
      },
      params: {
        session_id: sessionID
      }
    });
    return response.data;
  } catch (error) {
    let errorDetails = "Unknown error";
    
    if (axios.isAxiosError(error) && error.response) {
      errorDetails = JSON.stringify(error.response.data);
    }
    
    logger.error(MESSAGES.services.fetchSessionError(sessionID),
     { error: new Error(errorDetails),
      meta: {
        sessionID,
        errorDetails,
      }},
    );
    throw new Error(`Failed to fetch details for session ID ${sessionID}, Details: ${errorDetails}`);
  }
}

export async function getPayloadsByTransactionAndSession(
  transactionId: string,
  sessionId?: string
) {
  try {
    const response = await axios.get(
      `${process.env.DATA_BASE_URL}/payload/logs/${transactionId}`,
      {
        headers: {
          "x-api-key": process.env.API_SERVICE_KEY,
        },
      }
    );
    const payloads = response.data;
    // Filter by sessionId if provided
    const filteredPayloads = Array.isArray(payloads)
      ? sessionId
        ? payloads.filter(
            (p: any) => String(p.sessionId).trim() === String(sessionId).trim()
          )
        : payloads
      : [];

    return filteredPayloads;
  } catch (error) {
    logger.error(
      `Error fetching payloads for transactionId ${transactionId}:`,
      error
    );
    throw new Error("Failed to fetch payloads from DB API");
  }
}
