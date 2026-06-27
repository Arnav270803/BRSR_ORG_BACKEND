import type { Request, Response } from "express";

import { cookieOptions } from "../../config/cookies.js";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_TTL_MINUTES,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_TTL_DAYS
} from "../../shared/constants.js";
import { AppError } from "../../shared/errors/AppError.js";
import { googleLoginSchema } from "./auth.schemas.js";
import { getCurrentSession, loginWithGoogle, logout, refreshSession } from "./auth.service.js";

function getRequestMetadata(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
  };
}

function getSignedCookie(req: Request, name: string): string | null {
  const signedCookies = req.signedCookies as Record<string, string | undefined> | undefined;
  return signedCookies?.[name] ?? null;
}

function getAccessTokenFromRequest(req: Request): string {
  const cookieToken = getSignedCookie(req, ACCESS_TOKEN_COOKIE_NAME);

  if (cookieToken) {
    return cookieToken;
  }

  const authorization = req.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
}

function setSessionCookies(res: Response, tokens: { accessToken: string; refreshToken: string }): void {
  res.cookie(ACCESS_TOKEN_COOKIE_NAME, tokens.accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_TTL_MINUTES * 60 * 1000
  });

  res.cookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  });
}

function clearSessionCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, cookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, cookieOptions);
}

export async function googleLoginController(req: Request, res: Response): Promise<void> {
  const body = googleLoginSchema.parse(req.body);
  const session = await loginWithGoogle(body.idToken, getRequestMetadata(req));

  setSessionCookies(res, session.tokens);

  res.status(200).json({
    data: session.context
  });
}

export async function meController(req: Request, res: Response): Promise<void> {
  const accessToken = getAccessTokenFromRequest(req);
  const context = await getCurrentSession(accessToken);

  res.status(200).json({
    data: context
  });
}

export async function refreshController(req: Request, res: Response): Promise<void> {
  const refreshToken = getSignedCookie(req, REFRESH_TOKEN_COOKIE_NAME);

  if (!refreshToken) {
    throw new AppError("Refresh token is required", 401, "REFRESH_TOKEN_REQUIRED");
  }

  const session = await refreshSession(refreshToken, getRequestMetadata(req));
  setSessionCookies(res, session.tokens);

  res.status(200).json({
    data: session.context
  });
}

export async function logoutController(req: Request, res: Response): Promise<void> {
  const refreshToken = getSignedCookie(req, REFRESH_TOKEN_COOKIE_NAME);
  await logout(refreshToken);
  clearSessionCookies(res);

  res.status(204).send();
}
