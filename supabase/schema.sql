-- Run this in the Supabase SQL editor (Database → SQL Editor → New query).
-- Single-user app: auth is handled at the application layer via APP_PASSWORD.
-- Reads/writes use the service role key, so RLS is intentionally disabled.

create table if not exists public.audiobooks (
  source_url text primary key,
  title text not null,
  chapters jsonb not null,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress (
  user_id uuid not null,
  url text not null,
  chapter_index integer not null default 0,
  timestamp double precision not null default 0,
  speed double precision not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, url)
);

create index if not exists progress_updated_at_idx
  on public.progress (updated_at desc);

alter table public.audiobooks disable row level security;
alter table public.progress disable row level security;
