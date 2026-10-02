-- Read-only verification; no tasks or study records are created.
begin;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub',(select id from public.profiles order by created_at,id limit 1),'role','authenticated'
)::text,true);
set local role authenticated;
do $$
declare
  start date := date_trunc('week',statement_timestamp() at time zone 'Europe/Istanbul')::date;
  data jsonb;
  expected integer;
begin
  data := public.planner_analysis(start,'week');
  if jsonb_typeof(data->'chartStudyTimes')<>'array' then raise exception 'Daily chart records required'; end if;
  if (data->>'chartMonth')::date<>date_trunc('month',(data->>'asOf')::date)::date then raise exception 'Current month differs'; end if;
  if exists(select 1 from jsonb_array_elements(data->'tasks') t where t ?| array['id','description','position','remaining']) then
    raise exception 'Task-list fields leaked into analysis';
  end if;
  select count(*) into expected from public.tasks where user_id=auth.uid() and deleted_at is null and date between start and start+6;
  if coalesce((select sum((t->>'count')::integer) from jsonb_array_elements(data->'tasks') t),0)<>expected then raise exception 'Week counts differ'; end if;
  data := public.planner_analysis(start,'all');
  if jsonb_array_length(data->'previous')<>0 then raise exception 'General view included a previous-week list'; end if;
  if data ? 'remaining' or data ? 'filter' then raise exception 'Removed analysis feature present'; end if;
  select count(*) into expected from public.tasks where user_id=auth.uid() and deleted_at is null;
  if coalesce((select sum((t->>'count')::integer) from jsonb_array_elements(data->'tasks') t),0)<>expected then raise exception 'General counts differ'; end if;
  if has_function_privilege('anon','public.planner_analysis(date,text)','execute') then raise exception 'Anonymous access granted'; end if;
  data := public.planner_analysis(date '2024-02-19','week');
  if (data->>'chartMonth')::date<>date '2024-02-01' or (data->>'chartMonthEnd')::date<>date '2024-02-29' then
    raise exception 'Leap-month boundary incorrect';
  end if;
end $$;
reset role;
rollback;
select 'Grouped counts, daily chart records, calendar-month boundaries and owner access verified' as result;
