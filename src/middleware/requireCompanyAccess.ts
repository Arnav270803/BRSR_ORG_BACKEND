import { MembershipStatus } from "@prisma/client";
import type { RequestHandler } from "express";

import { prisma } from "../infra/prisma/client.js";
import { APP_ROLES } from "../shared/constants.js";
import { AppError } from "../shared/errors/AppError.js";
import type { CompanyRole } from "../shared/types.js";
import { getAuthenticatedUser } from "./authenticate.js";

type RequireCompanyAccessOptions = {
  paramName?: string;
  allowedCompanyRoles?: CompanyRole[];
};

function getStringParam(value: string | string[] | undefined): string | null {
  if (!value || Array.isArray(value)) {
    return null;
  }

  return value;
}

export function requireCompanyAccess(options: RequireCompanyAccessOptions = {}): RequestHandler {
  const paramName = options.paramName ?? "companyId";

  return async (req, res, next) => {
    try {
      const user = getAuthenticatedUser(res);
      const companyId = getStringParam(req.params[paramName]);

      if (!companyId) {
        throw new AppError("Company ID is required", 400, "COMPANY_ID_REQUIRED");
      }

      if (user.isSuperAdmin) {
        const company = await prisma.company.findUnique({
          where: { id: companyId },
          select: { id: true }
        });

        if (!company) {
          throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
        }

        res.locals.company = {
          companyId,
          role: APP_ROLES.SUPER_ADMIN
        };

        next();
        return;
      }

      const membership = await prisma.companyMembership.findFirst({
        where: {
          companyId,
          userId: user.id,
          status: MembershipStatus.ACTIVE
        },
        select: {
          id: true,
          role: true
        }
      });

      if (!membership) {
        throw new AppError("Company access denied", 403, "COMPANY_ACCESS_DENIED");
      }

      if (options.allowedCompanyRoles && !options.allowedCompanyRoles.includes(membership.role)) {
        throw new AppError("Insufficient permissions", 403, "INSUFFICIENT_PERMISSIONS");
      }

      res.locals.company = {
        companyId,
        role: membership.role,
        membershipId: membership.id
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
