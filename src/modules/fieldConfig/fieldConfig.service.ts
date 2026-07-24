import { VendorTrackingMode, type Prisma } from "@prisma/client";

import { prisma } from "../../infra/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuthenticatedUserContext, CompanyAccessContext } from "../../shared/types.js";
import { now, toIsoDate } from "../../shared/utils/date.js";
import { resolveCompanySiteForAccess } from "../sites/sites.service.js";
import type { UpdateGhgActivitySelectionsInput } from "./fieldConfig.schemas.js";

function toReportingYearSummary(reportingYear: {
  id: string;
  companyId: string;
  label: string;
  startDate: Date;
  endDate: Date;
}) {
  return {
    id: reportingYear.id,
    companyId: reportingYear.companyId,
    label: reportingYear.label,
    startDate: toIsoDate(reportingYear.startDate),
    endDate: toIsoDate(reportingYear.endDate)
  };
}

function toSelectedActivityResponse(selection: {
  id: string;
  siteId: string;
  customLabel: string | null;
  vendorTrackingMode: VendorTrackingMode;
  selectedAt: Date;
  ghgActivity: {
    id: string;
    categoryId: string;
    sourceSheet: string;
    sourceYear: number | null;
    sourceVersion: string | null;
    sourceRow: number;
    scope: string | null;
    activity: string;
    subtype: string;
    variant: string;
    unit: string;
    factorKgCo2e: Prisma.Decimal | null;
    factorData: Prisma.JsonValue | null;
    category: {
      id: string;
      name: string;
      sourceSheet: string;
    };
  };
}) {
  const activity = selection.ghgActivity;

  return {
    selectionId: selection.id,
    siteId: selection.siteId,
    customLabel: selection.customLabel,
    vendorTrackingMode: selection.vendorTrackingMode,
    selectedAt: selection.selectedAt.toISOString(),
    activity: {
      id: activity.id,
      categoryId: activity.categoryId,
      category: activity.category,
      sourceSheet: activity.sourceSheet,
      sourceYear: activity.sourceYear,
      sourceVersion: activity.sourceVersion,
      sourceRow: activity.sourceRow,
      scope: activity.scope,
      activity: activity.activity,
      subtype: activity.subtype || null,
      variant: activity.variant || null,
      unit: activity.unit,
      factorKgCo2e: activity.factorKgCo2e?.toString() ?? null,
      factorData: activity.factorData
    }
  };
}

async function getReportingYear(companyId: string, reportingYearId: string) {
  const reportingYear = await prisma.reportingYear.findFirst({
    where: {
      id: reportingYearId,
      companyId,
      isActive: true
    }
  });

  if (!reportingYear) {
    throw new AppError("Reporting year not found", 404, "REPORTING_YEAR_NOT_FOUND");
  }

  return reportingYear;
}

export async function listCompanyGhgActivitySelections(
  companyId: string,
  siteId: string | undefined,
  reportingYearId: string,
  user: AuthenticatedUserContext,
  companyAccess: CompanyAccessContext
) {
  const reportingYear = await getReportingYear(companyId, reportingYearId);
  const site = await resolveCompanySiteForAccess(companyId, siteId, user, companyAccess);
  const selections = await prisma.companyGhgActivitySelection.findMany({
    where: {
      companyId,
      siteId: site.id,
      reportingYearId,
      isEnabled: true
    },
    orderBy: [
      {
        ghgActivity: {
          sourceSheet: "asc"
        }
      },
      {
        ghgActivity: {
          sortOrder: "asc"
        }
      }
    ],
    include: {
      ghgActivity: {
        include: {
          category: {
            select: {
              id: true,
              name: true,
              sourceSheet: true
            }
          }
        }
      }
    }
  });

  return {
    site: {
      id: site.id,
      name: site.name,
      type: site.type,
      city: site.city,
      state: site.state,
      country: site.country,
      isPrimary: site.isPrimary
    },
    reportingYear: toReportingYearSummary(reportingYear),
    selectedActivities: selections.map(toSelectedActivityResponse)
  };
}

