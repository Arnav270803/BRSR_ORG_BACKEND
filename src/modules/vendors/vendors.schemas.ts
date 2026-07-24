import {
  VendorDataRequestStatus,
  VendorMembershipRole,
  VendorStatus
} from "@prisma/client";
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal("").transform(() => undefined));

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const createVendorSchema = z.object({
  legalName: z.string().trim().min(1, "Legal name is required"),
  displayName: z.string().trim().min(1, "Display name is required"),
  vendorCode: optionalText,
  primaryEmail: z.string().trim().email().transform((value) => value.toLowerCase()),
  primaryPhone: optionalText,
  website: optionalText,
  industry: optionalText,
  country: z.string().trim().min(1, "Country is required"),
  state: z.string().trim().min(1, "State is required"),
  city: z.string().trim().min(1, "City is required"),
  address: optionalText,
  taxId: optionalText,
  siteIds: z.array(z.string().uuid()).min(1, "Assign at least one site"),
  sendInvitation: z.boolean().default(true),
  invitationRole: z.nativeEnum(VendorMembershipRole).default(VendorMembershipRole.VENDOR_ADMIN)
});

export const updateVendorSchema = z
  .object({
    legalName: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1).optional(),
    vendorCode: optionalText.nullable(),
    primaryEmail: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase())
      .optional(),
    primaryPhone: optionalText.nullable(),
    website: optionalText.nullable(),
    industry: optionalText.nullable(),
    country: z.string().trim().min(1).optional(),
    state: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    address: optionalText.nullable(),
    taxId: optionalText.nullable(),
    status: z.nativeEnum(VendorStatus).optional()
  })
  .refine((input) => Object.keys(input).length > 0, "At least one vendor field is required");

export const updateVendorSitesSchema = z.object({
  siteIds: z.array(z.string().uuid()).min(1, "Assign at least one site")
});

export const createVendorInvitationSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: z.nativeEnum(VendorMembershipRole).default(VendorMembershipRole.VENDOR_ADMIN)
});

export const acceptVendorInvitationSchema = z.object({
  token: z.string().trim().min(1, "Invitation token is required")
});

export const listVendorsQuerySchema = z.object({
  status: z.nativeEnum(VendorStatus).optional(),
  siteId: z.string().uuid().optional(),
  search: optionalText
});

export const listVendorOptionsQuerySchema = z.object({
  siteId: z.string().uuid()
});

export const createVendorDataRequestSchema = z.object({
  vendorId: z.string().uuid(),
  siteId: z.string().uuid(),
  reportingYearId: z.string().uuid(),
  title: z.string().trim().min(1, "Request title is required"),
  instructions: optionalText,
  dueDate: dateOnly,
  activitySelectionIds: z
    .array(z.string().uuid())
    .min(1, "Select at least one vendor-tracked activity"),
  sendNow: z.boolean().default(false)
});

export const updateVendorDataRequestSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    instructions: optionalText.nullable(),
    dueDate: dateOnly.optional(),
    activitySelectionIds: z.array(z.string().uuid()).min(1).optional()
  })
  .refine((input) => Object.keys(input).length > 0, "At least one request field is required");

export const listVendorDataRequestsQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  reportingYearId: z.string().uuid().optional(),
  status: z.nativeEnum(VendorDataRequestStatus).optional()
});

export const reviewVendorDataRequestSchema = z
  .object({
    action: z.enum(["APPROVE", "REQUEST_CHANGES"]),
    notes: z.string().trim().min(1).max(4000).optional()
  })
  .refine((input) => input.action !== "REQUEST_CHANGES" || Boolean(input.notes), {
    message: "Review notes are required when requesting changes",
    path: ["notes"]
  });

export const saveVendorSubmissionSchema = z.object({
  records: z
    .array(
      z.object({
        requestItemId: z.string().uuid(),
        recordDate: dateOnly,
        quantity: z.coerce.number().positive("Quantity must be greater than zero"),
        notes: z.string().trim().max(2000).optional(),
        metadata: z.record(z.unknown()).optional()
      })
    )
    .max(500)
});

export const updateVendorPortalProfileSchema = z
  .object({
    legalName: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1).optional(),
    primaryPhone: optionalText.nullable(),
    website: optionalText.nullable(),
    industry: optionalText.nullable(),
    country: z.string().trim().min(1).optional(),
    state: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    address: optionalText.nullable(),
    taxId: optionalText.nullable()
  })
  .refine((input) => Object.keys(input).length > 0, "At least one profile field is required");

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type UpdateVendorSitesInput = z.infer<typeof updateVendorSitesSchema>;
export type CreateVendorInvitationInput = z.infer<typeof createVendorInvitationSchema>;
export type ListVendorsQuery = z.infer<typeof listVendorsQuerySchema>;
export type ListVendorOptionsQuery = z.infer<typeof listVendorOptionsQuerySchema>;
export type CreateVendorDataRequestInput = z.infer<typeof createVendorDataRequestSchema>;
export type UpdateVendorDataRequestInput = z.infer<typeof updateVendorDataRequestSchema>;
export type ListVendorDataRequestsQuery = z.infer<typeof listVendorDataRequestsQuerySchema>;
export type ReviewVendorDataRequestInput = z.infer<typeof reviewVendorDataRequestSchema>;
export type SaveVendorSubmissionInput = z.infer<typeof saveVendorSubmissionSchema>;
export type UpdateVendorPortalProfileInput = z.infer<typeof updateVendorPortalProfileSchema>;
