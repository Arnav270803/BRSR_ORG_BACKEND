import { createRemoteJWKSet, jwtVerify } from "jose";

import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";

const LINKEDIN_AUTHORIZATION_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const LINKEDIN_ISSUER = "https://www.linkedin.com";
const linkedInJwks = createRemoteJWKSet(new URL("https://www.linkedin.com/oauth/openid/jwks"));

export type LinkedInAuthorizationRequest = {
  authorizationUrl: string;
};

export type VerifiedLinkedInUser = {
  linkedInSub: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

type LinkedInTokenResponse = {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
};

type LinkedInUserInfoResponse = {
  sub?: string;
  name?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
};

function getLinkedInConfig() {
  if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET || !env.LINKEDIN_REDIRECT_URI) {
    throw new AppError(
      "LinkedIn sign-in is not configured",
      503,
      "LINKEDIN_AUTH_NOT_CONFIGURED"
    );
  }

  return {
    clientId: env.LINKEDIN_CLIENT_ID,
    clientSecret: env.LINKEDIN_CLIENT_SECRET,
    redirectUri: env.LINKEDIN_REDIRECT_URI
  };
}

export function buildLinkedInAuthorizationUrl({
  nonce,
  state
}: {
  nonce: string;
  state: string;
}): LinkedInAuthorizationRequest {
  const config = getLinkedInConfig();
  const authorizationUrl = new URL(LINKEDIN_AUTHORIZATION_URL);

  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("scope", "openid profile email");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("nonce", nonce);

  return {
    authorizationUrl: authorizationUrl.toString()
  };
}

export async function verifyLinkedInAuthorizationCode({
  code,
  nonce
}: {
  code: string;
  nonce: string;
}): Promise<VerifiedLinkedInUser> {
  const config = getLinkedInConfig();
  let tokenResponse: Response;

  try {
    tokenResponse = await fetch(LINKEDIN_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri
      })
    });
  } catch (error) {
    console.error("LinkedIn token request failed", error);
    throw new AppError("LinkedIn token request failed", 401, "LINKEDIN_TOKEN_REQUEST_FAILED");
  }

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text().catch(() => "");
    console.error("LinkedIn token exchange failed", {
      body: errorBody.slice(0, 500),
      status: tokenResponse.status
    });
    throw new AppError("LinkedIn token exchange failed", 401, "LINKEDIN_TOKEN_EXCHANGE_FAILED");
  }

  let tokens: LinkedInTokenResponse;

  try {
    tokens = (await tokenResponse.json()) as LinkedInTokenResponse;
  } catch (error) {
    console.error("LinkedIn token response JSON parsing failed", error);
    throw new AppError("LinkedIn token response is invalid", 401, "INVALID_LINKEDIN_TOKEN");
  }

  if (!tokens.id_token || !tokens.access_token) {
    throw new AppError("LinkedIn response is missing tokens", 401, "INVALID_LINKEDIN_TOKEN");
  }

  let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];

  try {
    ({ payload } = await jwtVerify(tokens.id_token, linkedInJwks, {
      audience: config.clientId,
      clockTolerance: "60s",
      issuer: LINKEDIN_ISSUER
    }));
  } catch (error) {
    console.error("LinkedIn ID token validation failed", error);
    throw new AppError("LinkedIn ID token validation failed", 401, "LINKEDIN_ID_TOKEN_INVALID");
  }

  if (typeof payload.nonce === "string" && payload.nonce !== nonce) {
    throw new AppError("LinkedIn token nonce mismatch", 401, "INVALID_LINKEDIN_NONCE");
  }

  let userInfoResponse: Response;

  try {
    userInfoResponse = await fetch(LINKEDIN_USERINFO_URL, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${tokens.access_token}`
      }
    });
  } catch (error) {
    console.error("LinkedIn profile lookup request failed", error);
    throw new AppError("LinkedIn profile lookup request failed", 401, "LINKEDIN_USERINFO_FAILED");
  }

  if (!userInfoResponse.ok) {
    const errorBody = await userInfoResponse.text().catch(() => "");
    console.error("LinkedIn profile lookup failed", {
      body: errorBody.slice(0, 500),
      status: userInfoResponse.status
    });
    throw new AppError("LinkedIn profile lookup failed", 401, "LINKEDIN_USERINFO_FAILED");
  }

  let userInfo: LinkedInUserInfoResponse;

  try {
    userInfo = (await userInfoResponse.json()) as LinkedInUserInfoResponse;
  } catch (error) {
    console.error("LinkedIn profile response JSON parsing failed", error);
    throw new AppError("LinkedIn profile response is invalid", 401, "INVALID_LINKEDIN_PROFILE");
  }
  const linkedInSub = userInfo.sub ?? (typeof payload.sub === "string" ? payload.sub : null);
  const email =
    userInfo.email ??
    (typeof payload.email === "string" ? payload.email : null);
  const isEmailVerified =
    userInfo.email_verified ??
    (typeof payload.email_verified === "boolean" ? payload.email_verified : undefined);

  if (!linkedInSub) {
    throw new AppError("LinkedIn profile is missing a subject", 401, "INVALID_LINKEDIN_PROFILE");
  }

  if (!email) {
    throw new AppError("LinkedIn did not return an email address", 401, "LINKEDIN_EMAIL_MISSING");
  }

  if (isEmailVerified === false) {
    throw new AppError("LinkedIn email is not verified", 401, "LINKEDIN_EMAIL_NOT_VERIFIED");
  }

  return {
    linkedInSub,
    email: email.toLowerCase(),
    name: userInfo.name ?? (typeof payload.name === "string" ? payload.name : null),
    avatarUrl: userInfo.picture ?? (typeof payload.picture === "string" ? payload.picture : null)
  };
}
