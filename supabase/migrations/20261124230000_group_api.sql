-- Group API: the only way data is read or written. Each function runs one transaction and is
-- callable by service_role only; the Edge Functions validate input, hash tokens and call these.
-- Errors are raised with SQLSTATE P0001 and the API error code as the message.

-- ---------------------------------------------------------------------------
-- Rate limiting: fixed windows per key (for example "join:<ip>").
-- ---------------------------------------------------------------------------

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Old windows are cleared now and then by whoever is counting.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Shared view of a group: what anyone with the join code may see. Never assignments.
-- ---------------------------------------------------------------------------

create function public.group_summary(p_group_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'budget', g.budget,
    'status', g.status,
    'joinDeadline', g.join_deadline,
    'joined', (select count(*) from public.participants p
               where p.group_id = g.id and p.claimed_at is not null),
    'total', (select count(*) from public.participants p where p.group_id = g.id),
    'participants', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', p.id, 'name', p.display_name, 'taken', p.claimed_at is not null)
        order by lower(p.display_name)
      )
      from public.participants p where p.group_id = g.id
    ), '[]'::jsonb)
  )
  from public.groups g
  where g.id = p_group_id;
$$;

-- ---------------------------------------------------------------------------
-- create_group: the group, its names and, when the organizer plays, their claim.
-- ---------------------------------------------------------------------------

