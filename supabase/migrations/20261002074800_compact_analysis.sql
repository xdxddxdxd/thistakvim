-- Analysis exposes grouped counts, daily totals and eight weekly aggregates, never a task list.
create or replace function public.planner_analysis(p_start date, p_scope text default 'week') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
  u uuid := auth.uid();
  local_now timestamp := statement_timestamp() at time zone 'Europe/Istanbul';
  as_of date := local_now::date;
  closed_through date := as_of - 1;
  anchor date;
  result jsonb;
begin
  if u is null or not exists(select 1 from public.profiles where id=u) then raise exception 'Oturum gerekli'; end if;
  if p_start is null or extract(isodow from p_start)<>1 or p_scope is null or p_scope not in ('week','all') then
    raise exception 'Geçersiz analiz aralığı';
  end if;
  if local_now::time >= time '23:59' then closed_through := as_of; end if;
  anchor := least(p_start, as_of - (extract(isodow from as_of)::integer - 1));
  if p_scope='all' then anchor := as_of - (extract(isodow from as_of)::integer - 1); end if;

  with task_groups as (
    select t.date, t.category_id, t.title, t.completed, count(*)::integer as count
    from public.tasks t
    where t.user_id=u and t.deleted_at is null
      and (p_scope='all' or t.date between p_start-7 and p_start+6)
    group by t.date,t.category_id,t.title,t.completed
  ), study_records as (
    select s.date,s.minutes from public.day_study_time s
    where s.user_id=u and s.date<=as_of and (p_scope='all' or s.date between p_start-7 and p_start+6)
  ), weeks as (
    select anchor - (7 * g)::integer as start from generate_series(0,7) g
  ), weekly as (
    select w.start, greatest(0,least(7,closed_through-w.start+1)) as days,
      (select count(*)::integer from public.tasks t where t.user_id=u and t.deleted_at is null and t.date between w.start and least(w.start+6,closed_through)) as total,
      (select count(*)::integer from public.tasks t where t.user_id=u and t.deleted_at is null and t.completed and t.date between w.start and least(w.start+6,closed_through)) as completed,
      (select sum(s.minutes)::integer from public.day_study_time s where s.user_id=u and s.date between w.start and least(w.start+6,closed_through)) as minutes,
      (select count(*)::integer from public.day_study_time s where s.user_id=u and s.date between w.start and least(w.start+6,closed_through)) as "recordedDays"
    from weeks w
  )
  select jsonb_build_object(
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) order by t.date,t.category_id,t.title,t.completed) from task_groups t where p_scope='all' or t.date>=p_start),'[]'::jsonb),
    'previous', coalesce((select jsonb_agg(to_jsonb(t) order by t.date,t.category_id,t.title,t.completed) from task_groups t where p_scope='week' and t.date<p_start),'[]'::jsonb),
    'studyTimes', coalesce((select jsonb_agg(to_jsonb(s) order by s.date) from study_records s where p_scope='all' or s.date>=p_start),'[]'::jsonb),
    'previousStudyTimes', coalesce((select jsonb_agg(to_jsonb(s) order by s.date) from study_records s where p_scope='week' and s.date<p_start),'[]'::jsonb),
    'trend', coalesce((select jsonb_agg(to_jsonb(w) order by w.start) from weekly w),'[]'::jsonb),
    'asOf',as_of,'closedThrough',closed_through
  ) into result;
  return result;
end $$;
revoke all on function public.planner_analysis(date,text) from public,anon;
grant execute on function public.planner_analysis(date,text) to authenticated;
comment on function public.planner_analysis(date,text) is 'Read-only owner-scoped analysis. No remaining-task list or individual task identifiers are exposed.';
