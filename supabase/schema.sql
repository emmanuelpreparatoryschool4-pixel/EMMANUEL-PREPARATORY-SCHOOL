-- Emmanuel Preparatory School single-school schema for Supabase.
-- Paste into the Supabase SQL Editor and run once on a new project.
-- Create users in Supabase Auth; new profiles remain pending until assigned an approved role.
-- Promote the school owner after creating their Auth user.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null default 'pending' check (role in ('pending', 'owner', 'headmaster', 'assistant_headmaster')),
  avatar_url text,
  staff_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'pending' where role = 'teacher';
update public.profiles set role = 'owner' where role = 'admin';
alter table public.profiles alter column role set default 'pending';
alter table public.profiles add constraint profiles_role_check
  check (role in ('pending', 'owner', 'headmaster', 'assistant_headmaster'));

create or replace function public.current_school_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_school_staff_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select staff_id from public.profiles where id = auth.uid();
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'School User'),
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create table if not exists public.school_settings (
  id text primary key default 'school-1' check (id = 'school-1'),
  name text not null,
  abbreviation text not null,
  logo text,
  profile_image text,
  address text not null default '',
  digital_address text not null default '',
  phone_numbers text[] not null default '{}',
  email text not null default '',
  establishment_date date,
  proprietor_name text not null default '',
  headteacher_name text not null default '',
  motto text not null default '',
  currency text not null default 'GHS',
  timezone text not null default 'Africa/Accra',
  language text not null default 'English',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academic_years (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create unique index if not exists academic_years_one_current_idx
  on public.academic_years (is_current) where is_current;

create table if not exists public.terms (
  id text primary key default gen_random_uuid()::text,
  academic_year_id text not null references public.academic_years(id) on delete restrict,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, name),
  check (end_date >= start_date)
);
create unique index if not exists terms_one_current_per_year_idx
  on public.terms (academic_year_id) where is_current;

create table if not exists public.subjects (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  code text not null unique,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  stream text,
  academic_year_id text not null references public.academic_years(id) on delete restrict,
  class_teacher_id text,
  subject_ids text[] not null default '{}',
  capacity integer not null default 1 check (capacity > 0),
  location text,
  status text not null default 'active' check (status in ('active', 'archived')),
  notes text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.prevent_duplicate_class_names()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.classes existing
    where existing.academic_year_id = new.academic_year_id
      and existing.id <> new.id
      and regexp_replace(
            lower(concat_ws(' ', btrim(existing.name), nullif(btrim(existing.stream), ''))),
            '([0-9])\s+([a-z])$',
            '\1\2'
          ) =
          regexp_replace(
            lower(concat_ws(' ', btrim(new.name), nullif(btrim(new.stream), ''))),
            '([0-9])\s+([a-z])$',
            '\1\2'
          )
  ) then
    raise exception 'A class with this name and stream already exists for the selected academic year.'
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists classes_unique_name_per_year on public.classes;
create trigger classes_unique_name_per_year
  before insert or update of name, stream, academic_year_id on public.classes
  for each row execute function public.prevent_duplicate_class_names();

create table if not exists public.staff (
  id text primary key default gen_random_uuid()::text,
  staff_id text not null unique,
  first_name text not null,
  last_name text not null,
  other_names text,
  gender text not null check (gender in ('male', 'female')),
  date_of_birth date not null,
  hometown text,
  place_of_birth text,
  district text,
  district_capital text,
  region text,
  residential_address text,
  digital_address text,
  phone_number text not null,
  email text,
  marital_status text check (marital_status in ('single', 'married', 'divorced', 'widowed')),
  number_of_children integer check (number_of_children is null or number_of_children >= 0),
  languages_spoken text[] not null default '{}',
  mother_tongue text,
  tribe text,
  religion text,
  photograph text,
  staff_category text not null check (staff_category in ('teacher', 'headteacher', 'administrator', 'cook', 'driver', 'other')),
  is_trained boolean not null default false,
  registration_number text,
  file_number text,
  appointment_date date not null,
  current_rank text,
  date_promoted date,
  pay_level text,
  current_station text,
  date_posted_to_station date,
  former_school text,
  class_in_charge_id text,
  subjects_taught text[] not null default '{}',
  employment_status text not null default 'active' check (employment_status in ('active', 'on_leave', 'suspended', 'terminated', 'retired')),
  school_portfolio text,
  tvet_skills text,
  next_of_kin_name text,
  next_of_kin_relationship text,
  next_of_kin_contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.classes
  add constraint classes_class_teacher_fk
  foreign key (class_teacher_id) references public.staff(id) on delete set null;
alter table public.staff
  add constraint staff_class_in_charge_fk
  foreign key (class_in_charge_id) references public.classes(id) on delete set null;

-- These identity and banking fields are deliberately isolated behind owner-only RLS.
create table if not exists public.staff_private_details (
  staff_id text primary key references public.staff(id) on delete cascade,
  ssnit_number text,
  tin text,
  ghana_card_number text,
  nhis_number text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_branch text,
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id text primary key default gen_random_uuid()::text,
  student_id text not null unique,
  admission_number text not null unique,
  first_name text not null,
  last_name text not null,
  other_names text,
  preferred_name text,
  gender text not null check (gender in ('male', 'female')),
  date_of_birth date not null,
  nhis_number text,
  languages_spoken text[] not null default '{}',
  mother_tongue text,
  place_of_birth text not null default '',
  district text not null default '',
  district_capital text not null default '',
  region text not null default '',
  religion text,
  residential_address text not null default '',
  digital_address text,
  photograph text,
  admission_date date not null,
  current_class_id text not null references public.classes(id) on delete restrict,
  stream text,
  academic_year_id text not null references public.academic_years(id) on delete restrict,
  enrollment_status text not null default 'active' check (enrollment_status in ('active', 'transferred', 'withdrawn', 'graduated', 'archived')),
  transport_arrangement text not null default 'other' check (transport_arrangement in ('school_bus', 'walking', 'private', 'other')),
  emergency_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guardians (
  id text primary key default gen_random_uuid()::text,
  student_id text not null references public.students(id) on delete cascade,
  full_name text not null,
  relationship text not null,
  phone_number text not null,
  alternative_phone text,
  email text,
  address text,
  is_primary_contact boolean not null default false,
  is_emergency_contact boolean not null default false,
  is_authorized_pickup boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enrollment_history (
  id text primary key default gen_random_uuid()::text,
  student_id text not null references public.students(id) on delete restrict,
  class_id text not null references public.classes(id) on delete restrict,
  academic_year_id text not null references public.academic_years(id) on delete restrict,
  term_id text references public.terms(id) on delete set null,
  enrollment_date date not null,
  exit_date date,
  status text not null check (status in ('active', 'transferred', 'withdrawn', 'graduated', 'archived')),
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (exit_date is null or exit_date >= enrollment_date)
);

create table if not exists public.qualifications (
  id text primary key default gen_random_uuid()::text,
  staff_id text not null references public.staff(id) on delete cascade,
  qualification text not null,
  institution text not null,
  school_attended text,
  course text,
  year_started integer not null,
  year_completed integer not null,
  professional_qualification text,
  certificate_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (year_completed >= year_started)
);

create table if not exists public.staff_assignments (
  id text primary key default gen_random_uuid()::text,
  staff_id text not null references public.staff(id) on delete restrict,
  class_id text references public.classes(id) on delete set null,
  subject_id text references public.subjects(id) on delete set null,
  academic_year_id text not null references public.academic_years(id) on delete restrict,
  term_id text references public.terms(id) on delete set null,
  assignment_type text not null check (assignment_type in ('class_teacher', 'subject_teacher', 'assistant')),
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.attendance_sessions (
  id text primary key default gen_random_uuid()::text,
  class_id text not null references public.classes(id) on delete restrict,
  date date not null,
  term_id text not null references public.terms(id) on delete restrict,
  academic_year_id text not null references public.academic_years(id) on delete restrict,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'completed')),
  sync_status text not null default 'local' check (sync_status in ('local', 'pending', 'syncing', 'synced', 'failed', 'conflict')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, date)
);

create table if not exists public.attendance_records (
  id text primary key default gen_random_uuid()::text,
  student_id text not null references public.students(id) on delete restrict,
  class_id text not null references public.classes(id) on delete restrict,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused', 'sick')),
  remarks text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  sync_status text not null default 'local' check (sync_status in ('local', 'pending', 'syncing', 'synced', 'failed', 'conflict')),
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, date)
);

create table if not exists public.sync_queue (
  id text primary key default gen_random_uuid()::text,
  entity_type text not null check (entity_type in ('attendance', 'assessment', 'other')),
  entity_id text not null,
  action text not null check (action in ('create', 'update', 'delete')),
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('local', 'pending', 'syncing', 'synced', 'failed', 'conflict')),
  retry_count integer not null default 0 check (retry_count >= 0),
  last_attempt timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.assessment_types (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  description text,
  default_weight numeric(5,2) not null default 0 check (default_weight >= 0 and default_weight <= 100),
  default_max_score numeric(8,2) not null default 100 check (default_max_score > 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessments (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  assessment_type_id text not null references public.assessment_types(id) on delete restrict,
  class_id text not null references public.classes(id) on delete restrict,
  subject_id text not null references public.subjects(id) on delete restrict,
  term_id text not null references public.terms(id) on delete restrict,
  academic_year_id text not null references public.academic_years(id) on delete restrict,
  teacher_id text references public.staff(id) on delete set null,
  max_score numeric(8,2) not null check (max_score > 0),
  weight numeric(5,2) not null check (weight > 0 and weight <= 100),
  date date not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'graded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_scores (
  id text primary key default gen_random_uuid()::text,
  assessment_id text not null references public.assessments(id) on delete cascade,
  student_id text not null references public.students(id) on delete restrict,
  score numeric(8,2) not null check (score >= 0),
  grade text,
  remarks text,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);

create or replace function public.validate_assessment_max_score()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.max_score <= 0 then
    raise exception 'Assessment maximum score must be greater than zero.';
  end if;
  return new;
end;
$$;

drop trigger if exists assessments_max_score_limit on public.assessments;
create trigger assessments_max_score_limit
  before insert or update of max_score on public.assessments
  for each row execute function public.validate_assessment_max_score();

create or replace function public.validate_assessment_score()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  assessment_max numeric(8,2);
  selected_assessment public.assessments%rowtype;
begin
  select * into selected_assessment
  from public.assessments
  where id = new.assessment_id;
  if not found then
    raise exception 'Assessment not found.';
  end if;
  assessment_max := selected_assessment.max_score;
  if new.score < 0 or new.score > assessment_max or new.status not in ('draft', 'submitted') then
    raise exception 'Assessment scores cannot be negative or exceed the assessment maximum.';
  end if;
  if not (
    exists (
      select 1 from public.students
      where id = new.student_id
        and current_class_id = selected_assessment.class_id
        and academic_year_id = selected_assessment.academic_year_id
        and enrollment_status = 'active'
    )
    or exists (
      select 1 from public.enrollment_history
      where student_id = new.student_id
        and class_id = selected_assessment.class_id
        and academic_year_id = selected_assessment.academic_year_id
        and term_id = selected_assessment.term_id and status = 'transferred'
    )
  ) then
    raise exception 'The student was not enrolled in this assessment class and term.';
  end if;
  if coalesce(cardinality((select subject_ids from public.classes where id = selected_assessment.class_id)), 0) > 0
    and not (selected_assessment.subject_id = any(
      (select subject_ids from public.classes where id = selected_assessment.class_id)
    )) then
    raise exception 'The assessment subject is not assigned to its class.';
  end if;
  if exists (
    select 1 from public.report_cards
    where class_id = selected_assessment.class_id and term_id = selected_assessment.term_id
      and academic_year_id = selected_assessment.academic_year_id and status = 'published'
  ) then
    raise exception 'Reopen published report cards before changing assessment scores.';
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_scores_limit on public.assessment_scores;
create trigger assessment_scores_limit
  before insert or update of score, assessment_id, student_id, status on public.assessment_scores
  for each row execute function public.validate_assessment_score();

create or replace function public.prevent_published_assessment_score_deletes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.assessments a
    join public.report_cards rc
      on rc.class_id = a.class_id and rc.term_id = a.term_id
      and rc.academic_year_id = a.academic_year_id and rc.status = 'published'
    where a.id = old.assessment_id
  ) then
    raise exception 'Reopen published report cards before deleting assessment scores.';
  end if;
  return old;
end;
$$;

drop trigger if exists assessment_scores_prevent_published_delete on public.assessment_scores;
create trigger assessment_scores_prevent_published_delete
  before delete on public.assessment_scores
  for each row execute function public.prevent_published_assessment_score_deletes();

create table if not exists public.grading_scales (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  grades jsonb not null default '[]'::jsonb check (jsonb_typeof(grades) = 'array'),
  calculation_rules jsonb not null default '{"rankingMethod":"competition"}'::jsonb
    check (jsonb_typeof(calculation_rules) = 'object'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists grading_scales_one_default_idx
  on public.grading_scales (is_default) where is_default;

create table if not exists public.report_cards (
  id text primary key default gen_random_uuid()::text,
  student_id text not null references public.students(id) on delete restrict,
  class_id text not null references public.classes(id) on delete restrict,
  term_id text not null references public.terms(id) on delete restrict,
  academic_year_id text not null references public.academic_years(id) on delete restrict,
  subjects jsonb not null default '[]'::jsonb check (jsonb_typeof(subjects) = 'array'),
  total_score numeric(10,2) not null default 0,
  average_score numeric(6,2) not null default 0,
  position integer check (position is null or position > 0),
  attendance_present integer not null default 0 check (attendance_present >= 0),
  attendance_total integer not null default 0 check (attendance_total >= 0),
  conduct text,
  teacher_comment text,
  headteacher_comment text,
  promotion_decision text,
  overall_grade text,
  overall_remark text,
  calculation_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(calculation_snapshot) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'ready_for_review', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, term_id)
);

create or replace function public.validate_assessment_configuration()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  selected_subject_ids text[];
begin
  select subject_ids into selected_subject_ids
  from public.classes
  where id = new.class_id and academic_year_id = new.academic_year_id;
  if not found or not exists (
    select 1 from public.terms
    where id = new.term_id and academic_year_id = new.academic_year_id
  ) then
    raise exception 'The selected class, academic year, and term do not match.';
  end if;
  if coalesce(cardinality(selected_subject_ids), 0) > 0
    and not (new.subject_id = any(selected_subject_ids)) then
    raise exception 'The assessment subject is not assigned to its class.';
  end if;
  if tg_op = 'INSERT' and not exists (
    select 1 from public.assessment_types
    where id = new.assessment_type_id and status = 'active'
  ) then
    raise exception 'Select an active assessment type.';
  end if;
  if not exists (
    select 1 from public.assessment_types where id = new.assessment_type_id
  ) then
    raise exception 'Select an active assessment type.';
  end if;
  return new;
end;
$$;

drop trigger if exists assessments_validate_configuration on public.assessments;
create trigger assessments_validate_configuration
  before insert or update of assessment_type_id, class_id, subject_id, term_id, academic_year_id
  on public.assessments
  for each row execute function public.validate_assessment_configuration();

create or replace function public.prevent_assessment_calculation_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if row(new.max_score, new.weight, new.assessment_type_id, new.class_id, new.subject_id, new.term_id, new.academic_year_id)
    is distinct from
    row(old.max_score, old.weight, old.assessment_type_id, old.class_id, old.subject_id, old.term_id, old.academic_year_id)
    and (
      exists (select 1 from public.assessment_scores where assessment_id = old.id)
      or exists (
        select 1 from public.report_cards
        where class_id = old.class_id and term_id = old.term_id
          and academic_year_id = old.academic_year_id and status = 'published'
      )
    ) then
    raise exception 'Assessment scoring rules cannot change after scores are saved or report cards are published.';
  end if;
  return new;
end;
$$;

drop trigger if exists assessments_prevent_calculation_changes on public.assessments;
create trigger assessments_prevent_calculation_changes
  before update on public.assessments
  for each row execute function public.prevent_assessment_calculation_changes();

create or replace function public.prevent_class_subject_history_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.subject_ids is distinct from old.subject_ids and (
    exists (
      select 1 from public.assessments a
      join public.assessment_scores s on s.assessment_id = a.id
      where a.class_id = old.id
    )
    or exists (
      select 1 from public.report_cards
      where class_id = old.id and status = 'published'
    )
  ) then
    raise exception 'Class subjects cannot change after scores are saved or report cards are published.';
  end if;
  return new;
end;
$$;

drop trigger if exists classes_prevent_subject_history_changes on public.classes;
create trigger classes_prevent_subject_history_changes
  before update of subject_ids on public.classes
  for each row execute function public.prevent_class_subject_history_changes();

create or replace function public.save_assessment_scores(
  p_assessment_id text,
  p_scores jsonb,
  p_update_assessment_status boolean default true,
  p_status text default 'submitted'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  selected_assessment public.assessments%rowtype;
  score_entry jsonb;
  selected_student_id text;
  selected_score numeric;
  enrolled_count integer;
  submitted_count integer;
begin
  if public.current_school_role() not in ('owner', 'headmaster', 'assistant_headmaster') then
    raise exception 'You are not authorized to enter academic results.';
  end if;
  if p_status not in ('draft', 'submitted') or jsonb_typeof(p_scores) <> 'array' then
    raise exception 'The score submission is invalid.';
  end if;
  select * into selected_assessment
  from public.assessments
  where id = p_assessment_id
  for update;
  if not found then
    raise exception 'Assessment not found.';
  end if;
  if exists (
    select 1 from public.report_cards
    where class_id = selected_assessment.class_id
      and term_id = selected_assessment.term_id
      and academic_year_id = selected_assessment.academic_year_id
      and status = 'published'
  ) then
    raise exception 'Reopen published report cards before changing assessment scores.';
  end if;
  if (
    select count(*) from jsonb_array_elements(p_scores)
  ) <> (
    select count(distinct coalesce(entry->>'studentId', entry->>'student_id'))
    from jsonb_array_elements(p_scores) as entries(entry)
  ) then
    raise exception 'A student may appear only once in a score submission.';
  end if;

  for score_entry in select value from jsonb_array_elements(p_scores)
  loop
    selected_student_id := coalesce(score_entry->>'studentId', score_entry->>'student_id');
    if selected_student_id is null or not (
      exists (
        select 1 from public.students
        where id = selected_student_id
          and current_class_id = selected_assessment.class_id
          and academic_year_id = selected_assessment.academic_year_id
          and enrollment_status = 'active'
      )
      or exists (
        select 1 from public.enrollment_history
        where student_id = selected_student_id
          and class_id = selected_assessment.class_id
          and academic_year_id = selected_assessment.academic_year_id
          and term_id = selected_assessment.term_id
          and status = 'transferred'
      )
    ) then
      raise exception 'Scores can only be recorded for students enrolled in the assessment class for that term.';
    end if;
    if not (selected_assessment.subject_id = any(
      coalesce((select subject_ids from public.classes where id = selected_assessment.class_id), '{}')
    )) then
      if coalesce(cardinality((select subject_ids from public.classes where id = selected_assessment.class_id)), 0) > 0 then
        raise exception 'The assessment subject is not assigned to its class.';
      end if;
    end if;

    if score_entry->'score' is null or score_entry->'score' = 'null'::jsonb then
      delete from public.assessment_scores
      where assessment_id = p_assessment_id and student_id = selected_student_id;
    else
      selected_score := coalesce(score_entry->>'score', '')::numeric;
      if selected_score < 0 or selected_score > selected_assessment.max_score then
        raise exception 'A score must be between zero and the assessment maximum of %.', selected_assessment.max_score;
      end if;
      insert into public.assessment_scores (
        id, assessment_id, student_id, score, status, created_at, updated_at
      ) values (
        gen_random_uuid()::text, p_assessment_id, selected_student_id,
        selected_score, p_status, now(), now()
      )
      on conflict (assessment_id, student_id) do update
      set score = excluded.score, status = excluded.status, updated_at = now();
    end if;
  end loop;

  if p_update_assessment_status then
    with enrolled_students as (
      select id as student_id
      from public.students
      where current_class_id = selected_assessment.class_id
        and academic_year_id = selected_assessment.academic_year_id
        and enrollment_status = 'active'
      union
      select student_id
      from public.enrollment_history
      where class_id = selected_assessment.class_id
        and academic_year_id = selected_assessment.academic_year_id
        and term_id = selected_assessment.term_id
        and status = 'transferred'
    )
    select count(*) into enrolled_count from enrolled_students;
    select count(*) into submitted_count
    from public.assessment_scores
    where assessment_id = p_assessment_id and status = 'submitted';
    update public.assessments
    set status = case
      when enrolled_count > 0 and submitted_count >= enrolled_count then 'graded'
      else 'open'
    end,
    updated_at = now()
    where id = p_assessment_id;
  end if;
end;
$$;

create or replace function public.save_student_assessment_scores(
  p_student_id text,
  p_scores jsonb,
  p_status text default 'submitted'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  score_entry jsonb;
  selected_assessment_id text;
begin
  if jsonb_typeof(p_scores) <> 'array' or p_status not in ('draft', 'submitted') then
    raise exception 'The score submission is invalid.';
  end if;
  if (
    select count(*) from jsonb_array_elements(p_scores)
  ) <> (
    select count(distinct coalesce(entry->>'assessmentId', entry->>'assessment_id'))
    from jsonb_array_elements(p_scores) as entries(entry)
  ) then
    raise exception 'An assessment may appear only once in a score submission.';
  end if;
  for score_entry in select value from jsonb_array_elements(p_scores)
  loop
    selected_assessment_id := coalesce(score_entry->>'assessmentId', score_entry->>'assessment_id');
    if selected_assessment_id is null then
      raise exception 'Each score must reference an assessment.';
    end if;
    perform public.save_assessment_scores(
      selected_assessment_id,
      jsonb_build_array(jsonb_build_object(
        'studentId', p_student_id,
        'score', score_entry->'score'
      )),
      true,
      p_status
    );
  end loop;
end;
$$;

create or replace function public.save_report_cards(p_report_cards jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  card_entry jsonb;
  existing_card public.report_cards%rowtype;
  selected_status text;
  selected_student_id text;
  selected_class_id text;
  selected_term_id text;
  selected_year_id text;
  subject_entry jsonb;
  selected_subject_id text;
  expected_subject_count integer;
  expected_component_count integer;
  component_count integer;
  total_weight numeric;
  calculated_subject_score numeric;
  calculated_total_score numeric;
  submitted_total_score numeric;
  submitted_average_score numeric;
  selected_grading_scale public.grading_scales%rowtype;
  snapshot_grades jsonb;
  expected_grade text;
  expected_remark text;
begin
  if public.current_school_role() not in ('owner', 'headmaster', 'assistant_headmaster')
    or jsonb_typeof(p_report_cards) <> 'array' then
    raise exception 'You are not authorized to save these report cards.';
  end if;
  for card_entry in select value from jsonb_array_elements(p_report_cards)
  loop
    selected_student_id := coalesce(card_entry->>'student_id', card_entry->>'studentId');
    selected_class_id := coalesce(card_entry->>'class_id', card_entry->>'classId');
    selected_term_id := coalesce(card_entry->>'term_id', card_entry->>'termId');
    selected_year_id := coalesce(card_entry->>'academic_year_id', card_entry->>'academicYearId');
    selected_status := coalesce(card_entry->>'status', 'draft');
    if selected_status not in ('draft', 'ready_for_review', 'published') then
      raise exception 'The report-card status is invalid.';
    end if;
    if selected_status = 'published' and public.current_school_role() not in ('owner', 'headmaster') then
      raise exception 'Only the owner or headmaster can publish report cards.';
    end if;
    if not exists (
      select 1 from public.classes c
      join public.terms t on t.id = selected_term_id and t.academic_year_id = selected_year_id
      where c.id = selected_class_id and c.academic_year_id = selected_year_id
    ) then
      raise exception 'The report card class, academic year, and term do not match.';
    end if;
    if not (
      exists (
        select 1 from public.students
        where id = selected_student_id
          and current_class_id = selected_class_id
          and academic_year_id = selected_year_id
      )
      or exists (
        select 1 from public.enrollment_history
        where student_id = selected_student_id
          and class_id = selected_class_id
          and academic_year_id = selected_year_id
          and term_id = selected_term_id
      )
    ) then
      raise exception 'The student was not enrolled in this class and academic period.';
    end if;
    if selected_status = 'published' and coalesce(jsonb_typeof(card_entry->'subjects'), '') <> 'array' then
      raise exception 'Published report-card subjects must be provided as a list.';
    end if;
    if selected_status = 'published' and jsonb_array_length(card_entry->'subjects') = 0 then
      raise exception 'Only complete report cards with a calculation snapshot can be published.';
    end if;
    if selected_status = 'published' and coalesce(
      jsonb_typeof(card_entry->'calculation_snapshot'),
      jsonb_typeof(card_entry->'calculationSnapshot'),
      ''
    ) <> 'object' then
      raise exception 'Only complete report cards with a calculation snapshot can be published.';
    end if;
    select * into selected_grading_scale
    from public.grading_scales
    where id = coalesce(
      card_entry->'calculation_snapshot'->>'grading_scale_id',
      card_entry->'calculationSnapshot'->>'gradingScaleId'
    );
    if not found then
      raise exception 'The report card grading scale is missing or unavailable.';
    end if;
    snapshot_grades := coalesce(
      card_entry->'calculation_snapshot'->'grading_scale'->'grades',
      card_entry->'calculationSnapshot'->'gradingScale'->'grades'
    );
    if snapshot_grades is distinct from selected_grading_scale.grades then
      raise exception 'The grading scale changed. Reload the results before saving report cards.';
    end if;
    if coalesce(jsonb_typeof(card_entry->'subjects'), '') <> 'array' then
      raise exception 'Report-card subjects must be provided as a list.';
    end if;
    select case
      when cardinality(c.subject_ids) > 0 then cardinality(c.subject_ids)
      else (select count(distinct a.subject_id) from public.assessments a
        where a.class_id = selected_class_id and a.term_id = selected_term_id
          and a.academic_year_id = selected_year_id)
    end
    into expected_subject_count
    from public.classes c where c.id = selected_class_id;
    if expected_subject_count <= 0 then
      raise exception 'Assign at least one subject before saving report cards.';
    end if;
    if jsonb_array_length(card_entry->'subjects') <> expected_subject_count then
      raise exception 'Report cards must include every subject assigned to the class.';
    end if;
    if jsonb_array_length(card_entry->'subjects') <> (
      select count(distinct coalesce(entry->>'subject_id', entry->>'subjectId'))
      from jsonb_array_elements(card_entry->'subjects') as entries(entry)
    ) then
      raise exception 'Each subject may appear only once on a report card.';
    end if;

    calculated_total_score := 0;
    for subject_entry in select value from jsonb_array_elements(card_entry->'subjects')
    loop
      selected_subject_id := coalesce(subject_entry->>'subject_id', subject_entry->>'subjectId');
      if coalesce(jsonb_typeof(subject_entry->'components'), '') <> 'array' then
        raise exception 'Every subject must include its assessment components.';
      end if;
      if not exists (
        select 1 from public.classes c
        where c.id = selected_class_id
          and (cardinality(c.subject_ids) = 0 or selected_subject_id = any(c.subject_ids))
      ) then
        raise exception 'The report card contains a subject that is not assigned to its class.';
      end if;
      select count(*) into expected_component_count
      from public.assessments a
      where a.class_id = selected_class_id and a.term_id = selected_term_id
        and a.academic_year_id = selected_year_id and a.subject_id = selected_subject_id;
      select count(*),
        coalesce(sum(round((s.score / a.max_score) * a.weight, 2)), 0),
        coalesce(sum(a.weight), 0)
      into component_count, calculated_subject_score, total_weight
      from jsonb_array_elements(subject_entry->'components') supplied(component)
      join public.assessments a
        on a.id = coalesce(supplied.component->>'assessment_id', supplied.component->>'assessmentId')
        and a.class_id = selected_class_id and a.term_id = selected_term_id
        and a.academic_year_id = selected_year_id and a.subject_id = selected_subject_id
      join public.assessment_scores s
        on s.assessment_id = a.id and s.student_id = selected_student_id and s.status = 'submitted'
      where (supplied.component->>'score')::numeric = s.score
        and (supplied.component->>'max_score')::numeric = a.max_score
        and (supplied.component->>'weight')::numeric = a.weight
        and (supplied.component->>'weighted_score')::numeric = round((s.score / a.max_score) * a.weight, 2);
      if expected_component_count = 0 or component_count <> expected_component_count
        or jsonb_array_length(subject_entry->'components') <> expected_component_count
        or abs(total_weight - 100) >= 0.01 then
        raise exception 'A subject must have submitted scores for all assessments and weights totaling 100 percent.';
      end if;
      if abs(calculated_subject_score - (subject_entry->>'total_score')::numeric) >= 0.01 then
        raise exception 'A report-card subject total does not match the saved assessment scores.';
      end if;
      select grade_entry->>'grade', grade_entry->>'remark'
      into expected_grade, expected_remark
      from jsonb_array_elements(snapshot_grades) as grades(grade_entry)
      where (subject_entry->>'total_score')::numeric >=
          coalesce(grade_entry->>'min_score', grade_entry->>'minScore')::numeric
        and (subject_entry->>'total_score')::numeric <=
          coalesce(grade_entry->>'max_score', grade_entry->>'maxScore')::numeric
      limit 1;
      if (subject_entry->>'grade') is distinct from expected_grade
        or (subject_entry->>'remark') is distinct from expected_remark then
        raise exception 'A report-card subject grade does not match the configured grading boundaries.';
      end if;
      calculated_total_score := calculated_total_score + calculated_subject_score;
    end loop;
    submitted_total_score := coalesce((card_entry->>'total_score')::numeric, (card_entry->>'totalScore')::numeric, 0);
    submitted_average_score := coalesce((card_entry->>'average_score')::numeric, (card_entry->>'averageScore')::numeric, 0);
    if abs(calculated_total_score - submitted_total_score) >= 0.01
      or abs((calculated_total_score / expected_subject_count) - submitted_average_score) >= 0.01 then
      raise exception 'The report-card aggregate or average does not match its subject results.';
    end if;
    select grade_entry->>'grade', grade_entry->>'remark'
    into expected_grade, expected_remark
    from jsonb_array_elements(snapshot_grades) as grades(grade_entry)
    where submitted_average_score >=
        coalesce(grade_entry->>'min_score', grade_entry->>'minScore')::numeric
      and submitted_average_score <=
        coalesce(grade_entry->>'max_score', grade_entry->>'maxScore')::numeric
    limit 1;
    if (coalesce(card_entry->>'overall_grade', card_entry->>'overallGrade')) is distinct from expected_grade
      or (coalesce(card_entry->>'overall_remark', card_entry->>'overallRemark')) is distinct from expected_remark then
      raise exception 'The report-card overall grade does not match the configured grading boundaries.';
    end if;
    select * into existing_card
    from public.report_cards
    where student_id = selected_student_id and term_id = selected_term_id
    for update;
    if found and existing_card.status = 'published'
      and public.current_school_role() not in ('owner', 'headmaster') then
      raise exception 'An owner or headmaster must reopen a published report card before it can be changed.';
    end if;
    insert into public.report_cards (
      id, student_id, class_id, term_id, academic_year_id, subjects, total_score,
      average_score, position, attendance_present, attendance_total, conduct,
      teacher_comment, headteacher_comment, promotion_decision, overall_grade, overall_remark, calculation_snapshot,
      status, created_at, updated_at
    ) values (
      coalesce(card_entry->>'id', gen_random_uuid()::text),
      selected_student_id, selected_class_id, selected_term_id, selected_year_id,
      coalesce(card_entry->'subjects', '[]'::jsonb),
      coalesce((card_entry->>'total_score')::numeric, (card_entry->>'totalScore')::numeric, 0),
      coalesce((card_entry->>'average_score')::numeric, (card_entry->>'averageScore')::numeric, 0),
      coalesce((card_entry->>'position')::integer, null),
      coalesce((card_entry->>'attendance_present')::integer, (card_entry->>'attendancePresent')::integer, 0),
      coalesce((card_entry->>'attendance_total')::integer, (card_entry->>'attendanceTotal')::integer, 0),
      coalesce(card_entry->>'conduct', null),
      coalesce(card_entry->>'teacher_comment', card_entry->>'teacherComment'),
      coalesce(card_entry->>'headteacher_comment', card_entry->>'headteacherComment'),
      coalesce(card_entry->>'promotion_decision', card_entry->>'promotionDecision'),
      coalesce(card_entry->>'overall_grade', card_entry->>'overallGrade'),
      coalesce(card_entry->>'overall_remark', card_entry->>'overallRemark'),
      coalesce(card_entry->'calculation_snapshot', card_entry->'calculationSnapshot', '{}'::jsonb),
      selected_status, now(), now()
    )
    on conflict (student_id, term_id) do update
    set class_id = excluded.class_id,
        academic_year_id = excluded.academic_year_id,
        subjects = excluded.subjects,
        total_score = excluded.total_score,
        average_score = excluded.average_score,
        position = excluded.position,
        attendance_present = excluded.attendance_present,
        attendance_total = excluded.attendance_total,
        conduct = excluded.conduct,
        teacher_comment = excluded.teacher_comment,
        headteacher_comment = excluded.headteacher_comment,
        promotion_decision = excluded.promotion_decision,
        overall_grade = excluded.overall_grade,
        overall_remark = excluded.overall_remark,
        calculation_snapshot = excluded.calculation_snapshot,
        status = excluded.status,
        updated_at = now();
  end loop;
end;
$$;

revoke all on function public.save_assessment_scores(text, jsonb, boolean, text) from public, anon;
revoke all on function public.save_student_assessment_scores(text, jsonb, text) from public, anon;
revoke all on function public.save_report_cards(jsonb) from public, anon;
grant execute on function public.save_assessment_scores(text, jsonb, boolean, text) to authenticated;
grant execute on function public.save_student_assessment_scores(text, jsonb, text) to authenticated;
grant execute on function public.save_report_cards(jsonb) to authenticated;

create table if not exists public.fee_categories (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  description text,
  is_required boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Monetary amounts are integer pesewas, matching the application data model.
create table if not exists public.fee_structures (
  id text primary key default gen_random_uuid()::text,
  academic_year_id text not null references public.academic_years(id) on delete restrict,
  term_id text not null references public.terms(id) on delete restrict,
  class_id text not null references public.classes(id) on delete restrict,
  fee_category_id text not null references public.fee_categories(id) on delete restrict,
  amount bigint not null check (amount >= 0),
  due_date date not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, term_id, class_id, fee_category_id)
);

create table if not exists public.class_fee_targets (
  id text primary key default gen_random_uuid()::text,
  academic_year_id text not null references public.academic_years(id) on delete restrict,
  term_id text not null references public.terms(id) on delete restrict,
  class_id text not null references public.classes(id) on delete restrict,
  amount bigint not null check (amount > 0),
  due_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, academic_year_id, term_id)
);

create or replace function public.validate_class_fee_target_period()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.amount is null or new.amount <= 0 then
    raise exception 'The class fee must be greater than zero.';
  end if;
  if not exists (
    select 1
    from public.classes c
    join public.terms t on t.id = new.term_id and t.academic_year_id = new.academic_year_id
    where c.id = new.class_id and c.academic_year_id = new.academic_year_id
  ) then
    raise exception 'The selected class, academic year, and term do not match.';
  end if;
  return new;
end;
$$;

drop trigger if exists class_fee_targets_validate_period on public.class_fee_targets;
create trigger class_fee_targets_validate_period
  before insert or update of class_id, academic_year_id, term_id, amount on public.class_fee_targets
  for each row execute function public.validate_class_fee_target_period();

create table if not exists public.invoices (
  id text primary key default gen_random_uuid()::text,
  invoice_number text not null unique,
  student_id text not null references public.students(id) on delete restrict,
  class_id text not null references public.classes(id) on delete restrict,
  academic_year_id text not null references public.academic_years(id) on delete restrict,
  term_id text not null references public.terms(id) on delete restrict,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  subtotal bigint not null check (subtotal >= 0),
  discount bigint not null default 0 check (discount >= 0),
  total_amount bigint not null check (total_amount >= 0),
  amount_paid bigint not null default 0 check (amount_paid >= 0),
  outstanding_balance bigint not null check (outstanding_balance >= 0),
  due_date date not null,
  status text not null default 'draft' check (status in ('draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id text primary key default gen_random_uuid()::text,
  receipt_number text not null unique,
  payment_reference text not null,
  student_id text not null references public.students(id) on delete restrict,
  invoice_id text references public.invoices(id) on delete set null,
  fee_target_id text references public.class_fee_targets(id) on delete restrict,
  amount bigint not null check (amount > 0),
  payment_date date not null,
  payment_method text not null check (payment_method in ('cash', 'bank_transfer', 'mobile_money', 'cheque', 'other')),
  transaction_reference text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  notes text,
  status text not null default 'completed' check (status in ('completed', 'reversed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_adjustments (
  id text primary key default gen_random_uuid()::text,
  student_id text not null references public.students(id) on delete restrict,
  invoice_id text references public.invoices(id) on delete set null,
  type text not null check (type in ('discount', 'waiver', 'scholarship', 'correction')),
  amount bigint not null check (amount >= 0),
  reason text not null,
  approved_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id text primary key default gen_random_uuid()::text,
  inventory_code text not null unique,
  name text not null,
  category text not null,
  description text,
  assigned_class_id text references public.classes(id) on delete set null,
  location text,
  quantity integer not null default 0 check (quantity >= 0),
  unit text not null,
  condition text not null check (condition in ('new', 'good', 'fair', 'poor', 'damaged')),
  acquisition_date date,
  acquisition_cost bigint check (acquisition_cost is null or acquisition_cost >= 0),
  supplier text,
  custodian_id text references public.staff(id) on delete set null,
  notes text,
  last_inspection_date date,
  status text not null default 'available' check (status in ('available', 'in_use', 'maintenance', 'disposed', 'missing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id text primary key default gen_random_uuid()::text,
  item_id text not null references public.inventory_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('received', 'issued', 'returned', 'damaged', 'missing', 'repaired', 'disposed', 'transferred')),
  quantity integer not null check (quantity > 0),
  from_location text,
  to_location text,
  from_class_id text references public.classes(id) on delete set null,
  to_class_id text references public.classes(id) on delete set null,
  performed_by uuid not null references public.profiles(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.profiles(id) on delete restrict,
  user_name text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details text,
  timestamp timestamptz not null default now()
);

create index if not exists terms_academic_year_idx on public.terms (academic_year_id);
create index if not exists classes_academic_year_idx on public.classes (academic_year_id);
create index if not exists students_class_idx on public.students (current_class_id);
create index if not exists students_year_status_idx on public.students (academic_year_id, enrollment_status);
create index if not exists guardians_student_idx on public.guardians (student_id);
create index if not exists enrollment_history_student_idx on public.enrollment_history (student_id, academic_year_id);
create index if not exists staff_category_status_idx on public.staff (staff_category, employment_status);
create index if not exists qualifications_staff_idx on public.qualifications (staff_id);
create index if not exists staff_assignments_staff_year_idx on public.staff_assignments (staff_id, academic_year_id);
create index if not exists attendance_records_class_date_idx on public.attendance_records (class_id, date);
create index if not exists attendance_records_date_status_idx on public.attendance_records (date, status);
create index if not exists assessments_class_term_idx on public.assessments (class_id, term_id);
create index if not exists assessment_scores_student_idx on public.assessment_scores (student_id);
create index if not exists report_cards_term_class_idx on public.report_cards (term_id, class_id);
create index if not exists invoices_student_status_idx on public.invoices (student_id, status);
create index if not exists payments_student_date_idx on public.payments (student_id, payment_date);
create index if not exists inventory_items_status_idx on public.inventory_items (status);
create index if not exists inventory_movements_item_date_idx on public.inventory_movements (item_id, created_at desc);
create index if not exists activity_logs_timestamp_idx on public.activity_logs (timestamp desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'school_settings', 'academic_years', 'terms', 'subjects', 'classes',
    'staff', 'staff_private_details', 'students', 'guardians', 'attendance_sessions',
    'attendance_records', 'assessment_types', 'assessments', 'assessment_scores',
    'grading_scales', 'report_cards', 'fee_categories', 'fee_structures', 'class_fee_targets', 'invoices',
    'payments', 'financial_adjustments', 'inventory_items'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', table_name);
  end loop;
end;
$$;

alter table public.profiles enable row level security;
drop policy if exists profiles_read_self_or_owner on public.profiles;
create policy profiles_read_self_or_owner on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_school_role() = 'owner');
drop policy if exists profiles_manage_owner on public.profiles;
drop policy if exists profiles_manage_admin_owner on public.profiles;
drop policy if exists profiles_manage_admin on public.profiles;
create policy profiles_manage_owner on public.profiles
  for all to authenticated
  using (public.current_school_role() = 'owner')
  with check (public.current_school_role() = 'owner');

alter table public.staff_private_details enable row level security;
drop policy if exists staff_private_details_owner_only on public.staff_private_details;
create policy staff_private_details_owner_only on public.staff_private_details
  for all to authenticated
  using (public.current_school_role() = 'owner')
  with check (public.current_school_role() = 'owner');

alter table public.school_settings enable row level security;
drop policy if exists school_settings_headmaster_read on public.school_settings;
create policy school_settings_headmaster_read on public.school_settings
  for select to authenticated
  using (public.current_school_role() in ('owner', 'headmaster', 'assistant_headmaster'));
drop policy if exists school_settings_owner_write on public.school_settings;
create policy school_settings_owner_write on public.school_settings
  for all to authenticated
  using (public.current_school_role() = 'owner')
  with check (public.current_school_role() = 'owner');

alter table public.activity_logs enable row level security;
drop policy if exists activity_logs_read_school_users on public.activity_logs;
create policy activity_logs_read_school_users on public.activity_logs
  for select to authenticated
  using (public.current_school_role() in ('owner', 'headmaster', 'assistant_headmaster'));
drop policy if exists activity_logs_insert_school_users on public.activity_logs;
create policy activity_logs_insert_school_users on public.activity_logs
  for insert to authenticated
  with check (public.current_school_role() in ('owner', 'headmaster', 'assistant_headmaster'));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'academic_years', 'terms', 'subjects', 'classes', 'staff',
    'students', 'guardians', 'enrollment_history', 'qualifications', 'staff_assignments',
    'attendance_sessions', 'attendance_records', 'sync_queue', 'assessment_types',
    'assessments', 'assessment_scores', 'grading_scales', 'report_cards', 'inventory_items',
    'inventory_movements'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists school_users_manage on public.%I', table_name);
    execute format(
    'create policy school_users_manage on public.%I for all to authenticated using (public.current_school_role() in (''owner'', ''headmaster'', ''assistant_headmaster'')) with check (public.current_school_role() in (''owner'', ''headmaster'', ''assistant_headmaster''))',
      table_name
    );
  end loop;

  foreach table_name in array array[
    'fee_categories', 'fee_structures', 'class_fee_targets', 'invoices', 'payments', 'financial_adjustments'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists school_users_manage on public.%I', table_name);
    execute format(
      'create policy school_users_manage on public.%I for all to authenticated using (public.current_school_role() in (''owner'', ''headmaster'')) with check (public.current_school_role() in (''owner'', ''headmaster''))',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists school_users_manage on public.report_cards;
drop policy if exists report_cards_read_school_users on public.report_cards;
drop policy if exists report_cards_insert_drafts on public.report_cards;
drop policy if exists report_cards_update_unpublished_or_admin on public.report_cards;
create policy report_cards_read_school_users on public.report_cards
  for select to authenticated
  using (public.current_school_role() in ('owner', 'headmaster', 'assistant_headmaster'));
create policy report_cards_insert_drafts on public.report_cards
  for insert to authenticated
  with check (
    public.current_school_role() in ('owner', 'headmaster', 'assistant_headmaster')
    and (status <> 'published' or public.current_school_role() in ('owner', 'headmaster'))
  );
create policy report_cards_update_unpublished_or_admin on public.report_cards
  for update to authenticated
  using (
    public.current_school_role() in ('owner', 'headmaster', 'assistant_headmaster')
    and (status <> 'published' or public.current_school_role() in ('owner', 'headmaster'))
  )
  with check (
    public.current_school_role() in ('owner', 'headmaster', 'assistant_headmaster')
    and (status <> 'published' or public.current_school_role() in ('owner', 'headmaster'))
  );

create or replace function public.promote_students(
  p_student_ids text[],
  p_source_class_id text,
  p_destination_class_id text,
  p_term_id text,
  p_enrollment_date date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  selected_student record;
  destination_class public.classes%rowtype;
  promotion_term public.terms%rowtype;
  source_year public.academic_years%rowtype;
  selected_count integer;
  destination_enrollment_count integer;
begin
  if public.current_school_role() not in ('owner', 'headmaster') then
    raise exception 'Only the owner or headmaster can promote students.';
  end if;
  if coalesce(cardinality(p_student_ids), 0) = 0 then
    raise exception 'Select at least one student to promote.';
  end if;
  select * into promotion_term
  from public.terms
  where id = p_term_id;
  if not found then
    raise exception 'The selected term is unavailable.';
  end if;
  select * into source_year
  from public.academic_years
  where id = promotion_term.academic_year_id;
  if source_year.status <> 'archived' or promotion_term.status <> 'archived' then
    raise exception 'Only a completed academic year and term can be promoted.';
  end if;
  if exists (
    select 1 from public.terms
    where academic_year_id = promotion_term.academic_year_id
      and end_date > promotion_term.end_date
  ) then
    raise exception 'Select the final term of the completed academic year.';
  end if;
  if not exists (
    select 1
    from public.classes
    where id = p_source_class_id
      and academic_year_id = promotion_term.academic_year_id
  ) then
    raise exception 'The selected term does not belong to the source class.';
  end if;
  select count(*) into selected_count
  from public.students
  where id = any(p_student_ids)
    and current_class_id = p_source_class_id
    and academic_year_id = promotion_term.academic_year_id
    and enrollment_status = 'active';
  if selected_count <> cardinality(p_student_ids) then
    raise exception 'Every selected student must be active and available in this class.';
  end if;
  if exists (
    select 1
    from unnest(p_student_ids) as selected(id)
    where not exists (
      select 1 from public.report_cards rc
      where rc.student_id = selected.id
        and rc.term_id = p_term_id
        and rc.academic_year_id = promotion_term.academic_year_id
        and rc.status = 'published'
    )
  ) then
    raise exception 'Publish final-term report cards before promoting students.';
  end if;

  select c.* into destination_class
  from public.classes c
  join public.academic_years destination_year on destination_year.id = c.academic_year_id
  where c.id = p_destination_class_id
    and c.status = 'active'
    and c.academic_year_id <> source_year.id
    and destination_year.start_date > source_year.end_date;
  if not found then
    raise exception 'The destination class must be active and belong to a future academic year.';
  end if;
  if exists (
    select 1
    from public.enrollment_history
    where student_id = any(p_student_ids)
      and academic_year_id = destination_class.academic_year_id
      and status = 'active'
  ) then
    raise exception 'A selected student already has an enrollment in the destination academic year.';
  end if;
  select count(*) into destination_enrollment_count
  from public.students
  where current_class_id = destination_class.id
    and academic_year_id = destination_class.academic_year_id
    and enrollment_status = 'active';
  if destination_enrollment_count + selected_count > destination_class.capacity then
    raise exception 'The destination class does not have enough capacity for all selected students.';
  end if;

  for selected_student in
    select id, current_class_id, academic_year_id
    from public.students
    where id = any(p_student_ids)
      and current_class_id = p_source_class_id
      and enrollment_status = 'active'
    for update
  loop
    if selected_student.current_class_id = destination_class.id then
      raise exception 'A selected student is already in the destination class.';
    end if;
    if selected_student.academic_year_id <> promotion_term.academic_year_id then
      raise exception 'The selected term does not belong to every selected student''s academic year.';
    end if;

    update public.enrollment_history
    set term_id = p_term_id,
        exit_date = p_enrollment_date,
        status = 'transferred',
        notes = 'Promoted to ' || destination_class.name || coalesce(' ' || destination_class.stream, ''),
        recorded_by = auth.uid()
    where student_id = selected_student.id
      and class_id = selected_student.current_class_id
      and academic_year_id = selected_student.academic_year_id
      and status = 'active';
    if not found then
      insert into public.enrollment_history (
        student_id, class_id, academic_year_id, term_id, enrollment_date, exit_date, status, notes, recorded_by
      ) values (
        selected_student.id,
        selected_student.current_class_id,
        selected_student.academic_year_id,
        p_term_id,
        p_enrollment_date,
        p_enrollment_date,
        'transferred',
        'Promoted to ' || destination_class.name || coalesce(' ' || destination_class.stream, ''),
        auth.uid()
      );
    end if;

    update public.students
    set current_class_id = destination_class.id,
        academic_year_id = destination_class.academic_year_id,
        updated_at = now()
    where id = selected_student.id;

    insert into public.enrollment_history (
      student_id, class_id, academic_year_id, term_id, enrollment_date, status, notes, recorded_by
    ) values (
      selected_student.id,
      destination_class.id,
      destination_class.academic_year_id,
      null,
      p_enrollment_date,
      'active',
      'Promoted from previous class',
      auth.uid()
    );
  end loop;
end;
$$;

grant execute on function public.promote_students(text[], text, text, text, date) to authenticated;

create or replace function public.record_student_payment(
  p_receipt_number text,
  p_payment_reference text,
  p_student_id text,
  p_invoice_id text,
  p_amount bigint,
  p_payment_date date,
  p_payment_method text,
  p_transaction_reference text,
  p_recorded_by uuid,
  p_notes text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  selected_invoice public.invoices%rowtype;
  new_payment_id text := gen_random_uuid()::text;
begin
  if public.current_school_role() not in ('owner', 'headmaster') then
    raise exception 'Only the owner or headmaster can record payments.';
  end if;
  if auth.uid() is distinct from p_recorded_by then
    raise exception 'The recorded-by user does not match the signed-in account.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  if p_invoice_id is not null then
    select * into selected_invoice
    from public.invoices
    where id = p_invoice_id
      and student_id = p_student_id
      and status not in ('paid', 'cancelled')
    for update;
    if not found then
      raise exception 'The selected invoice is not open for this student.';
    end if;
    if p_amount > selected_invoice.outstanding_balance then
      raise exception 'Payment amount exceeds the invoice balance.';
    end if;
  end if;

  insert into public.payments (
    id, receipt_number, payment_reference, student_id, invoice_id, amount,
    payment_date, payment_method, transaction_reference, recorded_by, notes, status
  ) values (
    new_payment_id, p_receipt_number, p_payment_reference, p_student_id, p_invoice_id, p_amount,
    p_payment_date, p_payment_method, p_transaction_reference, p_recorded_by, p_notes, 'completed'
  );

  if p_invoice_id is not null then
    update public.invoices
    set amount_paid = amount_paid + p_amount,
        outstanding_balance = outstanding_balance - p_amount,
        status = case
          when outstanding_balance - p_amount = 0 then 'paid'
          else 'partial'
        end,
        updated_at = now()
    where id = p_invoice_id;
  end if;

  return new_payment_id;
end;
$$;

grant execute on function public.record_student_payment(text, text, text, text, bigint, date, text, text, uuid, text) to authenticated;

create or replace function public.save_class_fee_target(
  p_class_id text,
  p_academic_year_id text,
  p_term_id text,
  p_amount bigint
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_id text;
begin
  if public.current_school_role() not in ('owner', 'headmaster') then
    raise exception 'Only the owner or headmaster can configure class fees.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'The class fee must be greater than zero.';
  end if;
  if not exists (
    select 1
    from public.classes c
    join public.terms t on t.id = p_term_id and t.academic_year_id = p_academic_year_id
    where c.id = p_class_id and c.academic_year_id = p_academic_year_id
  ) then
    raise exception 'The selected class, academic year, and term do not match.';
  end if;

  insert into public.class_fee_targets (class_id, academic_year_id, term_id, amount, status)
  values (p_class_id, p_academic_year_id, p_term_id, p_amount, 'active')
  on conflict (class_id, academic_year_id, term_id) do update
  set amount = excluded.amount,
      status = 'active',
      updated_at = now()
  returning id into target_id;

  return target_id;
end;
$$;

revoke all on function public.save_class_fee_target(text, text, text, bigint) from public, anon;
grant execute on function public.save_class_fee_target(text, text, text, bigint) to authenticated;

create or replace function public.record_class_fee_payment(
  p_receipt_number text,
  p_payment_reference text,
  p_student_id text,
  p_fee_target_id text,
  p_amount bigint,
  p_payment_date date,
  p_payment_method text,
  p_transaction_reference text,
  p_recorded_by uuid,
  p_notes text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  selected_target public.class_fee_targets%rowtype;
  existing_payment public.payments%rowtype;
  amount_paid bigint;
  new_payment_id text := gen_random_uuid()::text;
begin
  if public.current_school_role() not in ('owner', 'headmaster') then
    raise exception 'Only the owner or headmaster can record payments.';
  end if;
  if auth.uid() is distinct from p_recorded_by then
    raise exception 'The recorded-by user does not match the signed-in account.';
  end if;
  if coalesce(btrim(p_receipt_number), '') = '' or coalesce(btrim(p_payment_reference), '') = '' then
    raise exception 'A receipt number and payment reference are required.';
  end if;
  if p_amount is null or p_amount <= 0 or p_payment_date is null then
    raise exception 'Enter a valid payment amount and date.';
  end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'bank_transfer', 'mobile_money', 'cheque', 'other') then
    raise exception 'The selected payment method is not supported.';
  end if;

  select * into selected_target
  from public.class_fee_targets
  where id = p_fee_target_id and status = 'active'
  for update;
  if not found then
    raise exception 'The selected class fee is not active.';
  end if;

  if not exists (
    select 1 from public.students
    where id = p_student_id
      and current_class_id = selected_target.class_id
      and academic_year_id = selected_target.academic_year_id
      and enrollment_status = 'active'
  ) then
    raise exception 'The student is not actively enrolled in this class and academic year.';
  end if;

  select * into existing_payment
  from public.payments
  where receipt_number = btrim(p_receipt_number)
  for update;
  if found then
    if existing_payment.student_id = p_student_id
      and existing_payment.fee_target_id = selected_target.id
      and existing_payment.invoice_id is null
      and existing_payment.amount = p_amount
      and existing_payment.payment_date = p_payment_date
      and existing_payment.payment_method = p_payment_method
      and existing_payment.payment_reference = btrim(p_payment_reference)
      and existing_payment.transaction_reference is not distinct from nullif(btrim(p_transaction_reference), '')
      and existing_payment.recorded_by = p_recorded_by
      and existing_payment.notes is not distinct from nullif(btrim(p_notes), '')
      and existing_payment.status = 'completed' then
      return existing_payment.id;
    end if;
    raise exception 'This receipt number has already been used for a different payment.';
  end if;

  select coalesce(sum(p.amount), 0) into amount_paid
  from public.payments p
  left join public.invoices i on i.id = p.invoice_id
  where p.student_id = p_student_id
    and p.status = 'completed'
    and (
      p.fee_target_id = selected_target.id
      or (
        p.fee_target_id is null
        and i.class_id = selected_target.class_id
        and i.academic_year_id = selected_target.academic_year_id
        and i.term_id = selected_target.term_id
      )
      or (
        p.fee_target_id is null
        and p.invoice_id is null
        and p.payment_date between
          (select start_date from public.terms where id = selected_target.term_id)
          and (select end_date from public.terms where id = selected_target.term_id)
      )
    );

  if p_amount > greatest(0, selected_target.amount - amount_paid) then
    raise exception 'Payment exceeds the student''s remaining class fee balance.';
  end if;

  insert into public.payments (
    id, receipt_number, payment_reference, student_id, invoice_id, fee_target_id, amount,
    payment_date, payment_method, transaction_reference, recorded_by, notes, status
  ) values (
    new_payment_id, btrim(p_receipt_number), btrim(p_payment_reference), p_student_id, null,
    selected_target.id, p_amount, p_payment_date, p_payment_method,
    nullif(btrim(p_transaction_reference), ''), p_recorded_by, nullif(btrim(p_notes), ''), 'completed'
  );

  return new_payment_id;
end;
$$;

revoke all on function public.record_class_fee_payment(text, text, text, text, bigint, date, text, text, uuid, text) from public, anon;
grant execute on function public.record_class_fee_payment(text, text, text, text, bigint, date, text, text, uuid, text) to authenticated;

create or replace function public.set_current_academic_year(p_year_id text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.current_school_role() not in ('owner', 'headmaster') then
    raise exception 'Only the owner or headmaster can change the active academic year.';
  end if;

  update public.academic_years set is_current = false where is_current;
  update public.terms set is_current = false where is_current;
  update public.academic_years
  set is_current = true, status = 'active', updated_at = now()
  where id = p_year_id;
  if not found then
    raise exception 'The selected academic year does not exist.';
  end if;
end;
$$;

create or replace function public.set_current_term(p_term_id text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  selected_term public.terms%rowtype;
begin
  if public.current_school_role() not in ('owner', 'headmaster') then
    raise exception 'Only the owner or headmaster can change the active term.';
  end if;

  select * into selected_term from public.terms where id = p_term_id;
  if not found then
    raise exception 'The selected term does not exist.';
  end if;

  update public.terms set is_current = false where is_current;
  update public.academic_years set is_current = false where is_current;
  update public.academic_years
  set is_current = true, status = 'active', updated_at = now()
  where id = selected_term.academic_year_id;
  update public.terms
  set is_current = true, status = 'active', updated_at = now()
  where id = p_term_id;
end;
$$;

grant execute on function public.set_current_academic_year(text) to authenticated;
grant execute on function public.set_current_term(text) to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.current_school_role() to authenticated;
grant execute on function public.current_school_staff_id() to authenticated;

create or replace function public.reset_school_data()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.activity_logs where true;
  delete from public.sync_queue where true;
  delete from public.report_cards where true;
  delete from public.assessment_scores where true;
  delete from public.assessments where true;
  delete from public.assessment_types where true;
  delete from public.attendance_records where true;
  delete from public.attendance_sessions where true;
  delete from public.payments where true;
  delete from public.financial_adjustments where true;
  delete from public.invoices where true;
  delete from public.class_fee_targets where true;
  delete from public.fee_structures where true;
  delete from public.fee_categories where true;
  delete from public.inventory_movements where true;
  delete from public.inventory_items where true;
  delete from public.enrollment_history where true;
  delete from public.guardians where true;
  delete from public.staff_assignments where true;
  delete from public.qualifications where true;
  delete from public.staff_private_details where true;
  delete from public.students where true;
  delete from public.staff where true;
  delete from public.classes where true;
  delete from public.subjects where true;
  delete from public.terms where true;
  delete from public.academic_years where true;
  delete from public.grading_scales where true;
end;
$$;

revoke all on function public.reset_school_data() from public, anon, authenticated;
grant execute on function public.reset_school_data() to service_role;