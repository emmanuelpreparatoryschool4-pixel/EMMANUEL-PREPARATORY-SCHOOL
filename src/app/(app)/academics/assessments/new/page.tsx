'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { assessmentSchema, type AssessmentFormValues } from '@/lib/validations';
import { dataService } from '@/lib/db';
import { Class, Subject, AcademicYear, Term, Staff, AssessmentType } from '@/types';
import { getErrorMessage } from '@/lib/utils';

export default function NewAssessmentPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, control, formState: { errors }, setValue } = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: { maxScore: 100, weight: 30, date: new Date().toISOString().split('T')[0] },
  });

  const selectedYear = useWatch({ control, name: 'academicYearId' });
  const selectedType = useWatch({ control, name: 'assessmentTypeId' });
  const selectedTeacher = useWatch({ control, name: 'teacherId' });

  useEffect(() => {
    async function load() {
      const [c, s, y, t, at] = await Promise.all([
        dataService.getClasses(),
        dataService.getSubjects(),
        dataService.getAcademicYears(),
        dataService.getTerms(),
        dataService.getAssessmentTypes(),
      ]);
      setClasses(c);
      setSubjects(s);
      setAcademicYears(y);
      setTerms(t);
      setAssessmentTypes(at);
      if (user?.role === 'teacher') {
        if (!user.staffId) throw new Error('Your account is not linked to a staff profile. Contact the school administrator.');
        const ownStaff = (await dataService.getStaff()).find((staffMember) => staffMember.id === user.staffId);
        if (!ownStaff) throw new Error('Your linked staff profile could not be loaded.');
        setTeachers([ownStaff]);
        setValue('teacherId', ownStaff.id);
      }
      const currentYear = y.find((yr) => yr.isCurrent);
      const currentTerm = t.find((tm) => tm.isCurrent && tm.academicYearId === currentYear?.id) ??
        t.find((tm) => tm.academicYearId === currentYear?.id);
      if (currentYear) setValue('academicYearId', currentYear.id);
      if (currentTerm) setValue('termId', currentTerm.id);
    }
    load().catch((error: unknown) => {
      addToast({ type: 'error', title: 'Could not load assessment options', message: getErrorMessage(error, 'Failed to load assessment options.') });
    });
  }, [addToast, setValue, user]);

  useEffect(() => {
    if (selectedYear && user?.role !== 'teacher') {
      dataService.getStaff({ category: 'teacher' }).then(setTeachers).catch((error: unknown) => {
        addToast({ type: 'error', title: 'Could not load teachers', message: getErrorMessage(error, 'Failed to load teachers.') });
      });
    }
  }, [selectedYear, user?.role, addToast]);

  useEffect(() => {
    if (selectedTeacher) setValue('subjectId', '');
  }, [selectedTeacher, setValue]);

  useEffect(() => {
    const type = assessmentTypes.find((t) => t.id === selectedType);
    if (type) {
      setValue('weight', type.name.toLowerCase().includes('exam') ? 70 : 30);
      setValue('maxScore', type.defaultMaxScore);
    }
  }, [selectedType, assessmentTypes, setValue]);

  const filteredTerms = terms.filter((t) => t.academicYearId === selectedYear);
  const filteredClasses = classes.filter((schoolClass) => schoolClass.academicYearId === selectedYear);
  const teacherSubjects = teachers.find((teacher) => teacher.id === selectedTeacher)?.subjectsTaught ?? [];
  const normalizedTeacherSubjects = teacherSubjects.map((subject) => subject.trim().toLowerCase());
  const availableSubjects = normalizedTeacherSubjects.length
    ? subjects.filter((subject) => normalizedTeacherSubjects.includes(subject.id.toLowerCase()) ||
      normalizedTeacherSubjects.includes(subject.code.toLowerCase()) ||
      normalizedTeacherSubjects.includes(subject.name.toLowerCase()))
    : subjects;

  const onSubmit = async (data: AssessmentFormValues) => {
    const schoolClass = classes.find((item) => item.id === data.classId);
    const term = terms.find((item) => item.id === data.termId);
    const type = assessmentTypes.find((item) => item.id === data.assessmentTypeId);
    if (!schoolClass || schoolClass.academicYearId !== data.academicYearId ||
      !term || term.academicYearId !== data.academicYearId) {
      addToast({ type: 'error', title: 'Check the academic year', message: 'The class and term must belong to the selected academic year.' });
      return;
    }
    if (!type) {
      addToast({ type: 'error', title: 'Assessment type required', message: 'Choose a valid assessment type before continuing.' });
      return;
    }
    const teacher = teachers.find((item) => item.id === data.teacherId);
    if (teacher?.subjectsTaught.length) {
      const offeredSubjects = teacher.subjectsTaught.map((subject) => subject.trim().toLowerCase());
      const selectedSubject = subjects.find((subject) => subject.id === data.subjectId);
      if (!selectedSubject || ![
        selectedSubject.id.toLowerCase(),
        selectedSubject.code.toLowerCase(),
        selectedSubject.name.toLowerCase(),
      ].some((subject) => offeredSubjects.includes(subject))) {
        addToast({ type: 'error', title: 'Subject not assigned', message: 'Choose a subject assigned to the selected teacher.' });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await dataService.addAssessment({
        ...data,
        weight: type.name.toLowerCase().includes('exam') ? 70 : 30,
        status: 'draft',
      });
      addToast({ type: 'success', title: 'Assessment created' });
      router.push('/academics');
    } catch (error) {
      addToast({ type: 'error', title: 'Could not create assessment', message: getErrorMessage(error, 'Failed to create assessment.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Create Assessment" breadcrumbs={[{ label: 'Academics', href: '/academics' }, { label: 'New Assessment' }]}
        actions={<Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>Back</Button>} />
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader><CardTitle>Assessment Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input label="Assessment Name" required error={errors.name?.message} {...register('name')} placeholder="e.g. Mid-Term Test" />
            <Select label="Assessment Type" required options={assessmentTypes.map((t) => ({ value: t.id, label: t.name }))} error={errors.assessmentTypeId?.message} {...register('assessmentTypeId')} />
            <Select label="Class" required options={filteredClasses.map((c) => ({ value: c.id, label: c.stream ? `${c.name} - ${c.stream}` : c.name }))} error={errors.classId?.message} {...register('classId')} />
            <Select label="Subject" required options={availableSubjects.map((s) => ({ value: s.id, label: s.name }))} error={errors.subjectId?.message} {...register('subjectId')} hint={teacherSubjects.length ? undefined : 'Select a teacher with assigned subjects, or choose from the full subject list.'} />
            <Select
              label="Academic Year"
              required
              options={academicYears.map((y) => ({ value: y.id, label: y.name }))}
              error={errors.academicYearId?.message}
              {...register('academicYearId', {
                onChange: (event) => {
                  const yearId = event.target.value;
                  setValue('classId', classes.find((schoolClass) => schoolClass.academicYearId === yearId)?.id ?? '');
                  setValue('termId', terms.find((term) => term.academicYearId === yearId)?.id ?? '');
                },
              })}
            />
            <Select label="Term" required options={filteredTerms.map((t) => ({ value: t.id, label: t.name }))} error={errors.termId?.message} {...register('termId')} />
            {user?.role === 'teacher' ? (
              <>
                <Input label="Teacher" value={teachers[0] ? `${teachers[0].firstName} ${teachers[0].lastName}` : 'Loading teacher profile'} readOnly />
                <input type="hidden" {...register('teacherId')} />
              </>
            ) : (
              <Select label="Teacher" required options={teachers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))} error={errors.teacherId?.message} {...register('teacherId')} />
            )}
            <Input label="Maximum Score" type="number" required error={errors.maxScore?.message} {...register('maxScore', { valueAsNumber: true })} />
            <Input label="Weight (%)" type="number" required readOnly error={errors.weight?.message} {...register('weight', { valueAsNumber: true })} hint="Class assessments contribute 30%; examinations contribute 70%." />
            <Input label="Date" type="date" required error={errors.date?.message} {...register('date')} />
          </CardContent>
        </Card>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting} leftIcon={<Save className="h-4 w-4" />}>Create Assessment</Button>
        </div>
      </form>
    </div>
  );
}