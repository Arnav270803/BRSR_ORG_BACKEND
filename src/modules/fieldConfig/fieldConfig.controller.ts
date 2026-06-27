import type { Request, Response } from "express";

import { getAuthenticatedUser, getCompanyAccess } from "../../middleware/authenticate.js";
import { updateGhgActivitySelectionsSchema } from "./fieldConfig.schemas.js";
import {
  listCompanyGhgActivitySelections,
  replaceCompanyGhgActivitySelections
} from "./fieldConfig.service.js";

export async function listGhgActivitySelectionsController(
  req: Request<{ reportingYearId: string }>,
  res: Response
) {
  const company = getCompanyAccess(res);
  const result = await listCompanyGhgActivitySelections(company.companyId, req.params.reportingYearId);

  res.status(200).json({
    data: result
  });
}

export async function updateGhgActivitySelectionsController(
  req: Request<{ reportingYearId: string }>,
  res: Response
) {
  const user = getAuthenticatedUser(res);
  const company = getCompanyAccess(res);
  const input = updateGhgActivitySelectionsSchema.parse(req.body);
  const result = await replaceCompanyGhgActivitySelections(
    company.companyId,
    req.params.reportingYearId,
    input,
    user.id
  );

  res.status(200).json({
    data: result
  });
}
