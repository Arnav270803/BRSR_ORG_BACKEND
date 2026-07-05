import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { requireCompanyAccess } from "../../middleware/requireCompanyAccess.js";
import { requireSiteAccess } from "../../middleware/requireSiteAccess.js";
import {
  createDataRecordController,
  deleteDataRecordController,
  listDataRecordsController
} from "./dataRecords.controller.js";

export const dataRecordsRouter = Router({ mergeParams: true });
const requireSiteWhenPresent = requireSiteAccess();

dataRecordsRouter.use(authenticate, requireCompanyAccess());
dataRecordsRouter.use((req, res, next) => {
  if (req.params.siteId) {
    requireSiteWhenPresent(req, res, next);
    return;
  }

  next();
});

dataRecordsRouter.get("/", listDataRecordsController);
dataRecordsRouter.post("/", createDataRecordController);
dataRecordsRouter.delete("/:dataRecordId", deleteDataRecordController);
