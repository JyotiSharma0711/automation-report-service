import { Request, Response } from "express";
import axios from "axios";
import logger from "@ondc/automation-logger";
import { CacheService } from "../services/cacheService";
import { fetchSessionDetails } from "../services/dbService";
import { FLOW_ID_MAP } from "../utils/constants";

// A mochawesome suite (one per Pramaan flow_id, tagged via `result.title`) is
// considered failed if any of its tests — or any nested suite's tests — failed.
function suiteHasFailure(suite: any): boolean {
  if ((suite?.tests ?? []).some((t: any) => t?.state === "failed")) return true;
  return (suite?.suites ?? []).some((nested: any) => suiteHasFailure(nested));
}

// Builds a { workbenchFlowName: "PASS" | "FAIL" } map from the merged Pramaan
// report by translating each suite's Pramaan flow_id back to the workbench flow
// name via FLOW_ID_MAP[domain][version][usecaseId] (which maps name -> flow_id).
function buildFlowMapFromMergedReport(
  mergedReport: any,
  domain?: string,
  version?: string,
  usecaseId?: string
): Record<string, "PASS" | "FAIL"> {
  const flowIdToName: Record<string, string> = {};
  const nameToFlowId = (domain && version && usecaseId && FLOW_ID_MAP[domain]?.[version]?.[usecaseId]) || {};
  for (const [flowName, pramaanFlowId] of Object.entries(nameToFlowId)) {
    flowIdToName[pramaanFlowId as string] = flowName;
  }

  const flowMap: Record<string, "PASS" | "FAIL"> = {};
  for (const suite of mergedReport?.results ?? []) {
    const flowName = flowIdToName[suite?.title];
    if (!flowName) continue;
    flowMap[flowName] = suiteHasFailure(suite) ? "FAIL" : "PASS";
  }
  return flowMap;
}

