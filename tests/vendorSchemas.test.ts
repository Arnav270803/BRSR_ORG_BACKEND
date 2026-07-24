import { describe, expect, it } from "vitest";

import { createDataRecordSchema } from "../src/modules/dataRecords/dataRecords.schemas.js";
import { updateGhgActivitySelectionsSchema } from "../src/modules/fieldConfig/fieldConfig.schemas.js";
import {
  createVendorDataRequestSchema,
  createVendorSchema,
  listVendorOptionsQuerySchema,
  reviewVendorDataRequestSchema,
  saveVendorSubmissionSchema
} from "../src/modules/vendors/vendors.schemas.js";

const ids = {
  activity: "11111111-1111-4111-8111-111111111111",
  item: "22222222-2222-4222-8222-222222222222",
  site: "33333333-3333-4333-8333-333333333333",
  vendor: "44444444-4444-4444-8444-444444444444",
  year: "55555555-5555-4555-8555-555555555555"
};

describe("vendor tracking schemas", () => {
  it("accepts a vendor assigned to at least one site", () => {
    const result = createVendorSchema.safeParse({
      legalName: "Supplier Private Limited",
      displayName: "Supplier",
      primaryEmail: "DATA@SUPPLIER.EXAMPLE",
      country: "India",
      state: "Delhi",
      city: "New Delhi",
      siteIds: [ids.site],
      sendInvitation: true,
      invitationRole: "VENDOR_ADMIN"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.primaryEmail).toBe("data@supplier.example");
    }
  });

  it("rejects a vendor without a company site assignment", () => {
    expect(
      createVendorSchema.safeParse({
        legalName: "Supplier Private Limited",
        displayName: "Supplier",
        primaryEmail: "data@supplier.example",
        country: "India",
        state: "Delhi",
        city: "New Delhi",
        siteIds: []
      }).success
    ).toBe(false);
  });

  it("requires a site for the least-privilege vendor options endpoint", () => {
    expect(listVendorOptionsQuerySchema.safeParse({ siteId: ids.site }).success).toBe(true);
    expect(listVendorOptionsQuerySchema.safeParse({}).success).toBe(false);
  });

  it("requires at least one tracked activity in a vendor data request", () => {
    const baseRequest = {
      vendorId: ids.vendor,
      siteId: ids.site,
      reportingYearId: ids.year,
      title: "Purchased goods activity data",
      dueDate: "2026-08-31",
      sendNow: false
    };

    expect(
      createVendorDataRequestSchema.safeParse({
        ...baseRequest,
        activitySelectionIds: [ids.activity]
      }).success
    ).toBe(true);
    expect(
      createVendorDataRequestSchema.safeParse({
        ...baseRequest,
        activitySelectionIds: []
      }).success
    ).toBe(false);
  });

  it("rejects zero or negative vendor submission quantities", () => {
    const record = {
      requestItemId: ids.item,
      recordDate: "2026-07-24",
      quantity: 1
    };

    expect(saveVendorSubmissionSchema.safeParse({ records: [record] }).success).toBe(true);
    expect(
      saveVendorSubmissionSchema.safeParse({
        records: [{ ...record, quantity: 0 }]
      }).success
    ).toBe(false);
  });

  it("requires review notes when an admin requests changes", () => {
    expect(
      reviewVendorDataRequestSchema.safeParse({
        action: "REQUEST_CHANGES",
        notes: "Please attach the quantity for the complete reporting period."
      }).success
    ).toBe(true);
    expect(
      reviewVendorDataRequestSchema.safeParse({
        action: "REQUEST_CHANGES"
      }).success
    ).toBe(false);
    expect(
      reviewVendorDataRequestSchema.safeParse({
        action: "APPROVE"
      }).success
    ).toBe(true);
  });

  it("allows an internal data record to carry optional vendor attribution", () => {
    expect(
      createDataRecordSchema.safeParse({
        ghgActivitySelectionId: ids.activity,
        vendorId: ids.vendor,
        recordDate: "2026-07-24",
        quantity: 125
      }).success
    ).toBe(true);
  });

  it("rejects tracking modes for activities that are not selected", () => {
    expect(
      updateGhgActivitySelectionsSchema.safeParse({
        activityIds: [ids.activity],
        vendorTrackingModes: {
          [ids.activity]: "REQUIRED"
        }
      }).success
    ).toBe(true);
    expect(
      updateGhgActivitySelectionsSchema.safeParse({
        activityIds: [ids.activity],
        vendorTrackingModes: {
          [ids.item]: "OPTIONAL"
        }
      }).success
    ).toBe(false);
  });
});
