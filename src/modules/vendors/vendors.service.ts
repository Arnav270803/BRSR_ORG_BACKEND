import {
  DataOrigin,
  MembershipStatus,
  Prisma,
  VendorDataRequestStatus,
  VendorStatus,
  VendorTrackingMode
} from "@prisma/client";

import { env } from "../../config/env.js";
import {
  sendVendorDataRequestEmail,
  sendVendorInvitationEmail
} from "../../infra/email/resend.js";
import { prisma } from "../../infra/prisma/client.js";
import { INVITATION_TTL_DAYS } from "../../shared/constants.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuthenticatedUserContext } from "../../shared/types.js";
import { createRandomToken, hashToken } from "../../shared/utils/crypto.js";
import { addDays, now, toIsoDate } from "../../shared/utils/date.js";
import type {
  CreateVendorDataRequestInput,
  CreateVendorInput,
  CreateVendorInvitationInput,
  ListVendorOptionsQuery,
  ListVendorDataRequestsQuery,
  ListVendorsQuery,
  ReviewVendorDataRequestInput,
  UpdateVendorDataRequestInput,
  UpdateVendorInput,
  UpdateVendorSitesInput
} from "./vendors.schemas.js";

const vendorDetailInclude = {
  siteAssignments: {
    include: {
      site: true
    },
    orderBy: {
      site: {
        name: "asc" as const
      }
    }
  },
  memberships: {
    where: {
      status: MembershipStatus.ACTIVE
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true
        }
      }
    }
  },
  invitations: {
    orderBy: {
      createdAt: "desc" as const
    },
    take: 5
  },
  _count: {
    select: {
      dataRequests: true,
      dataRecords: true
    }
  }
} satisfies Prisma.VendorInclude;

export const requestDetailInclude = {
  vendor: {
    select: {
      id: true,
      displayName: true,
      legalName: true,
      primaryEmail: true,
      status: true
    }
  },
  site: {
    select: {
      id: true,
      name: true,
      type: true,
      city: true,
      state: true,
      country: true
    }
  },
  reportingYear: {
    select: {
      id: true,
      label: true,
      startDate: true,
      endDate: true
    }
  },
  items: {
    orderBy: {
      createdAt: "asc" as const
    },
    include: {
      ghgActivitySelection: {
        include: {
          ghgActivity: {
            include: {
              category: true
            }
          }
        }
      }
    }
  },
  submissionRecords: {
    orderBy: [{ recordDate: "asc" as const }, { createdAt: "asc" as const }],
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          name: true
        }
      },
      approvedDataRecord: {
        select: {
          id: true,
          calculatedKgCo2e: true
        }
      }
    }
  }
} satisfies Prisma.VendorDataRequestInclude;

type VendorDetail = Prisma.VendorGetPayload<{
  include: typeof vendorDetailInclude;
}>;

type VendorRequestDetail = Prisma.VendorDataRequestGetPayload<{
  include: typeof requestDetailInclude;
}>;

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toVendorResponse(vendor: VendorDetail) {
  return {
    id: vendor.id,
    companyId: vendor.companyId,
    legalName: vendor.legalName,
    displayName: vendor.displayName,
    vendorCode: vendor.vendorCode,
    primaryEmail: vendor.primaryEmail,
    primaryPhone: vendor.primaryPhone,
    website: vendor.website,
    industry: vendor.industry,
    country: vendor.country,
    state: vendor.state,
    city: vendor.city,
    address: vendor.address,
    taxId: vendor.taxId,
    status: vendor.status,
    profileCompletedAt: vendor.profileCompletedAt?.toISOString() ?? null,
    createdByUserId: vendor.createdByUserId,
    createdAt: vendor.createdAt.toISOString(),
    updatedAt: vendor.updatedAt.toISOString(),
    sites: vendor.siteAssignments.map((assignment) => ({
      assignmentId: assignment.id,
      id: assignment.site.id,
      name: assignment.site.name,
      type: assignment.site.type,
      city: assignment.site.city,
      state: assignment.site.state,
      country: assignment.site.country,
      isPrimary: assignment.site.isPrimary
    })),
    members: vendor.memberships.map((membership) => ({
      membershipId: membership.id,
      role: membership.role,
      status: membership.status,
      user: membership.user
    })),
    recentInvitations: vendor.invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      revokedAt: invitation.revokedAt?.toISOString() ?? null,
      createdAt: invitation.createdAt.toISOString()
    })),
    requestCount: vendor._count.dataRequests,
    approvedRecordCount: vendor._count.dataRecords
  };
}

function activityLabel(activity: {
  activity: string;
  subtype: string;
  variant: string;
}) {
  return [activity.activity, activity.subtype, activity.variant]
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .join(" - ");
}

