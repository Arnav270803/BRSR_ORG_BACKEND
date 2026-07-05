import type { Prisma } from "@prisma/client";

import { prisma } from "../../infra/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { toIsoDate } from "../../shared/utils/date.js";

type ReportRecord = {
  id: string;
  recordDate: string;
  activity: string;
  category: string;
  scope: string | null;
  quantity: string;
  unit: string;
  factorKgCo2e: string | null;
  calculatedKgCo2e: string | null;
  createdBy: string;
  notes: string | null;
};

type TotalsRow = {
  name: string;
  recordCount: number;
  totalKgCo2e: string;
};

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  if (!value) {
    return 0;
  }

  return Number(value.toString());
}

function formatDecimal(value: number) {
  return value.toFixed(3).replace(/\.?0+$/, "");
}

function uniqueTextParts(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();

  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .filter((part) => {
      const key = part.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function getActivityLabel(activity: {
  activity: string;
  subtype: string;
  variant: string;
}) {
  return uniqueTextParts([activity.activity, activity.subtype, activity.variant]).join(" - ");
}

function addTotal(
  map: Map<string, { recordCount: number; totalKgCo2e: number }>,
  key: string,
  value: number
) {
  const current = map.get(key) ?? { recordCount: 0, totalKgCo2e: 0 };

  map.set(key, {
    recordCount: current.recordCount + 1,
    totalKgCo2e: current.totalKgCo2e + value
  });
}

function mapTotals(map: Map<string, { recordCount: number; totalKgCo2e: number }>): TotalsRow[] {
  return [...map.entries()]
    .map(([name, total]) => ({
      name,
      recordCount: total.recordCount,
      totalKgCo2e: formatDecimal(total.totalKgCo2e)
    }))
    .sort((left, right) => Number(right.totalKgCo2e) - Number(left.totalKgCo2e));
}

export async function generateCompanyReportingYearReport(
  companyId: string,
  reportingYearId: string
) {
  const reportingYear = await prisma.reportingYear.findFirst({
    where: {
      id: reportingYearId,
      companyId,
      isActive: true
    },
    include: {
      company: true,
      ghgActivitySelections: {
        where: {
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
              category: true
            }
          }
        }
      },
      dataRecords: {
        where: {
          deletedAt: null
        },
        orderBy: [{ recordDate: "asc" }, { createdAt: "asc" }],
        include: {
          createdBy: {
            select: {
              email: true,
              name: true
            }
          },
          ghgActivity: {
            include: {
              category: true
            }
          }
        }
      }
    }
  });

  if (!reportingYear) {
    throw new AppError("Reporting year not found", 404, "REPORTING_YEAR_NOT_FOUND");
  }

  const selectedActivities = reportingYear.ghgActivitySelections.map((selection) => {
    const activity = selection.ghgActivity;

    return {
      selectionId: selection.id,
      activityId: activity.id,
      activity: getActivityLabel(activity),
      category: activity.category.name,
      scope: activity.scope,
      unit: activity.unit,
      factorKgCo2e: activity.factorKgCo2e?.toString() ?? null,
      sourceSheet: activity.sourceSheet,
      sourceYear: activity.sourceYear,
      sourceRow: activity.sourceRow
    };
  });
  const records: ReportRecord[] = reportingYear.dataRecords.map((record) => ({
    id: record.id,
    recordDate: toIsoDate(record.recordDate),
    activity: getActivityLabel(record.ghgActivity),
    category: record.ghgActivity.category.name,
    scope: record.ghgActivity.scope,
    quantity: record.quantity.toString(),
    unit: record.unit,
    factorKgCo2e: record.factorKgCo2e?.toString() ?? null,
    calculatedKgCo2e: record.calculatedKgCo2e?.toString() ?? null,
    createdBy: record.createdBy.name ?? record.createdBy.email,
    notes: record.notes
  }));
  const totalsByScope = new Map<string, { recordCount: number; totalKgCo2e: number }>();
  const totalsByCategory = new Map<string, { recordCount: number; totalKgCo2e: number }>();
  const totalsByActivity = new Map<string, { recordCount: number; totalKgCo2e: number }>();
  let totalKgCo2e = 0;

  for (const record of reportingYear.dataRecords) {
    const calculatedKgCo2e = decimalToNumber(record.calculatedKgCo2e);
    const activityName = getActivityLabel(record.ghgActivity);

    totalKgCo2e += calculatedKgCo2e;
    addTotal(totalsByScope, record.ghgActivity.scope ?? "Scope not set", calculatedKgCo2e);
    addTotal(totalsByCategory, record.ghgActivity.category.name, calculatedKgCo2e);
    addTotal(totalsByActivity, activityName, calculatedKgCo2e);
  }

  return {
    generatedAt: new Date().toISOString(),
    company: {
      id: reportingYear.company.id,
      displayName: reportingYear.company.displayName,
      legalName: reportingYear.company.legalName,
      primaryDomain: reportingYear.company.primaryDomain,
      industry: reportingYear.company.industry,
      location: `${reportingYear.company.city}, ${reportingYear.company.state}, ${reportingYear.company.country}`,
      financialYearStartMonth: reportingYear.company.financialYearStartMonth
    },
    reportingYear: {
      id: reportingYear.id,
      label: reportingYear.label,
      startDate: toIsoDate(reportingYear.startDate),
      endDate: toIsoDate(reportingYear.endDate),
      setupStatus: selectedActivities.length > 0 ? "Ready" : "Needs GHG activity setup"
    },
    ghgActivitySetup: {
      selectedActivityCount: selectedActivities.length,
      selectedActivities
    },
    emissionSummary: {
      recordCount: records.length,
      totalKgCo2e: formatDecimal(totalKgCo2e),
      totalsByScope: mapTotals(totalsByScope),
      totalsByCategory: mapTotals(totalsByCategory),
      totalsByActivity: mapTotals(totalsByActivity)
    },
    dataRecords: records,
    methodology: {
      formula: "quantity x emission factor",
      note: "Emission totals are calculated from submitted data records using the stored GHG factor catalog in the database."
    },
    limitations: [
      "Evidence uploads are not included in this V1 report.",
      "Approval workflow and final statutory BRSR filing format can be added later.",
      "This report reflects active, non-deleted records at generation time."
    ]
  };
}
