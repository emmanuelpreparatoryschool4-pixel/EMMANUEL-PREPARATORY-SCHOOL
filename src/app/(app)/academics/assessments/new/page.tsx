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
import { assessmentSchema, type AssessmentFormValues } from '@/lib/validations';
import { dataService } from '@/lib/db';
import { Class, Subject, AcademicYear, Term, AssessmentType } from '@/types';
import { getErrorMessage } from '@/lib/utils';

export default function NewAssessmentPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, control, formState: { errors }, setValue } = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: { maxScore: 100, weight: 1, date: new Date().toISOString().split('T')[0] },
  });

  const selectedYear = useWatch({ control, name: 'academicYearId' });
  const selectedClassId = useWatch({ control, name: 'classId' });
  const selectedType = useWatch({ control, name: 'assessmentTypeId' });

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
      setAssessmentTypes(at.filter((type) => type.status === 'active'));
      const currentYear = y.find((yr) => yr.isCurrent);
      const currentTerm = t.find((tm) => tm.isCurrent && tm.academicYearId === currentYear?.id) ??
        t.find((tm) => tm.academicYearId === currentYear?.id);
      if (currentYear) setValue('academicYearId', currentYear.id);
      if (currentTerm) setValue('termId', currentTerm.id);
    }
    load().catch((error: unknown) => {
      addToast({ type: 'error', title: 'Could not load assessment options', message: getErrorMessage(error, 'Failed to load assessment options.') });
    });
  }, [addToast, setValue]);

  useEffect(() => {
    const type = assessmentTypes.find((t) => t.id === selectedType);
    if (type) {
      setValue('weight', type.defaultWeight);
      setValue('maxScore', type.defaultMaxScore);
    }
  }, [selectedType, assessmentTypes, setValue]);

  const filteredTerms = terms.filter((t) => t.academicYearId === selectedYear);
  const filteredClasses = classes.filter((schoolClass) => schoolClass.academicYearId === selectedYear);
  const selectedClass = classes.find((schoolClass) => schoolClass.id === selectedClassId);
  const availableSubjects = selectedClass
    ? subjects.filter((subject) =>
      subject.status === 'active' &&
      (!selectedClass.subjectIds?.length || selectedClass.subjectIds.includes(subject.id))
    )
    : [];

  const onSubmit = async (data: AssessmentFormValues) => {
    const schoolClass = classes.find((item) => item.id === data.classId);
    const term = terms.find((item) => item.id === data.termId);
    const type = assessmentTypes.find((item) => item.id === data.assessmentTypeId);
    if (!schoolClass || schoolClass.academicYearId !== data.academicYearId ||
      !term || term.academicYearId !== data.academicYearId) {
      addToast({ type: 'error', title: 'Check the academic year', message: 'The class and term must belong to the selected academic year.' });
      return;
    }
    if (schoolClass.subjectIds?.length && !schoolClass.subjectIds.includes(data.subjectId)) {
      addToast({ type: 'error', title: 'Subject not assigned', message: 'Choose a subject assigned to the selected class.' });
      return;
    }
    if (!type) {
      addToast({ type: 'error', title: 'Assessment type required', message: 'Choose a valid assessment type before continuing.' });
      return;
    }
    setIsSubmitting(true);
    try {
      if (!schoolClass.subjectIds?.length) {
        await dataService.updateClass(schoolClass.id, { subjectIds: [data.subjectId] });
      }
      await dataService.addAssessment({
        ...data,
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
            <Select
              label="Class"
              required
              options={filteredClasses.map((c) => ({ value: c.id, label: c.stream ? `${c.name} - ${c.stream}` : c.name }))}
              error={errors.classId?.message}
              {...register('classId', { onChange: () => setValue('subjectId', '') })}
            />
            <Select label="Subject" required options={availableSubjects.map((s) => ({ value: s.id, label: s.name }))} error={errors.subjectId?.message} {...register('subjectId')} />
            {selectedClass && availableSubjects.length === 0 && (
              <p className="text-sm text-amber-700 md:col-span-2 lg:col-span-3">
                {subjects.length === 0
                  ? 'Create subjects in Academics & Results > Academic Configuration before creating assessments.'
                  : 'There are no active subjects available to assign to this class.'}
              </p>
            )}
            {selectedClass && !selectedClass.subjectIds?.length && availableSubjects.length > 0 && (
              <p className="text-sm text-amber-700 md:col-span-2 lg:col-span-3">
                This class has no subject assignments yet. The selected subject will be linked to it when you create the assessment.
              </p>
            )}
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
            <Input label="Maximum Score" type="number" min="0.01" step="0.01" required error={errors.maxScore?.message} {...register('maxScore', { valueAsNumber: true })} />
            <Input label="Contribution to subject total (%)" type="number" min="0.01" max="100" step="0.01" required error={errors.weight?.message} {...register('weight', { valueAsNumber: true })} hint="For each subject and term, assessment contributions must total 100%." />
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