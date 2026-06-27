import { MembershipStatus, Prisma } from "@prisma/client";

import { env } from "../../config/env.js";
import { verifyGoogleIdToken } from "../../infra/auth/google.js";
import { signAccessToken, verifyAccessToken } from "../../infra/auth/jwt.js";
import { prisma } from "../../infra/prisma/client.js";
import { ACCESS_TOKEN_TTL_MINUTES, REFRESH_TOKEN_TTL_DAYS } from "../../shared/constants.js";
import { AppError } from "../../shared/errors/AppError.js";
import { createRandomToken, hashToken } from "../../shared/utils/crypto.js";
import { addDays, addMinutes, now } from "../../shared/utils/date.js";

type RequestMetadata = {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
};

type UserSessionRecord = Prisma.UserGetPayload<{
  include: {
    memberships: {
      include: {
        company: true;
      };
    };
  };
}>;

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
};

type SessionContext = {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    isSuperAdmin: boolean;
  };
  memberships: Array<{
    companyId: string;
    companyDisplayName: string;
    role: string;
    status: string;
  }>;
  needsCompanyOnboarding: boolean;
};

type AuthSession = {
  context: SessionContext;
  tokens: SessionTokens;
};

function isSuperAdminEmail(email: string): boolean {
  return env.SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

function toSessionContext(user: UserSessionRecord): SessionContext {
  const activeMemberships = user.memberships.filter(
    (membership) => membership.status === MembershipStatus.ACTIVE
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      isSuperAdmin: user.isSuperAdmin
    },
    memberships: activeMemberships.map((membership) => ({
      companyId: membership.companyId,
      companyDisplayName: membership.company.displayName,
      role: membership.role,
      status: membership.status
    })),
    needsCompanyOnboarding: !user.isSuperAdmin && activeMemberships.length === 0
  };
}

async function getSessionUser(userId: string): Promise<UserSessionRecord> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          company: true
        }
      }
    }
  });

  if (!user) {
    throw new AppError("User session no longer exists", 401, "SESSION_USER_NOT_FOUND");
  }

  return user;
}

async function createSessionForUser(userId: string, metadata: RequestMetadata): Promise<AuthSession> {
  const user = await getSessionUser(userId);
  const issuedAt = now();
  const refreshToken = createRandomToken();
  const refreshTokenExpiresAt = addDays(issuedAt, REFRESH_TOKEN_TTL_DAYS);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
      createdByIp: metadata.ipAddress ?? null,
      userAgent: metadata.userAgent ?? null
    }
  });

  const accessToken = await signAccessToken({
    userId: user.id,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin
  });

  return {
    context: toSessionContext(user),
    tokens: {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: addMinutes(issuedAt, ACCESS_TOKEN_TTL_MINUTES),
      refreshTokenExpiresAt
    }
  };
}

export async function loginWithGoogle(idToken: string, metadata: RequestMetadata): Promise<AuthSession> {
  const googleUser = await verifyGoogleIdToken(idToken);
  const loginTime = now();
  const isSuperAdmin = isSuperAdminEmail(googleUser.email);

  const user = await prisma.user.upsert({
    where: {
      googleSub: googleUser.googleSub
    },
    update: {
      email: googleUser.email,
      name: googleUser.name,
      avatarUrl: googleUser.avatarUrl,
      isSuperAdmin,
      lastLoginAt: loginTime
    },
    create: {
      googleSub: googleUser.googleSub,
      email: googleUser.email,
      name: googleUser.name,
      avatarUrl: googleUser.avatarUrl,
      isSuperAdmin,
      lastLoginAt: loginTime
    }
  });

  return createSessionForUser(user.id, metadata);
}

export async function getCurrentSession(accessToken: string): Promise<SessionContext> {
  const payload = await verifyAccessToken(accessToken);
  const user = await getSessionUser(payload.userId);
  return toSessionContext(user);
}

export async function refreshSession(
  refreshToken: string,
  metadata: RequestMetadata
): Promise<AuthSession> {
  const tokenHash = hashToken(refreshToken);
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash }
  });

  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= now()) {
    throw new AppError("Invalid or expired refresh token", 401, "INVALID_REFRESH_TOKEN");
  }

  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: now() }
  });

  return createSessionForUser(storedToken.userId, metadata);
}

export async function logout(refreshToken: string | null): Promise<void> {
  if (!refreshToken) {
    return;
  }

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashToken(refreshToken),
      revokedAt: null
    },
    data: {
      revokedAt: now()
    }
  });
}