export function toVendorRequestResponse(request: VendorRequestDetail) {
  return {
    id: request.id,
    companyId: request.companyId,
    vendorId: request.vendorId,
    siteId: request.siteId,
    reportingYearId: request.reportingYearId,
    title: request.title,
    instructions: request.instructions,
    dueDate: toIsoDate(request.dueDate),
    status: request.status,
    reviewNotes: request.reviewNotes,
    createdByUserId: request.createdByUserId,
    reviewedByUserId: request.reviewedByUserId,
    sentAt: request.sentAt?.toISOString() ?? null,
    submittedAt: request.submittedAt?.toISOString() ?? null,
    approvedAt: request.approvedAt?.toISOString() ?? null,
    changesRequestedAt: request.changesRequestedAt?.toISOString() ?? null,
    cancelledAt: request.cancelledAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    vendor: request.vendor,
    site: request.site,
    reportingYear: {
      ...request.reportingYear,
      startDate: toIsoDate(request.reportingYear.startDate),
      endDate: toIsoDate(request.reportingYear.endDate)
    },
    items: request.items.map((item) => {
      const activity = item.ghgActivitySelection.ghgActivity;

      return {
        id: item.id,
        ghgActivitySelectionId: item.ghgActivitySelectionId,
        trackingMode: item.trackingMode,
        instructions: item.instructions,
        activity: {
          id: activity.id,
          label: activityLabel(activity),
          activity: activity.activity,
          subtype: activity.subtype || null,
          variant: activity.variant || null,
          scope: activity.scope,
          unit: activity.unit,
          factorKgCo2e: activity.factorKgCo2e?.toString() ?? null,
          category: {
            id: activity.category.id,
            name: activity.category.name
          }
        }
      };
    }),
    submissionRecords: request.submissionRecords.map((record) => ({
      id: record.id,
      requestItemId: record.vendorDataRequestItemId,
      ghgActivitySelectionId: record.ghgActivitySelectionId,
      recordDate: toIsoDate(record.recordDate),
      quantity: record.quantity.toString(),
      notes: record.notes,
      metadata: record.metadata,
      createdBy: record.createdBy,
      approvedDataRecord: record.approvedDataRecord
        ? {
            id: record.approvedDataRecord.id,
            calculatedKgCo2e:
              record.approvedDataRecord.calculatedKgCo2e?.toString() ?? null
          }
        : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    }))
  };
}

async function assertVendorTrackingEnabled(companyId: string) {
  const company = await prisma.company.findUnique({
    where: {
      id: companyId
    },
    select: {
      id: true,
      displayName: true,
      vendorTrackingEnabled: true
    }
  });

  if (!company) {
    throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
  }

  if (!company.vendorTrackingEnabled) {
    throw new AppError(
      "Enable vendor tracking in company settings first",
      409,
      "VENDOR_TRACKING_DISABLED"
    );
  }

  return company;
}

async function assertCompanySites(companyId: string, siteIds: string[]) {
  const uniqueSiteIds = [...new Set(siteIds)];
  const sites = await prisma.companySite.findMany({
    where: {
      companyId,
      id: {
        in: uniqueSiteIds
      },
      status: "ACTIVE"
    },
    select: {
      id: true
    }
  });

  if (sites.length !== uniqueSiteIds.length) {
    throw new AppError("One or more sites were not found", 400, "INVALID_VENDOR_SITE");
  }

  return uniqueSiteIds;
}

async function getVendorForCompany(companyId: string, vendorId: string) {
  const vendor = await prisma.vendor.findFirst({
    where: {
      id: vendorId,
      companyId
    }
  });

  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  return vendor;
}

