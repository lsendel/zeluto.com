export function serializeOrg(org: Record<string, any>) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug ?? '',
    logo: org.logo ?? null,
    planId: org.planId ?? null,
    stripeCustomerId: org.stripeCustomerId ?? null,
    isBlocked: org.isBlocked ?? false,
    createdAt:
      org.createdAt instanceof Date
        ? org.createdAt.toISOString()
        : String(org.createdAt),
    updatedAt:
      org.updatedAt instanceof Date
        ? org.updatedAt.toISOString()
        : String(org.updatedAt),
  };
}

export function serializeInvite(invite: Record<string, any>) {
  return {
    id: invite.id,
    organizationId: invite.organizationId,
    email: invite.email,
    role: invite.role,
    token: invite.token,
    invitedBy: invite.invitedBy,
    expiresAt:
      invite.expiresAt instanceof Date
        ? invite.expiresAt.toISOString()
        : String(invite.expiresAt),
    acceptedAt:
      invite.acceptedAt instanceof Date
        ? invite.acceptedAt.toISOString()
        : (invite.acceptedAt ?? null),
    createdAt:
      invite.createdAt instanceof Date
        ? invite.createdAt.toISOString()
        : String(invite.createdAt),
  };
}
