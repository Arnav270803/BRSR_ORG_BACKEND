import { Prisma } from "@prisma/client";

import { prisma } from "../../infra/prisma/client.js";
import { COMPANY_ROLES } from "../../shared/constants.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuthenticatedUserContext, CompanyAccessContext } from "../../shared/types.js";
import { now, toIsoDate } from "../../shared/utils/date.js";
import { getPagination, getPaginationMeta } from "../../shared/utils/pagination.js";
import { resolveCompanySiteForAccess } from "../sites/sites.service.js";
import type { CreateDataRecordInput, ListDataRecordsQuery } from "./dataRecords.schemas.js";

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function calculateEmissions(quantity: Prisma.Decimal, factor: Prisma.Decimal | null) {
  if (!factor) {
    return null;
  }

  return quantity.mul(factor);
}

function toDataRecordResponse(record: {
  id: string;
  companyId: string;
  siteId: string;
  reportingYearId: string;
  ghgActivitySelectionId: string;
  ghgActivityId: string;
  recordDate: Date;
  quantity: Prisma.Decimal;
  unit: string;
  factorKgCo2e: Prisma.Decimal | null;
  calculatedKgCo2e: Prisma.Decimal | null;
  notes: string | null;
  metadata: Prisma.JsonValue | null;
  createdByUserId: string;
  deletedByUserId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ghgActivity?: {
    id: string;
    activity: string;
    subtype: string;
    variant: string;
    scope: string | null;
    sourceSheet: string;
    category: {
      id: string;
      name: string;
    };
  };
  createdBy?: {
    id: string;
    email: string;
    name: string | null;
  };
}) {
  return {
    id: record.id,
    companyId: record.companyId,
    siteId: record.siteId,
    reportingYearId: record.reportingYearId,
    ghgActivitySelectionId: record.ghgActivitySelectionId,
    ghgActivityId: record.ghgActivityId,
    recordDate: toIsoDate(record.recordDate),
    quantity: record.quantity.toString(),
    unit: record.unit,
    factorKgCo2e: record.factorKgCo2e?.toString() ?? null,
    calculatedKgCo2e: record.calculatedKgCo2e?.toString() ?? null,
    notes: record.notes,
    metadata: record.metadata,
    createdByUserId: record.createdByUserId,
    createdBy: record.createdBy,
    deletedByUserId: record.deletedByUserId,
    deletedAt: record.deletedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    ghgActivity: record.ghgActivity
      ? {
          id: record.ghgActivity.id,
          category: record.ghgActivity.category,
          sourceSheet: record.ghgActivity.sourceSheet,
          scope: record.ghgActivity.scope,
          activity: record.ghgActivity.activity,
          subtype: record.ghgActivity.subtype || null,
          variant: record.ghgActivity.variant || null
        }
      : undefined
  };
}

async function getActiveReportingYear(companyId: string, reportingYearId: string) {
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

  return reportingYear;
}

