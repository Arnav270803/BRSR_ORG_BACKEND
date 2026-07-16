import { Prisma } from "@prisma/client";

import { prisma } from "../../infra/prisma/client.js";
import { COMPANY_ROLES } from "../../shared/constants.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuthenticatedUserContext, CompanyAccessContext } from "../../shared/types.js";
import { resolveCompanySiteForAccess } from "../sites/sites.service.js";

export const EMISSIONS_SCOPE_KEYS = [
  "SCOPE_1",
  "SCOPE_2",
  "SCOPE_3",
  "OUTSIDE_SCOPES",
  "UNCLASSIFIED"
] as const;

export type EmissionsScopeKey = (typeof EMISSIONS_SCOPE_KEYS)[number];

type AggregateNumber = Prisma.Decimal | string | number | null;
type AggregateCount = bigint | number;

export type ScopeAggregateRow = {
  scope: string | null;
  recordCount: AggregateCount;
  calculatedRecordCount: AggregateCount;
  totalKgCo2e: AggregateNumber;
};

export type CategoryAggregateRow = {
  name: string;
  recordCount: AggregateCount;
  calculatedRecordCount: AggregateCount;
  totalKgCo2e: AggregateNumber;
};

export type CoverageAggregateRow = {
  totalRecords: AggregateCount;
  calculatedRecords: AggregateCount;
  lastUpdatedAt: Date | string | null;
};

type EmissionsSummaryContext = {
  companyId: string;
  siteId: string | null;
  reportingYearId: string;
};

const scopeLabels: Record<EmissionsScopeKey, string> = {
  SCOPE_1: "Scope 1",
  SCOPE_2: "Scope 2",
  SCOPE_3: "Scope 3",
  OUTSIDE_SCOPES: "Outside scopes",
  UNCLASSIFIED: "Unclassified"
};

function toCount(value: AggregateCount) {
  return Number(value);
}

function toDecimal(value: AggregateNumber) {
  if (value === null) {
    return new Prisma.Decimal(0);
  }

  return new Prisma.Decimal(value.toString());
}

function toDecimalString(value: Prisma.Decimal) {
  return value.toFixed(10).replace(/(?:\.0+|(\.\d*?[1-9])0+)$/, "$1");
}

export function normalizeEmissionsScope(scope: string | null | undefined): EmissionsScopeKey {
  if (!scope?.trim()) {
    return "UNCLASSIFIED";
  }

  const compact = scope.toUpperCase().replace(/[^A-Z0-9]+/g, "");

  if (
    compact.includes("OUTSIDEOFSCOPE") ||
    compact.includes("OUTSIDESCOPE") ||
    compact.includes("OUTOFSCOPE") ||
    compact.includes("BIOGENIC")
  ) {
    return "OUTSIDE_SCOPES";
  }

  if (compact.includes("SCOPE1")) {
    return "SCOPE_1";
  }

  if (compact.includes("SCOPE2")) {
    return "SCOPE_2";
  }

  if (compact.includes("SCOPE3")) {
    return "SCOPE_3";
  }

  return "UNCLASSIFIED";
}

export function buildEmissionsSummary({
  categoryRows,
  context,
  coverageRow,
  scopeRows
}: {
  categoryRows: CategoryAggregateRow[];
  context: EmissionsSummaryContext;
  coverageRow?: CoverageAggregateRow;
  scopeRows: ScopeAggregateRow[];
}) {
  const scopeTotals = new Map<
    EmissionsScopeKey,
    { recordCount: number; calculatedRecordCount: number; totalKgCo2e: Prisma.Decimal }
  >(
    EMISSIONS_SCOPE_KEYS.map((key) => [
      key,
      {
        recordCount: 0,
        calculatedRecordCount: 0,
        totalKgCo2e: new Prisma.Decimal(0)
      }
    ])
  );

  for (const row of scopeRows) {
    const key = normalizeEmissionsScope(row.scope);
    const current = scopeTotals.get(key)!;

    current.recordCount += toCount(row.recordCount);
    current.calculatedRecordCount += toCount(row.calculatedRecordCount);
    current.totalKgCo2e = current.totalKgCo2e.add(toDecimal(row.totalKgCo2e));
  }

  const scopes = EMISSIONS_SCOPE_KEYS.map((key) => {
    const total = scopeTotals.get(key)!;

    return {
      key,
      label: scopeLabels[key],
      recordCount: total.recordCount,
      calculatedRecordCount: total.calculatedRecordCount,
      uncalculatedRecordCount: total.recordCount - total.calculatedRecordCount,
      totalKgCo2e: toDecimalString(total.totalKgCo2e)
    };
  });
  const getScopeTotal = (key: EmissionsScopeKey) => scopeTotals.get(key)!.totalKgCo2e;
  const grossKgCo2e = getScopeTotal("SCOPE_1")
    .add(getScopeTotal("SCOPE_2"))
    .add(getScopeTotal("SCOPE_3"));
  const totalRecords = coverageRow ? toCount(coverageRow.totalRecords) : 0;
  const calculatedRecords = coverageRow ? toCount(coverageRow.calculatedRecords) : 0;
  const categoryTotals = new Map<
    string,
    { recordCount: number; calculatedRecordCount: number; totalKgCo2e: Prisma.Decimal }
  >();

  for (const row of categoryRows) {
    const current = categoryTotals.get(row.name) ?? {
      recordCount: 0,
      calculatedRecordCount: 0,
      totalKgCo2e: new Prisma.Decimal(0)
    };

    current.recordCount += toCount(row.recordCount);
    current.calculatedRecordCount += toCount(row.calculatedRecordCount);
    current.totalKgCo2e = current.totalKgCo2e.add(toDecimal(row.totalKgCo2e));
    categoryTotals.set(row.name, current);
  }

  return {
    generatedAt: new Date().toISOString(),
    context: {
      ...context,
      aggregationScope: context.siteId ? ("SITE" as const) : ("COMPANY" as const)
    },
    unit: "kgCO2e" as const,
    totals: {
      grossKgCo2e: toDecimalString(grossKgCo2e),
      scope1KgCo2e: toDecimalString(getScopeTotal("SCOPE_1")),
      scope2KgCo2e: toDecimalString(getScopeTotal("SCOPE_2")),
      scope3KgCo2e: toDecimalString(getScopeTotal("SCOPE_3")),
      outsideScopesKgCo2e: toDecimalString(getScopeTotal("OUTSIDE_SCOPES")),
      unclassifiedKgCo2e: toDecimalString(getScopeTotal("UNCLASSIFIED"))
    },
    scopes,
    categories: [...categoryTotals.entries()]
      .map(([name, total]) => ({
        name,
        recordCount: total.recordCount,
        calculatedRecordCount: total.calculatedRecordCount,
        uncalculatedRecordCount: total.recordCount - total.calculatedRecordCount,
        totalKgCo2e: toDecimalString(total.totalKgCo2e)
      }))
      .sort((left, right) => {
        const totalComparison = new Prisma.Decimal(right.totalKgCo2e).comparedTo(
          new Prisma.Decimal(left.totalKgCo2e)
        );

        return totalComparison || left.name.localeCompare(right.name);
      }),
    coverage: {
      totalRecords,
      calculatedRecords,
      uncalculatedRecords: totalRecords - calculatedRecords,
      calculationCoveragePercent:
        totalRecords === 0 ? 0 : Math.round((calculatedRecords / totalRecords) * 1000) / 10,
      lastUpdatedAt: coverageRow?.lastUpdatedAt
        ? new Date(coverageRow.lastUpdatedAt).toISOString()
        : null
    }
  };
}