async function createInvitationForVendor(
  companyId: string,
  vendorId: string,
  input: CreateVendorInvitationInput,
  invitedByUserId: string
) {
  const company = await assertVendorTrackingEnabled(companyId);
  const vendor = await getVendorForCompany(companyId, vendorId);

  const existingMembership = await prisma.vendorMembership.findFirst({
    where: {
      vendorId,
      status: MembershipStatus.ACTIVE,
      user: {
        email: input.email
      }
    }
  });

  if (existingMembership) {
    throw new AppError("User is already an active vendor member", 409, "VENDOR_USER_EXISTS");
  }

  const existingInvite = await prisma.vendorInvitation.findFirst({
    where: {
      vendorId,
      email: input.email,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: {
        gt: now()
      }
    }
  });

  if (existingInvite) {
    throw new AppError(
      "An active vendor invitation already exists for this email",
      409,
      "VENDOR_INVITATION_EXISTS"
    );
  }

  const token = createRandomToken();
  const expiresAt = addDays(now(), INVITATION_TTL_DAYS);
  const inviteLink = `${env.INVITE_APP_URL ?? env.CLIENT_URL}/vendor/invite?token=${encodeURIComponent(token)}`;
  const invitation = await prisma.$transaction(async (tx) => {
    const createdInvitation = await tx.vendorInvitation.create({
      data: {
        companyId,
        vendorId,
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
        action: "VENDOR_INVITATION_CREATED",
        entityType: "vendor_invitation",
        entityId: createdInvitation.id,
        afterJson: {
          vendorId,
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
    const emailResult = await sendVendorInvitationEmail({
      acceptUrl: inviteLink,
      companyName: company.displayName,
      email: invitation.email,
      vendorName: vendor.displayName
    });

    emailSent = emailResult.sent;
    emailError = emailResult.error;
  } catch (error) {
    emailError = error instanceof Error ? error.message : "Unable to send vendor invitation";
  }

  return {
    invitation: {
      id: invitation.id,
      companyId: invitation.companyId,
      vendorId: invitation.vendorId,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString()
    },
    token,
    inviteLink,
    emailSent,
    emailError
  };
}

export async function listVendors(companyId: string, query: ListVendorsQuery) {
  await assertVendorTrackingEnabled(companyId);
  const search = query.search?.trim();
  const vendors = await prisma.vendor.findMany({
    where: {
      companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.siteId
        ? {
            siteAssignments: {
              some: {
                siteId: query.siteId
              }
            }
          }
        : {}),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: "insensitive" } },
              { legalName: { contains: search, mode: "insensitive" } },
              { primaryEmail: { contains: search, mode: "insensitive" } },
              { vendorCode: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    },
    include: vendorDetailInclude,
    orderBy: [{ status: "asc" }, { displayName: "asc" }]
  });

  return vendors.map(toVendorResponse);
}

export async function listVendorOptions(
  companyId: string,
  query: ListVendorOptionsQuery
) {
  await assertVendorTrackingEnabled(companyId);
  const site = await prisma.companySite.findFirst({
    where: {
      id: query.siteId,
      companyId,
      status: "ACTIVE"
    },
    select: {
      id: true
    }
  });

  if (!site) {
    throw new AppError("Site not found", 404, "SITE_NOT_FOUND");
  }

  return prisma.vendor.findMany({
    where: {
      companyId,
      status: VendorStatus.ACTIVE,
      siteAssignments: {
        some: {
          siteId: site.id
        }
      }
    },
    select: {
      id: true,
      displayName: true,
      vendorCode: true
    },
    orderBy: {
      displayName: "asc"
    }
  });
}

export async function getVendor(companyId: string, vendorId: string) {
  await assertVendorTrackingEnabled(companyId);
  const vendor = await prisma.vendor.findFirst({
    where: {
      id: vendorId,
      companyId
    },
    include: vendorDetailInclude
  });

  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  return toVendorResponse(vendor);
}

export async function createVendor(
  companyId: string,
  input: CreateVendorInput,
  actorUserId: string
) {
  await assertVendorTrackingEnabled(companyId);
  const siteIds = await assertCompanySites(companyId, input.siteIds);
  const vendor = await prisma.$transaction(async (tx) => {
    const createdVendor = await tx.vendor.create({
      data: {
        companyId,
        legalName: input.legalName,
        displayName: input.displayName,
        vendorCode: input.vendorCode ?? null,
        primaryEmail: input.primaryEmail,
        primaryPhone: input.primaryPhone ?? null,
        website: input.website ?? null,
        industry: input.industry ?? null,
        country: input.country,
        state: input.state,
        city: input.city,
        address: input.address ?? null,
        taxId: input.taxId ?? null,
        createdByUserId: actorUserId,
        siteAssignments: {
          create: siteIds.map((siteId) => ({
            companyId,
            siteId,
            createdByUserId: actorUserId
          }))
        }
      }
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId,
        action: "VENDOR_CREATED",
        entityType: "vendor",
        entityId: createdVendor.id,
        afterJson: {
          displayName: createdVendor.displayName,
          primaryEmail: createdVendor.primaryEmail,
          siteIds,
          status: createdVendor.status
        }
      }
    });

    return createdVendor;
  });
  const invitation = input.sendInvitation
    ? await createInvitationForVendor(
        companyId,
        vendor.id,
        {
          email: input.primaryEmail,
          role: input.invitationRole
        },
        actorUserId
      )
    : null;

  return {
    vendor: await getVendor(companyId, vendor.id),
    invitation
  };
}

export async function updateVendor(
  companyId: string,
  vendorId: string,
  input: UpdateVendorInput,
  actorUserId: string
) {
  await assertVendorTrackingEnabled(companyId);
  const existing = await getVendorForCompany(companyId, vendorId);
  const data: Prisma.VendorUpdateInput = {};

  for (const key of [
    "legalName",
    "displayName",
    "vendorCode",
    "primaryEmail",
    "primaryPhone",
    "website",
    "industry",
    "country",
    "state",
    "city",
    "address",
    "taxId",
    "status"
  ] as const) {
    if (input[key] !== undefined) {
      Object.assign(data, { [key]: input[key] });
    }
  }

  if (input.status === VendorStatus.ACTIVE && !existing.profileCompletedAt) {
    data.profileCompletedAt = now();
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.vendor.update({
      where: {
        id: vendorId
      },
      data
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId,
        action: "VENDOR_UPDATED",
        entityType: "vendor",
        entityId: vendorId,
        beforeJson: {
          displayName: existing.displayName,
          primaryEmail: existing.primaryEmail,
          status: existing.status
        },
        afterJson: {
          displayName: updated.displayName,
          primaryEmail: updated.primaryEmail,
          status: updated.status
        }
      }
    });
  });

  return getVendor(companyId, vendorId);
}

