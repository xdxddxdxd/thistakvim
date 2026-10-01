-- Study totals may be entered retrospectively, independently of task/day locks.
create table public.day_study_time (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  minutes integer not null check (minutes between 0 and 1440),
  primary key (user_id, date)
);
alter table public.day_study_time enable row level security;
revoke all on public.day_study_time from anon, authenticated;
grant select, insert, update on public.day_study_time to authenticated;
create policy read_own_study_time on public.day_study_time for select to authenticated
  using (user_id = (select auth.uid()));
create policy insert_own_study_time on public.day_study_time for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy update_own_study_time on public.day_study_time for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
