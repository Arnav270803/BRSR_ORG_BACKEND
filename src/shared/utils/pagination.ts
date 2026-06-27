import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants.js";

type RawPaginationInput = {
  page?: number | string | null;
  pageSize?: number | string | null;
};

export type Pagination = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

function toPositiveInteger(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

export function getPagination(input: RawPaginationInput = {}): Pagination {
  const page = toPositiveInteger(input.page) ?? 1;
  const requestedPageSize = toPositiveInteger(input.pageSize) ?? DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

export function getPaginationMeta(totalItems: number, pagination: Pagination) {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalItems,
    totalPages: Math.ceil(totalItems / pagination.pageSize)
  };
}
