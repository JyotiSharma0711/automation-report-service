import { Request, Response } from "express";
import { getPayloadsByTransactionAndSession } from "../services/dbService";
import { mapPayloadsToLogFormat } from "../utils/payloadUtils";
import logger from "@ondc/automation-logger";
import { MESSAGES } from "../utils/messages";

export const fetchLogsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { test_id, transaction_id } = req.query;

    logger.info(
      `fetchLogsController called with test_id: ${test_id}, transaction_id: ${transaction_id}`
    );

    if (!transaction_id) {
      logger.error(MESSAGES.logsController.missingTransactionId);
      res.status(400).json({ error: MESSAGES.logsController.transactionIdRequired });
      return;
    }

    // Extract sessionId from test_id (remove 'PW_' prefix)
    const sessionId =
  typeof test_id === "string"
    ? test_id.replace(/^PW_/, "").split("::")[0]
    : undefined;

    logger.info(
      `Extracted sessionId: ${sessionId || "undefined"} from test_id: ${test_id}`
    );

    // Fetch payloads/logs from DB API
    const payloads = await getPayloadsByTransactionAndSession(
      transaction_id as string,
      sessionId
    );

    logger.info(
      `Fetched ${payloads?.length || 0} payload(s) for transaction_id: ${transaction_id}, sessionId: ${sessionId}`
    );

    // Map payloads to log format
    const formattedLogs = mapPayloadsToLogFormat(payloads);

    logger.info(
      `Mapped payloads to log format for transaction_id: ${transaction_id}`
    );

    res.status(200).json(formattedLogs);
  } catch (error: any) {
    logger.error(
      `Error in fetchLogsController for transaction_id: ${req.query.transaction_id} — ${error.message}`,
      { stack: error.stack }
    );
    res.status(500).json({ error: MESSAGES.logsController.internalServerError });
  }
};