export async function updateVendorSites(
  companyId: string,
  vendorId: string,
  input: UpdateVendorSitesInput,
  actorUserId: string
) {
  await assertVendorTrackingEnabled(companyId);
  await getVendorForCompany(companyId, vendorId);
  const siteIds = await assertCompanySites(companyId, input.siteIds);

  await prisma.$transaction(async (tx) => {
    await tx.vendorSiteAssignment.deleteMany({
      where: {
        vendorId,
        siteId: {
          notIn: siteIds
        }
      }
    });

    for (const siteId of siteIds) {
      await tx.vendorSiteAssignment.upsert({
        where: {
          vendorId_siteId: {
            vendorId,
            siteId
          }
        },
        update: {},
        create: {
          companyId,
          vendorId,
          siteId,
          createdByUserId: actorUserId
        }
      });
    }

    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId,
        action: "VENDOR_SITE_ASSIGNMENTS_UPDATED",
        entityType: "vendor_site_assignments",
        entityId: vendorId,
        afterJson: {
          vendorId,
          siteIds
        }
      }
    });
  });

  return getVendor(companyId, vendorId);
}

export async function createVendorInvitation(
  companyId: string,
  vendorId: string,
  input: CreateVendorInvitationInput,
  actorUserId: string
) {
  return createInvitationForVendor(companyId, vendorId, input, actorUserId);
}

export async function acceptVendorInvitation(
  token: string,
  user: AuthenticatedUserContext
) {
  const invitation = await prisma.vendorInvitation.findUnique({
    where: {
      tokenHash: hashToken(token)
    },
    include: {
      company: true,
      vendor: true
    }
  });

  if (!invitation) {
    throw new AppError("Vendor invitation not found", 404, "VENDOR_INVITATION_NOT_FOUND");
  }

  if (invitation.revokedAt) {
    throw new AppError("Vendor invitation has been revoked", 410, "VENDOR_INVITATION_REVOKED");
  }

  if (invitation.acceptedAt) {
    throw new AppError(
      "Vendor invitation has already been accepted",
      409,
      "VENDOR_INVITATION_ACCEPTED"
    );
  }

  if (invitation.expiresAt <= now()) {
    throw new AppError("Vendor invitation has expired", 410, "VENDOR_INVITATION_EXPIRED");
  }

  if (invitation.email !== user.email.toLowerCase()) {
    throw new AppError(
      "Vendor invitation email does not match signed-in user",
      403,
      "VENDOR_INVITATION_EMAIL_MISMATCH"
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const membership = await tx.vendorMembership.upsert({
      where: {
        vendorId_userId: {
          vendorId: invitation.vendorId,
          userId: user.id
        }
      },
      update: {
        role: invitation.role,
        status: MembershipStatus.ACTIVE
      },
      create: {
        companyId: invitation.companyId,
        vendorId: invitation.vendorId,
        userId: user.id,
        role: invitation.role
      }
    });
    const acceptedAt = now();

    await tx.vendorInvitation.update({
      where: {
        id: invitation.id
      },
      data: {
        acceptedAt,
        acceptedByUserId: user.id
      }
    });
    await tx.vendor.update({
      where: {
        id: invitation.vendorId
      },
      data: {
        status: VendorStatus.ACTIVE,
        profileCompletedAt: invitation.vendor.profileCompletedAt ?? acceptedAt
      }
    });
    await tx.auditLog.create({
      data: {
        companyId: invitation.companyId,
        actorUserId: user.id,
        action: "VENDOR_INVITATION_ACCEPTED",
        entityType: "vendor_invitation",
        entityId: invitation.id,
        afterJson: {
          vendorId: invitation.vendorId,
          vendorMembershipId: membership.id,
          role: membership.role
        }
      }
    });

    return membership;
  });

  return {
    vendor: {
      id: invitation.vendor.id,
      displayName: invitation.vendor.displayName
    },
    company: {
      id: invitation.company.id,
      displayName: invitation.company.displayName
    },
    membership: {
      id: result.id,
      role: result.role,
      status: result.status
    }
  };
}

