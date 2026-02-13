/**
 * Field mappings from Mautic MySQL schema to Mauntic3 Postgres schema.
 *
 * Each map entry is:
 *   mauticColumn -> mauntic3Column | undefined (drop/special handling)
 *
 * Columns mapped to `undefined` are either dropped or handled via a custom
 * transform (e.g. points -> point system, Mautic IDs -> metadata).
 */

// ---------------------------------------------------------------------------
// Contacts (leads)
// ---------------------------------------------------------------------------

export const CONTACT_FIELD_MAP: Record<string, string | undefined> = {
  // Mautic column          -> Mauntic3 column
  id:                       undefined,        // generate new UUID, store old id in metadata.mautic_id
  email:                    'email',
  firstname:                'first_name',
  lastname:                 'last_name',
  phone:                    'phone',
  mobile:                   undefined,        // store in custom_fields.mobile
  company:                  undefined,        // resolve via company migration
  position:                 undefined,        // store in custom_fields.position
  title:                    undefined,        // store in custom_fields.title
  address1:                 undefined,        // store in custom_fields.address1
  address2:                 undefined,        // store in custom_fields.address2
  city:                     undefined,        // store in custom_fields.city
  state:                    undefined,        // store in custom_fields.state
  zipcode:                  undefined,        // store in custom_fields.zipcode
  country:                  undefined,        // store in custom_fields.country
  website:                  undefined,        // store in custom_fields.website
  points:                   undefined,        // migrate to point system (custom_fields.mautic_points)
  preferred_locale:         undefined,        // store in custom_fields.locale
  date_added:               'created_at',
  date_modified:            'updated_at',
  last_active:              'last_activity_at',
  date_identified:          undefined,        // store in custom_fields.date_identified
  owner_id:                 undefined,        // not directly mapped, store in metadata
  attribution:              undefined,        // store in custom_fields.attribution
  attribution_date:         undefined,        // store in custom_fields.attribution_date
  stage_id:                 undefined,        // store in custom_fields.mautic_stage_id
};

/**
 * Mautic lead fields that should be stored in `custom_fields` JSONB
 * on the Mauntic3 contact record.
 */
export const CONTACT_CUSTOM_FIELD_KEYS = [
  'mobile',
  'position',
  'title',
  'address1',
  'address2',
  'city',
  'state',
  'zipcode',
  'country',
  'website',
  'preferred_locale',
  'date_identified',
  'attribution',
  'attribution_date',
] as const;

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export const COMPANY_FIELD_MAP: Record<string, string | undefined> = {
  id:                       undefined,        // generate new UUID, store old id in metadata.mautic_id
  companyname:              'name',
  companyemail:             undefined,        // store in custom_fields.email
  companywebsite:           'domain',         // extract domain from URL
  companyindustry:          'industry',
  company_number_of_employees: 'size',        // map to size string
  companycity:              undefined,        // store in custom_fields.city
  companystate:             undefined,        // store in custom_fields.state
  companycountry:           undefined,        // store in custom_fields.country
  companyzipcode:           undefined,        // store in custom_fields.zipcode
  companyaddress1:          undefined,        // store in custom_fields.address1
  companyaddress2:          undefined,        // store in custom_fields.address2
  companyphone:             undefined,        // store in custom_fields.phone
  companyfax:               undefined,        // store in custom_fields.fax
  companyannual_revenue:    undefined,        // store in custom_fields.annual_revenue
  date_added:               'created_at',
  date_modified:            'updated_at',
};

export const COMPANY_CUSTOM_FIELD_KEYS = [
  'companyemail',
  'companycity',
  'companystate',
  'companycountry',
  'companyzipcode',
  'companyaddress1',
  'companyaddress2',
  'companyphone',
  'companyfax',
  'companyannual_revenue',
] as const;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const USER_FIELD_MAP: Record<string, string | undefined> = {
  id:                       undefined,        // generate new UUID, store old id in metadata.mautic_id
  username:                 undefined,        // store in metadata.mautic_username
  email:                    'email',
  first_name:               undefined,        // concatenate first_name + last_name -> name
  last_name:                undefined,        // concatenate first_name + last_name -> name
  role:                     undefined,        // map admin -> admin, others -> member
  date_added:               'created_at',
  last_login:               'last_signed_in',
  last_active:              undefined,        // store in metadata
};

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

