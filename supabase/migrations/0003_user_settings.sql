-- user_settings: per-account config + goal, synced cross-device.
-- The client (src/data/sync.ts) has always upserted/selected this table, but it
-- was never created, so settings sync silently no-op'd. This adds it with the
-- same owner-only RLS + auth.users cascade as the other tables.

create table if not exists public.user_settings (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  config      jsonb not null,
  goal_score  integer not null default 40,
  updated_at  timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "own settings" on public.user_settings;
create policy "own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
