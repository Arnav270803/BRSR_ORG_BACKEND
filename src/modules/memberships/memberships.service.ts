import { MembershipStatus } from "@prisma/client";

import { prisma } from "../../infra/prisma/client.js";

export async function getActiveCompanyMembership(userId: string, companyId: string) {
  return prisma.companyMembership.findFirst({
    where: {
      userId,
      companyId,
      status: MembershipStatus.ACTIVE
    },
    include: {
      company: true
    }
  });
}

export async function countActiveMembershipsForUser(userId: string): Promise<number> {
  return prisma.companyMembership.count({
    where: {
      userId,
      status: MembershipStatus.ACTIVE
    }
  });
}