create function public.create_group(
  p_name text,
  p_budget numeric,
  p_join_code text,
  p_admin_token_hash text,
  p_names text[],
  p_own_index integer,
  p_player_token_hash text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_participant_id uuid;
begin
  if cardinality(p_names) is null or cardinality(p_names) < 3 or cardinality(p_names) > 100 then
    raise exception 'invalid_input';
  end if;
  if p_own_index is not null and (p_own_index < 0 or p_own_index >= cardinality(p_names)
      or p_player_token_hash is null) then
    raise exception 'invalid_input';
  end if;

  begin
    insert into public.groups (name, join_code, admin_token_hash, budget)
    values (p_name, p_join_code, p_admin_token_hash, p_budget)
    returning id into v_group_id;
  exception when unique_violation then
    raise exception 'join_code_taken';
  end;

  begin
    insert into public.participants (group_id, display_name)
    select v_group_id, n from unnest(p_names) as n;
  exception when unique_violation then
    raise exception 'invalid_input';
  end;

  if p_own_index is not null then
    update public.participants
    set player_token_hash = p_player_token_hash, claimed_at = now()
    where group_id = v_group_id and display_name = p_names[p_own_index + 1]
    returning id into v_participant_id;
  end if;

  return jsonb_build_object('groupId', v_group_id, 'participantId', v_participant_id);
end;
$$;

create function public.preview_group(p_join_code text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.groups where join_code = p_join_code;
  if v_group_id is null then
    raise exception 'not_found';
  end if;
  return public.group_summary(v_group_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- join_group: claims a free name. The claim that leaves no free names draws the group in the
-- same transaction, using the cycle the caller drew with the shared matcher (p_pairs is a
-- jsonb array of {"giver": uuid, "receiver": uuid} over every participant). The group row is
-- locked, so concurrent joins queue up and exactly one of them draws.
-- ---------------------------------------------------------------------------

create function public.join_group(
  p_join_code text,
  p_participant_id uuid,
  p_player_token_hash text,
  p_pairs jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_group public.groups%rowtype;
  v_claimed timestamptz;
  v_total integer;
  v_valid integer;
begin
  select * into v_group from public.groups where join_code = p_join_code for update;
  if v_group.id is null then
    raise exception 'not_found';
  end if;
  if v_group.status = 'drawn' then
    raise exception 'group_drawn';
  end if;
  if now() > v_group.join_deadline then
    raise exception 'joining_closed';
  end if;

  select claimed_at into v_claimed from public.participants
  where id = p_participant_id and group_id = v_group.id;
  if not found then
    raise exception 'not_found';
  end if;
  if v_claimed is not null then
    raise exception 'already_taken';
  end if;

  update public.participants
  set player_token_hash = p_player_token_hash, claimed_at = now()
  where id = p_participant_id;

  if not exists (select 1 from public.participants
                 where group_id = v_group.id and claimed_at is null) then
    select count(*) into v_total from public.participants where group_id = v_group.id;

    -- The pairs must be one cycle through exactly this group's participants.
    with recursive
      pairs as (
        select (e->>'giver')::uuid as giver, (e->>'receiver')::uuid as receiver
        from jsonb_array_elements(coalesce(p_pairs, '[]'::jsonb)) as e
      ),
      walk as (
        select p.receiver as at, 1 as steps
        from pairs p
        where p.giver = (select min(id::text)::uuid from public.participants
                         where group_id = v_group.id)
        union all
        select p.receiver, w.steps + 1
        from walk w join pairs p on p.giver = w.at
        where w.steps < v_total
      )
    select count(distinct w.at) into v_valid
    from walk w
    where (select count(*) from pairs) = v_total
      and (select count(distinct giver) from pairs) = v_total
      and not exists (
        select 1 from pairs p
        where p.giver = p.receiver
           or p.giver not in (select id from public.participants where group_id = v_group.id)
      );

    if v_valid is distinct from v_total then
      raise exception 'invalid_input';
    end if;

    insert into public.assignments (group_id, giver_id, receiver_id)
    select v_group.id, (e->>'giver')::uuid, (e->>'receiver')::uuid
    from jsonb_array_elements(p_pairs) as e;

    update public.groups set status = 'drawn', drawn_at = now() where id = v_group.id;
    v_group.status := 'drawn';
  end if;

  return jsonb_build_object(
    'groupId', v_group.id, 'participantId', p_participant_id, 'status', v_group.status
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Organizer view and actions. A wrong token looks the same as a missing group.
-- ---------------------------------------------------------------------------

create function public.get_group_admin(p_group_id uuid, p_admin_token_hash text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_code text;
begin
  select join_code into v_code from public.groups
  where id = p_group_id and admin_token_hash = p_admin_token_hash;
  if v_code is null then
    raise exception 'not_found';
  end if;
  return public.group_summary(p_group_id) || jsonb_build_object('joinCode', v_code);
end;
$$;

-- Frees a name someone claimed by mistake, while the group is still open.
create function public.release_claim(
  p_group_id uuid,
  p_admin_token_hash text,
  p_participant_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_status public.group_status;
begin
  select status into v_status from public.groups
  where id = p_group_id and admin_token_hash = p_admin_token_hash
  for update;
  if v_status is null then
    raise exception 'not_found';
  end if;
  if v_status = 'drawn' then
    raise exception 'group_drawn';
  end if;

  update public.participants
  set player_token_hash = null, claimed_at = null
  where id = p_participant_id and group_id = p_group_id;
  if not found then
    raise exception 'not_found';
  end if;

  return public.group_summary(p_group_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_my_assignment: a player's own view. The recipient appears only once drawn.
-- ---------------------------------------------------------------------------

create function public.get_my_assignment(p_group_id uuid, p_player_token_hash text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_me public.participants%rowtype;
  v_summary jsonb;
  v_recipient text;
begin
  select * into v_me from public.participants
  where group_id = p_group_id and player_token_hash = p_player_token_hash;
  if v_me.id is null then
    raise exception 'not_found';
  end if;

  v_summary := public.group_summary(p_group_id);

  if v_summary->>'status' = 'drawn' then
    select r.display_name into v_recipient
    from public.assignments a
    join public.participants r on r.id = a.receiver_id
    where a.group_id = p_group_id and a.giver_id = v_me.id;
  end if;

  return jsonb_build_object(
    'groupId', p_group_id,
    'groupName', v_summary->>'name',
    'budget', v_summary->'budget',
    'status', v_summary->>'status',
    'joined', v_summary->'joined',
    'total', v_summary->'total',
    'me', v_me.display_name,
    'recipient', v_recipient
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime: every claim, release and draw broadcasts the progress on topic "group:<id>".
-- The payload holds counts and taken participant ids only, never assignments.
-- ---------------------------------------------------------------------------

create function public.broadcast_group_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid := (to_jsonb(new)->>(case tg_table_name when 'groups' then 'id'
                                                          else 'group_id' end))::uuid;
begin

  perform realtime.send(
    jsonb_build_object(
      'joined', (select count(*) from public.participants
                 where group_id = v_group_id and claimed_at is not null),
      'total', (select count(*) from public.participants where group_id = v_group_id),
      'takenIds', coalesce((select jsonb_agg(id order by id) from public.participants
                            where group_id = v_group_id and claimed_at is not null),
                           '[]'::jsonb),
      'status', (select status from public.groups where id = v_group_id)
    ),
    'progress',
    'group:' || v_group_id,
    false
  );
  return null;
end;
$$;

create trigger participants_broadcast_progress
after update of claimed_at on public.participants
for each row
when (old.claimed_at is distinct from new.claimed_at)
execute function public.broadcast_group_progress();

create trigger groups_broadcast_progress
after update of status on public.groups
for each row
when (old.status is distinct from new.status)
execute function public.broadcast_group_progress();

-- ---------------------------------------------------------------------------
-- Privileges: service_role only.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.rate_limit_hit(text, integer, integer),
  public.group_summary(uuid),
  public.create_group(text, numeric, text, text, text[], integer, text),
  public.preview_group(text),
  public.join_group(text, uuid, text, jsonb),
  public.get_group_admin(uuid, text),
  public.release_claim(uuid, text, uuid),
  public.get_my_assignment(uuid, text),
  public.broadcast_group_progress()
from public, anon, authenticated;

grant execute on function
  public.rate_limit_hit(text, integer, integer),
  public.create_group(text, numeric, text, text, text[], integer, text),
  public.preview_group(text),
  public.join_group(text, uuid, text, jsonb),
  public.get_group_admin(uuid, text),
  public.release_claim(uuid, text, uuid),
  public.get_my_assignment(uuid, text)
to service_role;
