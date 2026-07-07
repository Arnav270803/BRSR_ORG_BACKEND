import "dotenv/config";

import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional()
);

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().optional(),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CLIENT_URL: z.string().url("CLIENT_URL must be a valid URL"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  LINKEDIN_CLIENT_ID: optionalNonEmptyString,
  LINKEDIN_CLIENT_SECRET: optionalNonEmptyString,
  LINKEDIN_REDIRECT_URI: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url("LINKEDIN_REDIRECT_URI must be a valid URL").optional()
  ),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  COOKIE_SECRET: z.string().min(32, "COOKIE_SECRET must be at least 32 characters"),
  RESEND_API_KEY: optionalNonEmptyString,
  INVITE_FROM_EMAIL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().email("INVITE_FROM_EMAIL must be a valid email").optional()
  ),
  INVITE_APP_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url("INVITE_APP_URL must be a valid URL").optional()
  ),
  SUPER_ADMIN_EMAILS: z.string().default("")
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${details}`);
}

const values = parsedEnv.data;

export const env = {
  ...values,
  API_PORT: values.PORT ?? values.API_PORT,
  SUPER_ADMIN_EMAILS: values.SUPER_ADMIN_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
} as const;

export type AppEnv = typeof env;