export const EMAIL_TEMPLATE_FIELD_MAP: Record<string, string | undefined> = {
  id:                       undefined,        // generate new UUID
  name:                     'name',
  subject:                  'subject',
  custom_html:              'body_html',
  plain_text:               'body_text',
  template:                 undefined,        // Mautic template name, store in metadata
  category_id:              'category',       // resolve category name
  lang:                     undefined,        // store in metadata
  date_added:               'created_at',
  date_modified:            'updated_at',
  created_by:               'created_by',     // resolve to new user UUID
  is_published:             'is_active',
  publish_up:               undefined,        // store in metadata
  publish_down:             undefined,        // store in metadata
};

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export const FORM_FIELD_MAP: Record<string, string | undefined> = {
  id:                       undefined,        // generate new UUID
  name:                     'name',
  description:              'description',
  alias:                    undefined,        // store in metadata
  form_type:                undefined,        // Mautic form type, store in metadata
  is_published:             'is_active',
  cached_html:              undefined,        // not migrated
  post_action:              undefined,        // map to settings
  post_action_property:     'redirect_url',
  date_added:               'created_at',
  date_modified:            'updated_at',
  created_by:               undefined,        // resolve to new user UUID
};

// ---------------------------------------------------------------------------
// Landing Pages
// ---------------------------------------------------------------------------

export const LANDING_PAGE_FIELD_MAP: Record<string, string | undefined> = {
  id:                       undefined,        // generate new UUID
  title:                    'name',
  alias:                    'slug',
  custom_html:              undefined,        // store in template body
  template:                 undefined,        // Mautic template name
  is_published:             'is_published',
  publish_up:               'published_at',
  date_added:               'created_at',
  date_modified:            'updated_at',
  hits:                     'visit_count',
};

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export const CAMPAIGN_FIELD_MAP: Record<string, string | undefined> = {
  id:                       undefined,        // generate new UUID
  name:                     'name',
  description:              'description',
  is_published:             undefined,        // map to status
  date_added:               'created_at',
  date_modified:            'updated_at',
  created_by:               'created_by',     // resolve to new user UUID
  publish_up:               'scheduled_at',
};

// ---------------------------------------------------------------------------
// Categories -> Tags
// ---------------------------------------------------------------------------

export const CATEGORY_FIELD_MAP: Record<string, string | undefined> = {
  id:                       undefined,        // generate new UUID
  title:                    'name',
  color:                    'color',
  date_added:               'created_at',
};

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

export const MAUTIC_DO_NOT_CONTACT_REASONS: Record<number, string> = {
  1: 'unsubscribed',
  2: 'bounced',
  3: 'do_not_contact',
};

export function mapMauticStatus(
  dnc: number | null | undefined,
): 'active' | 'unsubscribed' | 'bounced' | 'do_not_contact' {
  if (dnc == null) return 'active';
  return (MAUTIC_DO_NOT_CONTACT_REASONS[dnc] as ReturnType<typeof mapMauticStatus>) ?? 'active';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a domain from a URL or email string. */
export function extractDomain(input: string | null): string | null {
  if (!input) return null;
  try {
    // Try as URL first
    if (input.includes('://')) {
      return new URL(input).hostname;
    }
    // Try as email
    if (input.includes('@')) {
      return input.split('@')[1] ?? null;
    }
    return input;
  } catch {
    return input;
  }
}

/** Map Mautic employee count to size string. */
export function mapCompanySize(employees: number | string | null): string | null {
  if (employees == null) return null;
  const n = typeof employees === 'string' ? parseInt(employees, 10) : employees;
  if (isNaN(n)) return String(employees);
  if (n <= 10) return '1-10';
  if (n <= 50) return '11-50';
  if (n <= 200) return '51-200';
  if (n <= 1000) return '201-1000';
  return '1000+';
}
