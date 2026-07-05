import { CompanySiteStatus, MembershipRole, MembershipStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "../../infra/prisma/client.js";
import { APP_ROLES } from "../../shared/constants.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuthenticatedUserContext, CompanyAccessContext } from "../../shared/types.js";
import type {
  CreateCompanySiteInput,
  UpdateCompanySiteInput,
  UpdateCompanySiteMembershipInput
} from "./sites.schemas.js";

function toCompanySiteResponse(site: {
  id: string;
  companyId: string;
  name: string;
  type: string;
  country: string;
  state: string;
  city: string;
  address: string | null;
  isPrimary: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: site.id,
    companyId: site.companyId,
    name: site.name,
    type: site.type,
    country: site.country,
    state: site.state,
    city: site.city,
    address: site.address,
    isPrimary: site.isPrimary,
    status: site.status,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString()
  };
}

function toSiteMemberResponse(member: {
  id: string;
  companyId: string;
  userId: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
  siteIds: string[];
}) {
  return {
    id: member.id,
    companyId: member.companyId,
    userId: member.userId,
    role: member.role,
    status: member.status,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
    user: member.user,
    siteIds: member.siteIds
  };
}

export async function createPrimarySiteForCompany(
  companyId: string,
  userId: string,
  input: CreateCompanySiteInput
) {
  return prisma.$transaction(async (tx) => {
    await tx.companySite.updateMany({
      where: {
        companyId,
        isPrimary: true
      },
      data: {
        isPrimary: false
      }
    });

    const site = await tx.companySite.create({
      data: {
        companyId,
        name: input.name,
        type: input.type,
        country: input.country,
        state: input.state,
        city: input.city,
        address: input.address ?? null,
        isPrimary: true
      }
    });

    await tx.companySiteMembership.create({
      data: {
        companyId,
        siteId: site.id,
        userId,
        role: MembershipRole.ADMIN
      }
    });

    return site;
  });
}

export async function getPrimaryCompanySite(companyId: string) {
  const site = await prisma.companySite.findFirst({
    where: {
      companyId,
      isPrimary: true,
      status: CompanySiteStatus.ACTIVE
    }
  });

  if (!site) {
    throw new AppError("Primary site not found", 404, "PRIMARY_SITE_NOT_FOUND");
  }

  return site;
}

export async function resolveCompanySiteForAccess(
  companyId: string,
  siteId: string | undefined,
  user: AuthenticatedUserContext,
  companyAccess: CompanyAccessContext
) {
  const site = siteId
    ? await prisma.companySite.findFirst({
        where: {
          id: siteId,
          companyId,
          status: CompanySiteStatus.ACTIVE
        }
      })
    : await getPrimaryCompanySite(companyId);

  if (!site) {
    throw new AppError("Site not found", 404, "SITE_NOT_FOUND");
  }

  if (user.isSuperAdmin || companyAccess.role === APP_ROLES.ADMIN) {
    return site;
  }

  const membership = await prisma.companySiteMembership.findFirst({
    where: {
      companyId,
      siteId: site.id,
      userId: user.id,
      status: MembershipStatus.ACTIVE
    },
    select: {
      id: true
    }
  });

  if (!membership) {
    throw new AppError("Site access denied", 403, "SITE_ACCESS_DENIED");
  }

  return site;
}

export async function listCompanySites(
  companyId: string,
  user: AuthenticatedUserContext,
  companyAccess: CompanyAccessContext
) {
  const where =
    user.isSuperAdmin || companyAccess.role === APP_ROLES.ADMIN
      ? {
          companyId,
          status: CompanySiteStatus.ACTIVE
        }
      : {
          companyId,
          status: CompanySiteStatus.ACTIVE,
          memberships: {
            some: {
              userId: user.id,
              status: MembershipStatus.ACTIVE
            }
          }
        };

  const sites = await prisma.companySite.findMany({
    where,
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }]
  });

  return sites.map(toCompanySiteResponse);
}

export async function getCompanySite(
  companyId: string,
  siteId: string,
  user: AuthenticatedUserContext,
  companyAccess: CompanyAccessContext
) {
  const site = await prisma.companySite.findFirst({
    where: {
      id: siteId,
      companyId,
      status: CompanySiteStatus.ACTIVE
    },
    include: {
      memberships: {
        where: {
          userId: user.id,
          status: MembershipStatus.ACTIVE
        },
        select: {
          id: true
        }
      }
    }
  });

  if (!site) {
    throw new AppError("Site not found", 404, "SITE_NOT_FOUND");
  }

  if (
    !user.isSuperAdmin &&
    companyAccess.role !== APP_ROLES.ADMIN &&
    site.memberships.length === 0
  ) {
    throw new AppError("Site access denied", 403, "SITE_ACCESS_DENIED");
  }

  return toCompanySiteResponse(site);
}

