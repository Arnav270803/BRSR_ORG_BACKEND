import {
  Prisma,
  VendorDataRequestStatus,
  VendorMembershipRole,
  VendorStatus,
  VendorTrackingMode
} from "@prisma/client";

import { prisma } from "../../infra/prisma/client.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuthenticatedUserContext, VendorAccessContext } from "../../shared/types.js";
import { now } from "../../shared/utils/date.js";
import type {
  SaveVendorSubmissionInput,
  UpdateVendorPortalProfileInput
} from "./vendors.schemas.js";
import {
  markOverdueRequests,
  requestDetailInclude,
  toVendorRequestResponse
} from "./vendors.service.js";

const editableStatuses: VendorDataRequestStatus[] = [
  VendorDataRequestStatus.SENT,
  VendorDataRequestStatus.IN_PROGRESS,
  VendorDataRequestStatus.CHANGES_REQUESTED,
  VendorDataRequestStatus.OVERDUE
];

async function getPortalRequest(vendorId: string, requestId: string) {
  const request = await prisma.vendorDataRequest.findFirst({
    where: {
      id: requestId,
      vendorId
    },
    include: requestDetailInclude
  });

  if (!request) {
    throw new AppError("Vendor data request not found", 404, "VENDOR_REQUEST_NOT_FOUND");
  }

  return request;
}

function assertRequestEditable(status: VendorDataRequestStatus) {
  if (!editableStatuses.includes(status)) {
    throw new AppError(
      "This request is not open for vendor editing",
      409,
      "VENDOR_REQUEST_NOT_EDITABLE"
    );
  }
}

export async function getVendorPortalContext(
  vendorAccess: VendorAccessContext,
  user: AuthenticatedUserContext
) {
  const vendor = await prisma.vendor.findFirst({
    where: {
      id: vendorAccess.vendorId,
      companyId: vendorAccess.companyId,
      status: VendorStatus.ACTIVE
    },
    include: {
      company: {
        select: {
          id: true,
          displayName: true,
          legalName: true
        }
      },
      siteAssignments: {
        include: {
          site: {
            select: {
              id: true,
              name: true,
              type: true,
              city: true,
              state: true,
              country: true
            }
          }
        },
        orderBy: {
          site: {
            name: "asc"
          }
        }
      }
    }
  });

  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  return {
    user,
    membership: {
      id: vendorAccess.vendorMembershipId,
      role: vendorAccess.role,
      status: vendorAccess.status
    },
    company: vendor.company,
    vendor: {
      id: vendor.id,
      legalName: vendor.legalName,
      displayName: vendor.displayName,
      vendorCode: vendor.vendorCode,
      primaryEmail: vendor.primaryEmail,
      primaryPhone: vendor.primaryPhone,
      website: vendor.website,
      industry: vendor.industry,
      country: vendor.country,
      state: vendor.state,
      city: vendor.city,
      address: vendor.address,
      taxId: vendor.taxId,
      status: vendor.status,
      profileCompletedAt: vendor.profileCompletedAt?.toISOString() ?? null
    },
    sites: vendor.siteAssignments.map((assignment) => assignment.site)
  };
}

export async function updateVendorPortalProfile(
  vendorAccess: VendorAccessContext,
  input: UpdateVendorPortalProfileInput,
  user: AuthenticatedUserContext
) {
  if (vendorAccess.role !== VendorMembershipRole.VENDOR_ADMIN) {
    throw new AppError(
      "Only a vendor administrator can update the vendor profile",
      403,
      "VENDOR_PROFILE_UPDATE_DENIED"
    );
  }

  const existing = await prisma.vendor.findFirst({
    where: {
      id: vendorAccess.vendorId,
      companyId: vendorAccess.companyId,
      status: VendorStatus.ACTIVE
    }
  });

  if (!existing) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  const data: Prisma.VendorUpdateInput = {};

  for (const key of [
    "legalName",
    "displayName",
    "primaryPhone",
    "website",
    "industry",
    "country",
    "state",
    "city",
    "address",
    "taxId"
  ] as const) {
    if (input[key] !== undefined) {
      Object.assign(data, { [key]: input[key] });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendor.update({
      where: {
        id: vendorAccess.vendorId
      },
      data: {
        ...data,
        profileCompletedAt: existing.profileCompletedAt ?? now()
      }
    });
    await tx.auditLog.create({
      data: {
        companyId: vendorAccess.companyId,
        actorUserId: user.id,
        action: "VENDOR_PROFILE_UPDATED",
        entityType: "vendor",
        entityId: vendorAccess.vendorId,
        afterJson: input
      }
    });
  });

  return getVendorPortalContext(vendorAccess, user);
}