export async function markOverdueRequests(companyId: string) {
  const today = toDateOnly(new Date().toISOString().slice(0, 10));

  await prisma.vendorDataRequest.updateMany({
    where: {
      companyId,
      dueDate: {
        lt: today
      },
      status: {
        in: [
          VendorDataRequestStatus.SENT,
          VendorDataRequestStatus.IN_PROGRESS,
          VendorDataRequestStatus.CHANGES_REQUESTED
        ]
      }
    },
    data: {
      status: VendorDataRequestStatus.OVERDUE
    }
  });
}

async function notifyVendorDataRequest(requestId: string) {
  const request = await prisma.vendorDataRequest.findUnique({
    where: {
      id: requestId
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      vendorId: true,
      company: {
        select: {
          displayName: true
        }
      },
      vendor: {
        select: {
          displayName: true,
          primaryEmail: true,
          memberships: {
            where: {
              status: MembershipStatus.ACTIVE
            },
            select: {
              user: {
                select: {
                  email: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!request) {
    return;
  }

  const recipients = [
    ...new Set([
      request.vendor.primaryEmail,
      ...request.vendor.memberships.map((membership) => membership.user.email)
    ])
  ];
  const requestUrl = `${env.INVITE_APP_URL ?? env.CLIENT_URL}/vendor/${request.vendorId}/requests/${request.id}`;
  const dueDate = toIsoDate(request.dueDate);

  await Promise.allSettled(
    recipients.map((email) =>
      sendVendorDataRequestEmail({
        companyName: request.company.displayName,
        dueDate,
        email,
        requestTitle: request.title,
        requestUrl,
        vendorName: request.vendor.displayName
      })
    )
  );
}

async function validateRequestSelections({
  activitySelectionIds,
  companyId,
  reportingYearId,
  siteId
}: {
  activitySelectionIds: string[];
  companyId: string;
  reportingYearId: string;
  siteId: string;
}) {
  const uniqueIds = [...new Set(activitySelectionIds)];
  const selections = await prisma.companyGhgActivitySelection.findMany({
    where: {
      id: {
        in: uniqueIds
      },
      companyId,
      reportingYearId,
      siteId,
      isEnabled: true,
      vendorTrackingMode: {
        not: VendorTrackingMode.NONE
      }
    },
    select: {
      id: true,
      vendorTrackingMode: true
    }
  });

  if (selections.length !== uniqueIds.length) {
    throw new AppError(
      "Every request activity must be enabled for vendor tracking at this site and year",
      400,
      "INVALID_VENDOR_REQUEST_ACTIVITY"
    );
  }

  return selections;
}

async function validateRequestContext(
  companyId: string,
  input: Pick<
    CreateVendorDataRequestInput,
    "activitySelectionIds" | "reportingYearId" | "siteId" | "vendorId"
  >
) {
  await assertVendorTrackingEnabled(companyId);
  const [vendor, site, reportingYear, siteAssignment] = await Promise.all([
    prisma.vendor.findFirst({
      where: {
        id: input.vendorId,
        companyId,
        status: {
          in: [VendorStatus.PENDING, VendorStatus.ACTIVE]
        }
      }
    }),
    prisma.companySite.findFirst({
      where: {
        id: input.siteId,
        companyId,
        status: "ACTIVE"
      }
    }),
    prisma.reportingYear.findFirst({
      where: {
        id: input.reportingYearId,
        companyId,
        isActive: true
      }
    }),
    prisma.vendorSiteAssignment.findFirst({
      where: {
        companyId,
        vendorId: input.vendorId,
        siteId: input.siteId
      }
    })
  ]);

  if (!vendor) throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  if (!site) throw new AppError("Site not found", 404, "SITE_NOT_FOUND");
  if (!reportingYear) {
    throw new AppError("Reporting year not found", 404, "REPORTING_YEAR_NOT_FOUND");
  }
  if (!siteAssignment) {
    throw new AppError(
      "Vendor is not assigned to the selected site",
      400,
      "VENDOR_SITE_ASSIGNMENT_REQUIRED"
    );
  }

  const selections = await validateRequestSelections({
    activitySelectionIds: input.activitySelectionIds,
    companyId,
    reportingYearId: input.reportingYearId,
    siteId: input.siteId
  });

  return {
    selections,
    vendor
  };
}

export async function listVendorDataRequests(
  companyId: string,
  query: ListVendorDataRequestsQuery
) {
  await assertVendorTrackingEnabled(companyId);
  await markOverdueRequests(companyId);
  const requests = await prisma.vendorDataRequest.findMany({
    where: {
      companyId,
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.reportingYearId ? { reportingYearId: query.reportingYearId } : {}),
      ...(query.status ? { status: query.status } : {})
    },
    include: requestDetailInclude,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }]
  });

  return requests.map(toVendorRequestResponse);
}

export async function getVendorDataRequest(companyId: string, requestId: string) {
  await assertVendorTrackingEnabled(companyId);
  await markOverdueRequests(companyId);
  const request = await prisma.vendorDataRequest.findFirst({
    where: {
      id: requestId,
      companyId
    },
    include: requestDetailInclude
  });

  if (!request) {
    throw new AppError("Vendor data request not found", 404, "VENDOR_REQUEST_NOT_FOUND");
  }

  return toVendorRequestResponse(request);
}

export async function createVendorDataRequest(
  companyId: string,
  input: CreateVendorDataRequestInput,
  actorUserId: string
) {
  const context = await validateRequestContext(companyId, input);

  if (input.sendNow && context.vendor.status !== VendorStatus.ACTIVE) {
    throw new AppError(
      "The vendor must accept an invitation before a request can be sent",
      409,
      "VENDOR_NOT_ACTIVE"
    );
  }

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.vendorDataRequest.create({
      data: {
        companyId,
        vendorId: input.vendorId,
        siteId: input.siteId,
        reportingYearId: input.reportingYearId,
        title: input.title,
        instructions: input.instructions ?? null,
        dueDate: toDateOnly(input.dueDate),
        status: input.sendNow ? VendorDataRequestStatus.SENT : VendorDataRequestStatus.DRAFT,
        sentAt: input.sendNow ? now() : null,
        createdByUserId: actorUserId,
        items: {
          create: context.selections.map((selection) => ({
            ghgActivitySelectionId: selection.id,
            trackingMode: selection.vendorTrackingMode
          }))
        }
      }
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId,
        action: input.sendNow ? "VENDOR_DATA_REQUEST_SENT" : "VENDOR_DATA_REQUEST_CREATED",
        entityType: "vendor_data_request",
        entityId: created.id,
        afterJson: {
          vendorId: input.vendorId,
          siteId: input.siteId,
          reportingYearId: input.reportingYearId,
          activitySelectionIds: context.selections.map((selection) => selection.id),
          dueDate: input.dueDate,
          status: created.status
        }
      }
    });

    return created;
  });

  if (input.sendNow) {
    await notifyVendorDataRequest(request.id);
  }

  return getVendorDataRequest(companyId, request.id);
}

export async function updateVendorDataRequest(
  companyId: string,
  requestId: string,
  input: UpdateVendorDataRequestInput,
  actorUserId: string
) {
  await assertVendorTrackingEnabled(companyId);
  const existing = await prisma.vendorDataRequest.findFirst({
    where: {
      id: requestId,
      companyId
    }
  });

  if (!existing) {
    throw new AppError("Vendor data request not found", 404, "VENDOR_REQUEST_NOT_FOUND");
  }
  if (existing.status !== VendorDataRequestStatus.DRAFT) {
    throw new AppError("Only draft requests can be edited", 409, "VENDOR_REQUEST_NOT_DRAFT");
  }

  const selections = input.activitySelectionIds
    ? await validateRequestSelections({
        activitySelectionIds: input.activitySelectionIds,
        companyId,
        reportingYearId: existing.reportingYearId,
        siteId: existing.siteId
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.vendorDataRequest.update({
      where: {
        id: requestId
      },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
        ...(input.dueDate !== undefined ? { dueDate: toDateOnly(input.dueDate) } : {})
      }
    });

    if (selections) {
      await tx.vendorDataRequestItem.deleteMany({
        where: {
          vendorDataRequestId: requestId
        }
      });
      await tx.vendorDataRequestItem.createMany({
        data: selections.map((selection) => ({
          vendorDataRequestId: requestId,
          ghgActivitySelectionId: selection.id,
          trackingMode: selection.vendorTrackingMode
        }))
      });
    }

    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId,
        action: "VENDOR_DATA_REQUEST_UPDATED",
        entityType: "vendor_data_request",
        entityId: requestId,
        afterJson: input
      }
    });
  });

  return getVendorDataRequest(companyId, requestId);
}

