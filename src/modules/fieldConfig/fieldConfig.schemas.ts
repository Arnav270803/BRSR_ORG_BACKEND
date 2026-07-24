import { z } from "zod";
import { VendorTrackingMode } from "@prisma/client";

export const updateGhgActivitySelectionsSchema = z
  .object({
    activityIds: z.array(z.string().uuid()).max(1000, "At most 1000 activities can be selected at once"),
    vendorTrackingModes: z.record(z.nativeEnum(VendorTrackingMode)).optional().default({})
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

    const activityIds = new Set(value.activityIds);

    for (const activityId of Object.keys(value.vendorTrackingModes)) {
      if (!activityIds.has(activityId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["vendorTrackingModes", activityId],
          message: "Vendor tracking can only be configured for a selected activity"
        });
      }
    }
  });

export type UpdateGhgActivitySelectionsInput = z.infer<typeof updateGhgActivitySelectionsSchema>;