export const pramaanCallbackController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const rawTestId = req.params.testId;

    const [testId, userId] = rawTestId.includes("::")
      ? rawTestId.split("::")
      : [rawTestId, undefined];

    const { data: base64Data, flow_summary: inlineFlowSummary } = req.body;

    logger.info(`Received callback for testId: ${testId}, flow_summary`, JSON.stringify(inlineFlowSummary));

    if (!base64Data) {
      logger.error(`Missing data in callback for testId: ${testId}`);
      res.status(400).json({ error: "Missing data in callback" });
      return;
    }

    const automationDbUrl = process.env.DATA_BASE_URL;
    if (!automationDbUrl) {
      throw new Error("DATA_BASE_URL not defined in environment variables");
    }

    // Prefer flow_summary sent inline in the callback body (Pramaan buyer path).
    // Fall back to the one cached in Redis by checkPramaanReport (frontend-triggered path).
    let flow_summary = inlineFlowSummary;
    if (!flow_summary || Object.keys(flow_summary).length === 0) {
      const cached = await CacheService.get(`flow_summary:${rawTestId}`);
      if (cached) {
        try {
          flow_summary = JSON.parse(cached);
          logger.info(`Retrieved flow_summary from cache for flow_summary`, JSON.stringify(flow_summary), `testId: ${rawTestId}`);
        } catch {
          logger.error(`Failed to parse cached flow_summary for testId: ${rawTestId}`);
        }
        // Clean up after reading
        CacheService.set(`flow_summary:${rawTestId}`, "").catch(() => { });
      }
    }

    let finalBase64Data = base64Data;
    // Inject script into the HTML report to hide PDF button and add HTML download button
    if (typeof base64Data === 'string' && base64Data.includes('base64,')) {
      try {
        const parts = base64Data.split('base64,');
        const prefix = parts[0] + 'base64,';
        const htmlContent = Buffer.from(parts[1], 'base64').toString('utf-8');
        
        const injectionScript = `
<script>
  window.addEventListener('DOMContentLoaded', () => {
    // Hide 'Download PDF' button
    const elements = document.querySelectorAll('button, a, div');
    elements.forEach(el => {
      const text = (el.innerText || el.textContent || '').toLowerCase();
      if ((el.tagName === 'BUTTON' || el.tagName === 'A') && text.includes('pdf')) {
        el.style.display = 'none';
      }
    });

    // Add 'Download HTML' button
    const downloadBtn = document.createElement('button');
    downloadBtn.innerText = '⬇ Download HTML Report';
    downloadBtn.style.position = 'fixed';
    downloadBtn.style.top = '15px';
    downloadBtn.style.right = '15px';
    downloadBtn.style.zIndex = '999999';
    downloadBtn.style.padding = '8px 16px';
    downloadBtn.style.backgroundColor = '#0056a6';
    downloadBtn.style.color = '#fff';
    downloadBtn.style.border = 'none';
    downloadBtn.style.borderRadius = '4px';
    downloadBtn.style.cursor = 'pointer';
    downloadBtn.style.fontWeight = 'bold';
    downloadBtn.onclick = function() {
      downloadBtn.style.display = 'none';
      const currentHtml = document.documentElement.outerHTML;
      const blob = new Blob([currentHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Pramaan_Report.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      downloadBtn.style.display = 'block';
    };
    document.body.appendChild(downloadBtn);
  });
</script>`;
        
        let modifiedHtml = htmlContent;
        if (modifiedHtml.includes('</body>')) {
          modifiedHtml = modifiedHtml.replace('</body>', `${injectionScript}</body>`);
        } else {
          modifiedHtml += injectionScript;
        }
        
        finalBase64Data = prefix + Buffer.from(modifiedHtml, 'utf-8').toString('base64');
        logger.info('Successfully injected HTML download script into Pramaan report.');
      } catch (err) {
        logger.error('Failed to inject HTML download script into Pramaan report', {}, err);
      }
    }

    const reportUrl = `${automationDbUrl}/report/${testId}`;
    const response = await axios.post(
      reportUrl,
      {
        data: finalBase64Data,
        ...(flow_summary && { flow_summary }),
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.API_SERVICE_KEY,
        },
        params: {
          ...(userId && { userId }),
        },
      }
    );

    logger.info(
      `Successfully forwarded report for testId ${testId} — DB responded with status ${response.status}`,
    );

    // Derive per-flow PASS/FAIL from the merged report and save it to session
    // analytics (flowMap), reusing the same endpoint the non-Pramaan path uses
    // in ReportService.saveReportToDB.
    try {
      const sessionId = testId.replace(/^PW_/, "");
      const sessionDetails = await fetchSessionDetails(sessionId);
      const flowMap = buildFlowMapFromMergedReport(
        base64Data,
        sessionDetails?.domain,
        sessionDetails?.version,
        sessionDetails?.usecaseId
      );

      logger.info(`Derived Pramaan flowMap for sessionId ${sessionId}:`, JSON.stringify(flowMap));

      if (Object.keys(flowMap).length > 0) {
        const analyticsUrl = `${automationDbUrl}/api/sessions/${sessionId}/analytics`;
        axios
          .post(
            analyticsUrl,
            { flowSummary: flow_summary, flowMap },
            { headers: { "Content-Type": "application/json", "x-api-key": process.env.API_SERVICE_KEY } }
          )
          .then(() => logger.info(`Analytics saved for sessionId: ${sessionId}`))
          .catch((err) => logger.error(`Failed to save analytics for sessionId: ${sessionId}`, {}, err));
      }
    } catch (err) {
      logger.error(`Failed to derive/save Pramaan flowMap for testId: ${testId}`, {}, err);
    }

    res.status(200).json({ message: "Report forwarded successfully" });
  } catch (err: any) {
    logger.error(
      `Error forwarding callback for testId: ${req.params.testId}`,
      err,
    );
    res.status(500).json({ error: err.message });
  }
};
