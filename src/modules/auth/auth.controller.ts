import type { Request, Response } from "express";

import { cookieOptions } from "../../config/cookies.js";
import { env } from "../../config/env.js";
import { buildLinkedInAuthorizationUrl } from "../../infra/auth/linkedin.js";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_TTL_MINUTES,
  LINKEDIN_OAUTH_COOKIE_NAME,
  LINKEDIN_OAUTH_TTL_MINUTES,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_TTL_DAYS
} from "../../shared/constants.js";
import { AppError } from "../../shared/errors/AppError.js";
import { createRandomToken } from "../../shared/utils/crypto.js";
import { googleLoginSchema } from "./auth.schemas.js";
import {
  getCurrentSession,
  loginWithGoogle,
  loginWithLinkedInAuthorizationCode,
  logout,
  refreshSession
} from "./auth.service.js";

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

function clearLinkedInOAuthCookie(res: Response): void {
  res.clearCookie(LINKEDIN_OAUTH_COOKIE_NAME, cookieOptions);
}

function getLinkedInOAuthCookie(req: Request): { nonce: string; returnTo: string | null; state: string } {
  const cookieValue = getSignedCookie(req, LINKEDIN_OAUTH_COOKIE_NAME);

  if (!cookieValue) {
    throw new AppError("LinkedIn sign-in state is missing", 401, "LINKEDIN_STATE_MISSING");
  }

  try {
    const parsed = JSON.parse(cookieValue) as {
      nonce?: unknown;
      returnTo?: unknown;
      state?: unknown;
    };

    if (typeof parsed.state !== "string" || typeof parsed.nonce !== "string") {
      throw new Error("Invalid LinkedIn OAuth cookie");
    }

    return {
      nonce: parsed.nonce,
      returnTo: typeof parsed.returnTo === "string" ? parsed.returnTo : null,
      state: parsed.state
    };
  } catch {
    throw new AppError("LinkedIn sign-in state is invalid", 401, "LINKEDIN_STATE_INVALID");
  }
}

function getSafeReturnTo(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }

  return value;
}

function toClientUrl(path: string): string {
  return new URL(path, env.CLIENT_URL).toString();
}

function getSessionRedirectPath(session: Awaited<ReturnType<typeof loginWithGoogle>>, returnTo: string | null): string {
  if (returnTo?.startsWith("/invite") || returnTo?.startsWith("/vendor/invite")) {
    return returnTo;
  }

  if (session.context.needsCompanyOnboarding) {
    return "/onboarding/company";
  }

  const firstCompany = session.context.memberships[0];

  if (firstCompany) {
    return `/app/${firstCompany.companyId}`;
  }

  if (session.context.vendorMemberships[0]) {
    return "/vendor";
  }

  return "/login?authError=no_workspace";
}

function redirectToLoginError(res: Response, code: string): void {
  res.redirect(toClientUrl(`/login?authError=${encodeURIComponent(code)}`));
}

export async function googleLoginController(req: Request, res: Response): Promise<void> {
  const body = googleLoginSchema.parse(req.body);
  const session = await loginWithGoogle(body.idToken, getRequestMetadata(req));

  setSessionCookies(res, session.tokens);

  res.status(200).json({
    data: session.context
  });
}

export async function linkedInStartController(req: Request, res: Response): Promise<void> {
  try {
    const state = createRandomToken();
    const nonce = createRandomToken();
    const returnTo = getSafeReturnTo(req.query.returnTo);
    const { authorizationUrl } = buildLinkedInAuthorizationUrl({ nonce, state });

    res.cookie(
      LINKEDIN_OAUTH_COOKIE_NAME,
      JSON.stringify({
        nonce,
        returnTo,
        state
      }),
      {
        ...cookieOptions,
        maxAge: LINKEDIN_OAUTH_TTL_MINUTES * 60 * 1000
      }
    );

    res.redirect(authorizationUrl);
  } catch (error) {
    console.error("LinkedIn start failed", error);
    redirectToLoginError(res, "linkedin_not_configured");
  }
}

export async function linkedInCallbackController(req: Request, res: Response): Promise<void> {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const returnedState = typeof req.query.state === "string" ? req.query.state : null;
    const oauthCookie = getLinkedInOAuthCookie(req);

    if (!code) {
      throw new AppError("LinkedIn authorization code is missing", 401, "LINKEDIN_CODE_MISSING");
    }

    if (!returnedState || returnedState !== oauthCookie.state) {
      throw new AppError("LinkedIn sign-in state mismatch", 401, "LINKEDIN_STATE_MISMATCH");
    }

    const session = await loginWithLinkedInAuthorizationCode({
      code,
      metadata: getRequestMetadata(req),
      nonce: oauthCookie.nonce
    });

    clearLinkedInOAuthCookie(res);
    setSessionCookies(res, session.tokens);
    res.redirect(toClientUrl(getSessionRedirectPath(session, oauthCookie.returnTo)));
  } catch (error) {
    console.error("LinkedIn callback failed", error);
    clearLinkedInOAuthCookie(res);
    redirectToLoginError(
      res,
      error instanceof AppError ? error.code.toLowerCase() : "linkedin_failed"
    );
  }
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
