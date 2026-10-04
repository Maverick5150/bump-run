import pino from "pino";
import { isProduction } from "./config.js";

/**
 * Structured logging for room lifecycle and errors. Never log tokens,
 * secrets, or private keys -- only ids, codes, and event names.
 */
const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

export const logger = pino({
  level: isTest ? "silent" : isProduction ? "info" : "debug",
  transport: isTest || isProduction ? undefined : { target: "pino-pretty", options: { colorize: true } },
});
