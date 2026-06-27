import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { requireCompanyAccess } from "../../middleware/requireCompanyAccess.js";
import { COMPANY_ROLES } from "../../shared/constants.js";
import {
  createReportingYearController,
  listReportingYearsController
} from "./reportingYears.controller.js";

export const reportingYearsRouter = Router({ mergeParams: true });

reportingYearsRouter.get("/", authenticate, requireCompanyAccess(), listReportingYearsController);
reportingYearsRouter.post(
  "/",
  authenticate,
  requireCompanyAccess({
    allowedCompanyRoles: [COMPANY_ROLES.ADMIN]
  }),
  createReportingYearController
);
