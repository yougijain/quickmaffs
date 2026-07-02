-- QuickMaffs schema: sessions, per-attempt analytics, and user settings.
-- All rows are owned by the authenticated user (owner-only RLS).

create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  started_at   timestamptz not null,
  duration_sec int not null,
  score        int not null,
  mode         text not null default 'classic',
  config       jsonb not null,
  created_at   timestamptz not null default now()
);

create table if not exists public.attempts (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  op          text not null,
  operand_a   int not null,
  operand_b   int not null,
  answer      int not null,
  given       int,
  correct     boolean not null,
  time_ms     int not null,
  corrections int not null default 0,
  bucket      text not null,
  ts          timestamptz not null
);

create table if not exists public.user_settings (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  config      jsonb not null,
  goal_score  int not null default 40,
  updated_at  timestamptz not null default now()
);

create index if not exists attempts_user_bucket_idx on public.attempts (user_id, bucket);
create index if not exists attempts_user_ts_idx on public.attempts (user_id, ts);
create index if not exists sessions_user_score_idx on public.sessions (user_id, score desc);

alter table public.sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "own rows" on public.sessions;
create policy "own rows" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.attempts;
create policy "own rows" on public.attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own row" on public.user_settings;
create policy "own row" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
