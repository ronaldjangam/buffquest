-- =========================================================
-- ENUMS
-- =========================================================

-- Drop types if they already exist (for idempotency)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quest_status') THEN
        create type public.quest_status as enum (
          'open',
          'claimed',
          'completed',
          'verified',
          'cancelled',
          'expired'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_status') THEN
        create type public.moderation_status as enum (
          'pending',
          'approved',
          'rejected'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_verification_status') THEN
        create type public.attendance_verification_status as enum (
          'pending',
          'approved',
          'rejected'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reward_source_type') THEN
        create type public.reward_source_type as enum (
          'quest_post',
          'quest_completion',
          'quest_refund',
          'attendance_reward',
          'manual_adjustment'
        );
    END IF;
END$$;

-- =========================================================
-- UPDATED_AT HELPER
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- PROFILES
-- =========================================================

create table if not exists public.profiles (
  id text primary key references public."user"(id) on delete cascade,
  email text unique,
  display_name text not null,
  credits integer not null default 0 check (credits >= 0),
  notoriety integer not null default 0 check (notoriety >= 0),
  is_verified_student boolean not null default false,
  profile_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.name, split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on public."user";

create trigger on_auth_user_created
after insert on public."user"
for each row
execute function public.handle_new_user();

-- Backfill profiles for existing Better Auth users
insert into public.profiles (id, email, display_name)
select id, email, coalesce(name, split_part(email, '@', 1)) from public."user"
on conflict (id) do nothing;

-- =========================================================
-- BUILDING ZONES
-- =========================================================

create table if not exists public.building_zones (
  id bigserial primary key,
  name text not null unique,
  latitude double precision,
  longitude double precision,
  radius_meters double precision check (radius_meters is null or radius_meters > 0),
  polygon_geojson jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (latitude is not null and longitude is not null and radius_meters is not null)
    or polygon_geojson is not null
  )
);

drop trigger if exists set_building_zones_updated_at on public.building_zones;
create trigger set_building_zones_updated_at
before update on public.building_zones
for each row
execute function public.set_updated_at();

-- =========================================================
-- QUESTS
-- =========================================================

create table if not exists public.quests (
  id bigserial primary key,
  creator_id text not null references public.profiles(id) on delete cascade,
  hunter_id text references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  building_zone_id bigint not null references public.building_zones(id) on delete restrict,
  cost_credits integer not null default 0 check (cost_credits >= 0),
  reward_credits integer not null default 0 check (reward_credits >= 0),
  reward_notoriety integer not null default 0 check (reward_notoriety >= 0),
  status public.quest_status not null default 'open',
  moderation_status public.moderation_status not null default 'pending',
  moderation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  verified_at timestamptz,
  rewarded_at timestamptz,
  expires_at timestamptz,

  check (creator_id <> hunter_id),

  check (
    (status = 'open' and hunter_id is null)
    or (status in ('claimed', 'completed', 'verified') and hunter_id is not null)
    or (status in ('cancelled', 'expired'))
  )
);

drop trigger if exists set_quests_updated_at on public.quests;
create trigger set_quests_updated_at
before update on public.quests
for each row
execute function public.set_updated_at();

-- =========================================================
-- MESSAGES
-- =========================================================

create table if not exists public.messages (
  id bigserial primary key,
  quest_id bigint not null references public.quests(id) on delete cascade,
  sender_id text not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- =========================================================
-- ATTENDANCE SUBMISSIONS
-- =========================================================

create table if not exists public.attendance_submissions (
  id bigserial primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  schedule_image_url text not null,
  class_photo_url text not null,
  class_name text not null,
  building_zone_id bigint references public.building_zones(id) on delete set null,
  scheduled_start_time timestamptz not null,
  submission_time timestamptz not null default now(),
  verification_status public.attendance_verification_status not null default 'pending',
  reward_issued boolean not null default false,
  created_at timestamptz not null default now()
);

-- =========================================================
-- REWARD LOGS
-- =========================================================

create table if not exists public.reward_logs (
  id bigserial primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  source_type public.reward_source_type not null,
  source_id bigint,
  credit_delta integer not null default 0,
  notoriety_delta integer not null default 0,
  created_at timestamptz not null default now(),
  check (credit_delta <> 0 or notoriety_delta <> 0)
);

-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists idx_profiles_email on public.profiles(email);

create index if not exists idx_quests_creator_id on public.quests(creator_id);
create index if not exists idx_quests_hunter_id on public.quests(hunter_id);
create index if not exists idx_quests_building_zone_id on public.quests(building_zone_id);
create index if not exists idx_quests_status on public.quests(status);
create index if not exists idx_quests_moderation_status on public.quests(moderation_status);
create index if not exists idx_quests_created_at on public.quests(created_at desc);

create index if not exists idx_messages_quest_id on public.messages(quest_id);
create index if not exists idx_messages_sender_id on public.messages(sender_id);
create index if not exists idx_messages_created_at on public.messages(created_at desc);

create index if not exists idx_attendance_user_id on public.attendance_submissions(user_id);
create index if not exists idx_attendance_building_zone_id on public.attendance_submissions(building_zone_id);
create index if not exists idx_attendance_verification_status on public.attendance_submissions(verification_status);
create index if not exists idx_attendance_submission_time on public.attendance_submissions(submission_time desc);

create index if not exists idx_reward_logs_user_id on public.reward_logs(user_id);
create index if not exists idx_reward_logs_source_type on public.reward_logs(source_type);
create index if not exists idx_reward_logs_created_at on public.reward_logs(created_at desc);
