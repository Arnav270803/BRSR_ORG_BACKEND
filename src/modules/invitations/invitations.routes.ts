import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { requireCompanyAccess } from "../../middleware/requireCompanyAccess.js";
import { COMPANY_ROLES } from "../../shared/constants.js";
import {
  acceptInvitationController,
  createCompanyInvitationController,
  listCompanyInvitationsController
} from "./invitations.controller.js";

export const invitationsRouter = Router();
export const companyInvitationsRouter = Router({ mergeParams: true });

invitationsRouter.use(authenticate);
invitationsRouter.post("/accept", acceptInvitationController);

companyInvitationsRouter.use(
  authenticate,
  requireCompanyAccess({
    allowedCompanyRoles: [COMPANY_ROLES.ADMIN]
  })
);
companyInvitationsRouter.get("/", listCompanyInvitationsController);
companyInvitationsRouter.post("/", createCompanyInvitationController);
