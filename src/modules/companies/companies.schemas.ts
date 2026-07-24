import { CompanySiteType } from "@prisma/client";
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const createCompanySchema = z.object({
  legalName: z.string().trim().min(1, "Legal company name is required"),
  displayName: z.string().trim().min(1, "Display name is required"),
  primaryDomain: z.string().trim().toLowerCase().min(1, "Primary domain is required"),
  industry: z.string().trim().min(1, "Industry is required"),
  country: z.string().trim().min(1, "Country is required"),
  state: z.string().trim().min(1, "State is required"),
  city: z.string().trim().min(1, "City is required"),
  financialYearStartMonth: z
    .number()
    .int()
    .min(1, "Financial year start month must be between 1 and 12")
    .max(12, "Financial year start month must be between 1 and 12"),
  cin: optionalText,
  gst: optionalText,
  registeredAddress: optionalText,
  listedStatus: optionalText,
  employeeCountRange: optionalText,
  contactPhone: optionalText,
  logoUrl: z.string().trim().url().optional(),
  vendorTrackingEnabled: z.boolean().optional().default(false),
  site: z
    .object({
      name: z.string().trim().min(1, "Site name is required"),
      type: z.nativeEnum(CompanySiteType).default(CompanySiteType.OTHER),
      country: z.string().trim().min(1, "Site country is required"),
      state: z.string().trim().min(1, "Site state is required"),
      city: z.string().trim().min(1, "Site city is required"),
      address: optionalText
    })
    .optional()
});

export const updateCompanySettingsSchema = z.object({
  vendorTrackingEnabled: z.boolean()
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanySettingsInput = z.infer<typeof updateCompanySettingsSchema>;
