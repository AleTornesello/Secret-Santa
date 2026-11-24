begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

-- Fixtures ------------------------------------------------------------------

create temporary table fx (key text primary key, id uuid);
create function pg_temp.fx_id(k text) returns uuid language sql as
  $$select id from fx where key = k$$;

with g as (
  insert into public.groups (name, join_code, admin_token_hash)
  values ('Family', 'ABCD2345', repeat('a', 64))
  returning id
)
insert into fx select 'g1', id from g;

with g as (
  insert into public.groups (name, join_code, admin_token_hash)
  values ('Office', 'WXYZ6789', repeat('b', 64))
  returning id
)
insert into fx select 'g2', id from g;

with p as (
  insert into public.participants (group_id, display_name)
  select pg_temp.fx_id('g1'), name
  from (values ('Anna'), ('Marco'), ('Giulia')) as v (name)
  returning id, display_name
)
insert into fx
select case display_name when 'Anna' then 'p1' when 'Marco' then 'p2' else 'p3' end, id from p;

-- Tables, RLS and the absence of policies --------------------------------------

select has_table('public', 'groups', 'groups table exists');
select has_table('public', 'participants', 'participants table exists');
select has_table('public', 'assignments', 'assignments table exists');

select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.groups'::regclass, 'public.participants'::regclass,
                 'public.assignments'::regclass)),
  'RLS is enabled on every table'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public'),
  0,
  'no RLS policies exist, so the public roles see no rows'
);

-- Privileges of the public API roles -----------------------------------------

select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated']) as r (role),
         unnest(array['public.groups', 'public.participants', 'public.assignments']) as t (tbl),
         unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'])
           as p (priv)
    where has_table_privilege(r.role, t.tbl, p.priv)
  ),
  'anon and authenticated have no privilege on any table'
);

select ok(
  not has_function_privilege('anon', 'public.delete_groups_created_before(timestamptz)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.delete_groups_created_before(timestamptz)', 'EXECUTE'),
  'public roles cannot run the cleanup function'
);

set local role anon;
select throws_ok('select * from public.assignments', '42501', null, 'anon cannot read assignments');
select throws_ok('select * from public.participants', '42501', null, 'anon cannot read participants');
select throws_ok('select * from public.groups', '42501', null, 'anon cannot read groups');
select throws_ok(
  $$insert into public.groups (name, join_code, admin_token_hash)
    values ('x', 'QQQQ2222', repeat('c', 64))$$,
  '42501', null, 'anon cannot create groups'
);
reset role;

set local role authenticated;
select throws_ok('select * from public.assignments', '42501', null,
  'authenticated cannot read assignments');
reset role;

set local role service_role;
select lives_ok('select * from public.assignments', 'the service role (Edge Functions) can read');
reset role;

-- Groups ----------------------------------------------------------------------

select is(
  (select join_deadline - created_at from public.groups where id = pg_temp.fx_id('g1')),
  interval '24 hours',
  'joining closes 24 hours after creation'
);

select is(
  (select count(*)::int from public.groups
   where join_code = 'QWER2345' and created_at > now() - interval '1 minute'),
  0, 'sanity: no such group yet'
);

insert into public.groups (name, join_code, admin_token_hash, created_at, join_deadline)
values ('Forged', 'QWER2345', repeat('d', 64), '2000-01-01', '2100-01-01');
select is(
  (select join_deadline - created_at from public.groups where join_code = 'QWER2345'),
  interval '24 hours',
  'created_at and join_deadline cannot be chosen by the caller'
);

select throws_ok(
  $$update public.groups set join_deadline = join_deadline + interval '1 day' where join_code = 'QWER2345'$$,
  'P0001', 'created_at and join_deadline cannot be changed',
  'the joining deadline cannot be extended'
);

select throws_ok(
  $$insert into public.groups (name, join_code, admin_token_hash) values ('x', 'ABCD234O', repeat('e', 64))$$,
  '23514', null, 'join codes reject look-alike characters'
);

select throws_ok(
  $$insert into public.groups (name, join_code, admin_token_hash, budget)
    values ('x', 'ABCD2346', repeat('f', 64), 0)$$,
  '23514', null, 'a budget must be positive'
);

select throws_ok(
  $$update public.groups set status = 'drawn' where id = pg_temp.fx_id('g2')$$,
  '23514', null, 'a drawn group needs drawn_at'
);

-- Participants -----------------------------------------------------------------

select throws_ok(
  $$insert into public.participants (group_id, display_name)
    values (pg_temp.fx_id('g1'), 'ANNA')$$,
  '23505', null, 'names are unique per group, ignoring case'
);

select lives_ok(
  $$insert into public.participants (group_id, display_name)
    values (pg_temp.fx_id('g2'), 'Anna')$$,
  'the same name can appear in another group'
);

select throws_ok(
  $$update public.participants set player_token_hash = repeat('1', 64)
    where id = pg_temp.fx_id('p1')$$,
  '23514', null, 'a claim needs both the token hash and claimed_at'
);

-- Assignments ------------------------------------------------------------------

select throws_ok(
  $$insert into public.assignments values (pg_temp.fx_id('g1'), pg_temp.fx_id('p1'), pg_temp.fx_id('p1'))$$,
  '23514', null, 'nobody can be assigned to themselves'
);

insert into public.assignments values (pg_temp.fx_id('g1'), pg_temp.fx_id('p1'), pg_temp.fx_id('p2'));

select throws_ok(
  $$insert into public.assignments values (pg_temp.fx_id('g1'), pg_temp.fx_id('p1'), pg_temp.fx_id('p3'))$$,
  '23505', null, 'everyone gives exactly once'
);

select throws_ok(
  $$insert into public.assignments values (pg_temp.fx_id('g1'), pg_temp.fx_id('p3'), pg_temp.fx_id('p2'))$$,
  '23505', null, 'everyone receives exactly once'
);

select throws_ok(
  $$insert into public.assignments values (pg_temp.fx_id('g2'), pg_temp.fx_id('p2'), pg_temp.fx_id('p3'))$$,
  '23503', null, 'giver and receiver must belong to the assignment''s group'
);

select * from finish();
rollback;
