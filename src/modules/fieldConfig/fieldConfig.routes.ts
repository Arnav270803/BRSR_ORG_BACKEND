import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { requireCompanyAccess } from "../../middleware/requireCompanyAccess.js";
import { COMPANY_ROLES } from "../../shared/constants.js";
import {
  listGhgActivitySelectionsController,
  updateGhgActivitySelectionsController
} from "./fieldConfig.controller.js";

export const fieldConfigRouter = Router({ mergeParams: true });

fieldConfigRouter.get("/", authenticate, requireCompanyAccess(), listGhgActivitySelectionsController);
fieldConfigRouter.put(
  "/",
  authenticate,
  requireCompanyAccess({
    allowedCompanyRoles: [COMPANY_ROLES.ADMIN]
  }),
  updateGhgActivitySelectionsController
);
