import { describe, expect, it } from "vitest";

import { createInvitationSchema } from "../src/modules/invitations/invitations.schemas.js";

describe("createInvitationSchema", () => {
  it.each(["ADMIN", "USER"])("accepts the public company role %s", (role) => {
    expect(
      createInvitationSchema.safeParse({
        email: "member@example.com",
        role
      }).success
    ).toBe(true);
  });

  it("rejects platform-level roles", () => {
    expect(
      createInvitationSchema.safeParse({
        email: "member@example.com",
        role: "SUPER_ADMIN"
      }).success
    ).toBe(false);
  });
});
