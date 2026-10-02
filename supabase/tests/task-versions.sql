-- Version guards run against one temporary task; all changes are rolled back.
begin;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select id from public.profiles order by created_at, id limit 1),
  'role', 'authenticated'
)::text, true);
set local role authenticated;

do $$
declare
  task public.tasks;
  result jsonb;
  action text;
  invalid_version jsonb;
  rejected boolean;
  target date := (clock_timestamp() at time zone 'Europe/Istanbul')::date + 14;
begin
  result := public.planner_mutate('create', jsonb_build_object(
    'date', target,
    'category_id', (select id from public.categories order by position, id limit 1),
    'title', '[version-test] Temporary task'
  ));
  select * into task from public.tasks where id = (result->>'id')::uuid;

  foreach action in array array['edit', 'toggle', 'delete', 'move', 'copy'] loop
    for invalid_version in select value from jsonb_array_elements(
      '[{}, {"updated_at":null}, {"updated_at":""}, {"updated_at":42}, {"updated_at":"invalid"}]'::jsonb
    ) loop
      rejected := false;
      begin
        perform public.planner_mutate(action, jsonb_build_object(
          'id', task.id, 'date', target + 1, 'dates', jsonb_build_array(target + 1),
          'category_id', task.category_id, 'title', 'Must not overwrite'
        ) || invalid_version);
      exception when others then rejected := true;
      end;
      if not rejected then raise exception 'Invalid version accepted for %: %', action, invalid_version; end if;
      if (select to_jsonb(t) from public.tasks t where id = task.id) is distinct from to_jsonb(task) then
        raise exception 'Rejected mutation changed the task';
      end if;
    end loop;
  end loop;

  perform public.planner_mutate('toggle', jsonb_build_object('id', task.id, 'updated_at', task.updated_at));
  if not (select completed from public.tasks where id = task.id) then raise exception 'Current version rejected'; end if;
  rejected := false;
  begin
    perform public.planner_mutate('toggle', jsonb_build_object('id', task.id, 'updated_at', task.updated_at));
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Stale version accepted'; end if;

  select * into task from public.tasks where id = task.id;
  perform public.planner_mutate('delete', jsonb_build_object('id', task.id, 'updated_at', task.updated_at));
  perform public.planner_mutate('restore', jsonb_build_object('id', task.id));
  if (select deleted_at from public.tasks where id = task.id) is not null then raise exception 'Undo without version failed'; end if;
end $$;

reset role;
rollback;
select 'Missing, null, malformed and stale task versions rejected; valid updates and timed undo preserved' as result;
