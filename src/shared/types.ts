import type { COMPANY_ROLES } from "./constants.js";
import type { MembershipStatus, VendorMembershipRole } from "@prisma/client";

export type CompanyRole = (typeof COMPANY_ROLES)[keyof typeof COMPANY_ROLES];

export type AuthenticatedUserContext = {
  id: string;
  email: string;
  isPlatformOwner: boolean;
};

export type CompanyAccessContext = {
  companyId: string;
  role: CompanyRole;
  membershipId?: string;
};

export type SiteAccessContext = {
  siteId: string;
  role: CompanyRole;
  siteMembershipId?: string;
};

export type VendorAccessContext = {
  companyId: string;
  vendorId: string;
  role: VendorMembershipRole;
  status: MembershipStatus;
  vendorMembershipId: string;
};

export type RequestContext = {
  user?: AuthenticatedUserContext;
  company?: CompanyAccessContext;
  site?: SiteAccessContext;
  vendor?: VendorAccessContext;
};

export type ApiSuccess<TData> = {
  data: TData;
};

export type ApiList<TData, TMeta = unknown> = {
  data: TData[];
  meta: TMeta;
};

export type Nullable<T> = T | null;
