-- All product dates are Istanbul dates. No scheduling times on tasks.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (length(username) between 1 and 64),
  created_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  name text not null, accent_color text not null check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  position integer not null, unique(user_id,id), unique(user_id,name)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  date date not null, category_id uuid not null, title text not null check (length(trim(title)) between 1 and 120),
  description text not null default '' check (length(description)<=1000),
  note text not null default '' check (length(note)<=2000), completed boolean not null default false,
  position numeric(30,10) not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (user_id,category_id) references public.categories(user_id,id)
);
create index tasks_week_order on public.tasks(user_id,date,position,id) where deleted_at is null;
create index tasks_category on public.tasks(user_id,category_id);
create table public.day_notes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), date date not null,
  content text not null default '' check (length(content)<=500),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,date)
);
create table public.day_status (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), date date not null,
  is_finished boolean not null default true check(is_finished), finished_at timestamptz not null default now(), unique(user_id,date)
);

create function private.editable(p_user uuid,p_date date) returns boolean
language sql stable security invoker set search_path='' as $$
  select p_date >= (now() at time zone 'Europe/Istanbul')::date
    and now() < (p_date + time '23:59') at time zone 'Europe/Istanbul'
    and not exists(select 1 from public.day_status where user_id=p_user and date=p_date and is_finished)
$$;
revoke all on function private.editable(uuid,date) from public;
grant execute on function private.editable(uuid,date) to authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.day_notes enable row level security;
alter table public.day_status enable row level security;
revoke all on public.profiles,public.categories,public.tasks,public.day_notes,public.day_status from anon,authenticated;
grant select on public.profiles,public.categories,public.tasks,public.day_notes,public.day_status to authenticated;
grant insert,update on public.tasks,public.day_notes to authenticated;
grant insert on public.day_status to authenticated;
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy own_categories on public.categories for select to authenticated using(user_id=(select auth.uid()));
create policy own_tasks on public.tasks for select to authenticated using(user_id=(select auth.uid()));
create policy insert_tasks on public.tasks for insert to authenticated with check(user_id=(select auth.uid()) and private.editable(user_id,date));
create policy update_tasks on public.tasks for update to authenticated using(user_id=(select auth.uid()) and private.editable(user_id,date)) with check(user_id=(select auth.uid()) and private.editable(user_id,date));
create policy own_notes on public.day_notes for select to authenticated using(user_id=(select auth.uid()));
create policy insert_notes on public.day_notes for insert to authenticated with check(user_id=(select auth.uid()) and private.editable(user_id,date));
create policy update_notes on public.day_notes for update to authenticated using(user_id=(select auth.uid()) and private.editable(user_id,date)) with check(user_id=(select auth.uid()) and private.editable(user_id,date));
create policy own_status on public.day_status for select to authenticated using(user_id=(select auth.uid()));
create policy finish_status on public.day_status for insert to authenticated with check(user_id=(select auth.uid()) and private.editable(user_id,date));

-- Shared user lock serializes moves, note edits and day finalization across tabs.
create function private.guard_day() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if current_user='postgres' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
  if new.user_id is distinct from auth.uid() then raise exception 'Erişim reddedildi'; end if;
  if tg_op='UPDATE' then
    if old.user_id is distinct from new.user_id or old.id is distinct from new.id then raise exception 'Kimlik değiştirilemez'; end if;
    if not private.editable(old.user_id,old.date) then raise exception 'Bu gün artık düzenlenemez'; end if;
    new.created_at:=old.created_at;
  end if;
  if not private.editable(new.user_id,new.date) then raise exception 'Bu gün artık düzenlenemez'; end if;
  new.updated_at:=clock_timestamp();
  return new;
