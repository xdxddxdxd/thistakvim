-- Reject missing task versions before any mutation; restore retains its timed undo contract.
create or replace function public.planner_mutate(p_action text,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  u uuid:=auth.uid(); t public.tasks; d date; target date; dest date;
  pos numeric; lower_pos numeric; upper_pos numeric; next_id uuid;
  selected uuid[]; copied uuid[]:='{}'; new_id uuid; remaining integer;
begin
  if u is null or not exists(select 1 from public.profiles where id=u) then raise exception 'Oturum gerekli'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  if p_action in ('edit','toggle','delete','restore','move','copy') then
    if p_action<>'restore' and (
      jsonb_typeof(p_data->'updated_at') is distinct from 'string'
      or nullif(btrim(p_data->>'updated_at'),'') is null
    ) then raise exception 'Görev işlemi için güncel kayıt gerekli.'; end if;
    select * into t from public.tasks where id=(p_data->>'id')::uuid and user_id=u for update;
    if not found then raise exception 'Görev bulunamadı'; end if;
    if not private.editable(u,t.date) then raise exception 'Bu gün artık düzenlenemez'; end if;
    if p_action<>'restore' and t.deleted_at is not null then raise exception 'Görev silinmiş'; end if;
    if p_action<>'restore' and (t.updated_at is distinct from (p_data->>'updated_at')::timestamptz) then raise exception 'Görev başka bir sekmede değişti. Tekrar dene.'; end if;
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
  else raise exception 'Geçersiz işlem';
  end case;
  return jsonb_build_object('ok',true);
end $$;
