-- Prioritize the selected week before older comparison rows at the context cap.
create or replace function public.assistant_context(p_start date) returns jsonb
language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
  'tasks',coalesce((select jsonb_agg(t) from (select * from public.tasks where user_id=auth.uid() and deleted_at is null and date between p_start-7 and p_start+6 order by (date>=p_start) desc,date,position,id limit 400) t),'[]'::jsonb),
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
