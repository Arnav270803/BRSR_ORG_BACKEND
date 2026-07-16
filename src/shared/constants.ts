export const APP_NAME = "brsr-backend";

export const ACCESS_TOKEN_COOKIE_NAME = "brsr_access_token";
export const REFRESH_TOKEN_COOKIE_NAME = "brsr_refresh_token";
export const LINKEDIN_OAUTH_COOKIE_NAME = "brsr_linkedin_oauth";

export const ACCESS_TOKEN_TTL_MINUTES = 15;
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const LINKEDIN_OAUTH_TTL_MINUTES = 10;
export const INVITATION_TTL_DAYS = 7;

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const COMPANY_ROLES = {
  ADMIN: "ADMIN",
  USER: "USER"
} as const;

export const MEMBERSHIP_STATUSES = {
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED"
} as const;

export const COMPANY_STATUSES = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED"
} as const;