export async function sendVendorDataRequest(
  companyId: string,
  requestId: string,
  actorUserId: string
) {
  await assertVendorTrackingEnabled(companyId);
  const request = await prisma.vendorDataRequest.findFirst({
    where: {
      id: requestId,
      companyId
    },
    include: {
      vendor: true
    }
  });

  if (!request) {
    throw new AppError("Vendor data request not found", 404, "VENDOR_REQUEST_NOT_FOUND");
  }
  if (request.status !== VendorDataRequestStatus.DRAFT) {
    throw new AppError("Only draft requests can be sent", 409, "VENDOR_REQUEST_NOT_DRAFT");
  }
  if (request.vendor.status !== VendorStatus.ACTIVE) {
    throw new AppError(
      "The vendor must accept an invitation before a request can be sent",
      409,
      "VENDOR_NOT_ACTIVE"
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendorDataRequest.update({
      where: {
        id: requestId
      },
      data: {
        status: VendorDataRequestStatus.SENT,
        sentAt: now()
      }
    });
    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId,
        action: "VENDOR_DATA_REQUEST_SENT",
        entityType: "vendor_data_request",
        entityId: requestId,
        afterJson: {
          vendorId: request.vendorId,
          status: VendorDataRequestStatus.SENT
        }
      }
    });
  });

  await notifyVendorDataRequest(requestId);

  return getVendorDataRequest(companyId, requestId);
}

