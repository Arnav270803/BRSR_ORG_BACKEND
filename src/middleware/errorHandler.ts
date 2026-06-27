import type { ErrorRequestHandler, RequestHandler } from "express";

import { AppError } from "../shared/errors/AppError.js";
import { toErrorResponse } from "../shared/errors/errorResponse.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, "ROUTE_NOT_FOUND"));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const response = toErrorResponse(error);
  res.status(response.statusCode).json(response.body);
};
