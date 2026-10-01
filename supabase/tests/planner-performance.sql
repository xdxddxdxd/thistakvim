-- Temporary fixtures and all mutations are rolled back.
begin;
select set_config('test.user',(select id::text from public.profiles limit 1),true);
select set_config('test.category',(select id::text from public.categories where user_id=current_setting('test.user')::uuid order by position limit 1),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.user'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare r jsonb; t public.tasks; failed boolean := false; removed uuid;
begin
  r := public.planner_mutate_with_tasks('create',jsonb_build_object('date','2045-05-01','category_id',current_setting('test.category'),'title','[perf-test] Main'));
  select * into t from public.tasks where id=(r->>'id')::uuid;
  if jsonb_array_length(r->'tasks')<>1 or not (r->'dates' ? '2045-05-01') then raise exception 'Missing create snapshot'; end if;
  r := public.planner_mutate_with_tasks('toggle',jsonb_build_object('id',t.id,'updated_at',t.updated_at));
  if not (r->'tasks'->0->>'completed')::boolean or (r->'tasks'->0->>'updated_at')::timestamptz=t.updated_at then raise exception 'Missing live completion/revision'; end if;
  begin perform public.planner_mutate_with_tasks('toggle',jsonb_build_object('id',t.id,'updated_at',t.updated_at)); exception when others then failed:=true; end;
  if not failed then raise exception 'Stale task write accepted'; end if;
  select * into t from public.tasks where id=t.id;
  r := public.planner_mutate_with_tasks('copy',jsonb_build_object('id',t.id,'updated_at',t.updated_at,'dates',jsonb_build_array('2045-05-02')));
  if jsonb_array_length(r->'tasks')<>2 or exists(select 1 from public.tasks where date='2045-05-02' and completed) then raise exception 'Invalid copy snapshot'; end if;
  r := public.planner_mutate_with_tasks('move',jsonb_build_object('id',t.id,'updated_at',t.updated_at,'date','2045-05-02'));
  if not (r->'dates' ? '2045-05-01') or not (r->'dates' ? '2045-05-02') or exists(select 1 from jsonb_array_elements(r->'tasks') x where x->>'date'='2045-05-01') then raise exception 'Invalid move snapshot'; end if;
  select * into t from public.tasks where id=t.id;
  r := public.planner_mutate_with_tasks('delete',jsonb_build_object('id',t.id,'updated_at',t.updated_at));
  if r->>'expires_at' is null or jsonb_array_length(r->'tasks')<>1 then raise exception 'Invalid delete snapshot'; end if;
  r := public.planner_mutate_with_tasks('restore',jsonb_build_object('id',t.id));
  if jsonb_array_length(r->'tasks')<>2 then raise exception 'Invalid undo snapshot'; end if;
  failed:=false;
  begin perform public.planner_mutate_with_tasks('create',jsonb_build_object('date','2020-01-01','category_id',current_setting('test.category'),'title','Invalid past')); exception when others then failed:=true; end;
  if not failed then raise exception 'Past write accepted'; end if;
end $$;
reset role;
insert into public.tasks(user_id,date,category_id,title,position)
select current_setting('test.user')::uuid,'2045-06-01',current_setting('test.category')::uuid,'[perf-test] Pagination '||i,i*1024 from generate_series(1,1001) i;
set local role authenticated;
do $$ declare r jsonb;
begin
  r:=public.planner_week('2045-06-01');
  if jsonb_array_length(r->'tasks')<>1001 then raise exception 'Week read truncates tasks'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if jsonb_array_length(public.planner_week('2045-06-01')->'tasks')<>0 then raise exception 'Cross-user week data leaked'; end if;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.planner_week(date)','EXECUTE') or has_function_privilege('anon','public.planner_mutate_with_tasks(text,jsonb)','EXECUTE') then raise exception 'Anonymous RPC exposed'; end if;
end $$;
rollback;
select 'Atomic task snapshots, CAS, immutable history, >1000 tasks, RLS and anonymous guards passed; fixtures rolled back' as result;
