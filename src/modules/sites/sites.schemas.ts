import { CompanySiteType } from "@prisma/client";
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const createCompanySiteSchema = z.object({
  name: z.string().trim().min(1, "Site name is required"),
  type: z.nativeEnum(CompanySiteType).default(CompanySiteType.OTHER),
  country: z.string().trim().min(1, "Country is required"),
  state: z.string().trim().min(1, "State is required"),
  city: z.string().trim().min(1, "City is required"),
  address: optionalText,
  isPrimary: z.boolean().optional()
});

export const updateCompanySiteSchema = createCompanySiteSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  "At least one site field is required"
);

export const updateCompanySiteMembershipSchema = z.object({
  siteIds: z.array(z.string().uuid()).default([])
});

export type CreateCompanySiteInput = z.infer<typeof createCompanySiteSchema>;
export type UpdateCompanySiteInput = z.infer<typeof updateCompanySiteSchema>;
export type UpdateCompanySiteMembershipInput = z.infer<
  typeof updateCompanySiteMembershipSchema
>;
