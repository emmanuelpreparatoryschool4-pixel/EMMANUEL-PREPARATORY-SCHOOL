-- Apply once to an existing EPS Supabase project before deploying the role updates.
begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles alter column role set default 'pending';
alter table public.profiles add constraint profiles_role_check
  check (role in ('pending', 'admin', 'owner', 'headmaster', 'teacher'));

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

create or replace function public.current_school_staff_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select staff_id from public.profiles where id = auth.uid();
$$;

alter table public.profiles enable row level security;
drop policy if exists profiles_read_self_or_owner on public.profiles;
create policy profiles_read_self_or_owner on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_school_role() in ('admin', 'owner'));
drop policy if exists profiles_manage_owner on public.profiles;
drop policy if exists profiles_manage_admin_owner on public.profiles;
drop policy if exists profiles_manage_admin on public.profiles;
create policy profiles_manage_admin on public.profiles
  for all to authenticated
  using (public.current_school_role() = 'admin')
  with check (public.current_school_role() = 'admin');

alter table public.staff_private_details enable row level security;
drop policy if exists staff_private_details_owner_only on public.staff_private_details;
create policy staff_private_details_owner_only on public.staff_private_details
  for all to authenticated
  using (public.current_school_role() in ('admin', 'owner'))
  with check (public.current_school_role() in ('admin', 'owner'));

alter table public.school_settings enable row level security;
drop policy if exists school_settings_headmaster_read on public.school_settings;
create policy school_settings_headmaster_read on public.school_settings
  for select to authenticated
  using (public.current_school_role() in ('admin', 'owner', 'headmaster'));
drop policy if exists school_settings_owner_write on public.school_settings;
create policy school_settings_owner_write on public.school_settings
  for all to authenticated
  using (public.current_school_role() in ('admin', 'owner'))
  with check (public.current_school_role() in ('admin', 'owner'));

alter table public.activity_logs enable row level security;
drop policy if exists activity_logs_read_school_users on public.activity_logs;
create policy activity_logs_read_school_users on public.activity_logs
  for select to authenticated
  using (public.current_school_role() in ('admin', 'owner', 'headmaster'));
drop policy if exists activity_logs_insert_school_users on public.activity_logs;
create policy activity_logs_insert_school_users on public.activity_logs
  for insert to authenticated
  with check (public.current_school_role() in ('admin', 'owner', 'headmaster'));

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
      'create policy school_users_manage on public.%I for all to authenticated using (public.current_school_role() in (''admin'', ''owner'', ''headmaster'')) with check (public.current_school_role() in (''admin'', ''owner'', ''headmaster''))',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists classes_teacher_read_assigned on public.classes;
create policy classes_teacher_read_assigned on public.classes
  for select to authenticated
  using (
    public.current_school_role() = 'teacher'
    and class_teacher_id = public.current_school_staff_id()
  );

drop policy if exists students_teacher_read_assigned on public.students;
create policy students_teacher_read_assigned on public.students
  for select to authenticated
  using (
    public.current_school_role() = 'teacher'
    and exists (
      select 1 from public.classes c
      where c.id = students.current_class_id
        and c.class_teacher_id = public.current_school_staff_id()
    )
  );

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'academic_years', 'terms', 'subjects', 'assessment_types', 'grading_scales'
  ] loop
    execute format('drop policy if exists teacher_read_reference on public.%I', table_name);
    execute format(
      'create policy teacher_read_reference on public.%I for select to authenticated using (public.current_school_role() = ''teacher'')',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists assessments_teacher_read_assigned on public.assessments;
create policy assessments_teacher_read_assigned on public.assessments
  for select to authenticated
  using (
    public.current_school_role() = 'teacher'
    and exists (
      select 1 from public.classes c
      where c.id = assessments.class_id
        and c.class_teacher_id = public.current_school_staff_id()
    )
  );

drop policy if exists attendance_records_teacher_assigned on public.attendance_records;
create policy attendance_records_teacher_assigned on public.attendance_records
  for all to authenticated
  using (
    public.current_school_role() = 'teacher'
    and exists (
      select 1 from public.classes c
      where c.id = attendance_records.class_id
        and c.class_teacher_id = public.current_school_staff_id()
    )
  )
  with check (
    public.current_school_role() = 'teacher'
    and exists (
      select 1 from public.classes c
      where c.id = attendance_records.class_id
        and c.class_teacher_id = public.current_school_staff_id()
    )
    and exists (
      select 1 from public.students s
      where s.id = attendance_records.student_id
        and s.current_class_id = attendance_records.class_id
    )
  );

drop policy if exists assessment_scores_teacher_assigned on public.assessment_scores;
create policy assessment_scores_teacher_assigned on public.assessment_scores
  for all to authenticated
  using (
    public.current_school_role() = 'teacher'
    and exists (
      select 1
      from public.assessments a
      join public.classes c on c.id = a.class_id
      join public.students s on s.id = assessment_scores.student_id
      where a.id = assessment_scores.assessment_id
        and c.class_teacher_id = public.current_school_staff_id()
        and s.current_class_id = c.id
    )
  )
  with check (
    public.current_school_role() = 'teacher'
    and exists (
      select 1
      from public.assessments a
      join public.classes c on c.id = a.class_id
      join public.students s on s.id = assessment_scores.student_id
      where a.id = assessment_scores.assessment_id
        and c.class_teacher_id = public.current_school_staff_id()
        and s.current_class_id = c.id
    )
  );

drop policy if exists report_cards_teacher_read_assigned on public.report_cards;
create policy report_cards_teacher_read_assigned on public.report_cards
  for select to authenticated
  using (
    public.current_school_role() = 'teacher'
    and exists (
      select 1 from public.classes c
      where c.id = report_cards.class_id
        and c.class_teacher_id = public.current_school_staff_id()
    )
  );

grant execute on function public.current_school_role() to authenticated;
grant execute on function public.current_school_staff_id() to authenticated;
commit;
