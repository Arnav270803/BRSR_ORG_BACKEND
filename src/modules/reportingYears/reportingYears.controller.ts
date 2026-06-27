import type { Request, Response } from "express";

import { getAuthenticatedUser, getCompanyAccess } from "../../middleware/authenticate.js";
import { createReportingYearSchema } from "./reportingYears.schemas.js";
import { createReportingYear, listReportingYears } from "./reportingYears.service.js";

export async function listReportingYearsController(_req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const reportingYears = await listReportingYears(company.companyId);

  res.status(200).json({
    data: reportingYears
  });
}

export async function createReportingYearController(req: Request, res: Response) {
  const user = getAuthenticatedUser(res);
  const company = getCompanyAccess(res);
  const input = createReportingYearSchema.parse(req.body);
  const reportingYear = await createReportingYear(company.companyId, input, user.id);

  res.status(201).json({
    data: reportingYear
  });
}
