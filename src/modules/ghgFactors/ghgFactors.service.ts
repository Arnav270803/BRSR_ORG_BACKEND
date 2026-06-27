import type { Prisma } from "@prisma/client";

import { prisma } from "../../infra/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import { getPagination, getPaginationMeta } from "../../shared/utils/pagination.js";
import type { ListGhgActivitiesQuery } from "./ghgFactors.schemas.js";

function toCategoryResponse(category: {
  id: string;
  name: string;
  sourceSheet: string;
  scope: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: {
    activities: number;
  };
}) {
  return {
    id: category.id,
    name: category.name,
    sourceSheet: category.sourceSheet,
    scope: category.scope,
    description: category.description,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    activityCount: category._count?.activities
  };
}

function toActivityResponse(activity: {
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
  sortOrder: number;
  isActive: boolean;
  category?: {
    id: string;
    name: string;
    sourceSheet: string;
  };
}) {
  return {
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
    factorData: activity.factorData,
    sortOrder: activity.sortOrder,
    isActive: activity.isActive
  };
}

export async function listGhgCategories() {
  const categories = await prisma.ghgCategory.findMany({
    where: {
      isActive: true
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          activities: {
            where: {
              isActive: true
            }
          }
        }
      }
    }
  });

  return categories.map(toCategoryResponse);
}

export async function listGhgActivities(input: ListGhgActivitiesQuery) {
  const pagination = getPagination({
    page: input.page ?? null,
    pageSize: input.pageSize ?? null
  });
  const where: Prisma.GhgActivityWhereInput = {
    isActive: true,
    category: {
      isActive: true
    }
  };

  if (input.categoryId) {
    where.categoryId = input.categoryId;
  }

  if (input.scope) {
    where.scope = {
      equals: input.scope,
      mode: "insensitive"
    };
  }

  if (input.search) {
    where.OR = [
      { activity: { contains: input.search, mode: "insensitive" } },
      { subtype: { contains: input.search, mode: "insensitive" } },
      { variant: { contains: input.search, mode: "insensitive" } },
      { unit: { contains: input.search, mode: "insensitive" } },
      { sourceSheet: { contains: input.search, mode: "insensitive" } }
    ];
  }

  const [activities, totalItems] = await prisma.$transaction([
    prisma.ghgActivity.findMany({
      where,
      orderBy: [{ sourceSheet: "asc" }, { sortOrder: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            sourceSheet: true
          }
        }
      }
    }),
    prisma.ghgActivity.count({ where })
  ]);

  return {
    data: activities.map(toActivityResponse),
    meta: getPaginationMeta(totalItems, pagination)
  };
}

export async function listGhgActivitiesByCategory(categoryId: string, input: ListGhgActivitiesQuery) {
  const category = await prisma.ghgCategory.findFirst({
    where: {
      id: categoryId,
      isActive: true
    },
    select: {
      id: true
    }
  });

  if (!category) {
    throw new AppError("GHG category not found", 404, "GHG_CATEGORY_NOT_FOUND");
  }

  return listGhgActivities({
    ...input,
    categoryId
  });
}
