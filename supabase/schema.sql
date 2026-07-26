create table if not exists public.companies (
  id text primary key,
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  subscription_status text not null default 'trialing',
  plan text not null default 'starter',
  billing_cycle text,
  trial_ends_at timestamptz,
  subscription_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id text primary key,
  company_id text references public.companies(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null default 'company_user' check (role in ('super_admin', 'company_admin', 'company_user')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  password_hash text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_company_required_for_tenant_users
    check ((role = 'super_admin' and company_id is null) or (role <> 'super_admin' and company_id is not null))
);

create table if not exists public.bots (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  accent_color text not null default '#2563eb',
  logo_data_url text,
  initials text not null,
  created_at timestamptz not null default now(),
  status text not null default 'draft' check (status in ('active', 'draft')),
  total_queries integer not null default 0
);

create table if not exists public.bot_documents (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  bot_id text not null references public.bots(id) on delete cascade,
  name text not null,
  size integer not null default 0,
  type text not null,
  uploaded_at timestamptz not null default now(),
  status text not null default 'ready' check (status in ('processing', 'ready', 'failed')),
  hash text,
  stored_name text,
  content text,
  source text check (source in ('upload', 'rich-text'))
);

create table if not exists public.tenant_activity (
  id text primary key,
  company_id text references public.companies(id) on delete cascade,
  actor_id text,
  type text not null,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

insert into public.companies (id, name, status, subscription_status, plan, billing_cycle, trial_ends_at)
values ('company-demo-acme', 'Acme Support Operations', 'active', 'trialing', 'growth', 'monthly', now() + interval '14 days')
on conflict (id) do nothing;

insert into public.app_users (id, company_id, email, name, role, status)
values
  ('user-super-admin', null, 'super@supportai.local', 'Super Admin', 'super_admin', 'active'),
  ('user-company-admin', 'company-demo-acme', 'admin@acme.local', 'Aminata Cole', 'company_admin', 'active'),
  ('user-company-agent', 'company-demo-acme', 'agent@acme.local', 'Ibrahim Sesay', 'company_user', 'active')
on conflict (email) do nothing;

create index if not exists companies_status_idx on public.companies(status);
create index if not exists app_users_company_role_idx on public.app_users(company_id, role);
create index if not exists app_users_status_idx on public.app_users(status);
create index if not exists bots_company_created_at_idx on public.bots(company_id, created_at desc);
create index if not exists bot_documents_company_uploaded_at_idx on public.bot_documents(company_id, uploaded_at desc);
create index if not exists bot_documents_bot_id_idx on public.bot_documents(bot_id);
create index if not exists bot_documents_hash_idx on public.bot_documents(hash);
create index if not exists bots_created_at_idx on public.bots(created_at desc);
create index if not exists tenant_activity_company_created_at_idx on public.tenant_activity(company_id, created_at desc);
create index if not exists tenant_activity_type_idx on public.tenant_activity(type);

insert into storage.buckets (id, name, public)
values ('bot-documents', 'bot-documents', false)
on conflict (id) do update set public = excluded.public;
