import type { APP_ROLES, COMPANY_ROLES } from "./constants.js";

export type CompanyRole = (typeof COMPANY_ROLES)[keyof typeof COMPANY_ROLES];
export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];

export type AuthenticatedUserContext = {
  id: string;
  email: string;
  isSuperAdmin: boolean;
};

export type CompanyAccessContext = {
  companyId: string;
  role: AppRole;
  membershipId?: string;
};

export type SiteAccessContext = {
  siteId: string;
  role: AppRole;
  siteMembershipId?: string;
};

export type RequestContext = {
  user?: AuthenticatedUserContext;
  company?: CompanyAccessContext;
  site?: SiteAccessContext;
};

export type ApiSuccess<TData> = {
  data: TData;
};

export type ApiList<TData, TMeta = unknown> = {
  data: TData[];
  meta: TMeta;
};

export type Nullable<T> = T | null;
