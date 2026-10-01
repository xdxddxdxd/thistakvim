-- Keep finalization and RLS, but avoid four Data API round trips per week read.
create or replace function public.planner_week(p_start date) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null or p_start is null then raise exception 'Oturum ve tarih gerekli'; end if;
  perform public.finalize_my_days();
  return jsonb_build_object(
    'tasks', coalesce((select jsonb_agg(t order by t.position,t.id) from public.tasks t
      where t.user_id=u and t.date between p_start and p_start+6 and t.deleted_at is null),'[]'::jsonb),
    'notes', coalesce((select jsonb_agg(n order by n.date) from public.day_notes n
      where n.user_id=u and n.date between p_start and p_start+6),'[]'::jsonb),
    'statuses', coalesce((select jsonb_agg(s order by s.date) from public.day_status s
      where s.user_id=u and s.date between p_start and p_start+6),'[]'::jsonb)
  );
end $$;
revoke all on function public.planner_week(date) from public,anon;
grant execute on function public.planner_week(date) to authenticated;

-- Return authoritative snapshots of affected days in the mutation transaction.
-- This includes deleted/restored rows and rare reorder position renumbering.
create or replace function public.planner_mutate_with_tasks(p_action text,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare u uuid := auth.uid(); source_date date; affected date[] := '{}'; result jsonb;
begin
  if u is null then raise exception 'Oturum gerekli'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  if p_action in ('edit','toggle','delete','restore','move','copy') then
    select t.date into source_date from public.tasks t where t.id=(p_data->>'id')::uuid and t.user_id=u;
    if source_date is not null then affected := array_append(affected,source_date); end if;
  end if;
  result := public.planner_mutate(p_action,p_data);
  if p_action in ('create','move') then
    affected := array_append(affected,(p_data->>'date')::date);
  elsif p_action='copy' then
    affected := affected || array(select distinct value::date from jsonb_array_elements_text(p_data->'dates'));
  end if;
  select array_agg(distinct d) into affected from unnest(affected) d;
  return result || jsonb_build_object(
    'dates',coalesce(to_jsonb(affected),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(t order by t.position,t.id) from public.tasks t
      where t.user_id=u and t.date=any(affected) and t.deleted_at is null),'[]'::jsonb)
  );
end $$;
revoke all on function public.planner_mutate_with_tasks(text,jsonb) from public,anon;
grant execute on function public.planner_mutate_with_tasks(text,jsonb) to authenticated;
