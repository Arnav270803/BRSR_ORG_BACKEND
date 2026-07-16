import { describe, expect, it } from "vitest";

import {
  buildEmissionsSummary,
  normalizeEmissionsScope
} from "../src/modules/emissionsSummary/emissionsSummary.service.js";

const context = {
  companyId: "11111111-1111-1111-1111-111111111111",
  siteId: "22222222-2222-2222-2222-222222222222",
  reportingYearId: "33333333-3333-3333-3333-333333333333"
};

describe("normalizeEmissionsScope", () => {
  it.each([
    ["Scope 1", "SCOPE_1"],
    ["SCOPE_2", "SCOPE_2"],
    ["Scope-3 emissions", "SCOPE_3"],
    ["Outside of scopes", "OUTSIDE_SCOPES"],
    ["Biogenic CO2", "OUTSIDE_SCOPES"],
    [null, "UNCLASSIFIED"]
  ])("maps %s to %s", (scope, expected) => {
    expect(normalizeEmissionsScope(scope)).toBe(expected);
  });
});

describe("buildEmissionsSummary", () => {
  it("combines scope variants and keeps outside-scope emissions out of the gross total", () => {
    const summary = buildEmissionsSummary({
      context,
      scopeRows: [
        { scope: "Scope 1", recordCount: 2, calculatedRecordCount: 2, totalKgCo2e: "100.5" },
        { scope: "scope_1", recordCount: 1, calculatedRecordCount: 1, totalKgCo2e: "9.5" },
        { scope: "Scope 2", recordCount: 1, calculatedRecordCount: 1, totalKgCo2e: "40" },
        { scope: "Scope 3", recordCount: 2, calculatedRecordCount: 1, totalKgCo2e: "25" },
        {
          scope: "Outside of scopes",
          recordCount: 1,
          calculatedRecordCount: 1,
          totalKgCo2e: "12"
        },
        { scope: null, recordCount: 1, calculatedRecordCount: 0, totalKgCo2e: "0" }
      ],
      categoryRows: [
        {
          name: "Purchased electricity",
          recordCount: 1,
          calculatedRecordCount: 1,
          totalKgCo2e: "40"
        }
      ],
      coverageRow: {
        totalRecords: 8,
        calculatedRecords: 6,
        lastUpdatedAt: "2026-07-17T10:00:00.000Z"
      }
    });

    expect(summary.totals).toEqual({
      grossKgCo2e: "175",
      scope1KgCo2e: "110",
      scope2KgCo2e: "40",
      scope3KgCo2e: "25",
      outsideScopesKgCo2e: "12",
      unclassifiedKgCo2e: "0"
    });
    expect(summary.scopes.find((scope) => scope.key === "SCOPE_1")).toMatchObject({
      recordCount: 3,
      calculatedRecordCount: 3,
      totalKgCo2e: "110"
    });
    expect(summary.coverage).toMatchObject({
      totalRecords: 8,
      calculatedRecords: 6,
      uncalculatedRecords: 2,
      calculationCoveragePercent: 75
    });
  });

  it("returns a stable zero summary when no records exist", () => {
    const summary = buildEmissionsSummary({
      context: { ...context, siteId: null },
      scopeRows: [],
      categoryRows: [],
      coverageRow: {
        totalRecords: 0,
        calculatedRecords: 0,
        lastUpdatedAt: null
      }
    });

    expect(summary.context.aggregationScope).toBe("COMPANY");
    expect(summary.totals.grossKgCo2e).toBe("0");
    expect(summary.scopes).toHaveLength(5);
    expect(summary.coverage.calculationCoveragePercent).toBe(0);
  });
});
