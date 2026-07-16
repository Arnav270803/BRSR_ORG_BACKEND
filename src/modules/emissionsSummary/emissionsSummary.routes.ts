import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { requireCompanyAccess } from "../../middleware/requireCompanyAccess.js";
import { requireSiteAccess } from "../../middleware/requireSiteAccess.js";
import { getEmissionsSummaryController } from "./emissionsSummary.controller.js";

export const emissionsSummaryRouter = Router({ mergeParams: true });
const requireSiteWhenPresent = requireSiteAccess();

emissionsSummaryRouter.use(authenticate, requireCompanyAccess());
emissionsSummaryRouter.use((req, res, next) => {
  if (req.params.siteId) {
    requireSiteWhenPresent(req, res, next);
    return;
  }

  next();
});

emissionsSummaryRouter.get("/", getEmissionsSummaryController);
