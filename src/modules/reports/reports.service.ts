import { Prisma } from "@prisma/client";

import { prisma } from "../../infra/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuthenticatedUserContext, CompanyAccessContext } from "../../shared/types.js";
import { toIsoDate } from "../../shared/utils/date.js";
import { getEmissionsSummaryForContext } from "../emissionsSummary/emissionsSummary.service.js";
import { resolveCompanySiteForAccess } from "../sites/sites.service.js";

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

function formatDecimal(value: Prisma.Decimal) {
  return value.toFixed(10).replace(/(?:\.0+|(\.\d*?[1-9])0+)$/, "$1");
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
  map: Map<string, { recordCount: number; totalKgCo2e: Prisma.Decimal }>,
  key: string,
  value: Prisma.Decimal | null
) {
  const current = map.get(key) ?? {
    recordCount: 0,
    totalKgCo2e: new Prisma.Decimal(0)
  };

  map.set(key, {
    recordCount: current.recordCount + 1,
    totalKgCo2e: current.totalKgCo2e.add(value ?? 0)
  });
}

function mapTotals(
  map: Map<string, { recordCount: number; totalKgCo2e: Prisma.Decimal }>
): TotalsRow[] {
  return [...map.entries()]
    .map(([name, total]) => ({
      name,
      recordCount: total.recordCount,
      totalKgCo2e: formatDecimal(total.totalKgCo2e)
    }))
    .sort((left, right) =>
      new Prisma.Decimal(right.totalKgCo2e).comparedTo(new Prisma.Decimal(left.totalKgCo2e))
    );
}

export async function generateCompanyReportingYearReport(
  companyId: string,
  siteId: string | undefined,
  reportingYearId: string,
  user: AuthenticatedUserContext,
  companyAccess: CompanyAccessContext
) {
  const site = await resolveCompanySiteForAccess(companyId, siteId, user, companyAccess);
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
          siteId: site.id,
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
          siteId: site.id,
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
    scope: record.scope ?? record.ghgActivity.scope,
    quantity: record.quantity.toString(),
    unit: record.unit,
    factorKgCo2e: record.factorKgCo2e?.toString() ?? null,
    calculatedKgCo2e: record.calculatedKgCo2e?.toString() ?? null,
    createdBy: record.createdBy.name ?? record.createdBy.email,
    notes: record.notes
  }));
  const totalsByActivity = new Map<
    string,
    { recordCount: number; totalKgCo2e: Prisma.Decimal }
  >();

  for (const record of reportingYear.dataRecords) {
    const activityName = getActivityLabel(record.ghgActivity);

    addTotal(totalsByActivity, activityName, record.calculatedKgCo2e);
  }
  const emissionsSummary = await getEmissionsSummaryForContext(
    companyId,
    reportingYearId,
    site.id
  );

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
    site: {
      id: site.id,
      name: site.name,
      type: site.type,
      country: site.country,
      state: site.state,
      city: site.city,
      address: site.address,
      isPrimary: site.isPrimary
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
      recordCount: emissionsSummary.coverage.totalRecords,
      calculatedRecordCount: emissionsSummary.coverage.calculatedRecords,
      uncalculatedRecordCount: emissionsSummary.coverage.uncalculatedRecords,
      calculationCoveragePercent: emissionsSummary.coverage.calculationCoveragePercent,
      totalKgCo2e: emissionsSummary.totals.grossKgCo2e,
      outsideScopesKgCo2e: emissionsSummary.totals.outsideScopesKgCo2e,
      unclassifiedKgCo2e: emissionsSummary.totals.unclassifiedKgCo2e,
      totalsByScope: emissionsSummary.scopes
        .filter((scope) => scope.recordCount > 0)
        .map((scope) => ({
          name: scope.label,
          recordCount: scope.recordCount,
          totalKgCo2e: scope.totalKgCo2e
        })),
      totalsByCategory: emissionsSummary.categories.map((category) => ({
        name: category.name,
        recordCount: category.recordCount,
        totalKgCo2e: category.totalKgCo2e
      })),
      totalsByActivity: mapTotals(totalsByActivity)
    },
    dataRecords: records,
    methodology: {
      formula: "quantity x emission factor",
      note: "Gross emissions include Scope 1, Scope 2, and Scope 3 records calculated from the factor snapshot stored with each submitted data record. Outside-scope and unclassified values are reported separately."
    },
    limitations: [
      "Evidence uploads are not included in this V1 report.",
      "Approval workflow and final statutory BRSR filing format can be added later.",
      "Records without a conversion factor are counted but excluded from calculated emission totals.",
      "This report reflects active, non-deleted records at generation time."
    ]
  };
}
