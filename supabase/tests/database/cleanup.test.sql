begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

-- Groups get created_at = now() from the trigger, so age them by bypassing it.
alter table public.groups disable trigger groups_set_timestamps;
insert into public.groups (name, join_code, admin_token_hash, created_at, join_deadline) values
  ('Last year', 'PREVYEAR', repeat('a', 64), '2025-12-20 10:00+01', '2025-12-21 10:00+01'),
  ('New year', 'NEWYEARS', repeat('b', 64), '2026-01-01 00:30+01', '2026-01-02 00:30+01');
alter table public.groups enable trigger groups_set_timestamps;

insert into public.participants (group_id, display_name)
select id, 'Anna' from public.groups where join_code = 'PREVYEAR';

select is(
  public.delete_groups_created_before('2026-01-01 00:00+01'),
  1,
  'deletes exactly the groups created before 1 January'
);

select ok(
  exists (select 1 from public.groups where join_code = 'NEWYEARS'),
  'keeps groups created on or after 1 January'
);

select is(
  (select count(*)::int from public.participants p
   left join public.groups g on g.id = p.group_id where g.id is null),
  0,
  'participants of deleted groups are deleted too'
);

select is(
  (select schedule from cron.job where jobname = 'year-end-group-cleanup'),
  '0 23 31 12 *',
  'the cleanup runs at 00:00 on 1 January, Rome time (23:00 UTC)'
);

select * from finish();
rollback;
