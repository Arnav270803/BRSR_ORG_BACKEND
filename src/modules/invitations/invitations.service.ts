import { MembershipStatus } from "@prisma/client";

import { env } from "../../config/env.js";
import { sendInvitationEmail } from "../../infra/email/resend.js";
import { prisma } from "../../infra/prisma/client.js";
import { INVITATION_TTL_DAYS } from "../../shared/constants.js";
import { AppError } from "../../shared/errors/AppError.js";
import { createRandomToken, hashToken } from "../../shared/utils/crypto.js";
import { addDays, now } from "../../shared/utils/date.js";
import type { AuthenticatedUserContext } from "../../shared/types.js";
import type { CreateInvitationInput } from "./invitations.schemas.js";

function toInvitationSummary(invitation: {
  id: string;
  companyId: string;
  email: string;
  role: string;
  invitedByUserId: string;
  acceptedByUserId: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: invitation.id,
    companyId: invitation.companyId,
    email: invitation.email,
    role: invitation.role,
    invitedByUserId: invitation.invitedByUserId,
    acceptedByUserId: invitation.acceptedByUserId,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    revokedAt: invitation.revokedAt,
    createdAt: invitation.createdAt
  };
}

export async function listCompanyInvitations(companyId: string) {
  const invitations = await prisma.invitation.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" }
  });

  return invitations.map(toInvitationSummary);
}

export async function createCompanyInvitation(
  companyId: string,
  input: CreateInvitationInput,
  invitedByUserId: string
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      displayName: true
    }
  });

  if (!company) {
    throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
  }

  const existingMember = await prisma.companyMembership.findFirst({
    where: {
      companyId,
      user: {
        email: input.email
      },
      status: MembershipStatus.ACTIVE
    }
  });

  if (existingMember) {
    throw new AppError("User is already an active company member", 409, "USER_ALREADY_MEMBER");
  }

  const existingActiveInvite = await prisma.invitation.findFirst({
    where: {
      companyId,
      email: input.email,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: {
        gt: now()
      }
    }
  });

  if (existingActiveInvite) {
    throw new AppError("An active invitation already exists for this email", 409, "INVITATION_ALREADY_EXISTS");
  }

  const token = createRandomToken();
  const expiresAt = addDays(now(), INVITATION_TTL_DAYS);
  const inviteLink = `${env.INVITE_APP_URL ?? env.CLIENT_URL}/invite?token=${encodeURIComponent(token)}`;

  const invitation = await prisma.$transaction(async (tx) => {
    const createdInvitation = await tx.invitation.create({
      data: {
        companyId,
        email: input.email,
        role: input.role,
        tokenHash: hashToken(token),
        invitedByUserId,
        expiresAt
      }
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId: invitedByUserId,
        action: "INVITATION_CREATED",
        entityType: "invitation",
        entityId: createdInvitation.id,
        afterJson: {
          email: createdInvitation.email,
          role: createdInvitation.role,
          expiresAt: createdInvitation.expiresAt
        }
      }
    });

    return createdInvitation;
  });
  let emailSent = false;
  let emailError: string | undefined;

  try {
    const emailResult = await sendInvitationEmail({
      acceptUrl: inviteLink,
      companyName: company.displayName,
      email: invitation.email,
      role: invitation.role
    });

    emailSent = emailResult.sent;
    emailError = emailResult.error;
  } catch (error) {
    emailError = error instanceof Error ? error.message : "Unable to send invitation email";
  }

  return {
    invitation: toInvitationSummary(invitation),
    token,
    inviteLink,
    emailSent,
    emailError
  };
}

export async function acceptInvitation(token: string, user: AuthenticatedUserContext) {
  const invitation = await prisma.invitation.findUnique({
    where: {
      tokenHash: hashToken(token)
    },
    include: {
      company: true
    }
  });

  if (!invitation) {
    throw new AppError("Invitation not found", 404, "INVITATION_NOT_FOUND");
  }

  if (invitation.revokedAt) {
    throw new AppError("Invitation has been revoked", 410, "INVITATION_REVOKED");
  }

  if (invitation.acceptedAt) {
    throw new AppError("Invitation has already been accepted", 409, "INVITATION_ALREADY_ACCEPTED");
  }

  if (invitation.expiresAt <= now()) {
    throw new AppError("Invitation has expired", 410, "INVITATION_EXPIRED");
  }

  if (invitation.email !== user.email.toLowerCase()) {
    throw new AppError("Invitation email does not match signed-in user", 403, "INVITATION_EMAIL_MISMATCH");
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingMembership = await tx.companyMembership.findUnique({
      where: {
        companyId_userId: {
          companyId: invitation.companyId,
          userId: user.id
        }
      }
    });

    if (existingMembership?.status === MembershipStatus.ACTIVE) {
      throw new AppError("User is already an active company member", 409, "USER_ALREADY_MEMBER");
    }

    const membership = existingMembership
      ? await tx.companyMembership.update({
          where: { id: existingMembership.id },
          data: {
            role: invitation.role,
            status: MembershipStatus.ACTIVE
          }
        })
      : await tx.companyMembership.create({
          data: {
            companyId: invitation.companyId,
            userId: user.id,
            role: invitation.role
          }
        });
    const primarySite = await tx.companySite.findFirst({
      where: {
        companyId: invitation.companyId,
        isPrimary: true
      },
      select: {
        id: true
      }
    });

    if (primarySite) {
      await tx.companySiteMembership.upsert({
        where: {
          siteId_userId: {
            siteId: primarySite.id,
            userId: user.id
          }
        },
        update: {
          role: invitation.role,
          status: MembershipStatus.ACTIVE
        },
        create: {
          companyId: invitation.companyId,
          siteId: primarySite.id,
          userId: user.id,
          role: invitation.role
        }
      });
    }

    const acceptedInvitation = await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        acceptedAt: now(),
        acceptedByUserId: user.id
      }
    });

    await tx.auditLog.create({
      data: {
        companyId: invitation.companyId,
        actorUserId: user.id,
        action: "INVITATION_ACCEPTED",
        entityType: "invitation",
        entityId: invitation.id,
        afterJson: {
          membershipId: membership.id,
          primarySiteId: primarySite?.id ?? null,
          role: membership.role
        }
      }
    });

    return {
      invitation: acceptedInvitation,
      membership
    };
  });

  return {
    invitation: toInvitationSummary(result.invitation),
    company: {
      id: invitation.company.id,
      displayName: invitation.company.displayName,
      legalName: invitation.company.legalName
    },
    membership: {
      id: result.membership.id,
      role: result.membership.role,
      status: result.membership.status
    }
  };
}