export async function reviewVendorDataRequest(
  companyId: string,
  requestId: string,
  input: ReviewVendorDataRequestInput,
  actorUserId: string
) {
  await assertVendorTrackingEnabled(companyId);
  const request = await prisma.vendorDataRequest.findFirst({
    where: {
      id: requestId,
      companyId
    },
    include: {
      submissionRecords: {
        include: {
          ghgActivitySelection: {
            include: {
              ghgActivity: true
            }
          },
          approvedDataRecord: true
        }
      }
    }
  });

  if (!request) {
    throw new AppError("Vendor data request not found", 404, "VENDOR_REQUEST_NOT_FOUND");
  }
  if (request.status !== VendorDataRequestStatus.SUBMITTED) {
    throw new AppError(
      "Only submitted requests can be reviewed",
      409,
      "VENDOR_REQUEST_NOT_SUBMITTED"
    );
  }

  if (input.action === "REQUEST_CHANGES") {
    await prisma.$transaction(async (tx) => {
      await tx.vendorDataRequest.update({
        where: {
          id: requestId
        },
        data: {
          status: VendorDataRequestStatus.CHANGES_REQUESTED,
          reviewNotes: input.notes ?? null,
          reviewedByUserId: actorUserId,
          changesRequestedAt: now()
        }
      });
      await tx.auditLog.create({
        data: {
          companyId,
          actorUserId,
          action: "VENDOR_DATA_REQUEST_CHANGES_REQUESTED",
          entityType: "vendor_data_request",
          entityId: requestId,
          afterJson: {
            notes: input.notes ?? null
          }
        }
      });
    });

    return getVendorDataRequest(companyId, requestId);
  }

  if (request.submissionRecords.length === 0) {
    throw new AppError("The vendor submitted no records", 409, "VENDOR_SUBMISSION_EMPTY");
  }

  await prisma.$transaction(async (tx) => {
    for (const submission of request.submissionRecords) {
      if (submission.approvedDataRecord) {
        continue;
      }

      const activity = submission.ghgActivitySelection.ghgActivity;
      const calculatedKgCo2e = activity.factorKgCo2e
        ? submission.quantity.mul(activity.factorKgCo2e)
        : null;

      await tx.dataRecord.create({
        data: {
          companyId,
          siteId: request.siteId,
          reportingYearId: request.reportingYearId,
          ghgActivitySelectionId: submission.ghgActivitySelectionId,
          ghgActivityId: activity.id,
          recordDate: submission.recordDate,
          quantity: submission.quantity,
          unit: activity.unit,
          factorKgCo2e: activity.factorKgCo2e,
          calculatedKgCo2e,
          scope: activity.scope,
          factorSourceSheet: activity.sourceSheet,
          factorSourceYear: activity.sourceYear,
          factorSourceVersion: activity.sourceVersion,
          notes: submission.notes,
          metadata: submission.metadata ?? Prisma.JsonNull,
          dataOrigin: DataOrigin.VENDOR,
          vendorId: request.vendorId,
          vendorSubmissionRecordId: submission.id,
          createdByUserId: actorUserId
        }
      });
    }

    await tx.vendorDataRequest.update({
      where: {
        id: requestId
      },
      data: {
        status: VendorDataRequestStatus.APPROVED,
        reviewNotes: input.notes ?? null,
        reviewedByUserId: actorUserId,
        approvedAt: now()
      }
    });
    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId,
        action: "VENDOR_DATA_REQUEST_APPROVED",
        entityType: "vendor_data_request",
        entityId: requestId,
        afterJson: {
          vendorId: request.vendorId,
          approvedRecordCount: request.submissionRecords.length,
          notes: input.notes ?? null
        }
      }
    });
  });

  return getVendorDataRequest(companyId, requestId);
}

