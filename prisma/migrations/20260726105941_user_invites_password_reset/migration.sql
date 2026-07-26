alter table public.app_users
  add column if not exists invitation_token_hash text,
  add column if not exists invitation_expires_at timestamptz,
  add column if not exists invited_at timestamptz,
  add column if not exists first_login_completed_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists password_reset_code_hash text,
  add column if not exists password_reset_expires_at timestamptz;

create index if not exists app_users_invitation_token_idx
  on public.app_users(invitation_token_hash);

create index if not exists app_users_password_reset_code_idx
  on public.app_users(password_reset_code_hash);
