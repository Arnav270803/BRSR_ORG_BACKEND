import { MembershipStatus, VendorStatus } from "@prisma/client";
import type { RequestHandler } from "express";

import { prisma } from "../infra/prisma/client.js";
import { AppError } from "../shared/errors/AppError.js";
import { getAuthenticatedUser } from "./authenticate.js";

type RequireVendorAccessOptions = {
  paramName?: string;
};

function getStringParam(value: string | string[] | undefined): string | null {
  if (!value || Array.isArray(value)) {
    return null;
  }

  return value;
}

export function requireVendorAccess(
  options: RequireVendorAccessOptions = {}
): RequestHandler {
  const paramName = options.paramName ?? "vendorId";

  return async (req, res, next) => {
    try {
      const user = getAuthenticatedUser(res);
      const vendorId = getStringParam(req.params[paramName]);

      if (!vendorId) {
        throw new AppError("Vendor ID is required", 400, "VENDOR_ID_REQUIRED");
      }

      const membership = await prisma.vendorMembership.findFirst({
        where: {
          vendorId,
          userId: user.id,
          status: MembershipStatus.ACTIVE,
          vendor: {
            status: VendorStatus.ACTIVE
          }
        },
        select: {
          id: true,
          companyId: true,
          role: true,
          status: true
        }
      });

      if (!membership) {
        throw new AppError("Vendor access denied", 403, "VENDOR_ACCESS_DENIED");
      }

      res.locals.vendor = {
        companyId: membership.companyId,
        vendorId,
        role: membership.role,
        status: membership.status,
        vendorMembershipId: membership.id
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
