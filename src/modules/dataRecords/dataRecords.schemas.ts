import { z } from "zod";

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Date must be a valid calendar date");

const metadataSchema = z.record(
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);

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

export const createDataRecordSchema = z.object({
  ghgActivitySelectionId: z.string().uuid(),
  recordDate: dateOnlySchema,
  quantity: z.number().positive("Quantity must be greater than zero").finite(),
  notes: z.string().trim().max(2000).optional(),
  metadata: metadataSchema.optional()
});

export const listDataRecordsQuerySchema = z.object({
  ghgActivitySelectionId: optionalQueryString,
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

export type CreateDataRecordInput = z.infer<typeof createDataRecordSchema>;
export type ListDataRecordsQuery = z.infer<typeof listDataRecordsQuerySchema>;
