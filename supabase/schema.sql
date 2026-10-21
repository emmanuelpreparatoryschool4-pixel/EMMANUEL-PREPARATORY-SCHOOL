-- Emmanuel Preparatory School single-school schema for Supabase.
-- Paste into the Supabase SQL Editor and run once on a new project.
-- Create users in Supabase Auth; new profiles default to headmaster.
-- Promote the owner profile manually after creating both Auth users:
-- update public.profiles set role = 'owner' where email = 'owner@example.com';

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null default 'headmaster' check (role in ('owner', 'headmaster')),
  avatar_url text,
  staff_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_school_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
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
    'headmaster'
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
  capacity integer not null default 1 check (capacity > 0),
  location text,
  status text not null default 'active' check (status in ('active', 'archived')),
  notes text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  teacher_id text not null references public.staff(id) on delete restrict,
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

create table if not exists public.grading_scales (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  grades jsonb not null default '[]'::jsonb check (jsonb_typeof(grades) = 'array'),
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
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, term_id)
);

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
    'grading_scales', 'report_cards', 'fee_categories', 'fee_structures', 'invoices',
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
  using (public.current_school_role() in ('owner', 'headmaster'));
drop policy if exists school_settings_owner_write on public.school_settings;
create policy school_settings_owner_write on public.school_settings
  for all to authenticated
  using (public.current_school_role() = 'owner')
  with check (public.current_school_role() = 'owner');

alter table public.activity_logs enable row level security;
drop policy if exists activity_logs_read_school_users on public.activity_logs;
create policy activity_logs_read_school_users on public.activity_logs
  for select to authenticated
  using (public.current_school_role() in ('owner', 'headmaster'));
drop policy if exists activity_logs_insert_school_users on public.activity_logs;
create policy activity_logs_insert_school_users on public.activity_logs
  for insert to authenticated
  with check (public.current_school_role() in ('owner', 'headmaster'));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'academic_years', 'terms', 'subjects', 'classes', 'staff',
    'students', 'guardians', 'enrollment_history', 'qualifications', 'staff_assignments',
    'attendance_sessions', 'attendance_records', 'sync_queue', 'assessment_types',
    'assessments', 'assessment_scores', 'grading_scales', 'report_cards', 'fee_categories',
    'fee_structures', 'invoices', 'payments', 'financial_adjustments', 'inventory_items',
    'inventory_movements'
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

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.current_school_role() to authenticated;