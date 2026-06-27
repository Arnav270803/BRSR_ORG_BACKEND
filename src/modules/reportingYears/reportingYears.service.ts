import { Prisma } from "@prisma/client";

import { prisma } from "../../infra/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { toIsoDate } from "../../shared/utils/date.js";
import type { CreateReportingYearInput } from "./reportingYears.schemas.js";

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toReportingYearResponse(reportingYear: {
  id: string;
  companyId: string;
  label: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    ghgActivitySelections: number;
  };
}) {
  return {
    id: reportingYear.id,
    companyId: reportingYear.companyId,
    label: reportingYear.label,
    startDate: toIsoDate(reportingYear.startDate),
    endDate: toIsoDate(reportingYear.endDate),
    isActive: reportingYear.isActive,
    selectedGhgActivityCount: reportingYear._count?.ghgActivitySelections ?? 0,
    createdAt: reportingYear.createdAt.toISOString(),
    updatedAt: reportingYear.updatedAt.toISOString()
  };
}

export async function listReportingYears(companyId: string) {
  const reportingYears = await prisma.reportingYear.findMany({
    where: {
      companyId,
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
  });

  return reportingYears.map(toReportingYearResponse);
}

export async function createReportingYear(
  companyId: string,
  input: CreateReportingYearInput,
  actorUserId: string
) {
  const startDate = toDateOnly(input.startDate);
  const endDate = toDateOnly(input.endDate);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reportingYear = await tx.reportingYear.create({
        data: {
          companyId,
          label: input.label,
          startDate,
          endDate
        }
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorUserId,
          action: "REPORTING_YEAR_CREATED",
          entityType: "reporting_year",
          entityId: reportingYear.id,
          afterJson: {
            reportingYearId: reportingYear.id,
            label: reportingYear.label,
            startDate: input.startDate,
            endDate: input.endDate
          }
        }
      });

      return reportingYear;
    });

    return toReportingYearResponse(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("Reporting year already exists for this company", 409, "REPORTING_YEAR_EXISTS");
    }

    throw error;
  }
}
