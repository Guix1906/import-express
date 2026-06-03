/**
 * Logger condicional.
 *
 * - `logger.debug` e `logger.info` só imprimem em desenvolvimento (`import.meta.env.DEV`).
 * - `logger.warn` e `logger.error` sempre imprimem (produção inclusive),
 *   porque erros silenciosos quebram observabilidade.
 *
 * Uso:
 *   import { logger } from "@/lib/logger";
 *   logger.debug("payload", payload);
 *   logger.error("falha ao salvar", err);
 */

const isDev =
  typeof import.meta !== "undefined" &&
  Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

type LogArgs = readonly unknown[];

export const logger = {
  debug: (...args: LogArgs) => {
    if (isDev) console.debug(...args);
  },
  info: (...args: LogArgs) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: LogArgs) => {
    console.warn(...args);
  },
  error: (...args: LogArgs) => {
    console.error(...args);
  },
};
