import { OAuth2Client } from "google-auth-library";

import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export type VerifiedGoogleUser = {
  googleSub: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleUser> {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) {
    throw new AppError("Google token is missing required identity fields", 401, "INVALID_GOOGLE_TOKEN");
  }

  if (payload.email_verified === false) {
    throw new AppError("Google email is not verified", 401, "GOOGLE_EMAIL_NOT_VERIFIED");
  }

  return {
    googleSub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name ?? null,
    avatarUrl: payload.picture ?? null
  };
}
