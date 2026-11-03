-- Apply to an existing project after the base schema; this upgrade is safe to rerun.
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
  selected_count integer;
  destination_enrollment_count integer;
begin
  if public.current_school_role() not in ('admin', 'owner', 'headmaster') then
    raise exception 'Only administrators, owners, or headmasters can promote students.';
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

  select * into destination_class
  from public.classes
  where id = p_destination_class_id and status = 'active';
  if not found then
    raise exception 'The destination class is unavailable.';
  end if;
  select count(*) into destination_enrollment_count
  from public.students
  where current_class_id = destination_class.id
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

    insert into public.enrollment_history (
      student_id, class_id, academic_year_id, term_id, enrollment_date, exit_date, status, notes
    ) values (
      selected_student.id,
      selected_student.current_class_id,
      selected_student.academic_year_id,
      p_term_id,
      p_enrollment_date,
      p_enrollment_date,
      'transferred',
      'Promoted to ' || destination_class.name || coalesce(' ' || destination_class.stream, '')
    );

    update public.students
    set current_class_id = destination_class.id,
        academic_year_id = destination_class.academic_year_id,
        updated_at = now()
    where id = selected_student.id;

    insert into public.enrollment_history (
      student_id, class_id, academic_year_id, term_id, enrollment_date, status, notes
    ) values (
      selected_student.id,
      destination_class.id,
      destination_class.academic_year_id,
      null,
      p_enrollment_date,
      'active',
      'Promoted from previous class'
    );
  end loop;

end;
$$;

grant execute on function public.promote_students(text[], text, text, text, date) to authenticated;

drop policy if exists staff_teacher_read_self on public.staff;
create policy staff_teacher_read_self on public.staff
  for select to authenticated
  using (
    public.current_school_role() = 'teacher'
    and id = public.current_school_staff_id()
  );

drop policy if exists assessments_teacher_create_assigned on public.assessments;
create policy assessments_teacher_create_assigned on public.assessments
  for insert to authenticated
  with check (
    public.current_school_role() = 'teacher'
    and teacher_id = public.current_school_staff_id()
    and exists (
      select 1
      from public.classes c
      where c.id = assessments.class_id
        and c.class_teacher_id = public.current_school_staff_id()
        and c.academic_year_id = assessments.academic_year_id
    )
    and exists (
      select 1
      from public.terms t
      where t.id = assessments.term_id
        and t.academic_year_id = assessments.academic_year_id
    )
    and exists (
      select 1
      from public.staff staff
      join public.subjects subject on subject.id = assessments.subject_id
      where staff.id = public.current_school_staff_id()
        and (
          cardinality(staff.subjects_taught) = 0
          or lower(subject.id) = any(array(select lower(value) from unnest(staff.subjects_taught) as offered(value)))
          or lower(subject.code) = any(array(select lower(value) from unnest(staff.subjects_taught) as offered(value)))
          or lower(subject.name) = any(array(select lower(value) from unnest(staff.subjects_taught) as offered(value)))
        )
    )
  );

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
  if public.current_school_role() not in ('admin', 'owner', 'headmaster') then
    raise exception 'Only administrators, owners, or headmasters can record payments.';
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
