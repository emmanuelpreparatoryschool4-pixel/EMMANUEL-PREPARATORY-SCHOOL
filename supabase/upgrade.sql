-- Apply to an existing project after the base schema; this upgrade is safe to rerun.
begin;

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'pending' where role = 'teacher';
update public.profiles set role = 'owner' where role = 'admin';
alter table public.profiles alter column role set default 'pending';
alter table public.profiles add constraint profiles_role_check
  check (role in ('pending', 'owner', 'headmaster', 'assistant_headmaster'));

alter table public.assessments alter column teacher_id drop not null;
alter table public.classes add column if not exists subject_ids text[] not null default '{}';
alter table public.school_settings add column if not exists profile_image text;
alter table public.enrollment_history
  add column if not exists recorded_by uuid references public.profiles(id) on delete set null;
alter table public.report_cards drop constraint if exists report_cards_status_check;
alter table public.report_cards add constraint report_cards_status_check
  check (status in ('draft', 'ready_for_review', 'published'));

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

alter table public.profiles enable row level security;
drop policy if exists profiles_read_self_or_owner on public.profiles;
create policy profiles_read_self_or_owner on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_school_role() = 'owner');
drop policy if exists profiles_manage_admin on public.profiles;
drop policy if exists profiles_manage_owner on public.profiles;
drop policy if exists profiles_manage_admin_owner on public.profiles;
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
drop policy if exists school_settings_school_users_read on public.school_settings;
create policy school_settings_school_users_read on public.school_settings
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
    'assessments', 'assessment_scores', 'grading_scales', 'report_cards',
    'inventory_items', 'inventory_movements'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists school_users_manage on public.%I', table_name);
    execute format(
      'create policy school_users_manage on public.%I for all to authenticated using (public.current_school_role() in (''owner'', ''headmaster'', ''assistant_headmaster'')) with check (public.current_school_role() in (''owner'', ''headmaster'', ''assistant_headmaster''))',
      table_name
    );
  end loop;

  foreach table_name in array array[
    'fee_categories', 'fee_structures', 'invoices', 'payments', 'financial_adjustments'
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

create or replace function public.validate_assessment_max_score()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.max_score > 100 then
    raise exception 'Assessment maximum score cannot exceed 100.';
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
begin
  select max_score into assessment_max from public.assessments where id = new.assessment_id;
  if new.score < 0 or new.score > 100 or new.score > assessment_max then
    raise exception 'Assessment scores must be between zero and 100 and cannot exceed the assessment maximum.';
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_scores_limit on public.assessment_scores;
create trigger assessment_scores_limit
  before insert or update of score, assessment_id on public.assessment_scores
  for each row execute function public.validate_assessment_score();

drop policy if exists classes_teacher_read_assigned on public.classes;
drop policy if exists staff_teacher_read_self on public.staff;
drop policy if exists students_teacher_read_assigned on public.students;
drop policy if exists assessments_teacher_read_assigned on public.assessments;
drop policy if exists assessments_teacher_create_assigned on public.assessments;
drop policy if exists attendance_records_teacher_assigned on public.attendance_records;
drop policy if exists assessment_scores_teacher_assigned on public.assessment_scores;
drop policy if exists report_cards_teacher_read_assigned on public.report_cards;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'academic_years', 'terms', 'subjects', 'assessment_types', 'grading_scales'
  ] loop
    execute format('drop policy if exists teacher_read_reference on public.%I', table_name);
  end loop;
end;
$$;

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
  if p_amount <= 0 then
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

create or replace function public.reset_school_data()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.activity_logs;
  delete from public.sync_queue;
  delete from public.assessment_scores;
  delete from public.report_cards;
  delete from public.assessments;
  delete from public.assessment_types;
  delete from public.attendance_records;
  delete from public.attendance_sessions;
  delete from public.payments;
  delete from public.financial_adjustments;
  delete from public.invoices;
  delete from public.fee_structures;
  delete from public.fee_categories;
  delete from public.inventory_movements;
  delete from public.inventory_items;
  delete from public.enrollment_history;
  delete from public.guardians;
  delete from public.staff_assignments;
  delete from public.qualifications;
  delete from public.staff_private_details;
  delete from public.students;
  delete from public.staff;
  delete from public.classes;
  delete from public.subjects;
  delete from public.terms;
  delete from public.academic_years;
  delete from public.grading_scales;
end;
$$;

revoke all on function public.reset_school_data() from public, anon, authenticated;
grant execute on function public.reset_school_data() to service_role;

commit;
