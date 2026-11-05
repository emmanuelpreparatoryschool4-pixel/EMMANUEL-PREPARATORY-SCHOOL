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
alter table public.grading_scales
  add column if not exists calculation_rules jsonb not null default '{"rankingMethod":"competition"}'::jsonb
  check (jsonb_typeof(calculation_rules) = 'object');
alter table public.report_cards
  add column if not exists calculation_snapshot jsonb not null default '{}'::jsonb
  check (jsonb_typeof(calculation_snapshot) = 'object');
alter table public.report_cards add column if not exists overall_grade text;
alter table public.report_cards add column if not exists overall_remark text;

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

insert into public.class_fee_targets (
  academic_year_id, term_id, class_id, amount, due_date, status, created_at, updated_at
)
select
  fs.academic_year_id,
  fs.term_id,
  fs.class_id,
  sum(fs.amount)::bigint,
  max(fs.due_date),
  'active',
  min(fs.created_at),
  max(fs.updated_at)
from public.fee_structures fs
join public.classes c on c.id = fs.class_id and c.academic_year_id = fs.academic_year_id
join public.terms t on t.id = fs.term_id and t.academic_year_id = fs.academic_year_id
where fs.status = 'active' and fs.amount > 0
group by fs.academic_year_id, fs.term_id, fs.class_id
on conflict (class_id, academic_year_id, term_id) do nothing;

alter table public.payments
  add column if not exists fee_target_id text references public.class_fee_targets(id) on delete restrict;
