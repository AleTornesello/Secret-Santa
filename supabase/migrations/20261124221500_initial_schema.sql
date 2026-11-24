-- Secret Santa schema: groups, participants and assignments.
--
-- Security model (no authentication in this version):
--   * Every table has RLS enabled and NO policies, and all privileges are revoked from the
--     public API roles (anon, authenticated). Clients can read and write nothing directly.
--   * Edge Functions use the service role, check the caller's secret token, and do all reads
--     and writes. Tokens are stored only as SHA-256 hex hashes.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.group_status as enum ('open', 'drawn');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (char_length(btrim(name)) between 1 and 60 and name = btrim(name)),
  -- 8 characters from a 31-symbol alphabet without look-alikes (no 0/O, 1/I/L).
  join_code text not null unique
    check (join_code ~ '^[A-HJKMNP-Z2-9]{8}$'),
  admin_token_hash text not null unique
    check (admin_token_hash ~ '^[0-9a-f]{64}$'),
  -- Optional gift budget in euros.
  budget numeric(8, 2)
    check (budget is null or budget > 0),
  status public.group_status not null default 'open',
  -- Both set by trigger on insert; see set_group_timestamps().
  created_at timestamptz not null default now(),
  join_deadline timestamptz not null default now() + interval '24 hours',
  drawn_at timestamptz,
  check ((status = 'drawn') = (drawn_at is not null))
);

comment on table public.groups is 'A Secret Santa group. Joining closes at join_deadline.';

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 40 and display_name = btrim(display_name)),
  -- Null until someone claims this name; then the hash of their player token.
  player_token_hash text unique
    check (player_token_hash is null or player_token_hash ~ '^[0-9a-f]{64}$'),
  claimed_at timestamptz,
  check ((player_token_hash is null) = (claimed_at is null)),
  -- Lets assignments reference (participant, group) pairs, so both sides share one group.
  unique (id, group_id)
);

create unique index participants_group_name_key
  on public.participants (group_id, lower(display_name));

comment on table public.participants is 'A name in a group, claimed by whoever selects it.';

create table public.assignments (
  group_id uuid not null,
  giver_id uuid not null,
  receiver_id uuid not null,
  primary key (group_id, giver_id),
  unique (group_id, receiver_id),
  check (giver_id <> receiver_id),
  foreign key (giver_id, group_id)
    references public.participants (id, group_id) on delete cascade,
  foreign key (receiver_id, group_id)
    references public.participants (id, group_id) on delete cascade
);

comment on table public.assignments is
  'Who gives to whom. Returned only to the holder of the giver''s player token.';

-- ---------------------------------------------------------------------------
-- Timestamps: created_at is now() and joining closes exactly 24 hours later.
-- ---------------------------------------------------------------------------

create function public.set_group_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.join_deadline := new.created_at + interval '24 hours';
  elsif new.created_at is distinct from old.created_at
     or new.join_deadline is distinct from old.join_deadline then
    raise exception 'created_at and join_deadline cannot be changed';
  end if;
  return new;
end;
$$;

create trigger groups_set_timestamps
  before insert or update on public.groups
  for each row execute function public.set_group_timestamps();

-- ---------------------------------------------------------------------------
-- Lockdown: RLS on, no policies, no privileges for the public API roles.
-- ---------------------------------------------------------------------------

alter table public.groups enable row level security;
alter table public.participants enable row level security;
alter table public.assignments enable row level security;

revoke all on public.groups, public.participants, public.assignments from anon, authenticated;
revoke all on type public.group_status from public;
grant usage on type public.group_status to service_role;

revoke execute on function public.set_group_timestamps() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Year-end deletion: every group created before 1 January (Europe/Rome) is deleted with its
-- participants and assignments. Runs at 23:00 UTC on 31 December = 00:00 on 1 January in Rome.
-- ---------------------------------------------------------------------------

create function public.delete_groups_created_before(cutoff timestamptz)
returns integer
language sql
set search_path = ''
as $$
  with deleted as (
    delete from public.groups where created_at < cutoff returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke execute on function public.delete_groups_created_before(timestamptz)
  from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.schedule(
  'year-end-group-cleanup',
  '0 23 31 12 *',
  $$select public.delete_groups_created_before(
      date_trunc('year', (now() + interval '1 hour') at time zone 'Europe/Rome')
        at time zone 'Europe/Rome'
    )$$
);
