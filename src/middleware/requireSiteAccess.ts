import { CompanySiteStatus, MembershipStatus } from "@prisma/client";
import type { RequestHandler } from "express";

import { prisma } from "../infra/prisma/client.js";
import { COMPANY_ROLES } from "../shared/constants.js";
import { AppError } from "../shared/errors/AppError.js";
import { getAuthenticatedUser, getCompanyAccess } from "./authenticate.js";

type RequireSiteAccessOptions = {
  paramName?: string;
};

function getStringParam(value: string | string[] | undefined): string | null {
  if (!value || Array.isArray(value)) {
    return null;
  }

  return value;
}

export function requireSiteAccess(options: RequireSiteAccessOptions = {}): RequestHandler {
  const paramName = options.paramName ?? "siteId";

  return async (req, res, next) => {
    try {
      const user = getAuthenticatedUser(res);
      const company = getCompanyAccess(res);
      const siteId = getStringParam(req.params[paramName]);

      if (!siteId) {
        throw new AppError("Site ID is required", 400, "SITE_ID_REQUIRED");
      }

      const site = await prisma.companySite.findFirst({
        where: {
          id: siteId,
          companyId: company.companyId,
          status: CompanySiteStatus.ACTIVE
        },
        select: {
          id: true
        }
      });

      if (!site) {
        throw new AppError("Site not found", 404, "SITE_NOT_FOUND");
      }

      if (user.isPlatformOwner || company.role === COMPANY_ROLES.ADMIN) {
        res.locals.site = {
          siteId,
          role: company.role
        };

        next();
        return;
      }

      const membership = await prisma.companySiteMembership.findFirst({
        where: {
          companyId: company.companyId,
          siteId,
          userId: user.id,
          status: MembershipStatus.ACTIVE
        },
        select: {
          id: true,
          role: true
        }
      });

      if (!membership) {
        throw new AppError("Site access denied", 403, "SITE_ACCESS_DENIED");
      }

      res.locals.site = {
        siteId,
        role: membership.role,
        siteMembershipId: membership.id
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
