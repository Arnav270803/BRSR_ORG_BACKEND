import { describe, expect, it } from "vitest";

import { matchesPlatformOwnerEmail } from "../src/shared/security/platformOwner.js";

describe("matchesPlatformOwnerEmail", () => {
  it("matches the one configured owner email case-insensitively", () => {
    expect(matchesPlatformOwnerEmail("Owner@Example.com", "owner@example.com")).toBe(true);
  });

  it("does not grant owner access without a configured email", () => {
    expect(matchesPlatformOwnerEmail("owner@example.com", null)).toBe(false);
  });

  it("does not grant owner access to another email", () => {
    expect(matchesPlatformOwnerEmail("admin@example.com", "owner@example.com")).toBe(false);
  });
});