async function assertActiveReportingYear(companyId: string, reportingYearId: string) {
  const reportingYear = await prisma.reportingYear.findFirst({
    where: {
      id: reportingYearId,
      companyId,
      isActive: true
    },
    select: {
      id: true
    }
  });

  if (!reportingYear) {
    throw new AppError("Reporting year not found", 404, "REPORTING_YEAR_NOT_FOUND");
  }
}

export async function getEmissionsSummaryForContext(
  companyId: string,
  reportingYearId: string,
  siteId: string | null
) {
  const siteFilter = siteId ? Prisma.sql`AND dr."site_id" = ${siteId}::uuid` : Prisma.empty;
  const recordFilter = Prisma.sql`
    WHERE dr."company_id" = ${companyId}::uuid
      AND dr."reporting_year_id" = ${reportingYearId}::uuid
      AND dr."deleted_at" IS NULL
      ${siteFilter}
  `;
  const [scopeRows, categoryRows, coverageRows] = await prisma.$transaction([
    prisma.$queryRaw<ScopeAggregateRow[]>(Prisma.sql`
      SELECT
        COALESCE(dr."scope", ga."scope") AS "scope",
        COUNT(*)::bigint AS "recordCount",
        COUNT(dr."calculated_kg_co2e")::bigint AS "calculatedRecordCount",
        COALESCE(SUM(dr."calculated_kg_co2e"), 0) AS "totalKgCo2e"
      FROM "data_records" dr
      INNER JOIN "ghg_activities" ga ON ga."id" = dr."ghg_activity_id"
      ${recordFilter}
      GROUP BY COALESCE(dr."scope", ga."scope")
    `),
    prisma.$queryRaw<CategoryAggregateRow[]>(Prisma.sql`
      SELECT
        gc."name" AS "name",
        COUNT(*)::bigint AS "recordCount",
        COUNT(dr."calculated_kg_co2e")::bigint AS "calculatedRecordCount",
        COALESCE(SUM(dr."calculated_kg_co2e"), 0) AS "totalKgCo2e"
      FROM "data_records" dr
      INNER JOIN "ghg_activities" ga ON ga."id" = dr."ghg_activity_id"
      INNER JOIN "ghg_categories" gc ON gc."id" = ga."category_id"
      ${recordFilter}
      GROUP BY gc."name"
    `),
    prisma.$queryRaw<CoverageAggregateRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS "totalRecords",
        COUNT(dr."calculated_kg_co2e")::bigint AS "calculatedRecords",
        MAX(dr."updated_at") AS "lastUpdatedAt"
      FROM "data_records" dr
      ${recordFilter}
    `)
  ]);

  return buildEmissionsSummary({
    categoryRows,
    context: {
      companyId,
      siteId,
      reportingYearId
    },
    coverageRow: coverageRows[0] ?? {
      totalRecords: 0,
      calculatedRecords: 0,
      lastUpdatedAt: null
    },
    scopeRows
  });
}

export async function getEmissionsSummary(
  companyId: string,
  siteId: string | undefined,
  reportingYearId: string,
  user: AuthenticatedUserContext,
  companyAccess: CompanyAccessContext
) {
  await assertActiveReportingYear(companyId, reportingYearId);

  if (!siteId) {
    if (!user.isPlatformOwner && companyAccess.role !== COMPANY_ROLES.ADMIN) {
      throw new AppError(
        "Company-wide emissions totals require admin access",
        403,
        "EMISSIONS_SUMMARY_COMPANY_ACCESS_DENIED"
      );
    }

    return getEmissionsSummaryForContext(companyId, reportingYearId, null);
  }

  const site = await resolveCompanySiteForAccess(companyId, siteId, user, companyAccess);

  return getEmissionsSummaryForContext(companyId, reportingYearId, site.id);
}
