import type { Request, RequestHandler, Response } from "express";

import { env } from "../config/env.js";
import { verifyAccessToken } from "../infra/auth/jwt.js";
import { ACCESS_TOKEN_COOKIE_NAME } from "../shared/constants.js";
import { AppError } from "../shared/errors/AppError.js";
import { matchesPlatformOwnerEmail } from "../shared/security/platformOwner.js";
import type {
  AuthenticatedUserContext,
  CompanyAccessContext,
  SiteAccessContext,
  VendorAccessContext
} from "../shared/types.js";

function getSignedCookie(req: Request, name: string): string | null {
  const signedCookies = req.signedCookies as Record<string, string | undefined> | undefined;
  return signedCookies?.[name] ?? null;
}

function getAccessToken(req: Request): string | null {
  const cookieToken = getSignedCookie(req, ACCESS_TOKEN_COOKIE_NAME);

  if (cookieToken) {
    return cookieToken;
  }

  const authorization = req.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  return null;
}

export const authenticate: RequestHandler = async (req, res, next) => {
  try {
    const token = getAccessToken(req);

    if (!token) {
      throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
    }

    const payload = await verifyAccessToken(token);

    res.locals.user = {
      id: payload.userId,
      email: payload.email,
      isPlatformOwner: matchesPlatformOwnerEmail(payload.email, env.PLATFORM_OWNER_EMAIL)
    };

    next();
  } catch (error) {
    next(error);
  }
};

export function getAuthenticatedUser(res: Response): AuthenticatedUserContext {
  const user = res.locals.user as AuthenticatedUserContext | undefined;

  if (!user) {
    throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
  }

  return user;
}

export function getCompanyAccess(res: Response): CompanyAccessContext {
  const company = res.locals.company as CompanyAccessContext | undefined;

  if (!company) {
    throw new AppError("Company access context required", 500, "COMPANY_CONTEXT_REQUIRED");
  }

  return company;
}

export function getSiteAccess(res: Response): SiteAccessContext {
  const site = res.locals.site as SiteAccessContext | undefined;

  if (!site) {
    throw new AppError("Site access context required", 500, "SITE_CONTEXT_REQUIRED");
  }

  return site;
}

export function getVendorAccess(res: Response): VendorAccessContext {
  const vendor = res.locals.vendor as VendorAccessContext | undefined;

  if (!vendor) {
    throw new AppError("Vendor access context required", 500, "VENDOR_CONTEXT_REQUIRED");
  }

  return vendor;
}
