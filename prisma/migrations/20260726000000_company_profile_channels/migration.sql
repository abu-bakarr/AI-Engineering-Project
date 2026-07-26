alter table public.companies
  add column if not exists website text,
  add column if not exists support_email text,
  add column if not exists timezone text not null default 'UTC',
  add column if not exists whatsapp_enabled boolean not null default false,
  add column if not exists facebook_enabled boolean not null default false,
  add column if not exists live_chat_enabled boolean not null default false;

update public.companies
set
  whatsapp_enabled = case when plan in ('growth', 'enterprise') then whatsapp_enabled else false end,
  facebook_enabled = case when plan in ('growth', 'enterprise') then facebook_enabled else false end,
  live_chat_enabled = case when plan in ('growth', 'enterprise') then live_chat_enabled else false end;
