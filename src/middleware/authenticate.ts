import type { Request, RequestHandler, Response } from "express";

import { verifyAccessToken } from "../infra/auth/jwt.js";
import { ACCESS_TOKEN_COOKIE_NAME } from "../shared/constants.js";
import { AppError } from "../shared/errors/AppError.js";
import type { AuthenticatedUserContext, CompanyAccessContext } from "../shared/types.js";

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
      isSuperAdmin: payload.isSuperAdmin
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