end $$;
revoke all on function private.guard_day() from public;
create trigger guard_tasks before insert or update on public.tasks for each row execute function private.guard_day();
create trigger guard_notes before insert or update on public.day_notes for each row execute function private.guard_day();
create function private.guard_status() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user='postgres' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
  if new.user_id is distinct from auth.uid() or not private.editable(new.user_id,new.date) then raise exception 'Bu gün artık düzenlenemez'; end if;
  new.finished_at:=clock_timestamp(); return new;
end $$;
revoke all on function private.guard_status() from public;
create trigger guard_status before insert on public.day_status for each row execute function private.guard_status();

create function public.planner_mutate(p_action text,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  u uuid:=auth.uid(); t public.tasks; d date; target date; dest date;
  pos numeric; lower_pos numeric; upper_pos numeric; next_id uuid;
  selected uuid[]; copied uuid[]:='{}'; new_id uuid; remaining integer;
begin
  if u is null or not exists(select 1 from public.profiles where id=u) then raise exception 'Oturum gerekli'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  if p_action in ('edit','toggle','delete','restore','move','copy') then
    select * into t from public.tasks where id=(p_data->>'id')::uuid and user_id=u for update;
    if not found then raise exception 'Görev bulunamadı'; end if;
    if not private.editable(u,t.date) then raise exception 'Bu gün artık düzenlenemez'; end if;
    if p_action<>'restore' and t.deleted_at is not null then raise exception 'Görev silinmiş'; end if;
    if p_action<>'restore' and t.updated_at<>(p_data->>'updated_at')::timestamptz then raise exception 'Görev başka bir sekmede değişti. Tekrar dene.'; end if;
  end if;
  case p_action
  when 'create' then
    d:=(p_data->>'date')::date;
    select coalesce(max(position),0)+1024 into pos from public.tasks where user_id=u and date=d and deleted_at is null;
    insert into public.tasks(user_id,date,category_id,title,description,note,position) values(u,d,(p_data->>'category_id')::uuid,trim(p_data->>'title'),coalesce(p_data->>'description',''),coalesce(p_data->>'note',''),pos) returning id into new_id;
    return jsonb_build_object('id',new_id);
  when 'edit' then
    update public.tasks set category_id=(p_data->>'category_id')::uuid,title=trim(p_data->>'title'),description=coalesce(p_data->>'description',''),note=coalesce(p_data->>'note','') where id=t.id;
  when 'toggle' then update public.tasks set completed=not t.completed where id=t.id;
  when 'delete' then update public.tasks set deleted_at=clock_timestamp() where id=t.id returning deleted_at into t.deleted_at;
    return jsonb_build_object('expires_at',t.deleted_at+interval '5 seconds');
  when 'restore' then
    if t.deleted_at is null or clock_timestamp()>t.deleted_at+interval '5 seconds' then raise exception 'Geri alma süresi doldu'; end if;
    update public.tasks set deleted_at=null where id=t.id;
  when 'move' then
    target:=(p_data->>'date')::date;
    if not private.editable(u,target) then raise exception 'Hedef gün düzenlenemez'; end if;
    next_id:=nullif(p_data->>'before_id','')::uuid;
    if next_id is not null then
      select position into upper_pos from public.tasks where id=next_id and user_id=u and date=target and id<>t.id and deleted_at is null;
      if not found then raise exception 'Sıralama değişti. Tekrar dene.'; end if;
      select coalesce(max(position),upper_pos-2048) into lower_pos from public.tasks where user_id=u and date=target and position<upper_pos and id<>t.id and deleted_at is null;
      if upper_pos-lower_pos<0.0001 then
        with numbered as (select id,row_number() over(order by position,id)*1024 as n from public.tasks where user_id=u and date=target and id<>t.id and deleted_at is null)
        update public.tasks a set position=numbered.n from numbered where a.id=numbered.id;
        select position into upper_pos from public.tasks where id=next_id;
        select coalesce(max(position),upper_pos-2048) into lower_pos from public.tasks where user_id=u and date=target and position<upper_pos and id<>t.id and deleted_at is null;
      end if;
      pos:=(lower_pos+upper_pos)/2;
    else select coalesce(max(position),0)+1024 into pos from public.tasks where user_id=u and date=target and id<>t.id and deleted_at is null;
    end if;
    update public.tasks set date=target,position=pos where id=t.id;
  when 'copy' then
    for dest in select distinct value::date from jsonb_array_elements_text(p_data->'dates') loop
      if not private.editable(u,dest) then raise exception 'Hedef gün düzenlenemez'; end if;
      select coalesce(max(position),0)+1024 into pos from public.tasks where user_id=u and date=dest and deleted_at is null;
      insert into public.tasks(user_id,date,category_id,title,description,note,completed,position) values(u,dest,t.category_id,t.title,t.description,t.note,false,pos) returning id into new_id;
      copied:=array_append(copied,new_id);
    end loop;
    if cardinality(copied)=0 then raise exception 'En az bir gün seç'; end if;
    return jsonb_build_object('ids',copied);
  when 'note' then
    d:=(p_data->>'date')::date;
    insert into public.day_notes(user_id,date,content) values(u,d,coalesce(p_data->>'content','')) on conflict(user_id,date) do update set content=excluded.content;
  when 'finish' then
    d:=(p_data->>'date')::date; target:=d+1;
    if not private.editable(u,d) then raise exception 'Bu gün artık düzenlenemez'; end if;
    select count(*) into remaining from public.tasks where user_id=u and date=d and not completed and deleted_at is null;
    if remaining>0 and coalesce(p_data->>'mode','') not in ('all','selected','leave') then raise exception 'Taşıma seçeneği gerekli'; end if;
    if p_data->>'mode' in ('all','selected') and remaining>0 then
      if not private.editable(u,target) then raise exception 'Yarın tamamlanmış; görevler taşınamaz. Bugünde bırakabilirsin.'; end if;
      select coalesce(array_agg(value::uuid),'{}') into selected from jsonb_array_elements_text(coalesce(p_data->'ids','[]'));
      select coalesce(max(position),0) into pos from public.tasks where user_id=u and date=target and deleted_at is null;
      for t in select * from public.tasks where user_id=u and date=d and not completed and deleted_at is null and (p_data->>'mode'='all' or id=any(selected)) order by position,id loop
        pos:=pos+1024; update public.tasks set date=target,position=pos where id=t.id;
      end loop;
    end if;
    insert into public.day_status(user_id,date,is_finished) values(u,d,true);
  else raise exception 'Geçersiz işlem';
  end case;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.planner_mutate(text,jsonb) from public,anon;
grant execute on function public.planner_mutate(text,jsonb) to authenticated;

-- Only this private server-owned routine bypasses date guards to close elapsed days.
create function private.finalize_days(p_user uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
  if p_user is not null and p_user is distinct from auth.uid() then raise exception 'Erişim reddedildi'; end if;
  for u in select id from public.profiles where p_user is null or id=p_user loop
    perform pg_advisory_xact_lock(hashtextextended(u::text,0));
    insert into public.day_status(user_id,date,is_finished,finished_at)
    select u,date,true,(date+time '23:59') at time zone 'Europe/Istanbul' from (
      select date from public.tasks where user_id=u and deleted_at is null union select date from public.day_notes where user_id=u
    ) days where now()>=(date+time '23:59') at time zone 'Europe/Istanbul'
    on conflict(user_id,date) do nothing;
  end loop;
end $$;
revoke all on function private.finalize_days(uuid) from public,anon,authenticated;
create function public.finalize_my_days() returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Oturum gerekli'; end if;
  perform private.finalize_days(auth.uid());
end $$;
revoke all on function public.finalize_my_days() from public,anon;
grant execute on function public.finalize_my_days() to authenticated;

create extension if not exists pg_cron;
-- UTC cron: Istanbul 23:59 = UTC 20:59. Also catch up on every app read.
select cron.schedule('planner-close-istanbul-day','59 20 * * *','select private.finalize_days(null);');
