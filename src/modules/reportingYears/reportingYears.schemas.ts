import { z } from "zod";

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Date must be a valid calendar date");

export const createReportingYearSchema = z
  .object({
    label: z.string().trim().min(1, "Reporting year label is required").max(80),
    startDate: dateOnlySchema,
    endDate: dateOnlySchema
  })
  .superRefine((value, ctx) => {
    if (value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after start date"
      });
    }
  });

export type CreateReportingYearInput = z.infer<typeof createReportingYearSchema>;
