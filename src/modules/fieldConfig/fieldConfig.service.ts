import type { Prisma } from "@prisma/client";

import { prisma } from "../../infra/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { now, toIsoDate } from "../../shared/utils/date.js";
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
  customLabel: string | null;
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
    customLabel: selection.customLabel,
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

export async function listCompanyGhgActivitySelections(companyId: string, reportingYearId: string) {
  const reportingYear = await getReportingYear(companyId, reportingYearId);
  const selections = await prisma.companyGhgActivitySelection.findMany({
    where: {
      companyId,
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
    reportingYear: toReportingYearSummary(reportingYear),
    selectedActivities: selections.map(toSelectedActivityResponse)
  };
}

export async function replaceCompanyGhgActivitySelections(
  companyId: string,
  reportingYearId: string,
  input: UpdateGhgActivitySelectionsInput,
  actorUserId: string
) {
  await getReportingYear(companyId, reportingYearId);

  const activityIds = [...new Set(input.activityIds)];
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
      reportingYearId,
      isEnabled: true
    },
    select: {
      ghgActivityId: true
    }
  });
  const beforeActivityIds = existingSelections.map((selection) => selection.ghgActivityId);
  const currentTime = now();

  await prisma.$transaction(async (tx) => {
    if (activityIds.length === 0) {
      await tx.companyGhgActivitySelection.updateMany({
        where: {
          companyId,
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
          reportingYearId_ghgActivityId: {
            reportingYearId,
            ghgActivityId: activityId
          }
        },
        update: {
          companyId,
          isEnabled: true,
          disabledAt: null,
          selectedAt: currentTime,
          selectedByUserId: actorUserId
        },
        create: {
          companyId,
          reportingYearId,
          ghgActivityId: activityId,
          selectedAt: currentTime,
          selectedByUserId: actorUserId
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
          count: beforeActivityIds.length
        },
        afterJson: {
          activityIds,
          count: activityIds.length
        }
      }
    });
  });

  return listCompanyGhgActivitySelections(companyId, reportingYearId);
}