export async function cancelVendorDataRequest(
  companyId: string,
  requestId: string,
  actorUserId: string
) {
  await assertVendorTrackingEnabled(companyId);
  const request = await prisma.vendorDataRequest.findFirst({
    where: {
      id: requestId,
      companyId
    }
  });

  if (!request) {
    throw new AppError("Vendor data request not found", 404, "VENDOR_REQUEST_NOT_FOUND");
  }
  const finalStatuses: VendorDataRequestStatus[] = [
    VendorDataRequestStatus.APPROVED,
    VendorDataRequestStatus.CANCELLED
  ];
  if (finalStatuses.includes(request.status)) {
    throw new AppError(
      "Approved or cancelled requests cannot be cancelled",
      409,
      "VENDOR_REQUEST_CANNOT_CANCEL"
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendorDataRequest.update({
      where: {
        id: requestId
      },
      data: {
        status: VendorDataRequestStatus.CANCELLED,
        cancelledAt: now()
      }
    });
    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId,
        action: "VENDOR_DATA_REQUEST_CANCELLED",
        entityType: "vendor_data_request",
        entityId: requestId
      }
    });
  });

  return getVendorDataRequest(companyId, requestId);
}

export async function getVendorAnalytics(
  companyId: string,
  query: Pick<ListVendorDataRequestsQuery, "reportingYearId" | "siteId">
) {
  await assertVendorTrackingEnabled(companyId);
  await markOverdueRequests(companyId);
  const dataRecordWhere: Prisma.DataRecordWhereInput = {
    companyId,
    vendorId: {
      not: null
    },
    dataOrigin: DataOrigin.VENDOR,
    deletedAt: null,
    ...(query.reportingYearId ? { reportingYearId: query.reportingYearId } : {}),
    ...(query.siteId ? { siteId: query.siteId } : {})
  };
  const requestWhere: Prisma.VendorDataRequestWhereInput = {
    companyId,
    ...(query.reportingYearId ? { reportingYearId: query.reportingYearId } : {}),
    ...(query.siteId ? { siteId: query.siteId } : {})
  };
  const [vendors, groupedRecords, groupedRequests, totalRequests] = await Promise.all([
    prisma.vendor.findMany({
      where: {
        companyId,
        status: {
          not: VendorStatus.ARCHIVED
        }
      },
      select: {
        id: true,
        displayName: true,
        status: true
      },
      orderBy: {
        displayName: "asc"
      }
    }),
    prisma.dataRecord.groupBy({
      by: ["vendorId"],
      where: dataRecordWhere,
      _count: {
        id: true
      },
      _sum: {
        calculatedKgCo2e: true
      }
    }),
    prisma.vendorDataRequest.groupBy({
      by: ["status"],
      where: requestWhere,
      _count: {
        id: true
      }
    }),
    prisma.vendorDataRequest.count({
      where: {
        ...requestWhere,
        status: {
          notIn: [VendorDataRequestStatus.DRAFT, VendorDataRequestStatus.CANCELLED]
        }
      }
    })
  ]);
  const approvedRequests = groupedRequests.find(
    (row) => row.status === VendorDataRequestStatus.APPROVED
  )?._count.id ?? 0;
  const totalsByVendorId = new Map(
    groupedRecords
      .filter((row) => row.vendorId)
      .map((row) => [
        row.vendorId!,
        {
          approvedRecordCount: row._count.id,
          totalKgCo2e: row._sum.calculatedKgCo2e?.toString() ?? "0"
        }
      ])
  );

  return {
    filters: query,
    summary: {
      vendorCount: vendors.length,
      approvedRequestCount: approvedRequests,
      totalRequestCount: totalRequests,
      requestCoveragePercent:
        totalRequests === 0 ? 0 : Math.round((approvedRequests / totalRequests) * 1000) / 10
    },
    requestStatuses: groupedRequests.map((row) => ({
      status: row.status,
      count: row._count.id
    })),
    vendors: vendors
      .map((vendor) => ({
        ...vendor,
        approvedRecordCount: totalsByVendorId.get(vendor.id)?.approvedRecordCount ?? 0,
        totalKgCo2e: totalsByVendorId.get(vendor.id)?.totalKgCo2e ?? "0"
      }))
      .sort(
        (left, right) =>
          new Prisma.Decimal(right.totalKgCo2e).comparedTo(
            new Prisma.Decimal(left.totalKgCo2e)
          ) || left.displayName.localeCompare(right.displayName)
      )
  };
}
