import { z } from "zod";

import { COMPANY_ROLES } from "../../shared/constants.js";

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid invite email is required"),
  role: z.enum([COMPANY_ROLES.ADMIN, COMPANY_ROLES.USER])
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required")
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
