import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { requireCompanyAccess } from "../../middleware/requireCompanyAccess.js";
import { COMPANY_ROLES } from "../../shared/constants.js";
import {
  createCompanySiteController,
  getCompanySiteController,
  listCompanySiteMembersController,
  listCompanySitesController,
  updateCompanySiteController,
  updateCompanySiteMembershipsController
} from "./sites.controller.js";

export const sitesRouter = Router({ mergeParams: true });

sitesRouter.get("/", authenticate, requireCompanyAccess(), listCompanySitesController);
sitesRouter.get(
  "/members",
  authenticate,
  requireCompanyAccess({
    allowedCompanyRoles: [COMPANY_ROLES.ADMIN]
  }),
  listCompanySiteMembersController
);
sitesRouter.put(
  "/members/:userId",
  authenticate,
  requireCompanyAccess({
    allowedCompanyRoles: [COMPANY_ROLES.ADMIN]
  }),
  updateCompanySiteMembershipsController
);
sitesRouter.post(
  "/",
  authenticate,
  requireCompanyAccess({
    allowedCompanyRoles: [COMPANY_ROLES.ADMIN]
  }),
  createCompanySiteController
);
sitesRouter.get("/:siteId", authenticate, requireCompanyAccess(), getCompanySiteController);
sitesRouter.patch(
  "/:siteId",
  authenticate,
  requireCompanyAccess({
    allowedCompanyRoles: [COMPANY_ROLES.ADMIN]
  }),
  updateCompanySiteController
);
