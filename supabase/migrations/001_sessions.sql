-- Near Me session schema.
-- Direct table access is revoked. Clients use the functions below.
-- Rerunning this file drops and recreates Near Me tables.

begin;

drop table if exists public.locations cascade;
drop table if exists public.participants cascade;
drop table if exists public.sessions cascade;

drop function if exists public.create_session();
drop function if exists public.session_preview(text);
drop function if exists public.join_session(text, text, text, text);
drop function if exists public.session_state(text, text);
drop function if exists public.update_location(text, text, double precision, double precision, double precision);
drop function if exists public.stop_sharing(text, text);
drop function if exists public.heartbeat(text, text);
drop function if exists public.end_session(text, text);
drop function if exists public.leave_session(text, text);
drop function if exists public.broadcast_session(text);
drop function if exists public.prepare_session(text);
drop function if exists public.session_payload(text, uuid, boolean);
drop function if exists public.mark_stale(text);
drop function if exists public.clean_name(text);
drop function if exists public.token_hash(text);
drop function if exists public.api_error(text, text);
drop function if exists public.is_session_id(text);
drop function if exists public.generate_session_id();

create extension if not exists pgcrypto with schema extensions;

create table public.sessions (
  id text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'ended', 'expired')),
  created_by uuid,
  creator_token_hash bytea not null
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 32),
  joined_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'inactive', 'left')),
  last_seen timestamptz not null default now(),
  sharing boolean not null default false,
  is_creator boolean not null default false,
  token_hash bytea not null
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions (id) on delete cascade,
  participant_id uuid not null unique references public.participants (id) on delete cascade,
  latitude double precision not null check (latitude >= -90 and latitude <= 90),
  longitude double precision not null check (longitude >= -180 and longitude <= 180),
  accuracy double precision check (accuracy is null or (accuracy >= 0 and accuracy <= 100000)),
  recorded_at timestamptz not null default now()
);

create index participants_session_id_idx on public.participants (session_id);
create index participants_session_token_idx on public.participants (session_id, token_hash);
create index locations_session_id_idx on public.locations (session_id);
create index sessions_expires_at_idx on public.sessions (expires_at);
create unique index participants_one_creator_idx on public.participants (session_id) where is_creator;

alter table public.sessions enable row level security;
alter table public.participants enable row level security;
alter table public.locations enable row level security;

revoke all on table public.sessions from anon, authenticated, public;
revoke all on table public.participants from anon, authenticated, public;
revoke all on table public.locations from anon, authenticated, public;

