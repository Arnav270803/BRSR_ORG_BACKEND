import { z } from "zod";

export const updateGhgActivitySelectionsSchema = z
  .object({
    activityIds: z.array(z.string().uuid()).max(1000, "At most 1000 activities can be selected at once")
  })
  .superRefine((value, ctx) => {
    const uniqueIds = new Set(value.activityIds);

    if (uniqueIds.size !== value.activityIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activityIds"],
        message: "Activity IDs must be unique"
      });
    }
  });

export type UpdateGhgActivitySelectionsInput = z.infer<typeof updateGhgActivitySelectionsSchema>;