export async function replaceCompanyGhgActivitySelections(
  companyId: string,
  siteId: string | undefined,
  reportingYearId: string,
  input: UpdateGhgActivitySelectionsInput,
  actorUserId: string,
  user: AuthenticatedUserContext,
  companyAccess: CompanyAccessContext
) {
  await getReportingYear(companyId, reportingYearId);
  const site = await resolveCompanySiteForAccess(companyId, siteId, user, companyAccess);

  const activityIds = [...new Set(input.activityIds)];
  const hasVendorTracking = Object.values(input.vendorTrackingModes).some(
    (mode) => mode !== VendorTrackingMode.NONE
  );

  if (hasVendorTracking) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { vendorTrackingEnabled: true }
    });

    if (!company?.vendorTrackingEnabled) {
      throw new AppError(
        "Enable vendor tracking in company settings before assigning vendor activities",
        400,
        "VENDOR_TRACKING_NOT_ENABLED"
      );
    }
  }
  const activities = await prisma.ghgActivity.findMany({
    where: {
      id: {
        in: activityIds
      },
      isActive: true,
      category: {
        isActive: true
      }
    },
    select: {
      id: true
    }
  });

  if (activities.length !== activityIds.length) {
    throw new AppError("One or more GHG activities are invalid", 400, "GHG_ACTIVITY_INVALID");
  }

  const existingSelections = await prisma.companyGhgActivitySelection.findMany({
    where: {
      companyId,
      siteId: site.id,
      reportingYearId,
      isEnabled: true
    },
    select: {
      ghgActivityId: true,
      vendorTrackingMode: true
    }
  });
  const beforeActivityIds = existingSelections.map((selection) => selection.ghgActivityId);
  const currentTime = now();

  await prisma.$transaction(async (tx) => {
    if (activityIds.length === 0) {
      await tx.companyGhgActivitySelection.updateMany({
        where: {
          companyId,
          siteId: site.id,
          reportingYearId,
          isEnabled: true
        },
        data: {
          isEnabled: false,
          disabledAt: currentTime
        }
      });
    } else {
      await tx.companyGhgActivitySelection.updateMany({
        where: {
          companyId,
          siteId: site.id,
          reportingYearId,
          isEnabled: true,
          ghgActivityId: {
            notIn: activityIds
          }
        },
        data: {
          isEnabled: false,
          disabledAt: currentTime
        }
      });
    }

    for (const activityId of activityIds) {
      await tx.companyGhgActivitySelection.upsert({
        where: {
          reportingYearId_siteId_ghgActivityId: {
            reportingYearId,
            siteId: site.id,
            ghgActivityId: activityId
          }
        },
        update: {
          companyId,
          siteId: site.id,
          isEnabled: true,
          disabledAt: null,
          selectedAt: currentTime,
          selectedByUserId: actorUserId,
          vendorTrackingMode:
            input.vendorTrackingModes[activityId] ?? VendorTrackingMode.NONE
        },
        create: {
          companyId,
          siteId: site.id,
          reportingYearId,
          ghgActivityId: activityId,
          selectedAt: currentTime,
          selectedByUserId: actorUserId,
          vendorTrackingMode:
            input.vendorTrackingModes[activityId] ?? VendorTrackingMode.NONE
        }
      });
    }

    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId,
        action: "GHG_ACTIVITY_SELECTIONS_UPDATED",
        entityType: "reporting_year",
        entityId: reportingYearId,
        beforeJson: {
          activityIds: beforeActivityIds,
          vendorTrackingModes: Object.fromEntries(
            existingSelections.map((selection) => [
              selection.ghgActivityId,
              selection.vendorTrackingMode
            ])
          ),
          siteId: site.id,
          count: beforeActivityIds.length
        },
        afterJson: {
          activityIds,
          vendorTrackingModes: input.vendorTrackingModes,
          siteId: site.id,
          count: activityIds.length
        }
      }
    });
  });

  return listCompanyGhgActivitySelections(companyId, site.id, reportingYearId, user, companyAccess);
}
