import { pinoHttp, type Options } from "pino-http";

import { env } from "../config/env.js";

const loggerOptions: Options =
  env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard"
          }
        }
      }
    : {};

export const requestLogger = pinoHttp(loggerOptions);