export async function createDataRecord(
  companyId: string,
  siteId: string | undefined,
  reportingYearId: string,
  input: CreateDataRecordInput,
  user: AuthenticatedUserContext,
  companyAccess: CompanyAccessContext
) {
  await getActiveReportingYear(companyId, reportingYearId);
  const site = await resolveCompanySiteForAccess(companyId, siteId, user, companyAccess);

  const selection = await prisma.companyGhgActivitySelection.findFirst({
    where: {
      id: input.ghgActivitySelectionId,
      companyId,
      siteId: site.id,
      reportingYearId,
      isEnabled: true
    },
    include: {
      ghgActivity: true
    }
  });

  if (!selection) {
    throw new AppError(
      "GHG activity is not selected for this reporting year",
      400,
      "GHG_ACTIVITY_NOT_SELECTED"
    );
  }

  const quantity = new Prisma.Decimal(input.quantity.toString());
  const factorKgCo2e = selection.ghgActivity.factorKgCo2e;
  const calculatedKgCo2e = calculateEmissions(quantity, factorKgCo2e);

  const result = await prisma.$transaction(async (tx) => {
    const dataRecord = await tx.dataRecord.create({
      data: {
        companyId,
        siteId: site.id,
        reportingYearId,
        ghgActivitySelectionId: selection.id,
        ghgActivityId: selection.ghgActivityId,
        recordDate: toDateOnly(input.recordDate),
        quantity,
        unit: selection.ghgActivity.unit,
        factorKgCo2e,
        calculatedKgCo2e,
        notes: input.notes ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
        createdByUserId: user.id
      },
      include: {
        ghgActivity: {
          include: {
            category: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId: user.id,
        action: "DATA_RECORD_CREATED",
        entityType: "data_record",
        entityId: dataRecord.id,
        afterJson: {
          dataRecordId: dataRecord.id,
          reportingYearId,
          siteId: site.id,
          ghgActivitySelectionId: selection.id,
          ghgActivityId: selection.ghgActivityId,
          quantity: quantity.toString(),
          unit: selection.ghgActivity.unit,
          factorKgCo2e: factorKgCo2e?.toString() ?? null,
          calculatedKgCo2e: calculatedKgCo2e?.toString() ?? null
        }
      }
    });

    return dataRecord;
  });

  return toDataRecordResponse(result);
}

export async function listDataRecords(
  companyId: string,
  siteId: string | undefined,
  reportingYearId: string,
  input: ListDataRecordsQuery,
  user: AuthenticatedUserContext,
  companyAccess: CompanyAccessContext
) {
  await getActiveReportingYear(companyId, reportingYearId);
  const site = await resolveCompanySiteForAccess(companyId, siteId, user, companyAccess);

  const pagination = getPagination({
    page: input.page ?? null,
    pageSize: input.pageSize ?? null
  });
  const where: Prisma.DataRecordWhereInput = {
    companyId,
    siteId: site.id,
    reportingYearId,
    deletedAt: null
  };

  if (input.ghgActivitySelectionId) {
    where.ghgActivitySelectionId = input.ghgActivitySelectionId;
  }

  const [records, totalItems] = await prisma.$transaction([
    prisma.dataRecord.findMany({
      where,
      orderBy: [{ recordDate: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
      include: {
        ghgActivity: {
          include: {
            category: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    }),
    prisma.dataRecord.count({ where })
  ]);

  return {
    data: records.map(toDataRecordResponse),
    meta: getPaginationMeta(totalItems, pagination)
  };
}

export async function softDeleteDataRecord(
  companyId: string,
  siteId: string | undefined,
  reportingYearId: string,
  dataRecordId: string,
  user: AuthenticatedUserContext,
  companyAccess: CompanyAccessContext
) {
  await getActiveReportingYear(companyId, reportingYearId);
  const site = await resolveCompanySiteForAccess(companyId, siteId, user, companyAccess);

  const dataRecord = await prisma.dataRecord.findFirst({
    where: {
      id: dataRecordId,
      companyId,
      siteId: site.id,
      reportingYearId,
      deletedAt: null
    }
  });

  if (!dataRecord) {
    throw new AppError("Data record not found", 404, "DATA_RECORD_NOT_FOUND");
  }

  if (companyAccess.role === COMPANY_ROLES.USER && dataRecord.createdByUserId !== user.id) {
    throw new AppError("Users can delete only their own records", 403, "DATA_RECORD_DELETE_DENIED");
  }

  const deletedAt = now();
  const result = await prisma.$transaction(async (tx) => {
    const deletedRecord = await tx.dataRecord.update({
      where: {
        id: dataRecord.id
      },
      data: {
        deletedAt,
        deletedByUserId: user.id
      },
      include: {
        ghgActivity: {
          include: {
            category: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId: user.id,
        action: "DATA_RECORD_DELETED",
        entityType: "data_record",
        entityId: dataRecord.id,
        beforeJson: {
          dataRecordId: dataRecord.id,
          createdByUserId: dataRecord.createdByUserId,
          quantity: dataRecord.quantity.toString(),
          calculatedKgCo2e: dataRecord.calculatedKgCo2e?.toString() ?? null
        },
        afterJson: {
          deletedAt: deletedAt.toISOString(),
          deletedByUserId: user.id
        }
      }
    });

    return deletedRecord;
  });

  return toDataRecordResponse(result);
}
