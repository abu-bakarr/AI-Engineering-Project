begin;

drop table if exists public.bot_documents;
drop table if exists public.bots;

create table if not exists public.bots (
  id text primary key,
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

create index if not exists bot_documents_bot_id_idx on public.bot_documents(bot_id);
create index if not exists bot_documents_hash_idx on public.bot_documents(hash);
create index if not exists bots_created_at_idx on public.bots(created_at desc);

insert into storage.buckets (id, name, public)
values (:'storage_bucket', :'storage_bucket', false)
on conflict (id) do update set public = excluded.public;

commit;
