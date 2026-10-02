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
  if jsonb_array_length(data->'trend')<>8 then raise exception 'Eight trend weeks required'; end if;
  if jsonb_array_length(data->'monthlyTrend')<>6 then raise exception 'Six trend months required'; end if;
  if exists(select 1 from jsonb_array_elements(data->'tasks') t where t ?| array['id','description','position','remaining']) then
    raise exception 'Task-list fields leaked into analysis';
  end if;
  select count(*) into expected from public.tasks where user_id=auth.uid() and deleted_at is null and date between start and start+6;
  if coalesce((select sum((t->>'count')::integer) from jsonb_array_elements(data->'tasks') t),0)<>expected then raise exception 'Week counts differ'; end if;
  if exists(select 1 from jsonb_array_elements(data->'trend') w where (w->>'days')::integer not between 0 and 7) then raise exception 'Invalid closed-day range'; end if;
  data := public.planner_analysis(start,'all');
  if jsonb_array_length(data->'previous')<>0 then raise exception 'General view included a previous-week list'; end if;
  if data ? 'remaining' or data ? 'filter' then raise exception 'Removed analysis feature present'; end if;
  select count(*) into expected from public.tasks where user_id=auth.uid() and deleted_at is null;
  if coalesce((select sum((t->>'count')::integer) from jsonb_array_elements(data->'tasks') t),0)<>expected then raise exception 'General counts differ'; end if;
  if has_function_privilege('anon','public.planner_analysis(date,text)','execute') then raise exception 'Anonymous access granted'; end if;
  data := public.planner_analysis(date '2024-02-19','week');
  if (data->'monthlyTrend'->5->>'end')::date<>date '2024-02-29' or (data->'monthlyTrend'->5->>'days')::integer<>29 then
    raise exception 'Leap-month boundary incorrect';
  end if;
end $$;
reset role;
rollback;
select 'Grouped counts, eight weeks, six months, leap-month boundaries and owner access verified' as result;
