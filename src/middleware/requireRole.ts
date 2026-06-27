import type { RequestHandler } from "express";

import { APP_ROLES } from "../shared/constants.js";
import { AppError } from "../shared/errors/AppError.js";
import type { AppRole } from "../shared/types.js";
import { getAuthenticatedUser, getCompanyAccess } from "./authenticate.js";

export function requireRole(...allowedRoles: AppRole[]): RequestHandler {
  return (_req, res, next) => {
    try {
      const user = getAuthenticatedUser(res);

      if (user.isSuperAdmin && allowedRoles.includes(APP_ROLES.SUPER_ADMIN)) {
        next();
        return;
      }

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
