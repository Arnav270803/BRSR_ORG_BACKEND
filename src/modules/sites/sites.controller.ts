import type { Request, Response } from "express";

import {
  getAuthenticatedUser,
  getCompanyAccess
} from "../../middleware/authenticate.js";
import {
  createCompanySiteSchema,
  updateCompanySiteMembershipSchema,
  updateCompanySiteSchema
} from "./sites.schemas.js";
import {
  createCompanySite,
  getCompanySite,
  listCompanySiteMembers,
  listCompanySites,
  updateCompanySite,
  updateCompanySiteMemberships
} from "./sites.service.js";

type SiteRouteParams = {
  companyId: string;
  siteId?: string;
  userId?: string;
};

export async function listCompanySitesController(
  _req: Request<SiteRouteParams>,
  res: Response
) {
  const user = getAuthenticatedUser(res);
  const company = getCompanyAccess(res);
  const sites = await listCompanySites(company.companyId, user, company);

  res.status(200).json({
    data: sites
  });
}

export async function createCompanySiteController(req: Request<SiteRouteParams>, res: Response) {
  const user = getAuthenticatedUser(res);
  const company = getCompanyAccess(res);
  const input = createCompanySiteSchema.parse(req.body);
  const site = await createCompanySite(company.companyId, input, user.id);

  res.status(201).json({
    data: site
  });
}

export async function getCompanySiteController(req: Request<SiteRouteParams>, res: Response) {
  const user = getAuthenticatedUser(res);
  const company = getCompanyAccess(res);
  const siteId = req.params.siteId;

  if (!siteId) {
    res.status(400).json({
      error: {
        code: "SITE_ID_REQUIRED",
        message: "Site ID is required"
      }
    });
    return;
  }

  const site = await getCompanySite(company.companyId, siteId, user, company);

  res.status(200).json({
    data: site
  });
}

export async function updateCompanySiteController(req: Request<SiteRouteParams>, res: Response) {
  const user = getAuthenticatedUser(res);
  const company = getCompanyAccess(res);
  const siteId = req.params.siteId;

  if (!siteId) {
    res.status(400).json({
      error: {
        code: "SITE_ID_REQUIRED",
        message: "Site ID is required"
      }
    });
    return;
  }

  const input = updateCompanySiteSchema.parse(req.body);
  const site = await updateCompanySite(company.companyId, siteId, input, user.id);

  res.status(200).json({
    data: site
  });
}

export async function listCompanySiteMembersController(
  _req: Request<SiteRouteParams>,
  res: Response
) {
  const company = getCompanyAccess(res);
  const members = await listCompanySiteMembers(company.companyId);

  res.status(200).json({
    data: members
  });
}

export async function updateCompanySiteMembershipsController(
  req: Request<SiteRouteParams>,
  res: Response
) {
  const user = getAuthenticatedUser(res);
  const company = getCompanyAccess(res);
  const targetUserId = req.params.userId;

  if (!targetUserId) {
    res.status(400).json({
      error: {
        code: "USER_ID_REQUIRED",
        message: "User ID is required"
      }
    });
    return;
  }

  const input = updateCompanySiteMembershipSchema.parse(req.body);
  const member = await updateCompanySiteMemberships(
    company.companyId,
    targetUserId,
    input,
    user.id
  );

  res.status(200).json({
    data: member
  });
}
