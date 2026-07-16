import type { RequestHandler } from "express";

import { AppError } from "../shared/errors/AppError.js";
import type { CompanyRole } from "../shared/types.js";
import { getCompanyAccess } from "./authenticate.js";

export function requireRole(...allowedRoles: CompanyRole[]): RequestHandler {
  return (_req, res, next) => {
    try {
      const company = getCompanyAccess(res);

      if (!allowedRoles.includes(company.role)) {
        throw new AppError("Insufficient permissions", 403, "INSUFFICIENT_PERMISSIONS");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
