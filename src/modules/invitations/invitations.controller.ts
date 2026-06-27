import type { Request, Response } from "express";

import { getAuthenticatedUser, getCompanyAccess } from "../../middleware/authenticate.js";
import { acceptInvitationSchema, createInvitationSchema } from "./invitations.schemas.js";
import {
  acceptInvitation,
  createCompanyInvitation,
  listCompanyInvitations
} from "./invitations.service.js";

export async function listCompanyInvitationsController(_req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const invitations = await listCompanyInvitations(company.companyId);

  res.status(200).json({
    data: invitations
  });
}

export async function createCompanyInvitationController(req: Request, res: Response) {
  const user = getAuthenticatedUser(res);
  const company = getCompanyAccess(res);
  const input = createInvitationSchema.parse(req.body);
  const result = await createCompanyInvitation(company.companyId, input, user.id);

  res.status(201).json({
    data: result
  });
}

export async function acceptInvitationController(req: Request, res: Response) {
  const user = getAuthenticatedUser(res);
  const input = acceptInvitationSchema.parse(req.body);
  const result = await acceptInvitation(input.token, user);

  res.status(200).json({
    data: result
  });
}
