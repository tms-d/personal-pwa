-- Friends: paired contacted/seen cadences as a first-class task kind.
-- Decisions per #27:
--  - Category gains a `kind` discriminator. Friends-kind categories carry
--    default contacted/seen days; general-kind categories don't expose them.
--  - Friend is `tasks.kind = 'friend'` with its own contacted/seen target
--    days (copied from the category defaults on create, then overridable).
--  - Completion gains a nullable `stream` ('contacted' | 'seen'). Existing
--    rows mean "single stream" implicitly — no backfill needed.

alter table public.categories
	add column kind text not null default 'general'
		check (kind in ('general', 'friends'));

alter table public.categories
	add column default_contacted_days integer,
	add column default_seen_days integer;

alter table public.tasks
	drop constraint tasks_kind_check;
alter table public.tasks
	add constraint tasks_kind_check
		check (kind in ('todo', 'recurring', 'cadence', 'friend'));

alter table public.tasks
	add column contacted_target_days integer,
	add column seen_target_days integer;

alter table public.completions
	add column stream text check (stream in ('contacted', 'seen'));

create index completions_user_stream_idx on public.completions (user_id, task_id, stream);
