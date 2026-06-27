import { z } from "zod";

export const googleLoginSchema = z.object({
  idToken: z.string().min(1, "Google ID token is required")
});

export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
