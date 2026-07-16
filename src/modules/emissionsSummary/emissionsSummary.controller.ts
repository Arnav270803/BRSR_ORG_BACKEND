import type { Request, Response } from "express";

import { getAuthenticatedUser, getCompanyAccess } from "../../middleware/authenticate.js";
import { getEmissionsSummary } from "./emissionsSummary.service.js";

type EmissionsSummaryRouteParams = {
  siteId?: string;
  reportingYearId: string;
};

export async function getEmissionsSummaryController(
  req: Request<EmissionsSummaryRouteParams>,
  res: Response
) {
  const user = getAuthenticatedUser(res);
  const company = getCompanyAccess(res);
  const summary = await getEmissionsSummary(
    company.companyId,
    req.params.siteId,
    req.params.reportingYearId,
    user,
    company
  );

  res.status(200).json({
    data: summary
  });
}
