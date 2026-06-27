import type { Request, Response } from "express";

import {
  getAuthenticatedUser,
  getCompanyAccess
} from "../../middleware/authenticate.js";
import {
  createDataRecordSchema,
  listDataRecordsQuerySchema
} from "./dataRecords.schemas.js";
import {
  createDataRecord,
  listDataRecords,
  softDeleteDataRecord
} from "./dataRecords.service.js";

type DataRecordRouteParams = {
  reportingYearId: string;
  dataRecordId?: string;
};

export async function createDataRecordController(
  req: Request<DataRecordRouteParams>,
  res: Response
) {
  const user = getAuthenticatedUser(res);
  const company = getCompanyAccess(res);
  const input = createDataRecordSchema.parse(req.body);
  const dataRecord = await createDataRecord(company.companyId, req.params.reportingYearId, input, user);

  res.status(201).json({
    data: dataRecord
  });
}

export async function listDataRecordsController(
  req: Request<DataRecordRouteParams>,
  res: Response
) {
  const company = getCompanyAccess(res);
  const input = listDataRecordsQuerySchema.parse(req.query);
  const result = await listDataRecords(company.companyId, req.params.reportingYearId, input);

  res.status(200).json(result);
}

export async function deleteDataRecordController(
  req: Request<DataRecordRouteParams>,
  res: Response
) {
  const user = getAuthenticatedUser(res);
  const company = getCompanyAccess(res);
  const dataRecordId = req.params.dataRecordId;

  if (!dataRecordId) {
    res.status(400).json({
      error: {
        code: "DATA_RECORD_ID_REQUIRED",
        message: "Data record ID is required"
      }
    });
    return;
  }

  const dataRecord = await softDeleteDataRecord(
    company.companyId,
    req.params.reportingYearId,
    dataRecordId,
    user,
    company
  );

  res.status(200).json({
    data: dataRecord
  });
}
