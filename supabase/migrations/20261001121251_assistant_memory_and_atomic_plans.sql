-- Conversation text is never persisted. Only short study preferences and
-- content-free application receipts survive a closed assistant page.
create table public.assistant_memory (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  facts jsonb not null default '{}' check(jsonb_typeof(facts)='object'),
  forgotten_keys text[] not null default '{}',
  revision integer not null default 0 check(revision>=0),
  updated_at timestamptz not null default now()
);
alter table public.assistant_memory enable row level security;
revoke all on public.assistant_memory from anon,authenticated;
grant select,insert,update on public.assistant_memory to authenticated;
create policy own_assistant_memory on public.assistant_memory for select to authenticated using(user_id=(select auth.uid()));
create policy insert_assistant_memory on public.assistant_memory for insert to authenticated with check(user_id=(select auth.uid()));
create policy update_assistant_memory on public.assistant_memory for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create function public.save_assistant_memory(p_patch jsonb,p_revision integer,p_mode text default 'manual') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); r public.assistant_memory; k text; v jsonb; facts jsonb; blocked text[];
begin
  if u is null then raise exception 'Oturum gerekli'; end if;
  if p_mode not in ('auto','manual','allow') or jsonb_typeof(p_patch) is distinct from 'object' or p_revision is null or p_revision<0 then raise exception 'Geçersiz hafıza'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  select * into r from public.assistant_memory where user_id=u for update;
  if not found then r.user_id:=u; r.facts:='{}'; r.forgotten_keys:='{}'; r.revision:=0; end if;
  if r.revision<>p_revision then return jsonb_build_object('conflict',true,'current',to_jsonb(r)); end if;
  facts:=r.facts; blocked:=r.forgotten_keys;
  for k,v in select * from jsonb_each(p_patch) loop
    if k not in ('hedef','zorlanilan_dersler','calisma_tercihi','musaitlik','diger') or (v<>'null'::jsonb and (jsonb_typeof(v)<>'string' or length(v#>>'{}')>500)) then raise exception 'Geçersiz hafıza alanı'; end if;
    if p_mode='allow' then blocked:=array_remove(blocked,k);
    elsif p_mode='auto' then
      if not k=any(blocked) and v<>'null'::jsonb and length(trim(v#>>'{}'))>0 then facts:=jsonb_set(facts,array[k],v); end if;
    elsif v='null'::jsonb or length(trim(v#>>'{}'))=0 then
      facts:=facts-k;
      if not k=any(blocked) then blocked:=array_append(blocked,k); end if;
    else facts:=jsonb_set(facts,array[k],v); blocked:=array_remove(blocked,k);
    end if;
  end loop;
  if facts=r.facts and blocked=r.forgotten_keys then return to_jsonb(r); end if;
  insert into public.assistant_memory(user_id,facts,forgotten_keys,revision,updated_at)
    values(u,facts,blocked,r.revision+1,clock_timestamp())
    on conflict(user_id) do update set facts=excluded.facts,forgotten_keys=excluded.forgotten_keys,revision=excluded.revision,updated_at=excluded.updated_at
    returning * into r;
  return to_jsonb(r);
end $$;
revoke all on function public.save_assistant_memory(jsonb,integer,text) from public,anon;
grant execute on function public.save_assistant_memory(jsonb,integer,text) to authenticated;

create table public.assistant_applied_plans (
  plan_id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade,
  applied_at timestamptz not null default now()
);
alter table public.assistant_applied_plans enable row level security;
revoke all on public.assistant_applied_plans from anon,authenticated;
grant select,insert on public.assistant_applied_plans to authenticated;
create policy own_applied_plans on public.assistant_applied_plans for select to authenticated using(user_id=(select auth.uid()));
create policy insert_applied_plans on public.assistant_applied_plans for insert to authenticated with check(user_id=(select auth.uid()));

create function public.apply_assistant_plan(p_id uuid,p_operations jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); op jsonb; d jsonb; t public.tasks; target date; pos numeric; result jsonb; affected date[]:='{}'; inserted integer;
begin
  if u is null or p_id is null or jsonb_typeof(p_operations) is distinct from 'array' or jsonb_array_length(p_operations) not between 1 and 40 then raise exception 'Geçersiz plan'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  insert into public.assistant_applied_plans(plan_id,user_id) values(p_id,u) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 then
    if not exists(select 1 from public.assistant_applied_plans where plan_id=p_id and user_id=u) then raise exception 'Erişim reddedildi'; end if;
    return jsonb_build_object('ok',true,'already_applied',true);
  end if;
  for op in select value from jsonb_array_elements(p_operations) loop
    d:=op->'data';
    if op->>'action' in ('update','delete') then
      select * into t from public.tasks where id=(d->>'id')::uuid and user_id=u and deleted_at is null for update;
      if not found or d->>'updated_at' is null or t.updated_at is distinct from (d->>'updated_at')::timestamptz then raise exception 'Görev başka bir yerde değişti. Güncel planı yeniden iste.'; end if;
      if not private.editable(u,t.date) then raise exception 'Bu gün artık düzenlenemez'; end if;
      affected:=array_append(affected,t.date);
    end if;
    case op->>'action'
    when 'create' then result:=public.planner_mutate('create',d); affected:=array_append(affected,(d->>'date')::date);
    when 'delete' then result:=public.planner_mutate('delete',d);
    when 'update' then
      target:=(d->>'date')::date;
      if not private.editable(u,target) then raise exception 'Hedef gün düzenlenemez'; end if;
      pos:=t.position;
      if target<>t.date then select coalesce(max(position),0)+1024 into pos from public.tasks where user_id=u and date=target and deleted_at is null; end if;
      update public.tasks set date=target,position=pos,category_id=(d->>'category_id')::uuid,title=trim(d->>'title'),description=d->>'description',note=d->>'note',completed=(d->>'completed')::boolean where id=t.id and user_id=u;
      affected:=array_append(affected,target);
    else raise exception 'Geçersiz görev işlemi';
    end case;
  end loop;
  return jsonb_build_object('ok',true,'dates',to_jsonb(affected));
end $$;
revoke all on function public.apply_assistant_plan(uuid,jsonb) from public,anon;
grant execute on function public.apply_assistant_plan(uuid,jsonb) to authenticated;

create function public.assistant_context(p_start date) returns jsonb
language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
  'tasks',coalesce((select jsonb_agg(t) from (select * from public.tasks where user_id=auth.uid() and deleted_at is null and date between p_start-7 and p_start+6 order by date,position,id limit 400) t),'[]'::jsonb),
  'partial',(select count(*)>400 from public.tasks where user_id=auth.uid() and deleted_at is null and date between p_start-7 and p_start+6),
  'statuses',coalesce((select jsonb_agg(s) from public.day_status s where user_id=auth.uid() and date between p_start-7 and p_start+6),'[]'::jsonb),
  'notes',coalesce((select jsonb_agg(jsonb_build_object('date',date,'content',content)) from public.day_notes where user_id=auth.uid() and date between p_start and p_start+6),'[]'::jsonb),
  'study',coalesce((select jsonb_agg(jsonb_build_object('date',date,'minutes',minutes)) from public.day_study_time where user_id=auth.uid() and date between p_start-7 and p_start+6),'[]'::jsonb),
  'courses',coalesce((select jsonb_agg(c) from (select category_id,count(*) total,count(*) filter(where completed) completed from public.tasks where user_id=auth.uid() and deleted_at is null group by category_id) c),'[]'::jsonb),
  'days',coalesce((select jsonb_agg(d) from (select extract(isodow from date) weekday,count(*) total,count(*) filter(where completed) completed from public.tasks where user_id=auth.uid() and deleted_at is null group by weekday order by weekday) d),'[]'::jsonb),
  'titles',coalesce((select jsonb_agg(t) from (select title,count(*) total from public.tasks where user_id=auth.uid() and deleted_at is null group by title order by count(*) desc limit 20) t),'[]'::jsonb)
);
$$;
revoke all on function public.assistant_context(date) from public,anon;
grant execute on function public.assistant_context(date) to authenticated;
