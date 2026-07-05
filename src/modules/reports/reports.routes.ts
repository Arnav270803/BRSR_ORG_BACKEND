import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { requireCompanyAccess } from "../../middleware/requireCompanyAccess.js";
import {
  downloadReportPdfController,
  getReportController
} from "./reports.controller.js";

export const reportsRouter = Router({ mergeParams: true });
export const reportsPdfRouter = Router({ mergeParams: true });

reportsRouter.use(authenticate, requireCompanyAccess());
reportsPdfRouter.use(authenticate, requireCompanyAccess());

reportsRouter.get("/", getReportController);
reportsRouter.get("/pdf", downloadReportPdfController);
reportsPdfRouter.get("/", downloadReportPdfController);
