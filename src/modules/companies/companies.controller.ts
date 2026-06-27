import type { Request, Response } from "express";

import { getAuthenticatedUser } from "../../middleware/authenticate.js";
import { createCompanySchema } from "./companies.schemas.js";
import {
  createCompanyForUser,
  getCompanyWorkspace,
  getCurrentCompanyForUser
} from "./companies.service.js";

export async function createCompanyController(req: Request, res: Response) {
  const user = getAuthenticatedUser(res);
  const input = createCompanySchema.parse(req.body);
  const result = await createCompanyForUser(input, user.id);

  res.status(201).json({
    data: result
  });
}

export async function getCurrentCompanyController(_req: Request, res: Response) {
  const user = getAuthenticatedUser(res);
  const result = await getCurrentCompanyForUser(user.id);

  res.status(200).json({
    data: result
  });
}

export async function getCompanyWorkspaceController(req: Request<{ companyId: string }>, res: Response) {
  const user = getAuthenticatedUser(res);
  const companyId = req.params.companyId;
  const result = await getCompanyWorkspace(companyId, user.id, user.isSuperAdmin);

  res.status(200).json({
    data: result
  });
}
