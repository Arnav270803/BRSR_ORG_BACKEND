import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { requireCompanyAccess } from "../../middleware/requireCompanyAccess.js";
import {
  createDataRecordController,
  deleteDataRecordController,
  listDataRecordsController
} from "./dataRecords.controller.js";

export const dataRecordsRouter = Router({ mergeParams: true });

dataRecordsRouter.use(authenticate, requireCompanyAccess());

dataRecordsRouter.get("/", listDataRecordsController);
dataRecordsRouter.post("/", createDataRecordController);
dataRecordsRouter.delete("/:dataRecordId", deleteDataRecordController);
