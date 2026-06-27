import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { requireCompanyAccess } from "../../middleware/requireCompanyAccess.js";
import {
  createCompanyController,
  getCompanyWorkspaceController,
  getCurrentCompanyController
} from "./companies.controller.js";

export const companiesRouter = Router();

companiesRouter.use(authenticate);

companiesRouter.post("/", createCompanyController);
companiesRouter.get("/current", getCurrentCompanyController);
companiesRouter.get("/:companyId/workspace", requireCompanyAccess(), getCompanyWorkspaceController);