create or replace function public.api_error(p_code text, p_message text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object('ok', false, 'code', p_code, 'message', p_message);
$$;

create or replace function public.is_session_id(p_id text)
returns boolean
language sql
immutable
as $$
  select p_id ~ '^[23456789abcdefghjkmnpqrstuvwxyz]{8}$';
$$;

create or replace function public.token_hash(p_token text)
returns bytea
language sql
immutable
set search_path = public, extensions
as $$
  select extensions.digest(convert_to(p_token, 'UTF8'), 'sha256');
$$;

create or replace function public.generate_session_id()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet text := '23456789abcdefghjkmnpqrstuvwxyz';
  bytes bytea := extensions.gen_random_bytes(8);
  result text := '';
  i int;
begin
  for i in 0..7 loop
    result := result || substr(alphabet, 1 + (get_byte(bytes, i) % length(alphabet)), 1);
  end loop;
  return result;
end;
$$;

create or replace function public.mark_stale(p_session_id text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_updated int := 0;
  v_deleted int := 0;
begin
  update public.participants p
  set sharing = false,
      status = 'inactive'
  where p.session_id = p_session_id
    and p.status = 'active'
    and p.sharing = true
    and (
      p.last_seen < clock_timestamp() - interval '3 minutes'
      or not exists (
        select 1
        from public.locations l
        where l.participant_id = p.id
          and l.recorded_at > clock_timestamp() - interval '3 minutes'
      )
    );
  get diagnostics v_updated = row_count;

  delete from public.locations l
  using public.participants p
  where l.participant_id = p.id
    and p.session_id = p_session_id
    and p.sharing = false;
  get diagnostics v_deleted = row_count;

  return v_updated > 0 or v_deleted > 0;
end;
$$;

create or replace function public.prepare_session(p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session public.sessions;
  v_changed boolean := false;
begin
  if not public.is_session_id(p_session_id) then
    return jsonb_build_object('found', false);
  end if;

  select * into v_session
  from public.sessions
  where id = p_session_id
  for update;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  if v_session.status = 'active' and v_session.expires_at <= clock_timestamp() then
    update public.sessions set status = 'expired' where id = p_session_id;
    update public.participants set sharing = false where session_id = p_session_id;
    delete from public.locations where session_id = p_session_id;
    select * into v_session from public.sessions where id = p_session_id;
    v_changed := true;
  elsif v_session.status = 'active' then
    v_changed := public.mark_stale(p_session_id);
  end if;

  return jsonb_build_object(
    'found', true,
    'changed', v_changed,
    'id', v_session.id,
    'createdAt', v_session.created_at,
    'expiresAt', v_session.expires_at,
    'status', v_session.status
  );
end;
$$;

create or replace function public.session_payload(
  p_session_id text,
  p_self uuid,
  p_is_creator boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_session public.sessions;
  v_participants jsonb;
  v_locations jsonb;
  v_count int;
begin
  select * into v_session from public.sessions where id = p_session_id;
  if not found then
    return public.api_error('missing', 'This session doesn''t exist.');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'displayName', p.display_name,
        'status', p.status,
        'lastSeen', p.last_seen,
        'sharing', p.sharing
      )
      order by p.joined_at
    ),
    '[]'::jsonb
  ), count(*)
  into v_participants, v_count
  from public.participants p
  where p.session_id = p_session_id
    and p.status <> 'left';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'participantId', l.participant_id,
        'latitude', l.latitude,
        'longitude', l.longitude,
        'accuracy', l.accuracy,
        'timestamp', l.recorded_at
      )
      order by l.recorded_at desc
    ),
    '[]'::jsonb
  )
  into v_locations
  from public.locations l
  join public.participants p on p.id = l.participant_id
  where l.session_id = p_session_id
    and p.sharing = true
    and p.status = 'active'
    and l.recorded_at > clock_timestamp() - interval '3 minutes';

  return jsonb_build_object(
    'revision', clock_timestamp(),
    'session', jsonb_build_object(
      'id', v_session.id,
      'createdAt', v_session.created_at,
      'expiresAt', v_session.expires_at,
      'status', v_session.status
    ),
    'participantCount', v_count,
    'participants', v_participants,
    'locations', v_locations,
    'selfId', p_self,
    'isCreator', p_is_creator
  );
end;
$$;

