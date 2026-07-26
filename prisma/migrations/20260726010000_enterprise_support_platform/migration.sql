alter table public.companies
  add column if not exists logo_url text,
  add column if not exists industry text,
  add column if not exists description text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists country text,
  add column if not exists default_language text not null default 'en';

alter table public.bots
  add column if not exists updated_at timestamptz not null default now();

alter table public.tenant_activity
  add column if not exists action text,
  add column if not exists resource_type text,
  add column if not exists resource_id text,
  add column if not exists ip_address text,
  add column if not exists user_agent text;

create table if not exists public.company_settings (
  id text primary key,
  company_id text not null unique references public.companies(id) on delete cascade,
  widget_appearance jsonb,
  welcome_message text,
  offline_message text,
  bot_display_name text,
  bot_avatar_url text,
  supported_languages jsonb,
  business_hours jsonb,
  default_department_id text,
  auto_close_rules jsonb,
  ai_model text,
  response_tone text,
  confidence_threshold double precision,
  escalation_threshold double precision,
  restricted_topics jsonb,
  handoff_rules jsonb,
  citation_required boolean not null default true,
  max_response_length integer,
  notification_settings jsonb,
  security_settings jsonb,
  retention_settings jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  name text,
  email text,
  phone text,
  organization text,
  tags jsonb,
  custom_fields jsonb,
  consent_status text not null default 'unknown',
  consent_metadata jsonb,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_channel_identities (
  id text primary key,
  company_id text not null,
  contact_id text not null references public.contacts(id) on delete cascade,
  channel text not null,
  external_id text not null,
  display_name text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_identities_company_channel_external_key unique (company_id, channel, external_id)
);

create table if not exists public.conversations (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  bot_id text references public.bots(id) on delete set null,
  contact_id text references public.contacts(id) on delete set null,
  channel text not null default 'web',
  status text not null default 'open',
  mode text not null default 'AI_ACTIVE',
  priority text not null default 'normal',
  subject text,
  assigned_agent_id text references public.app_users(id) on delete set null,
  tags jsonb,
  last_message_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_mode_check check (mode in ('AI_ACTIVE', 'HUMAN_REQUESTED', 'HUMAN_ACTIVE', 'AI_PAUSED', 'RESOLVED', 'CLOSED')),
  constraint conversations_status_check check (status in ('open', 'pending', 'resolved', 'closed'))
);

create table if not exists public.messages (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  conversation_id text not null references public.conversations(id) on delete cascade,
  contact_id text references public.contacts(id) on delete set null,
  sender_user_id text references public.app_users(id) on delete set null,
  sender_type text not null,
  channel text not null,
  body text not null,
  metadata jsonb,
  external_message_id text,
  delivery_status text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_sender_type_check check (sender_type in ('customer', 'ai', 'agent', 'system')),
  constraint messages_company_channel_external_key unique (company_id, channel, external_message_id)
);

create table if not exists public.internal_notes (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  conversation_id text not null references public.conversations(id) on delete cascade,
  author_id text references public.app_users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_events (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  conversation_id text not null references public.conversations(id) on delete cascade,
  actor_id text references public.app_users(id) on delete set null,
  type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.channel_integrations (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  channel text not null,
  status text not null default 'pending',
  display_name text,
  encrypted_credential jsonb,
  webhook_secret_hash text,
  external_account_id text,
  last_webhook_event_id text,
  last_error text,
  connected_at timestamptz,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint channel_integrations_channel_check check (channel in ('web', 'whatsapp', 'facebook')),
  constraint channel_integrations_status_check check (status in ('connected', 'disconnected', 'pending', 'error', 'token_expired', 'reauthorization_required')),
  constraint channel_integrations_company_channel_key unique (company_id, channel)
);

create table if not exists public.subscriptions (
  id text primary key,
  company_id text not null unique references public.companies(id) on delete cascade,
  plan text not null,
  status text not null,
  billing_cycle text,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_plan_check check (plan in ('starter', 'growth', 'enterprise'))
);

create table if not exists public.usage_records (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  metric text not null,
  quantity integer not null default 0,
  period_start timestamptz not null,
  period_end timestamptz not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_company_name_key unique (company_id, name)
);

create table if not exists public.routing_rules (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  name text not null,
  priority integer not null default 100,
  status text not null default 'active',
  conditions jsonb not null,
  actions jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.escalation_rules (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  name text not null,
  priority integer not null default 100,
  status text not null default 'active',
  trigger text not null,
  conditions jsonb,
  actions jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sla_configs (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  channel text,
  priority text,
  first_response_minutes integer not null,
  resolution_minutes integer not null,
  business_hours jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sla_events (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  conversation_id text references public.conversations(id) on delete cascade,
  type text not null,
  due_at timestamptz,
  breached_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quality_reviews (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  conversation_id text not null references public.conversations(id) on delete cascade,
  reviewer_id text references public.app_users(id) on delete set null,
  score integer,
  status text not null default 'open',
  tags jsonb,
  criteria jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_reviews_score_check check (score is null or (score >= 0 and score <= 100))
);

create table if not exists public.approval_requests (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  requester_id text references public.app_users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  status text not null default 'pending',
  metadata jsonb,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approval_requests_status_check check (status in ('pending', 'approved', 'rejected', 'canceled'))
);

create table if not exists public.security_events (
  id text primary key,
  company_id text references public.companies(id) on delete cascade,
  actor_id text,
  type text not null,
  severity text not null default 'info',
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists companies_plan_status_idx on public.companies(plan, status);
create index if not exists bots_company_updated_at_idx on public.bots(company_id, updated_at desc);
create index if not exists tenant_activity_company_type_created_at_idx on public.tenant_activity(company_id, type, created_at desc);
create index if not exists contacts_company_last_activity_idx on public.contacts(company_id, last_activity_at desc);
create index if not exists contacts_company_email_idx on public.contacts(company_id, email);
create index if not exists contact_identities_contact_idx on public.contact_channel_identities(contact_id);
create index if not exists conversations_company_status_last_message_idx on public.conversations(company_id, status, last_message_at desc);
create index if not exists conversations_company_channel_status_idx on public.conversations(company_id, channel, status);
create index if not exists conversations_company_agent_idx on public.conversations(company_id, assigned_agent_id);
create index if not exists conversations_bot_idx on public.conversations(bot_id);
create index if not exists messages_company_conversation_created_idx on public.messages(company_id, conversation_id, created_at);
create index if not exists messages_company_created_idx on public.messages(company_id, created_at desc);
create index if not exists internal_notes_company_conversation_created_idx on public.internal_notes(company_id, conversation_id, created_at);
create index if not exists conversation_events_company_conversation_created_idx on public.conversation_events(company_id, conversation_id, created_at);
create index if not exists conversation_events_company_type_created_idx on public.conversation_events(company_id, type, created_at desc);
create index if not exists channel_integrations_company_status_idx on public.channel_integrations(company_id, status);
create index if not exists subscriptions_plan_status_idx on public.subscriptions(plan, status);
create index if not exists usage_records_company_metric_period_idx on public.usage_records(company_id, metric, period_start);
create index if not exists routing_rules_company_status_priority_idx on public.routing_rules(company_id, status, priority);
create index if not exists escalation_rules_company_status_priority_idx on public.escalation_rules(company_id, status, priority);
create index if not exists sla_configs_company_status_idx on public.sla_configs(company_id, status);
create index if not exists sla_events_company_type_created_idx on public.sla_events(company_id, type, created_at desc);
create index if not exists quality_reviews_company_status_created_idx on public.quality_reviews(company_id, status, created_at desc);
create index if not exists approval_requests_company_status_created_idx on public.approval_requests(company_id, status, created_at desc);
create index if not exists security_events_company_type_created_idx on public.security_events(company_id, type, created_at desc);

insert into public.subscriptions (id, company_id, plan, status, billing_cycle, current_period_start, current_period_end)
select
  'subscription-' || id,
  id,
  plan,
  subscription_status,
  billing_cycle,
  now(),
  coalesce(subscription_ends_at, now() + interval '30 days')
from public.companies
on conflict (company_id) do nothing;

insert into public.company_settings (
  id,
  company_id,
  welcome_message,
  offline_message,
  bot_display_name,
  supported_languages,
  business_hours,
  response_tone,
  confidence_threshold,
  escalation_threshold,
  notification_settings,
  security_settings,
  retention_settings
)
select
  'settings-' || id,
  id,
  'Hi, how can we help today?',
  'We are currently offline. Leave a message and our team will respond.',
  name || ' Support',
  '["en"]'::jsonb,
  '{"timezone":"UTC","weekdays":["mon","tue","wed","thu","fri"],"start":"09:00","end":"17:00"}'::jsonb,
  'professional',
  0.72,
  0.45,
  '{"email":true,"assignment":true,"escalation":true,"security":true}'::jsonb,
  '{"mfaRequired":false,"allowedDomains":[],"sessionHours":8}'::jsonb,
  '{"conversationRetentionDays":365,"auditRetentionDays":2555}'::jsonb
from public.companies
on conflict (company_id) do nothing;

insert into public.departments (id, company_id, name)
values
  ('department-demo-support', 'company-demo-acme', 'Support'),
  ('department-demo-billing', 'company-demo-acme', 'Billing')
on conflict (company_id, name) do nothing;

insert into public.channel_integrations (id, company_id, channel, status, display_name)
values
  ('integration-demo-web', 'company-demo-acme', 'web', 'connected', 'Website widget'),
  ('integration-demo-whatsapp', 'company-demo-acme', 'whatsapp', 'pending', 'WhatsApp Business'),
  ('integration-demo-facebook', 'company-demo-acme', 'facebook', 'pending', 'Facebook Messenger')
on conflict (company_id, channel) do nothing;