grant select, insert, update, delete on public.class_fee_targets to authenticated;

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
  select * into selected_assessment from public.assessments where id = new.assessment_id;
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
      where id = new.student_id and current_class_id = selected_assessment.class_id
        and academic_year_id = selected_assessment.academic_year_id and enrollment_status = 'active'
    )
    or exists (
      select 1 from public.enrollment_history
      where student_id = new.student_id and class_id = selected_assessment.class_id
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
  if not exists (select 1 from public.assessment_types where id = new.assessment_type_id) then
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
  if public.current_school_role() not in ('owner', 'headmaster', 'assistant_headmaster')
    or p_status not in ('draft', 'submitted')
    or jsonb_typeof(p_scores) <> 'array' then
    raise exception 'You are not authorized to enter these academic results.';
  end if;
  select * into selected_assessment from public.assessments where id = p_assessment_id for update;
  if not found then
    raise exception 'Assessment not found.';
  end if;
  if exists (
    select 1 from public.report_cards
    where class_id = selected_assessment.class_id and term_id = selected_assessment.term_id
      and academic_year_id = selected_assessment.academic_year_id and status = 'published'
  ) then
    raise exception 'Reopen published report cards before changing assessment scores.';
  end if;
  if (select count(*) from jsonb_array_elements(p_scores))
    <> (select count(distinct coalesce(entry->>'studentId', entry->>'student_id'))
        from jsonb_array_elements(p_scores) as entries(entry)) then
    raise exception 'A student may appear only once in a score submission.';
  end if;
  for score_entry in select value from jsonb_array_elements(p_scores)
  loop
    selected_student_id := coalesce(score_entry->>'studentId', score_entry->>'student_id');
    if selected_student_id is null or not (
      exists (
        select 1 from public.students
        where id = selected_student_id and current_class_id = selected_assessment.class_id
          and academic_year_id = selected_assessment.academic_year_id and enrollment_status = 'active'
      )
      or exists (
        select 1 from public.enrollment_history
        where student_id = selected_student_id and class_id = selected_assessment.class_id
          and academic_year_id = selected_assessment.academic_year_id
          and term_id = selected_assessment.term_id and status = 'transferred'
      )
    ) then
      raise exception 'The student was not enrolled in this assessment class and term.';
    end if;
    if score_entry->'score' is null or score_entry->'score' = 'null'::jsonb then
      delete from public.assessment_scores
      where assessment_id = p_assessment_id and student_id = selected_student_id;
    else
      selected_score := coalesce(score_entry->>'score', '')::numeric;
      if selected_score < 0 or selected_score > selected_assessment.max_score then
        raise exception 'A score must be between zero and the configured maximum of %.', selected_assessment.max_score;
      end if;
      insert into public.assessment_scores (id, assessment_id, student_id, score, status, created_at, updated_at)
      values (gen_random_uuid()::text, p_assessment_id, selected_student_id, selected_score, p_status, now(), now())
      on conflict (assessment_id, student_id) do update
      set score = excluded.score, status = excluded.status, updated_at = now();
    end if;
  end loop;
  if p_update_assessment_status then
    with roster as (
      select id as student_id from public.students
      where current_class_id = selected_assessment.class_id
        and academic_year_id = selected_assessment.academic_year_id and enrollment_status = 'active'
      union
      select student_id from public.enrollment_history
      where class_id = selected_assessment.class_id
        and academic_year_id = selected_assessment.academic_year_id
        and term_id = selected_assessment.term_id and status = 'transferred'
    )
    select count(*) into enrolled_count from roster;
    select count(*) into submitted_count from public.assessment_scores
    where assessment_id = p_assessment_id and status = 'submitted';
    update public.assessments
    set status = case when enrolled_count > 0 and submitted_count >= enrolled_count then 'graded' else 'open' end,
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
  if (select count(*) from jsonb_array_elements(p_scores))
    <> (select count(distinct coalesce(entry->>'assessmentId', entry->>'assessment_id'))
        from jsonb_array_elements(p_scores) as entries(entry)) then
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
      jsonb_build_array(jsonb_build_object('studentId', p_student_id, 'score', score_entry->'score')),
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
    raise exception 'You are not authorized to save report cards.';
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
      raise exception 'The report-card class, year, and term do not match.';
    end if;
    if not (
      exists (
        select 1 from public.students
        where id = selected_student_id and current_class_id = selected_class_id
          and academic_year_id = selected_year_id
      )
      or exists (
        select 1 from public.enrollment_history
        where student_id = selected_student_id and class_id = selected_class_id
          and academic_year_id = selected_year_id and term_id = selected_term_id
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
    if expected_subject_count <= 0 or jsonb_array_length(card_entry->'subjects') <> expected_subject_count then
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
        select 1 from public.classes c where c.id = selected_class_id
          and (cardinality(c.subject_ids) = 0 or selected_subject_id = any(c.subject_ids))
      ) then
        raise exception 'The report card contains a subject that is not assigned to its class.';
      end if;
      select count(*) into expected_component_count from public.assessments a
      where a.class_id = selected_class_id and a.term_id = selected_term_id
        and a.academic_year_id = selected_year_id and a.subject_id = selected_subject_id;
      select count(*), coalesce(sum(round((s.score / a.max_score) * a.weight, 2)), 0), coalesce(sum(a.weight), 0)
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
    select * into existing_card from public.report_cards
    where student_id = selected_student_id and term_id = selected_term_id for update;
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
      coalesce(card_entry->>'id', gen_random_uuid()::text), selected_student_id, selected_class_id,
      selected_term_id, selected_year_id, coalesce(card_entry->'subjects', '[]'::jsonb),
      coalesce((card_entry->>'total_score')::numeric, (card_entry->>'totalScore')::numeric, 0),
      coalesce((card_entry->>'average_score')::numeric, (card_entry->>'averageScore')::numeric, 0),
      (card_entry->>'position')::integer,
      coalesce((card_entry->>'attendance_present')::integer, (card_entry->>'attendancePresent')::integer, 0),
      coalesce((card_entry->>'attendance_total')::integer, (card_entry->>'attendanceTotal')::integer, 0),
      card_entry->>'conduct',
      coalesce(card_entry->>'teacher_comment', card_entry->>'teacherComment'),
      coalesce(card_entry->>'headteacher_comment', card_entry->>'headteacherComment'),
      coalesce(card_entry->>'promotion_decision', card_entry->>'promotionDecision'),
      coalesce(card_entry->>'overall_grade', card_entry->>'overallGrade'),
      coalesce(card_entry->>'overall_remark', card_entry->>'overallRemark'),
      coalesce(card_entry->'calculation_snapshot', card_entry->'calculationSnapshot', '{}'::jsonb),
      selected_status, now(), now()
    )
    on conflict (student_id, term_id) do update
    set class_id = excluded.class_id, academic_year_id = excluded.academic_year_id,
        subjects = excluded.subjects, total_score = excluded.total_score,
        average_score = excluded.average_score, position = excluded.position,
        attendance_present = excluded.attendance_present, attendance_total = excluded.attendance_total,
        conduct = excluded.conduct, teacher_comment = excluded.teacher_comment,
        headteacher_comment = excluded.headteacher_comment, promotion_decision = excluded.promotion_decision,
        overall_grade = excluded.overall_grade, overall_remark = excluded.overall_remark,
        calculation_snapshot = excluded.calculation_snapshot, status = excluded.status, updated_at = now();
  end loop;
end;
$$;

revoke all on function public.save_assessment_scores(text, jsonb, boolean, text) from public, anon;
revoke all on function public.save_student_assessment_scores(text, jsonb, text) from public, anon;
revoke all on function public.save_report_cards(jsonb) from public, anon;
grant execute on function public.save_assessment_scores(text, jsonb, boolean, text) to authenticated;
grant execute on function public.save_student_assessment_scores(text, jsonb, text) to authenticated;
grant execute on function public.save_report_cards(jsonb) to authenticated;

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

commit;