export async function createCompanySite(
  companyId: string,
  input: CreateCompanySiteInput,
  actorUserId: string
) {
  const site = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.companySite.updateMany({
        where: {
          companyId,
          isPrimary: true
        },
        data: {
          isPrimary: false
        }
      });
    }

    const createdSite = await tx.companySite.create({
      data: {
        companyId,
        name: input.name,
        type: input.type,
        country: input.country,
        state: input.state,
        city: input.city,
        address: input.address ?? null,
        isPrimary: input.isPrimary ?? false,
        memberships: {
          create: {
            companyId,
            userId: actorUserId,
            role: MembershipRole.ADMIN
          }
        }
      }
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId,
        action: "COMPANY_SITE_CREATED",
        entityType: "company_site",
        entityId: createdSite.id,
        afterJson: {
          siteId: createdSite.id,
          name: createdSite.name,
          type: createdSite.type,
          isPrimary: createdSite.isPrimary
        }
      }
    });

    return createdSite;
  });

  return toCompanySiteResponse(site);
}

export async function updateCompanySite(
  companyId: string,
  siteId: string,
  input: UpdateCompanySiteInput,
  actorUserId: string
) {
  const existingSite = await prisma.companySite.findFirst({
    where: {
      id: siteId,
      companyId,
      status: CompanySiteStatus.ACTIVE
    }
  });

  if (!existingSite) {
    throw new AppError("Site not found", 404, "SITE_NOT_FOUND");
  }

  const site = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.companySite.updateMany({
        where: {
          companyId,
          isPrimary: true,
          id: {
            not: siteId
          }
        },
        data: {
          isPrimary: false
        }
      });
    }

    const updateData: Prisma.CompanySiteUpdateInput = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.country !== undefined) updateData.country = input.country;
    if (input.state !== undefined) updateData.state = input.state;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.isPrimary !== undefined) updateData.isPrimary = input.isPrimary;

    const updatedSite = await tx.companySite.update({
      where: {
        id: siteId
      },
      data: updateData
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId,
        action: "COMPANY_SITE_UPDATED",
        entityType: "company_site",
        entityId: siteId,
        beforeJson: {
          name: existingSite.name,
          type: existingSite.type,
          isPrimary: existingSite.isPrimary
        },
        afterJson: {
          name: updatedSite.name,
          type: updatedSite.type,
          isPrimary: updatedSite.isPrimary
        }
      }
    });

    return updatedSite;
  });

  return toCompanySiteResponse(site);
}

export async function listCompanySiteMembers(companyId: string) {
  const [members, siteMemberships] = await Promise.all([
    prisma.companyMembership.findMany({
      where: {
        companyId,
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
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    }),
    prisma.companySiteMembership.findMany({
      where: {
        companyId,
        status: MembershipStatus.ACTIVE
      },
      select: {
        siteId: true,
        userId: true
      }
    })
  ]);

  const siteIdsByUserId = new Map<string, string[]>();

  for (const siteMembership of siteMemberships) {
    const userSiteIds = siteIdsByUserId.get(siteMembership.userId) ?? [];
    userSiteIds.push(siteMembership.siteId);
    siteIdsByUserId.set(siteMembership.userId, userSiteIds);
  }

  return members.map((member) =>
    toSiteMemberResponse({
      ...member,
      siteIds: siteIdsByUserId.get(member.userId) ?? []
    })
  );
}

export async function updateCompanySiteMemberships(
  companyId: string,
  targetUserId: string,
  input: UpdateCompanySiteMembershipInput,
  actorUserId: string
) {
  const targetMembership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId,
        userId: targetUserId
      }
    }
  });

  if (!targetMembership || targetMembership.status !== MembershipStatus.ACTIVE) {
    throw new AppError("Company member not found", 404, "COMPANY_MEMBER_NOT_FOUND");
  }

  const uniqueSiteIds = [...new Set(input.siteIds)];
  const sites = uniqueSiteIds.length
    ? await prisma.companySite.findMany({
        where: {
          companyId,
          id: {
            in: uniqueSiteIds
          },
          status: CompanySiteStatus.ACTIVE
        },
        select: {
          id: true
        }
      })
    : [];

  if (sites.length !== uniqueSiteIds.length) {
    throw new AppError("One or more sites were not found", 400, "INVALID_SITE_ASSIGNMENT");
  }

  await prisma.$transaction(async (tx) => {
    await tx.companySiteMembership.updateMany({
      where: {
        companyId,
        userId: targetUserId,
        siteId: {
          notIn: uniqueSiteIds
        }
      },
      data: {
        status: MembershipStatus.DISABLED
      }
    });

    for (const siteId of uniqueSiteIds) {
      await tx.companySiteMembership.upsert({
        where: {
          siteId_userId: {
            siteId,
            userId: targetUserId
          }
        },
        update: {
          role: targetMembership.role,
          status: MembershipStatus.ACTIVE
        },
        create: {
          companyId,
          siteId,
          userId: targetUserId,
          role: targetMembership.role
        }
      });
    }

    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId,
        action: "COMPANY_SITE_MEMBERSHIPS_UPDATED",
        entityType: "company_site_memberships",
        entityId: targetUserId,
        afterJson: {
          userId: targetUserId,
          siteIds: uniqueSiteIds
        }
      }
    });
  });

  const member = await prisma.companyMembership.findFirst({
    where: {
      companyId,
      userId: targetUserId,
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
  });

  if (!member) {
    throw new AppError("Company member not found", 404, "COMPANY_MEMBER_NOT_FOUND");
  }

  return toSiteMemberResponse({
    ...member,
    siteIds: uniqueSiteIds
  });
}
