-- Daily study-time charts for the selected week and its calendar month.
create or replace function public.planner_analysis(p_start date, p_scope text default 'week') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
  u uuid := auth.uid();
  local_now timestamp := statement_timestamp() at time zone 'Europe/Istanbul';
  as_of date := local_now::date;
  closed_through date := as_of - 1;
  chart_start date;
  chart_month date;
  chart_month_end date;
  result jsonb;
begin
  if u is null or not exists(select 1 from public.profiles where id=u) then raise exception 'Oturum gerekli'; end if;
  if p_start is null or extract(isodow from p_start)<>1 or p_scope is null or p_scope not in ('week','all') then
    raise exception 'Geçersiz analiz aralığı';
  end if;
  if local_now::time >= time '23:59' then closed_through := as_of; end if;
  chart_start := case when p_scope='all' then as_of - (extract(isodow from as_of)::integer - 1) else p_start end;
  chart_month := date_trunc('month',case when as_of between chart_start and chart_start+6 then as_of else chart_start end)::date;
  chart_month_end := (chart_month + interval '1 month' - interval '1 day')::date;

  with task_groups as (
    select t.date, t.category_id, t.title, t.completed, count(*)::integer as count
    from public.tasks t
    where t.user_id=u and t.deleted_at is null
      and (p_scope='all' or t.date between p_start-7 and p_start+6)
    group by t.date,t.category_id,t.title,t.completed
  ), study_records as (
    select s.date,s.minutes from public.day_study_time s
    where s.user_id=u and s.date<=as_of and (p_scope='all' or s.date between p_start-7 and p_start+6)
  ), chart_records as (
    select s.date,s.minutes from public.day_study_time s
    where s.user_id=u and s.date<=as_of
      and (s.date between chart_start and chart_start+6 or s.date between chart_month and chart_month_end)
  )
  select jsonb_build_object(
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) order by t.date,t.category_id,t.title,t.completed) from task_groups t where p_scope='all' or t.date>=p_start),'[]'::jsonb),
    'previous', coalesce((select jsonb_agg(to_jsonb(t) order by t.date,t.category_id,t.title,t.completed) from task_groups t where p_scope='week' and t.date<p_start),'[]'::jsonb),
    'studyTimes', coalesce((select jsonb_agg(to_jsonb(s) order by s.date) from study_records s where p_scope='all' or s.date>=p_start),'[]'::jsonb),
    'previousStudyTimes', coalesce((select jsonb_agg(to_jsonb(s) order by s.date) from study_records s where p_scope='week' and s.date<p_start),'[]'::jsonb),
    'chartStudyTimes', coalesce((select jsonb_agg(to_jsonb(s) order by s.date) from chart_records s),'[]'::jsonb),
    'chartMonth',chart_month,'chartMonthEnd',chart_month_end,
    -- Keep the previous frontend compatible during the deployment transition.
    'trend','[]'::jsonb,'monthlyTrend','[]'::jsonb,
    'asOf',as_of,'closedThrough',closed_through
  ) into result;
  return result;
end $$;
revoke all on function public.planner_analysis(date,text) from public,anon;
grant execute on function public.planner_analysis(date,text) to authenticated;
comment on function public.planner_analysis(date,text) is 'Read-only owner-scoped grouped analysis and daily study times for the selected week and calendar month. No individual task identifiers are exposed.';
