import { pgSchema, uuid, varchar, text, timestamp, jsonb, boolean, integer, bigint } from 'drizzle-orm/pg-core';

export const contentSchema = pgSchema('content');

// Templates
export const templates = contentSchema.table('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // email/sms/push/page
  category: varchar('category', { length: 100 }),
  subject: varchar('subject', { length: 500 }),
  bodyHtml: text('body_html'),
  bodyText: text('body_text'),
  bodyJson: jsonb('body_json'), // for block editor
  thumbnailUrl: text('thumbnail_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Template versions
export const templateVersions = contentSchema.table('template_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id')
    .notNull()
    .references(() => templates.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  bodyHtml: text('body_html'),
  bodyText: text('body_text'),
  bodyJson: jsonb('body_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Forms
export const forms = contentSchema.table('forms', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  fields: jsonb('fields').notNull(), // form field definitions
  settings: jsonb('settings'), // form settings (e.g., double opt-in, notifications)
  redirectUrl: text('redirect_url'),
  isActive: boolean('is_active').default(true).notNull(),
  submissionCount: integer('submission_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Form submissions
export const formSubmissions = contentSchema.table('form_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  formId: uuid('form_id')
    .notNull()
    .references(() => forms.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull(),
  contactId: uuid('contact_id'),
  data: jsonb('data').notNull(), // submitted form data
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Landing pages
export const landingPages = contentSchema.table('landing_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  templateId: uuid('template_id').references(() => templates.id),
  isPublished: boolean('is_published').default(false).notNull(),
  publishedAt: timestamp('published_at'),
  visitCount: integer('visit_count').default(0).notNull(),
  conversionCount: integer('conversion_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Assets (files stored in R2)
export const assets = contentSchema.table('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  fileKey: text('file_key').notNull(), // R2 object key
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  folder: varchar('folder', { length: 255 }),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
