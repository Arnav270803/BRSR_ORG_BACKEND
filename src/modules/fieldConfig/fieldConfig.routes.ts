import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { requireCompanyAccess } from "../../middleware/requireCompanyAccess.js";
import { requireSiteAccess } from "../../middleware/requireSiteAccess.js";
import { COMPANY_ROLES } from "../../shared/constants.js";
import {
  listGhgActivitySelectionsController,
  updateGhgActivitySelectionsController
} from "./fieldConfig.controller.js";

export const fieldConfigRouter = Router({ mergeParams: true });
const requireSiteWhenPresent = requireSiteAccess();

fieldConfigRouter.use((req, res, next) => {
  if (req.params.siteId) {
    authenticate(req, res, (authError) => {
      if (authError) {
        next(authError);
        return;
      }

      requireCompanyAccess()(req, res, (companyError) => {
        if (companyError) {
          next(companyError);
          return;
        }

        requireSiteWhenPresent(req, res, next);
      });
    });
    return;
  }

  next();
});

fieldConfigRouter.get("/", authenticate, requireCompanyAccess(), listGhgActivitySelectionsController);
fieldConfigRouter.put(
  "/",
  authenticate,
  requireCompanyAccess({
    allowedCompanyRoles: [COMPANY_ROLES.ADMIN]
  }),
  updateGhgActivitySelectionsController
);
