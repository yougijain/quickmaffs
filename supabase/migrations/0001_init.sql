-- QuickMaffs schema.
-- Owner-only RLS on every table. `meta jsonb` catch-alls let future features
-- store data without a migration. Raw per-attempt signals are captured now
-- because history can't be backfilled later.

-- Profiles: one row per auth user (created by trigger below).
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  handle       text unique,
  timezone     text,
  meta         jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  mode           text not null default 'classic',
  started_at     timestamptz not null,
  ended_at       timestamptz,
  duration_sec   int not null,
  score          int not null,
  total_attempts int not null default 0,
  correct        int not null default 0,
  errors         int not null default 0,
  accuracy       real,
  median_ms      int,
  focus          jsonb not null default '[]',
  seed           bigint,
  config         jsonb not null,
  app_version    text,
  meta           jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

create table if not exists public.attempts (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.sessions (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  idx            int not null default 0,
  op             text not null,
  operand_a      int not null,
  operand_b      int not null,
  answer         int not null,
  given          int,
  correct        boolean not null,
  time_ms        int not null,
  first_input_ms int,
  corrections    int not null default 0,
  prompt         text,
  bucket         text not null,
  targeted       boolean not null default false,
  ts             timestamptz not null,
  meta           jsonb not null default '{}'
);

create index if not exists attempts_user_bucket_idx on public.attempts (user_id, bucket);
create index if not exists attempts_user_ts_idx     on public.attempts (user_id, ts);
create index if not exists attempts_session_idx      on public.attempts (session_id);
create index if not exists sessions_user_started_idx on public.sessions (user_id, started_at desc);
create index if not exists sessions_user_score_idx   on public.sessions (user_id, score desc);

alter table public.profiles  enable row level security;
alter table public.sessions  enable row level security;
alter table public.attempts  enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.sessions;
create policy "own rows" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.attempts;
create policy "own rows" on public.attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create a profile row for every new (including anonymous) user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The trigger function must not be callable directly via the REST RPC surface.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
