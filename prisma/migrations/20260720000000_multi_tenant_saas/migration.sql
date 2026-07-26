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

create table if not exists public.tenant_activity (
  id text primary key,
  company_id text references public.companies(id) on delete cascade,
  actor_id text,
  type text not null,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

insert into public.companies (
  id,
  name,
  status,
  subscription_status,
  plan,
  billing_cycle,
  trial_ends_at
)
values (
  'company-demo-acme',
  'Acme Support Operations',
  'active',
  'trialing',
  'growth',
  'monthly',
  now() + interval '14 days'
)
on conflict (id) do nothing;

insert into public.app_users (
  id,
  company_id,
  email,
  name,
  role,
  status,
  password_hash
)
values
  (
    'user-super-admin',
    null,
    'super@supportai.local',
    'Super Admin',
    'super_admin',
    'active',
    null
  ),
  (
    'user-company-admin',
    'company-demo-acme',
    'admin@acme.local',
    'Aminata Cole',
    'company_admin',
    'active',
    null
  ),
  (
    'user-company-agent',
    'company-demo-acme',
    'agent@acme.local',
    'Ibrahim Sesay',
    'company_user',
    'active',
    null
  )
on conflict (email) do nothing;

alter table public.bots
  add column if not exists company_id text;

update public.bots
set company_id = 'company-demo-acme'
where company_id is null;

alter table public.bots
  alter column company_id set not null;

alter table public.bots
  drop constraint if exists bots_company_id_fkey;

alter table public.bots
  add constraint bots_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete cascade;

alter table public.bot_documents
  add column if not exists company_id text;

update public.bot_documents bd
set company_id = b.company_id
from public.bots b
where bd.bot_id = b.id
  and bd.company_id is null;

update public.bot_documents
set company_id = 'company-demo-acme'
where company_id is null;

alter table public.bot_documents
  alter column company_id set not null;

alter table public.bot_documents
  drop constraint if exists bot_documents_company_id_fkey;

alter table public.bot_documents
  add constraint bot_documents_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete cascade;

create index if not exists companies_status_idx on public.companies(status);
create index if not exists app_users_company_role_idx on public.app_users(company_id, role);
create index if not exists app_users_status_idx on public.app_users(status);
create index if not exists bots_company_created_at_idx on public.bots(company_id, created_at desc);
create index if not exists bot_documents_company_uploaded_at_idx on public.bot_documents(company_id, uploaded_at desc);
create index if not exists tenant_activity_company_created_at_idx on public.tenant_activity(company_id, created_at desc);
create index if not exists tenant_activity_type_idx on public.tenant_activity(type);
