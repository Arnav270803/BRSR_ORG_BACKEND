import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { requireCompanyAccess } from "../../middleware/requireCompanyAccess.js";
import { requireVendorAccess } from "../../middleware/requireVendorAccess.js";
import { COMPANY_ROLES } from "../../shared/constants.js";
import {
  acceptVendorInvitationController,
  cancelVendorDataRequestController,
  createVendorController,
  createVendorDataRequestController,
  createVendorInvitationController,
  getVendorAnalyticsController,
  getVendorController,
  getVendorDataRequestController,
  getVendorPortalContextController,
  getVendorPortalRequestController,
  listVendorDataRequestsController,
  listVendorPortalRequestsController,
  listVendorOptionsController,
  listVendorsController,
  reviewVendorDataRequestController,
  saveVendorSubmissionController,
  sendVendorDataRequestController,
  submitVendorDataRequestController,
  updateVendorController,
  updateVendorDataRequestController,
  updateVendorPortalProfileController,
  updateVendorSitesController
} from "./vendors.controller.js";

export const companyVendorsRouter = Router({ mergeParams: true });
export const companyVendorRequestsRouter = Router({ mergeParams: true });
export const companyVendorAnalyticsRouter = Router({ mergeParams: true });
export const vendorInvitationsRouter = Router();
export const vendorPortalRouter = Router({ mergeParams: true });

const requireAdmin = requireCompanyAccess({
  allowedCompanyRoles: [COMPANY_ROLES.ADMIN]
});

companyVendorsRouter.get(
  "/options",
  authenticate,
  requireCompanyAccess(),
  listVendorOptionsController
);
companyVendorsRouter.use(authenticate, requireAdmin);
companyVendorsRouter.get("/", listVendorsController);
companyVendorsRouter.post("/", createVendorController);
companyVendorsRouter.get("/:vendorId", getVendorController);
companyVendorsRouter.patch("/:vendorId", updateVendorController);
companyVendorsRouter.put("/:vendorId/sites", updateVendorSitesController);
companyVendorsRouter.post("/:vendorId/invitations", createVendorInvitationController);

companyVendorRequestsRouter.use(authenticate, requireAdmin);
companyVendorRequestsRouter.get("/", listVendorDataRequestsController);
companyVendorRequestsRouter.post("/", createVendorDataRequestController);
companyVendorRequestsRouter.get("/:requestId", getVendorDataRequestController);
companyVendorRequestsRouter.patch("/:requestId", updateVendorDataRequestController);
companyVendorRequestsRouter.post("/:requestId/send", sendVendorDataRequestController);
companyVendorRequestsRouter.post("/:requestId/review", reviewVendorDataRequestController);
companyVendorRequestsRouter.post("/:requestId/cancel", cancelVendorDataRequestController);

companyVendorAnalyticsRouter.use(authenticate, requireAdmin);
companyVendorAnalyticsRouter.get("/", getVendorAnalyticsController);

vendorInvitationsRouter.use(authenticate);
vendorInvitationsRouter.post("/accept", acceptVendorInvitationController);

vendorPortalRouter.use(authenticate, requireVendorAccess());
vendorPortalRouter.get("/", getVendorPortalContextController);
vendorPortalRouter.patch("/profile", updateVendorPortalProfileController);
vendorPortalRouter.get("/requests", listVendorPortalRequestsController);
vendorPortalRouter.get("/requests/:requestId", getVendorPortalRequestController);
vendorPortalRouter.put(
  "/requests/:requestId/submissions",
  saveVendorSubmissionController
);
vendorPortalRouter.post(
  "/requests/:requestId/submit",
  submitVendorDataRequestController
);
