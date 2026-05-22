-- Public Storage bucket for screenshots attached to user-reported bugs.
-- The `report-bug` Edge Function writes here using the service-role key
-- (bypassing RLS), then embeds the public URL in the GitHub issue body.
-- Public read is required so GitHub can render the markdown image.
insert into storage.buckets (id, name, public)
values ('bug-reports', 'bug-reports', true)
on conflict (id) do nothing;
