import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { requireCompanyAccess } from "../../middleware/requireCompanyAccess.js";
import { COMPANY_ROLES } from "../../shared/constants.js";
import {
  createCompanyController,
  getCompanyWorkspaceController,
  getCurrentCompanyController,
  updateCompanySettingsController
} from "./companies.controller.js";

export const companiesRouter = Router();

companiesRouter.use(authenticate);

companiesRouter.post("/", createCompanyController);
companiesRouter.get("/current", getCurrentCompanyController);
companiesRouter.get("/:companyId/workspace", requireCompanyAccess(), getCompanyWorkspaceController);
companiesRouter.patch(
  "/:companyId/settings",
  requireCompanyAccess({
    allowedCompanyRoles: [COMPANY_ROLES.ADMIN]
  }),
  updateCompanySettingsController
);
