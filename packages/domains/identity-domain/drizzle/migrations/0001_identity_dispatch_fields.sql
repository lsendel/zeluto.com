ALTER TABLE identity.organization_members
  RENAME COLUMN created_at TO joined_at;

ALTER TABLE identity.organization_members
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE identity.organization_members
  ADD COLUMN invited_by uuid;

ALTER TABLE identity.organization_members
  ADD CONSTRAINT organization_members_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES identity.users(id) ON DELETE SET NULL;

ALTER TABLE identity.organization_invites
  RENAME COLUMN inviter_id TO invited_by;

ALTER TABLE identity.organization_invites
  ADD COLUMN token text;

UPDATE identity.organization_invites
  SET token = id::text
  WHERE token IS NULL;

ALTER TABLE identity.organization_invites
  ALTER COLUMN token SET NOT NULL;

ALTER TABLE identity.organization_invites
  ADD CONSTRAINT organization_invites_token_key UNIQUE (token);

ALTER TABLE identity.organization_invites
  ADD COLUMN accepted_at TIMESTAMPTZ;

ALTER TABLE identity.organization_invites
  ADD CONSTRAINT organization_invites_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES identity.users(id) ON DELETE CASCADE;
