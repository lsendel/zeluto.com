export function serializeUser(user: Record<string, any>) {
  return {
    id: user.id,
    name: user.name ?? '',
    email: user.email,
    emailVerified: user.emailVerified ?? false,
    image: user.image ?? null,
    role: user.role,
    isBlocked: user.isBlocked ?? false,
    lastSignedIn:
      user.lastSignedIn instanceof Date
        ? user.lastSignedIn.toISOString()
        : user.lastSignedIn ?? null,
    loginMethod: user.loginMethod ?? null,
    createdAt:
      user.createdAt instanceof Date
        ? user.createdAt.toISOString()
        : String(user.createdAt),
    updatedAt:
      user.updatedAt instanceof Date
        ? user.updatedAt.toISOString()
        : String(user.updatedAt),
  };
}
