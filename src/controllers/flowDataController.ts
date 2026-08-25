import { Request, Response } from "express";
import axios from "axios";
import logger from "@ondc/automation-logger";
import { ENABLED_DOMAINS } from "../utils/constants";
import { MESSAGES } from "../utils/messages";

const PRAMAAN_ANALYTICS_URL = "https://pramaan.ondc.org/beta/analytics-api/fetch-flow-data/";

/**
 * POST /flow-data
 * Body: { subscriberId, domain, version, npType }
 *
 * - If `domain:version` is in ENABLED_DOMAINS → return { source: "internal", enabled: true }
 * - Otherwise → proxy to Pramaan analytics API and return response
 */
export async function fetchFlowDataController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { subscriberId, domain, version, npType } = req.body as {
      subscriberId: string;
      domain: string;
      version: string;
      npType: string;
    };

    if (!subscriberId || !domain || !version) {
      res.status(400).json({
        error: true,
        message: MESSAGES.flowData.missingRequiredFields,
      });
      return;
    }

    // Build lookup key — same format as ENABLED_DOMAINS e.g. "ONDC:FIS12:2.0.2"
    const domainVersionKey = `${domain}:${version}`;
    const isEnabled = (ENABLED_DOMAINS as string[]).includes(domainVersionKey);

    logger.info(MESSAGES.flowData.checkingDomain, { domainVersionKey, isEnabled });

    if (isEnabled) {
      // Internal workbench flow — handler to be built later
      res.json({
        source: "internal",
        enabled: true,
        domainVersionKey,
        message: MESSAGES.flowData.internalWorkbenchFlowMessage,
      });
      return;
    }

    // Not in ENABLED_DOMAINS → call Pramaan analytics API
    const pramaanPayload = {
      route: "fetch-flow-data",
      id: subscriberId,
      domain,
      type: npType === "BPP" ? "Seller" : "Buyer",
    };

    logger.info(MESSAGES.flowData.fetchingFromPramaan, {
      subscriberId,
      domain,
      version,
      npType,
    });

    const pramaanResponse = await axios.post(
      PRAMAAN_ANALYTICS_URL,
      pramaanPayload,
      {
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/plain, */*",
        },
        timeout: 30000,
      }
    );

    res.json({
      source: "pramaan",
      enabled: false,
      domainVersionKey,
      data: pramaanResponse.data,
    });
  } catch (err: any) {
    const status = err?.response?.status;
    logger.error(MESSAGES.flowData.fetchError, { body: req.body, error: err?.message });
    res
      .status(status || 500)
      .json(err?.response?.data || { error: true, message: err?.message });
  }
}
