import { pgSchema, text, timestamp, boolean, varchar, uuid } from 'drizzle-orm/pg-core';

export const identitySchema = pgSchema('identity');

// Users table — no organization_id (users span orgs)
export const users = identitySchema.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: varchar('email', { length: 320 }).notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  role: varchar('role', { length: 20 }).default('member').notNull(), // owner, admin, member, viewer
  isBlocked: boolean('is_blocked').default(false),
  lastSignedIn: timestamp('last_signed_in'),
  loginMethod: varchar('login_method', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Sessions — no organization_id
export const sessions = identitySchema.table('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  activeOrganizationId: uuid('active_organization_id'),
});

// Accounts (OAuth + credential links) — no organization_id
export const accounts = identitySchema.table('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Verification tokens — no organization_id
export const verifications = identitySchema.table('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Organizations — the tenancy unit
export const organizations = identitySchema.table('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique(),
  logo: text('logo'),
  planId: uuid('plan_id'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  isBlocked: boolean('is_blocked').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Organization members — links users to orgs with roles
// Field names match Better Auth's organization plugin expectations
export const organizationMembers = identitySchema.table('organization_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).default('member').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Organization invites
// Field names match Better Auth's organization plugin expectations
export const organizationInvites = identitySchema.table('organization_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 320 }).notNull(),
  role: varchar('role', { length: 20 }).default('member').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  inviterId: uuid('inviter_id').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
