import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { requireCompanyAccess } from "../../middleware/requireCompanyAccess.js";
import { requireSiteAccess } from "../../middleware/requireSiteAccess.js";
import {
  downloadReportPdfController,
  getReportController
} from "./reports.controller.js";

export const reportsRouter = Router({ mergeParams: true });
export const reportsPdfRouter = Router({ mergeParams: true });
const requireSiteWhenPresent = requireSiteAccess();

reportsRouter.use(authenticate, requireCompanyAccess());
reportsPdfRouter.use(authenticate, requireCompanyAccess());
reportsRouter.use((req, res, next) => {
  if (req.params.siteId) {
    requireSiteWhenPresent(req, res, next);
    return;
  }

  next();
});
reportsPdfRouter.use((req, res, next) => {
  if (req.params.siteId) {
    requireSiteWhenPresent(req, res, next);
    return;
  }

  next();
});

reportsRouter.get("/", getReportController);
reportsRouter.get("/pdf", downloadReportPdfController);
reportsPdfRouter.get("/", downloadReportPdfController);
