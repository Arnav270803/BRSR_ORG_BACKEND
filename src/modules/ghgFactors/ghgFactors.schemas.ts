import { z } from "zod";

const optionalQueryString = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().optional());

export const listGhgActivitiesQuerySchema = z.object({
  categoryId: optionalQueryString,
  scope: optionalQueryString,
  search: optionalQueryString,
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

export type ListGhgActivitiesQuery = z.infer<typeof listGhgActivitiesQuerySchema>;
