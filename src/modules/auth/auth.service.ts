import { AuthProvider, MembershipStatus, Prisma } from "@prisma/client";

import { env } from "../../config/env.js";
import { verifyGoogleIdToken } from "../../infra/auth/google.js";
import { verifyLinkedInAuthorizationCode } from "../../infra/auth/linkedin.js";
import { signAccessToken, verifyAccessToken } from "../../infra/auth/jwt.js";
import { prisma } from "../../infra/prisma/client.js";
import { ACCESS_TOKEN_TTL_MINUTES, REFRESH_TOKEN_TTL_DAYS } from "../../shared/constants.js";
import { AppError } from "../../shared/errors/AppError.js";
import { matchesPlatformOwnerEmail } from "../../shared/security/platformOwner.js";
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
    isPlatformOwner: boolean;
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

type ExternalIdentity = {
  provider: AuthProvider;
  providerUserId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  googleSub?: string | null;
};

function isPlatformOwnerEmail(email: string): boolean {
  return matchesPlatformOwnerEmail(email, env.PLATFORM_OWNER_EMAIL);
}

function toSessionContext(user: UserSessionRecord): SessionContext {
  const activeMemberships = user.memberships.filter(
    (membership) => membership.status === MembershipStatus.ACTIVE
  );

  const isPlatformOwner = isPlatformOwnerEmail(user.email);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      isPlatformOwner
    },
    memberships: activeMemberships.map((membership) => ({
      companyId: membership.companyId,
      companyDisplayName: membership.company.displayName,
      role: membership.role,
      status: membership.status
    })),
    needsCompanyOnboarding: !isPlatformOwner && activeMemberships.length === 0
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
    email: user.email
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

  const user = await findOrCreateUserFromIdentity({
    provider: AuthProvider.GOOGLE,
    providerUserId: googleUser.googleSub,
    email: googleUser.email,
    name: googleUser.name,
    avatarUrl: googleUser.avatarUrl,
    googleSub: googleUser.googleSub
  });

  return createSessionForUser(user.id, metadata);
}

export async function loginWithLinkedInAuthorizationCode({
  code,
  metadata,
  nonce
}: {
  code: string;
  metadata: RequestMetadata;
  nonce: string;
}): Promise<AuthSession> {
  const linkedInUser = await verifyLinkedInAuthorizationCode({ code, nonce });

  try {
    const user = await findOrCreateUserFromIdentity({
      provider: AuthProvider.LINKEDIN,
      providerUserId: linkedInUser.linkedInSub,
      email: linkedInUser.email,
      name: linkedInUser.name,
      avatarUrl: linkedInUser.avatarUrl
    });

    return createSessionForUser(user.id, metadata);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("LinkedIn session creation failed", error);
    throw new AppError("LinkedIn session creation failed", 500, "LINKEDIN_SESSION_CREATE_FAILED");
  }
}

async function findOrCreateUserFromIdentity(identity: ExternalIdentity) {
  const loginTime = now();
  const isPlatformOwner = isPlatformOwnerEmail(identity.email);

  return prisma.$transaction(async (tx) => {
    if (isPlatformOwner) {
      await tx.user.updateMany({
        where: {
          isSuperAdmin: true,
          email: {
            not: identity.email
          }
        },
        data: {
          isSuperAdmin: false
        }
      });
    }

    const existingIdentity = await tx.userIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: identity.provider,
          providerUserId: identity.providerUserId
        }
      },
      include: {
        user: true
      }
    });

    if (existingIdentity) {
      return tx.user.update({
        where: {
          id: existingIdentity.userId
        },
        data: {
          email: identity.email,
          name: identity.name,
          avatarUrl: identity.avatarUrl,
          googleSub: identity.googleSub ?? existingIdentity.user.googleSub,
          isSuperAdmin: isPlatformOwner,
          lastLoginAt: loginTime
        }
      });
    }

    const existingUser =
      identity.googleSub
        ? await tx.user.findFirst({
            where: {
              OR: [{ email: identity.email }, { googleSub: identity.googleSub }]
            }
          })
        : await tx.user.findUnique({
            where: {
              email: identity.email
            }
          });

    if (existingUser) {
      await tx.userIdentity.create({
        data: {
          userId: existingUser.id,
          provider: identity.provider,
          providerUserId: identity.providerUserId,
          email: identity.email
        }
      });

      return tx.user.update({
        where: {
          id: existingUser.id
        },
        data: {
          email: identity.email,
          name: identity.name,
          avatarUrl: identity.avatarUrl,
          googleSub: identity.googleSub ?? existingUser.googleSub,
          isSuperAdmin: isPlatformOwner,
          lastLoginAt: loginTime
        }
      });
    }

    return tx.user.create({
      data: {
        googleSub: identity.googleSub ?? null,
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
        isSuperAdmin: isPlatformOwner,
        lastLoginAt: loginTime,
        identities: {
          create: {
            provider: identity.provider,
            providerUserId: identity.providerUserId,
            email: identity.email
          }
        }
      }
    });
  });
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