export async function listVendorPortalRequests(vendorAccess: VendorAccessContext) {
  await markOverdueRequests(vendorAccess.companyId);
  const requests = await prisma.vendorDataRequest.findMany({
    where: {
      vendorId: vendorAccess.vendorId,
      companyId: vendorAccess.companyId,
      status: {
        notIn: [VendorDataRequestStatus.DRAFT, VendorDataRequestStatus.CANCELLED]
      }
    },
    include: requestDetailInclude,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }]
  });

  return requests.map(toVendorRequestResponse);
}

export async function getVendorPortalRequest(
  vendorAccess: VendorAccessContext,
  requestId: string
) {
  await markOverdueRequests(vendorAccess.companyId);
  const request = await getPortalRequest(vendorAccess.vendorId, requestId);

  if (request.status === VendorDataRequestStatus.DRAFT) {
    throw new AppError("Vendor data request not found", 404, "VENDOR_REQUEST_NOT_FOUND");
  }

  return toVendorRequestResponse(request);
}

export async function saveVendorSubmission(
  vendorAccess: VendorAccessContext,
  requestId: string,
  input: SaveVendorSubmissionInput,
  actorUserId: string
) {
  const request = await getPortalRequest(vendorAccess.vendorId, requestId);
  assertRequestEditable(request.status);
  const itemsById = new Map(request.items.map((item) => [item.id, item]));

  for (const record of input.records) {
    if (!itemsById.has(record.requestItemId)) {
      throw new AppError(
        "One or more submission records do not belong to this request",
        400,
        "INVALID_VENDOR_SUBMISSION_ITEM"
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendorSubmissionRecord.deleteMany({
      where: {
        vendorDataRequestId: requestId,
        approvedDataRecord: null
      }
    });

    if (input.records.length > 0) {
      await tx.vendorSubmissionRecord.createMany({
        data: input.records.map((record) => {
          const item = itemsById.get(record.requestItemId)!;

          return {
            companyId: request.companyId,
            vendorId: request.vendorId,
            siteId: request.siteId,
            reportingYearId: request.reportingYearId,
            vendorDataRequestId: request.id,
            vendorDataRequestItemId: item.id,
            ghgActivitySelectionId: item.ghgActivitySelectionId,
            recordDate: new Date(`${record.recordDate}T00:00:00.000Z`),
            quantity: new Prisma.Decimal(record.quantity.toString()),
            notes: record.notes ?? null,
            metadata: record.metadata
              ? (record.metadata as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            createdByUserId: actorUserId
          };
        })
      });
    }

    await tx.vendorDataRequest.update({
      where: {
        id: requestId
      },
      data: {
        status: VendorDataRequestStatus.IN_PROGRESS
      }
    });
    await tx.auditLog.create({
      data: {
        companyId: request.companyId,
        actorUserId,
        action: "VENDOR_SUBMISSION_SAVED",
        entityType: "vendor_data_request",
        entityId: requestId,
        afterJson: {
          vendorId: request.vendorId,
          recordCount: input.records.length
        }
      }
    });
  });

  return getVendorPortalRequest(vendorAccess, requestId);
}

export async function submitVendorDataRequest(
  vendorAccess: VendorAccessContext,
  requestId: string,
  actorUserId: string
) {
  const request = await getPortalRequest(vendorAccess.vendorId, requestId);
  assertRequestEditable(request.status);
  const submittedItemIds = new Set(
    request.submissionRecords.map((record) => record.vendorDataRequestItemId)
  );
  const missingRequiredItem = request.items.find(
    (item) =>
      item.trackingMode === VendorTrackingMode.REQUIRED && !submittedItemIds.has(item.id)
  );

  if (missingRequiredItem) {
    throw new AppError(
      "Every required activity needs at least one data record",
      400,
      "VENDOR_REQUIRED_ACTIVITY_MISSING"
    );
  }
  if (request.submissionRecords.length === 0) {
    throw new AppError(
      "Add at least one record before submitting",
      400,
      "VENDOR_SUBMISSION_EMPTY"
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendorDataRequest.update({
      where: {
        id: requestId
      },
      data: {
        status: VendorDataRequestStatus.SUBMITTED,
        submittedAt: now(),
        reviewNotes: null
      }
    });
    await tx.auditLog.create({
      data: {
        companyId: request.companyId,
        actorUserId,
        action: "VENDOR_DATA_REQUEST_SUBMITTED",
        entityType: "vendor_data_request",
        entityId: requestId,
        afterJson: {
          vendorId: request.vendorId,
          recordCount: request.submissionRecords.length
        }
      }
    });
  });

  return getVendorPortalRequest(vendorAccess, requestId);
}
