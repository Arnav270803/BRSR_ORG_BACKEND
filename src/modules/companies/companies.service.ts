import { MembershipRole, MembershipStatus } from "@prisma/client";

import { prisma } from "../../infra/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { CreateCompanyInput } from "./companies.schemas.js";

type CompanySummary = {
  id: string;
  legalName: string;
  displayName: string;
  primaryDomain: string;
  industry: string;
  country: string;
  state: string;
  city: string;
  financialYearStartMonth: number;
  status: string;
};

function toCompanySummary(company: {
  id: string;
  legalName: string;
  displayName: string;
  primaryDomain: string;
  industry: string;
  country: string;
  state: string;
  city: string;
  financialYearStartMonth: number;
  status: string;
}): CompanySummary {
  return {
    id: company.id,
    legalName: company.legalName,
    displayName: company.displayName,
    primaryDomain: company.primaryDomain,
    industry: company.industry,
    country: company.country,
    state: company.state,
    city: company.city,
    financialYearStartMonth: company.financialYearStartMonth,
    status: company.status
  };
}

export async function createCompanyForUser(input: CreateCompanyInput, userId: string) {
  const existingActiveMembership = await prisma.companyMembership.findFirst({
    where: {
      userId,
      status: MembershipStatus.ACTIVE
    }
  });

  if (existingActiveMembership) {
    throw new AppError("User already belongs to a company", 409, "USER_ALREADY_HAS_COMPANY");
  }

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        legalName: input.legalName,
        displayName: input.displayName,
        primaryDomain: input.primaryDomain,
        industry: input.industry,
        country: input.country,
        state: input.state,
        city: input.city,
        financialYearStartMonth: input.financialYearStartMonth,
        cin: input.cin ?? null,
        gst: input.gst ?? null,
        registeredAddress: input.registeredAddress ?? null,
        listedStatus: input.listedStatus ?? null,
        employeeCountRange: input.employeeCountRange ?? null,
        contactPhone: input.contactPhone ?? null,
        logoUrl: input.logoUrl ?? null
      }
    });

    const membership = await tx.companyMembership.create({
      data: {
        companyId: company.id,
        userId,
        role: MembershipRole.ADMIN
      }
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        actorUserId: userId,
        action: "COMPANY_CREATED",
        entityType: "company",
        entityId: company.id,
        afterJson: {
          companyId: company.id,
          membershipId: membership.id,
          role: membership.role
        }
      }
    });

    return { company, membership };
  });

  return {
    company: toCompanySummary(result.company),
    membership: {
      id: result.membership.id,
      role: result.membership.role,
      status: result.membership.status
    }
  };
}

export async function getCurrentCompanyForUser(userId: string) {
  const membership = await prisma.companyMembership.findFirst({
    where: {
      userId,
      status: MembershipStatus.ACTIVE
    },
    include: {
      company: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (!membership) {
    return null;
  }

  return {
    company: toCompanySummary(membership.company),
    membership: {
      id: membership.id,
      role: membership.role,
      status: membership.status
    }
  };
}

export async function getCompanyWorkspace(companyId: string, userId: string, isSuperAdmin: boolean) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      memberships: {
        where: {
          status: MembershipStatus.ACTIVE
        }
      },
      reportingYears: {
        where: {
          isActive: true
        },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        include: {
          _count: {
            select: {
              ghgActivitySelections: {
                where: {
                  isEnabled: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!company) {
    throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
  }

  const membership = company.memberships.find((item) => item.userId === userId);

  if (!isSuperAdmin && !membership) {
    throw new AppError("Company access denied", 403, "COMPANY_ACCESS_DENIED");
  }

  return {
    company: toCompanySummary(company),
    viewerRole: isSuperAdmin ? "SUPER_ADMIN" : membership?.role,
    activeMemberCount: company.memberships.length,
    reportingYears: company.reportingYears.map((reportingYear) => ({
      id: reportingYear.id,
      label: reportingYear.label,
      startDate: reportingYear.startDate.toISOString().slice(0, 10),
      endDate: reportingYear.endDate.toISOString().slice(0, 10),
      selectedGhgActivityCount: reportingYear._count.ghgActivitySelections
    })),
    setup: {
      reportingYearsReady: company.reportingYears.length > 0,
      ghgActivitySelectionReady: company.reportingYears.some(
        (reportingYear) => reportingYear._count.ghgActivitySelections > 0
      ),
      fieldConfigurationReady: company.reportingYears.some(
        (reportingYear) => reportingYear._count.ghgActivitySelections > 0
      )
    }
  };
}