create or replace function public.broadcast_session(p_session_id text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform realtime.send(
    public.session_payload(p_session_id, null, false),
    'sync',
    'session:' || p_session_id,
    false
  );
exception
  when others then
    raise warning 'session broadcast failed: %', sqlerrm;
end;
$$;

create or replace function public.clean_name(p_display_name text)
returns text
language plpgsql
immutable
as $$
declare
  v_name text;
begin
  v_name := regexp_replace(trim(coalesce(p_display_name, '')), '[[:space:]]+', ' ', 'g');
  if char_length(v_name) < 1 or char_length(v_name) > 32 or v_name ~ '[[:cntrl:]]' then
    return null;
  end if;
  return v_name;
end;
$$;

create or replace function public.create_session()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id text;
  v_token text;
  v_created timestamptz;
  v_expires timestamptz;
  i int;
begin
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  for i in 1..6 loop
    v_id := public.generate_session_id();
    exit when not exists (select 1 from public.sessions where id = v_id);
    v_id := null;
  end loop;

  if v_id is null then
    return public.api_error('error', 'Something went wrong. Try again.');
  end if;

  insert into public.sessions (id, expires_at, creator_token_hash)
  values (v_id, clock_timestamp() + interval '8 hours', public.token_hash(v_token))
  returning created_at, expires_at into v_created, v_expires;

  return jsonb_build_object(
    'ok', true,
    'sessionId', v_id,
    'creatorToken', v_token,
    'createdAt', v_created,
    'expiresAt', v_expires
  );
exception
  when others then
    raise warning 'create_session failed: %', sqlerrm;
    return public.api_error('error', 'Something went wrong. Try again.');
end;
$$;

create or replace function public.session_preview(p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_meta jsonb;
begin
  v_meta := public.prepare_session(p_session_id);
  if coalesce((v_meta->>'found')::boolean, false) = false then
    return public.api_error('missing', 'This session doesn''t exist.');
  end if;
  if coalesce((v_meta->>'changed')::boolean, false) then
    perform public.broadcast_session(p_session_id);
  end if;
  return jsonb_build_object(
    'ok', true,
    'session', jsonb_build_object(
      'id', v_meta->>'id',
      'status', v_meta->>'status',
      'createdAt', v_meta->'createdAt',
      'expiresAt', v_meta->'expiresAt'
    )
  );
exception
  when others then
    raise warning 'session_preview failed: %', sqlerrm;
    return public.api_error('error', 'Something went wrong. Try again.');
end;
$$;

create or replace function public.join_session(
  p_session_id text,
  p_display_name text,
  p_participant_token text default null,
  p_creator_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_meta jsonb;
  v_name text;
  v_session public.sessions;
  v_participant public.participants;
  v_token text;
  v_creator boolean := false;
  v_found boolean := false;
  v_count int;
begin
  v_name := public.clean_name(p_display_name);
  if v_name is null then
    return public.api_error('invalid_name', 'Enter a name to join.');
  end if;

  v_meta := public.prepare_session(p_session_id);
  if coalesce((v_meta->>'found')::boolean, false) = false then
    return public.api_error('missing', 'This session doesn''t exist.');
  end if;
  if v_meta->>'status' <> 'active' then
    perform public.broadcast_session(p_session_id);
    return public.api_error('ended', 'This session has ended.');
  end if;

  select * into v_session from public.sessions where id = p_session_id;

  if p_participant_token is not null and char_length(p_participant_token) between 16 and 128 then
    select * into v_participant
    from public.participants
    where session_id = p_session_id
      and token_hash = public.token_hash(p_participant_token);
    if found then
      v_found := true;
      v_token := p_participant_token;
    end if;
  end if;

  if not v_found
     and p_creator_token is not null
     and char_length(p_creator_token) between 16 and 128
     and v_session.creator_token_hash = public.token_hash(p_creator_token) then
    select * into v_participant
    from public.participants
    where session_id = p_session_id and is_creator
    limit 1;
    v_creator := true;
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    if found then
      v_found := true;
    end if;
  end if;

  if v_found then
    update public.participants
    set display_name = v_name,
        status = 'active',
        last_seen = clock_timestamp(),
        token_hash = public.token_hash(v_token),
        is_creator = is_creator or v_creator
    where id = v_participant.id
    returning * into v_participant;
  else
    select count(*) into v_count
    from public.participants
    where session_id = p_session_id and status <> 'left';
    if v_count >= 50 then
      return public.api_error('full', 'This session is full.');
    end if;

    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    v_creator := p_creator_token is not null
      and char_length(p_creator_token) between 16 and 128
      and v_session.creator_token_hash = public.token_hash(p_creator_token);

    insert into public.participants (
      session_id, display_name, token_hash, is_creator, status, sharing
    )
    values (
      p_session_id, v_name, public.token_hash(v_token), v_creator, 'active', false
    )
    returning * into v_participant;
  end if;

  if v_participant.is_creator then
    update public.sessions
    set created_by = v_participant.id
    where id = p_session_id and created_by is distinct from v_participant.id;
  end if;

  perform public.broadcast_session(p_session_id);

  return public.session_payload(p_session_id, v_participant.id, v_participant.is_creator)
    || jsonb_build_object(
      'ok', true,
      'participantId', v_participant.id,
      'participantToken', v_token,
      'isCreator', v_participant.is_creator
    );
exception
  when others then
    raise warning 'join_session failed: %', sqlerrm;
    return public.api_error('error', 'Something went wrong. Try again.');
end;
$$;

create or replace function public.session_state(
  p_session_id text,
  p_participant_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_meta jsonb;
  v_participant public.participants;
begin
  if p_participant_token is null or char_length(p_participant_token) > 128 then
    return public.api_error('not_member', 'Join this session to continue.');
  end if;

  v_meta := public.prepare_session(p_session_id);
  if coalesce((v_meta->>'found')::boolean, false) = false then
    return public.api_error('missing', 'This session doesn''t exist.');
  end if;

  select * into v_participant
  from public.participants
  where session_id = p_session_id
    and token_hash = public.token_hash(p_participant_token)
    and status <> 'left';

  if not found then
    return public.api_error('not_member', 'Join this session to continue.');
  end if;

  if coalesce((v_meta->>'changed')::boolean, false) then
    perform public.broadcast_session(p_session_id);
  end if;

  return public.session_payload(p_session_id, v_participant.id, v_participant.is_creator)
    || jsonb_build_object('ok', true);
exception
  when others then
    raise warning 'session_state failed: %', sqlerrm;
    return public.api_error('error', 'Something went wrong. Try again.');
end;
$$;

create or replace function public.update_location(
  p_session_id text,
  p_participant_token text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_meta jsonb;
  v_participant public.participants;
begin
  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180
     or (p_accuracy is not null and (p_accuracy < 0 or p_accuracy > 100000)) then
    return public.api_error('invalid_location', 'We couldn''t use that location. Try again.');
  end if;

  v_meta := public.prepare_session(p_session_id);
  if coalesce((v_meta->>'found')::boolean, false) = false then
    return public.api_error('missing', 'This session doesn''t exist.');
  end if;
  if v_meta->>'status' <> 'active' then
    if coalesce((v_meta->>'changed')::boolean, false) then
      perform public.broadcast_session(p_session_id);
    end if;
    return public.api_error('ended', 'This session has ended.');
  end if;

  select * into v_participant
  from public.participants
  where session_id = p_session_id
    and token_hash = public.token_hash(coalesce(p_participant_token, ''))
    and status <> 'left'
  for update;

  if not found then
    return public.api_error('not_member', 'Join this session to continue.');
  end if;

  if exists (
    select 1 from public.locations
    where participant_id = v_participant.id
      and recorded_at > clock_timestamp() - interval '2 seconds'
  ) then
    update public.participants set last_seen = clock_timestamp() where id = v_participant.id;
    return jsonb_build_object('ok', true, 'throttled', true);
  end if;

  update public.participants
  set sharing = true,
      status = 'active',
      last_seen = clock_timestamp()
  where id = v_participant.id;

  insert into public.locations (session_id, participant_id, latitude, longitude, accuracy, recorded_at)
  values (p_session_id, v_participant.id, p_latitude, p_longitude, p_accuracy, clock_timestamp())
  on conflict (participant_id) do update
  set latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy = excluded.accuracy,
      recorded_at = excluded.recorded_at,
      session_id = excluded.session_id;

  perform public.broadcast_session(p_session_id);
  return jsonb_build_object('ok', true);
exception
  when others then
    raise warning 'update_location failed: %', sqlerrm;
    return public.api_error('error', 'Something went wrong. Try again.');
end;
$$;

create or replace function public.stop_sharing(p_session_id text, p_participant_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_meta jsonb;
  v_participant public.participants;
begin
  v_meta := public.prepare_session(p_session_id);
  if coalesce((v_meta->>'found')::boolean, false) = false then
    return public.api_error('missing', 'This session doesn''t exist.');
  end if;

  select * into v_participant
  from public.participants
  where session_id = p_session_id
    and token_hash = public.token_hash(coalesce(p_participant_token, ''))
    and status <> 'left';

  if not found then
    return public.api_error('not_member', 'Join this session to continue.');
  end if;

  update public.participants
  set sharing = false,
      status = 'inactive',
      last_seen = clock_timestamp()
  where id = v_participant.id;

  delete from public.locations where participant_id = v_participant.id;
  perform public.broadcast_session(p_session_id);
  return jsonb_build_object('ok', true);
exception
  when others then
    raise warning 'stop_sharing failed: %', sqlerrm;
    return public.api_error('error', 'Something went wrong. Try again.');
end;
$$;

create or replace function public.heartbeat(p_session_id text, p_participant_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_meta jsonb;
  v_participant public.participants;
begin
  v_meta := public.prepare_session(p_session_id);
  if coalesce((v_meta->>'found')::boolean, false) = false then
    return public.api_error('missing', 'This session doesn''t exist.');
  end if;
  if v_meta->>'status' <> 'active' then
    if coalesce((v_meta->>'changed')::boolean, false) then
      perform public.broadcast_session(p_session_id);
    end if;
    return public.api_error('ended', 'This session has ended.');
  end if;

  update public.participants
  set last_seen = clock_timestamp()
  where session_id = p_session_id
    and token_hash = public.token_hash(coalesce(p_participant_token, ''))
    and status <> 'left'
  returning * into v_participant;

  if not found then
    return public.api_error('not_member', 'Join this session to continue.');
  end if;

  if coalesce((v_meta->>'changed')::boolean, false) then
    perform public.broadcast_session(p_session_id);
  end if;

  return jsonb_build_object('ok', true);
exception
  when others then
    raise warning 'heartbeat failed: %', sqlerrm;
    return public.api_error('error', 'Something went wrong. Try again.');
end;
$$;

create or replace function public.end_session(p_session_id text, p_creator_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_meta jsonb;
  v_session public.sessions;
begin
  v_meta := public.prepare_session(p_session_id);
  if coalesce((v_meta->>'found')::boolean, false) = false then
    return public.api_error('missing', 'This session doesn''t exist.');
  end if;

  select * into v_session from public.sessions where id = p_session_id;
  if p_creator_token is null
     or char_length(p_creator_token) > 128
     or v_session.creator_token_hash is distinct from public.token_hash(p_creator_token) then
    return public.api_error('forbidden', 'Only the person who created this session can end it.');
  end if;

  if v_session.status = 'active' then
    update public.sessions set status = 'ended' where id = p_session_id;
    update public.participants set sharing = false where session_id = p_session_id;
    delete from public.locations where session_id = p_session_id;
  end if;

  perform public.broadcast_session(p_session_id);
  return jsonb_build_object('ok', true);
exception
  when others then
    raise warning 'end_session failed: %', sqlerrm;
    return public.api_error('error', 'Something went wrong. Try again.');
end;
$$;

create or replace function public.leave_session(p_session_id text, p_participant_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_participant public.participants;
begin
  if public.prepare_session(p_session_id)->>'found' <> 'true' then
    return public.api_error('missing', 'This session doesn''t exist.');
  end if;

  update public.participants
  set status = 'left',
      sharing = false,
      last_seen = clock_timestamp()
  where session_id = p_session_id
    and token_hash = public.token_hash(coalesce(p_participant_token, ''))
    and status <> 'left'
  returning * into v_participant;

  if not found then
    return public.api_error('not_member', 'Join this session to continue.');
  end if;

  delete from public.locations where participant_id = v_participant.id;
  perform public.broadcast_session(p_session_id);
  return jsonb_build_object('ok', true);
exception
  when others then
    raise warning 'leave_session failed: %', sqlerrm;
    return public.api_error('error', 'Something went wrong. Try again.');
end;
$$;

revoke all on function public.api_error(text, text) from public, anon, authenticated;
revoke all on function public.is_session_id(text) from public, anon, authenticated;
revoke all on function public.token_hash(text) from public, anon, authenticated;
revoke all on function public.generate_session_id() from public, anon, authenticated;
revoke all on function public.mark_stale(text) from public, anon, authenticated;
revoke all on function public.prepare_session(text) from public, anon, authenticated;
revoke all on function public.session_payload(text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.broadcast_session(text) from public, anon, authenticated;
revoke all on function public.clean_name(text) from public, anon, authenticated;

revoke all on function public.create_session() from public;
revoke all on function public.session_preview(text) from public;
revoke all on function public.join_session(text, text, text, text) from public;
revoke all on function public.session_state(text, text) from public;
revoke all on function public.update_location(text, text, double precision, double precision, double precision) from public;
revoke all on function public.stop_sharing(text, text) from public;
revoke all on function public.heartbeat(text, text) from public;
revoke all on function public.end_session(text, text) from public;
revoke all on function public.leave_session(text, text) from public;

grant execute on function public.create_session() to anon, authenticated;
grant execute on function public.session_preview(text) to anon, authenticated;
grant execute on function public.join_session(text, text, text, text) to anon, authenticated;
grant execute on function public.session_state(text, text) to anon, authenticated;
grant execute on function public.update_location(text, text, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.stop_sharing(text, text) to anon, authenticated;
grant execute on function public.heartbeat(text, text) to anon, authenticated;
grant execute on function public.end_session(text, text) to anon, authenticated;
grant execute on function public.leave_session(text, text) to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table public.sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'participants'
  ) then
    alter publication supabase_realtime add table public.participants;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'locations'
  ) then
    alter publication supabase_realtime add table public.locations;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
