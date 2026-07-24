import { Router } from "express";

import { authRouter } from "./modules/auth/auth.routes.js";
import { companiesRouter } from "./modules/companies/companies.routes.js";
import { dataRecordsRouter } from "./modules/dataRecords/dataRecords.routes.js";
import { emissionsSummaryRouter } from "./modules/emissionsSummary/emissionsSummary.routes.js";
import { fieldConfigRouter } from "./modules/fieldConfig/fieldConfig.routes.js";
import { ghgFactorsRouter } from "./modules/ghgFactors/ghgFactors.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import {
  companyInvitationsRouter,
  invitationsRouter
} from "./modules/invitations/invitations.routes.js";
import { reportingYearsRouter } from "./modules/reportingYears/reportingYears.routes.js";
import { reportsPdfRouter, reportsRouter } from "./modules/reports/reports.routes.js";
import { sitesRouter } from "./modules/sites/sites.routes.js";
import {
  companyVendorAnalyticsRouter,
  companyVendorRequestsRouter,
  companyVendorsRouter,
  vendorInvitationsRouter,
  vendorPortalRouter
} from "./modules/vendors/vendors.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/companies/:companyId/invitations", companyInvitationsRouter);
apiRouter.use(
  "/companies/:companyId/reporting-years/:reportingYearId/data-records",
  dataRecordsRouter
);
apiRouter.use(
  "/companies/:companyId/sites/:siteId/reporting-years/:reportingYearId/data-records",
  dataRecordsRouter
);
apiRouter.use(
  "/companies/:companyId/reporting-years/:reportingYearId/emissions-summary",
  emissionsSummaryRouter
);
apiRouter.use(
  "/companies/:companyId/sites/:siteId/reporting-years/:reportingYearId/emissions-summary",
  emissionsSummaryRouter
);
apiRouter.use(
  "/companies/:companyId/reporting-years/:reportingYearId/ghg-activity-selections",
  fieldConfigRouter
);
apiRouter.use(
  "/companies/:companyId/sites/:siteId/reporting-years/:reportingYearId/ghg-activity-selections",
  fieldConfigRouter
);
apiRouter.use(
  "/companies/:companyId/reporting-years/:reportingYearId/report.pdf",
  reportsPdfRouter
);
apiRouter.use(
  "/companies/:companyId/sites/:siteId/reporting-years/:reportingYearId/report.pdf",
  reportsPdfRouter
);
apiRouter.use(
  "/companies/:companyId/reporting-years/:reportingYearId/report",
  reportsRouter
);
apiRouter.use(
  "/companies/:companyId/sites/:siteId/reporting-years/:reportingYearId/report",
  reportsRouter
);
apiRouter.use("/companies/:companyId/reporting-years", reportingYearsRouter);
apiRouter.use("/companies/:companyId/sites", sitesRouter);
apiRouter.use("/companies/:companyId/vendors", companyVendorsRouter);
apiRouter.use(
  "/companies/:companyId/vendor-data-requests",
  companyVendorRequestsRouter
);
apiRouter.use("/companies/:companyId/vendor-analytics", companyVendorAnalyticsRouter);
apiRouter.use("/companies", companiesRouter);
apiRouter.use("/ghg", ghgFactorsRouter);
apiRouter.use("/health", healthRouter);
apiRouter.use("/invitations", invitationsRouter);
apiRouter.use("/vendor-invitations", vendorInvitationsRouter);
apiRouter.use("/vendor-portal/vendors/:vendorId", vendorPortalRouter);
