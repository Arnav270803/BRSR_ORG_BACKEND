import { env } from "../../config/env.js";
import { AppError } from "./AppError.js";
import { ZodError } from "zod";

type ErrorResponse = {
  error: {
    code: string;
    message: string;
    stack?: string;
  };
};

export function toErrorResponse(error: unknown): {
  statusCode: number;
  body: ErrorResponse;
} {
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues.map((issue) => issue.message).join("; ")
        }
      }
    };
  }

  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(env.NODE_ENV === "development" && error.stack ? { stack: error.stack } : {})
        }
      }
    };
  }

  const fallback = error instanceof Error ? error : new Error("Unknown error");

  return {
    statusCode: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: env.NODE_ENV === "production" ? "Internal server error" : fallback.message,
        ...(env.NODE_ENV === "development" && fallback.stack ? { stack: fallback.stack } : {})
      }
    }
  };
}
