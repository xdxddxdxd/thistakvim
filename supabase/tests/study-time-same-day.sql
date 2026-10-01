-- Real current-day RPC operations are rolled back, including existing user values.
begin;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from public.profiles limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare d date:=(clock_timestamp() at time zone 'Europe/Istanbul')::date; v integer; r jsonb;
begin
  if clock_timestamp()>=(d+time '23:59') at time zone 'Europe/Istanbul' then
    r:=public.save_study_time(d,10,0);
    if not (r->>'locked')::boolean then raise exception 'Deadline write accepted';end if;
  else
    if not private.editable(auth.uid(),d) then raise exception 'Current day incorrectly locked';end if;
    select coalesce((select revision from public.day_study_time where user_id=auth.uid() and date=d),0) into v;
    r:=public.save_study_time(d,125,v);
    if (r->>'revision')::integer<>v+1 then raise exception 'Current-day save failed';end if;
    r:=public.save_study_time(d,180,v+1);
    if (r->>'revision')::integer<>v+2 then raise exception 'Repeated same-day save failed';end if;
    r:=public.save_study_time(d,200,v+1);
    if not (r->>'conflict')::boolean then raise exception 'Stale revision accepted';end if;
    if (select minutes from public.day_study_time where user_id=auth.uid() and date=d)<>180 then raise exception 'Stale update changed total';end if;
  end if;
  r:=public.save_study_time(d+1,60,0);
  if not (r->>'locked')::boolean then raise exception 'Future write accepted';end if;
  r:=public.save_study_time(d-1,60,0);
  if not (r->>'locked')::boolean then raise exception 'Past write accepted';end if;
end $$;
reset role;
rollback;
select 'Same-day repeated saves, CAS conflicts, past/future locks passed; rolled back' as result;
