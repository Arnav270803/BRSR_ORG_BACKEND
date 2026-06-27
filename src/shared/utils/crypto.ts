import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createRandomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function compareTokenToHash(token: string, expectedHash: string): boolean {
  const tokenHash = hashToken(token);
  const tokenBuffer = Buffer.from(tokenHash, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (tokenBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(tokenBuffer, expectedBuffer);
}
