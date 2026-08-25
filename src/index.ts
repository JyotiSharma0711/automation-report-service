import "./config/otelConfig"
import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import Router from "./routes/routes";
import { RedisService } from "@ondc/ondc-automation-cache-lib";
import logger from "@ondc/automation-logger";
import { MESSAGES } from "./utils/messages";
import { apiResponse } from "./utils/responseHandler";

// Initialize dotenv to load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json({ limit: '75mb' }));
app.use(express.urlencoded({ limit: '75mb', extended: true }));
// Set up Redis database connection
try {
  RedisService.useDb(0);
} catch (err) {
  logger.error(String(err));
}

// Routes
app.use("/", Router);

// Global error handler middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // logger.error(err.stack);
  logger.info(MESSAGES.app.internalError,
    {error: err},
  );
  apiResponse.internalError(res, MESSAGES.responses.generic500, err);
});

// Start the server
app.listen(PORT, () => {
  // logger.info(`Server is running on http://localhost:${PORT}`);
  logger.info(MESSAGES.app.serverStarted(Number(PORT)));
});
