import type { Request, Response } from "express";

import {
  getAuthenticatedUser,
  getCompanyAccess,
  getVendorAccess
} from "../../middleware/authenticate.js";
import { AppError } from "../../shared/errors/AppError.js";
import {
  getVendorPortalContext,
  getVendorPortalRequest,
  listVendorPortalRequests,
  saveVendorSubmission,
  submitVendorDataRequest,
  updateVendorPortalProfile
} from "./vendorPortal.service.js";
import {
  acceptVendorInvitationSchema,
  createVendorDataRequestSchema,
  createVendorInvitationSchema,
  createVendorSchema,
  listVendorOptionsQuerySchema,
  listVendorDataRequestsQuerySchema,
  listVendorsQuerySchema,
  reviewVendorDataRequestSchema,
  saveVendorSubmissionSchema,
  updateVendorDataRequestSchema,
  updateVendorPortalProfileSchema,
  updateVendorSchema,
  updateVendorSitesSchema
} from "./vendors.schemas.js";
import {
  acceptVendorInvitation,
  cancelVendorDataRequest,
  createVendor,
  createVendorDataRequest,
  createVendorInvitation,
  getVendor,
  getVendorAnalytics,
  getVendorDataRequest,
  listVendorDataRequests,
  listVendorOptions,
  listVendors,
  reviewVendorDataRequest,
  sendVendorDataRequest,
  updateVendor,
  updateVendorDataRequest,
  updateVendorSites
} from "./vendors.service.js";

function getParam(req: Request, name: string): string {
  const value = req.params[name];

  if (!value || Array.isArray(value)) {
    throw new AppError(`${name} is required`, 400, "ROUTE_PARAMETER_REQUIRED");
  }

  return value;
}

export async function listVendorsController(req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const query = listVendorsQuerySchema.parse(req.query);
  const result = await listVendors(company.companyId, query);

  res.status(200).json({ data: result });
}

export async function listVendorOptionsController(req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const query = listVendorOptionsQuerySchema.parse(req.query);
  const result = await listVendorOptions(company.companyId, query);

  res.status(200).json({ data: result });
}

export async function getVendorController(req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const result = await getVendor(company.companyId, getParam(req, "vendorId"));

  res.status(200).json({ data: result });
}

export async function createVendorController(req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const user = getAuthenticatedUser(res);
  const input = createVendorSchema.parse(req.body);
  const result = await createVendor(company.companyId, input, user.id);

  res.status(201).json({ data: result });
}

export async function updateVendorController(req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const user = getAuthenticatedUser(res);
  const input = updateVendorSchema.parse(req.body);
  const result = await updateVendor(
    company.companyId,
    getParam(req, "vendorId"),
    input,
    user.id
  );

  res.status(200).json({ data: result });
}

export async function updateVendorSitesController(req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const user = getAuthenticatedUser(res);
  const input = updateVendorSitesSchema.parse(req.body);
  const result = await updateVendorSites(
    company.companyId,
    getParam(req, "vendorId"),
    input,
    user.id
  );

  res.status(200).json({ data: result });
}

export async function createVendorInvitationController(req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const user = getAuthenticatedUser(res);
  const input = createVendorInvitationSchema.parse(req.body);
  const result = await createVendorInvitation(
    company.companyId,
    getParam(req, "vendorId"),
    input,
    user.id
  );

  res.status(201).json({ data: result });
}

export async function acceptVendorInvitationController(req: Request, res: Response) {
  const user = getAuthenticatedUser(res);
  const input = acceptVendorInvitationSchema.parse(req.body);
  const result = await acceptVendorInvitation(input.token, user);

  res.status(200).json({ data: result });
}

export async function listVendorDataRequestsController(req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const query = listVendorDataRequestsQuerySchema.parse(req.query);
  const result = await listVendorDataRequests(company.companyId, query);

  res.status(200).json({ data: result });
}

export async function getVendorDataRequestController(req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const result = await getVendorDataRequest(
    company.companyId,
    getParam(req, "requestId")
  );

  res.status(200).json({ data: result });
}

export async function createVendorDataRequestController(req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const user = getAuthenticatedUser(res);
  const input = createVendorDataRequestSchema.parse(req.body);
  const result = await createVendorDataRequest(company.companyId, input, user.id);

  res.status(201).json({ data: result });
}

export async function updateVendorDataRequestController(req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const user = getAuthenticatedUser(res);
  const input = updateVendorDataRequestSchema.parse(req.body);
  const result = await updateVendorDataRequest(
    company.companyId,
    getParam(req, "requestId"),
    input,
    user.id
  );

  res.status(200).json({ data: result });
}

export async function sendVendorDataRequestController(req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const user = getAuthenticatedUser(res);
  const result = await sendVendorDataRequest(
    company.companyId,
    getParam(req, "requestId"),
    user.id
  );

  res.status(200).json({ data: result });
}

export async function reviewVendorDataRequestController(req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const user = getAuthenticatedUser(res);
  const input = reviewVendorDataRequestSchema.parse(req.body);
  const result = await reviewVendorDataRequest(
    company.companyId,
    getParam(req, "requestId"),
    input,
    user.id
  );

  res.status(200).json({ data: result });
}

export async function cancelVendorDataRequestController(req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const user = getAuthenticatedUser(res);
  const result = await cancelVendorDataRequest(
    company.companyId,
    getParam(req, "requestId"),
    user.id
  );

  res.status(200).json({ data: result });
}

export async function getVendorAnalyticsController(req: Request, res: Response) {
  const company = getCompanyAccess(res);
  const query = listVendorDataRequestsQuerySchema
    .pick({
      reportingYearId: true,
      siteId: true
    })
    .parse(req.query);
  const result = await getVendorAnalytics(company.companyId, query);

  res.status(200).json({ data: result });
}

export async function getVendorPortalContextController(_req: Request, res: Response) {
  const vendor = getVendorAccess(res);
  const user = getAuthenticatedUser(res);
  const result = await getVendorPortalContext(vendor, user);

  res.status(200).json({ data: result });
}

export async function updateVendorPortalProfileController(req: Request, res: Response) {
  const vendor = getVendorAccess(res);
  const user = getAuthenticatedUser(res);
  const input = updateVendorPortalProfileSchema.parse(req.body);
  const result = await updateVendorPortalProfile(vendor, input, user);

  res.status(200).json({ data: result });
}

export async function listVendorPortalRequestsController(_req: Request, res: Response) {
  const vendor = getVendorAccess(res);
  const result = await listVendorPortalRequests(vendor);

  res.status(200).json({ data: result });
}

export async function getVendorPortalRequestController(req: Request, res: Response) {
  const vendor = getVendorAccess(res);
  const result = await getVendorPortalRequest(vendor, getParam(req, "requestId"));

  res.status(200).json({ data: result });
}

export async function saveVendorSubmissionController(req: Request, res: Response) {
  const vendor = getVendorAccess(res);
  const user = getAuthenticatedUser(res);
  const input = saveVendorSubmissionSchema.parse(req.body);
  const result = await saveVendorSubmission(
    vendor,
    getParam(req, "requestId"),
    input,
    user.id
  );

  res.status(200).json({ data: result });
}

export async function submitVendorDataRequestController(req: Request, res: Response) {
  const vendor = getVendorAccess(res);
  const user = getAuthenticatedUser(res);
  const result = await submitVendorDataRequest(
    vendor,
    getParam(req, "requestId"),
    user.id
  );

  res.status(200).json({ data: result });
}
