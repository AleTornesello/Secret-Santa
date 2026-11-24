begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

-- Helpers ---------------------------------------------------------------------

create temporary table fx (key text primary key, val jsonb);
create function pg_temp.fx(k text) returns jsonb language sql as
  $$select val from fx where key = k$$;
create function pg_temp.pid(g uuid, n text) returns uuid language sql as
  $$select id from public.participants where group_id = g and display_name = n$$;
-- One cycle through the group's participants, in id order.
create function pg_temp.cycle(g uuid) returns jsonb language sql as $$
  with ids as (
    select id, row_number() over (order by id) as i, count(*) over () as n
    from public.participants where group_id = g
  )
  select jsonb_agg(jsonb_build_object('giver', a.id, 'receiver', b.id))
  from ids a join ids b on b.i = a.i % a.n + 1
$$;

-- create_group ----------------------------------------------------------------

insert into fx select 'g1', public.create_group(
  'Family', 20, 'ABCD2345', repeat('a', 64), array['Anna', 'Marco', 'Giulia'], null, null);
insert into fx select 'g2', public.create_group(
  'Office', null, 'WXYZ6789', repeat('b', 64), array['Luca', 'Sara', 'Paolo', 'Elena'], 0,
  repeat('1', 64));

select ok(pg_temp.fx('g1')->>'groupId' is not null, 'create_group returns the group id');
select is(pg_temp.fx('g1')->'participantId', 'null'::jsonb,
  'no participant id when the organizer does not play');
select is((pg_temp.fx('g2')->>'participantId')::uuid,
  pg_temp.pid((pg_temp.fx('g2')->>'groupId')::uuid, 'Luca'),
  'the playing organizer claims their own name');
select throws_ok(
  $$select public.create_group('Again', null, 'ABCD2345', repeat('c', 64),
    array['A', 'B', 'C'], null, null)$$,
  'P0001', 'join_code_taken', 'a used join code is reported');
select throws_ok(
  $$select public.create_group('Dupes', null, 'DUPE2345', repeat('d', 64),
    array['Anna', 'anna', 'Marco'], null, null)$$,
  'P0001', 'invalid_input', 'duplicate names are rejected');
select throws_ok(
  $$select public.create_group('Small', null, 'SMAL2345', repeat('e', 64),
    array['A', 'B'], null, null)$$,
  'P0001', 'invalid_input', 'fewer than 3 names are rejected');

-- preview_group -----------------------------------------------------------------

select is(public.preview_group('WXYZ6789')->'joined', '1'::jsonb, 'preview counts the joined');
select is(public.preview_group('WXYZ6789')->'total', '4'::jsonb, 'preview counts everyone');
select is(public.preview_group('WXYZ6789') ? 'joinCode', false, 'preview does not echo the code');
select throws_ok($$select public.preview_group('NONE2345')$$, 'P0001', 'not_found',
  'an unknown code is not found');

-- join_group --------------------------------------------------------------------

insert into fx select 'g1id', to_jsonb((pg_temp.fx('g1')->>'groupId')::uuid);
insert into fx select 'g2id', to_jsonb((pg_temp.fx('g2')->>'groupId')::uuid);

