-- Remove the retired feature without changing planner records or shared routines.
drop function if exists public.apply_assistant_plan(uuid,jsonb);
drop function if exists public.save_assistant_memory(jsonb,integer,text);
drop function if exists public.assistant_context(date);
drop table if exists public.assistant_applied_plans;
drop table if exists public.assistant_memory;
