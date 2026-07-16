import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { env } from "../../config/env.js";
import { ACCESS_TOKEN_TTL_MINUTES } from "../../shared/constants.js";
import { AppError } from "../../shared/errors/AppError.js";

const textEncoder = new TextEncoder();
const accessTokenSecret = textEncoder.encode(env.JWT_ACCESS_SECRET);

const accessTokenPayloadSchema = z.object({
  tokenUse: z.literal("access"),
  userId: z.string().uuid(),
  email: z.string().email()
});

export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;

export async function signAccessToken(payload: Omit<AccessTokenPayload, "tokenUse">): Promise<string> {
  return new SignJWT({
    tokenUse: "access",
    userId: payload.userId,
    email: payload.email
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(accessTokenSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const verified = await jwtVerify(token, accessTokenSecret);
    return accessTokenPayloadSchema.parse(verified.payload);
  } catch {
    throw new AppError("Invalid or expired access token", 401, "INVALID_ACCESS_TOKEN");
  }
}