select is(
  public.join_group('ABCD2345', pg_temp.pid((pg_temp.fx('g1id')#>>'{}')::uuid, 'Anna'),
    repeat('2', 64), null)->>'status',
  'open', 'a join that leaves free names keeps the group open');
select throws_ok(
  format($$select public.join_group('ABCD2345', %L, %L, null)$$,
    pg_temp.pid((pg_temp.fx('g1id')#>>'{}')::uuid, 'Anna'), repeat('3', 64)),
  'P0001', 'already_taken', 'a taken name cannot be claimed again');
select throws_ok(
  format($$select public.join_group('ABCD2345', %L, %L, null)$$,
    pg_temp.pid((pg_temp.fx('g2id')#>>'{}')::uuid, 'Sara'), repeat('3', 64)),
  'P0001', 'not_found', 'a participant of another group is not found');

select is(
  public.get_my_assignment((pg_temp.fx('g1id')#>>'{}')::uuid, repeat('2', 64))->'recipient',
  'null'::jsonb, 'no recipient before everyone has joined');

select public.join_group('ABCD2345', pg_temp.pid((pg_temp.fx('g1id')#>>'{}')::uuid, 'Marco'),
  repeat('4', 64), null);
select throws_ok(
  format($$select public.join_group('ABCD2345', %L, %L, null)$$,
    pg_temp.pid((pg_temp.fx('g1id')#>>'{}')::uuid, 'Giulia'), repeat('5', 64)),
  'P0001', 'invalid_input', 'the last join needs the pairs');

-- Office: two mutual pairs are not one cycle.
select public.join_group('WXYZ6789', pg_temp.pid((pg_temp.fx('g2id')#>>'{}')::uuid, 'Sara'),
  repeat('6', 64), null);
select public.join_group('WXYZ6789', pg_temp.pid((pg_temp.fx('g2id')#>>'{}')::uuid, 'Paolo'),
  repeat('7', 64), null);
select throws_ok(
  format($$select public.join_group('WXYZ6789', %L, %L, %L)$$,
    pg_temp.pid((pg_temp.fx('g2id')#>>'{}')::uuid, 'Elena'), repeat('8', 64),
    jsonb_build_array(
      jsonb_build_object('giver', pg_temp.pid((pg_temp.fx('g2id')#>>'{}')::uuid, 'Luca'),
                         'receiver', pg_temp.pid((pg_temp.fx('g2id')#>>'{}')::uuid, 'Sara')),
      jsonb_build_object('giver', pg_temp.pid((pg_temp.fx('g2id')#>>'{}')::uuid, 'Sara'),
                         'receiver', pg_temp.pid((pg_temp.fx('g2id')#>>'{}')::uuid, 'Luca')),
      jsonb_build_object('giver', pg_temp.pid((pg_temp.fx('g2id')#>>'{}')::uuid, 'Paolo'),
                         'receiver', pg_temp.pid((pg_temp.fx('g2id')#>>'{}')::uuid, 'Elena')),
      jsonb_build_object('giver', pg_temp.pid((pg_temp.fx('g2id')#>>'{}')::uuid, 'Elena'),
                         'receiver', pg_temp.pid((pg_temp.fx('g2id')#>>'{}')::uuid, 'Paolo')))),
  'P0001', 'invalid_input', 'pairs that are not one cycle are rejected');
select is((select count(*)::int from public.participants
           where group_id = (pg_temp.fx('g2id')#>>'{}')::uuid and claimed_at is null), 1,
  'a rejected last join leaves the name free');

select is(
  public.join_group('ABCD2345', pg_temp.pid((pg_temp.fx('g1id')#>>'{}')::uuid, 'Giulia'),
    repeat('5', 64), pg_temp.cycle((pg_temp.fx('g1id')#>>'{}')::uuid))->>'status',
  'drawn', 'the last join draws the group');
select is((select count(*)::int from public.assignments
           where group_id = (pg_temp.fx('g1id')#>>'{}')::uuid), 3, 'everyone has a recipient');
select throws_ok(
  format($$select public.join_group('ABCD2345', %L, %L, null)$$,
    pg_temp.pid((pg_temp.fx('g1id')#>>'{}')::uuid, 'Anna'), repeat('9', 64)),
  'P0001', 'group_drawn', 'a drawn group takes no joins');

-- get_my_assignment ---------------------------------------------------------------

select is(
  public.get_my_assignment((pg_temp.fx('g1id')#>>'{}')::uuid, repeat('2', 64))->>'recipient',
  (select r.display_name from public.assignments a
   join public.participants r on r.id = a.receiver_id
   where a.giver_id = pg_temp.pid((pg_temp.fx('g1id')#>>'{}')::uuid, 'Anna')),
  'a player sees their own recipient once drawn');
select throws_ok(
  format($$select public.get_my_assignment(%L, %L)$$, pg_temp.fx('g1id')#>>'{}',
    repeat('f', 64)),
  'P0001', 'not_found', 'a wrong player token sees nothing');

-- Organizer -----------------------------------------------------------------------

select is(
  public.get_group_admin((pg_temp.fx('g2id')#>>'{}')::uuid, repeat('b', 64))->>'joinCode',
  'WXYZ6789', 'the organizer sees the join code');
select throws_ok(
  format($$select public.get_group_admin(%L, %L)$$, pg_temp.fx('g2id')#>>'{}', repeat('a', 64)),
  'P0001', 'not_found', 'another group''s admin token sees nothing');
select is(
  public.release_claim((pg_temp.fx('g2id')#>>'{}')::uuid, repeat('b', 64),
    pg_temp.pid((pg_temp.fx('g2id')#>>'{}')::uuid, 'Sara'))->'joined',
  '2'::jsonb, 'the organizer can free a claimed name');
select throws_ok(
  format($$select public.release_claim(%L, %L, %L)$$, pg_temp.fx('g1id')#>>'{}',
    repeat('a', 64), pg_temp.pid((pg_temp.fx('g1id')#>>'{}')::uuid, 'Anna')),
  'P0001', 'group_drawn', 'claims cannot be freed after the draw');

-- Deadline ------------------------------------------------------------------------

set local session_replication_role = replica;
update public.groups set join_deadline = now() - interval '1 minute'
where id = (pg_temp.fx('g2id')#>>'{}')::uuid;
set local session_replication_role = origin;
select throws_ok(
  format($$select public.join_group('WXYZ6789', %L, %L, null)$$,
    pg_temp.pid((pg_temp.fx('g2id')#>>'{}')::uuid, 'Sara'), repeat('a', 64)),
  'P0001', 'joining_closed', 'joining closes at the deadline');

-- Realtime, rate limits and privileges -------------------------------------------------

select ok(exists(
  select 1 from realtime.messages
  where topic = 'group:' || (pg_temp.fx('g1id')#>>'{}') and event = 'progress'
    and payload->>'status' = 'drawn'
    and not payload ? 'assignments'), 'the draw is broadcast without assignments');

select is(array[public.rate_limit_hit('t', 2, 60), public.rate_limit_hit('t', 2, 60),
                public.rate_limit_hit('t', 2, 60)],
  array[true, true, false], 'the third hit in a window of limit 2 is refused');

set local role anon;
select throws_ok($$select public.preview_group('ABCD2345')$$, '42501', null,
  'anon cannot call the API functions');
reset role;

set local role service_role;
select lives_ok($$select public.preview_group('ABCD2345')$$, 'service_role can call them');
reset role;

select * from finish();
rollback;
