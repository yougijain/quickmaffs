-- Additional context captured per session/attempt. Additive & nullable so
-- existing rows are preserved.
alter table public.sessions add column if not exists platform    text;
alter table public.sessions add column if not exists user_agent  text;
alter table public.sessions add column if not exists local_hour  int;
alter table public.sessions add column if not exists timezone    text;

alter table public.attempts add column if not exists answer_digits int;
