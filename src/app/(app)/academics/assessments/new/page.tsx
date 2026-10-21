'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
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
import { Class, Subject, AcademicYear, Term, Staff, AssessmentType } from '@/types';

export default function NewAssessmentPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: { maxScore: 100, weight: 30, date: new Date().toISOString().split('T')[0] },
  });

  const selectedYear = watch('academicYearId');
  const selectedType = watch('assessmentTypeId');

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
      const currentYear = y.find((yr) => yr.isCurrent);
      const currentTerm = t.find((tm) => tm.isCurrent);
      if (currentYear) setValue('academicYearId', currentYear.id);
      if (currentTerm) setValue('termId', currentTerm.id);
    }
    load();
  }, [setValue]);

  useEffect(() => {
    if (selectedYear) {
      dataService.getStaff({ category: 'teacher' }).then(setTeachers);
    }
  }, [selectedYear]);

  useEffect(() => {
    const type = assessmentTypes.find((t) => t.id === selectedType);
    if (type) {
      setValue('weight', type.defaultWeight);
      setValue('maxScore', type.defaultMaxScore);
    }
  }, [selectedType, assessmentTypes, setValue]);

  const filteredTerms = terms.filter((t) => t.academicYearId === selectedYear);

  const onSubmit = async (data: AssessmentFormValues) => {
    setIsSubmitting(true);
    try {
      await dataService.addAssessment({
        ...data,
        status: 'draft',
      });
      addToast({ type: 'success', title: 'Assessment created' });
      router.push('/academics');
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to create assessment.' });
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
            <Select label="Class" required options={classes.map((c) => ({ value: c.id, label: c.name }))} error={errors.classId?.message} {...register('classId')} />
            <Select label="Subject" required options={subjects.map((s) => ({ value: s.id, label: s.name }))} error={errors.subjectId?.message} {...register('subjectId')} />
            <Select label="Academic Year" required options={academicYears.map((y) => ({ value: y.id, label: y.name }))} error={errors.academicYearId?.message} {...register('academicYearId')} />
            <Select label="Term" required options={filteredTerms.map((t) => ({ value: t.id, label: t.name }))} error={errors.termId?.message} {...register('termId')} />
            <Select label="Teacher" required options={teachers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))} error={errors.teacherId?.message} {...register('teacherId')} />
            <Input label="Maximum Score" type="number" required error={errors.maxScore?.message} {...register('maxScore', { valueAsNumber: true })} />
            <Input label="Weight (%)" type="number" required error={errors.weight?.message} {...register('weight', { valueAsNumber: true })} />
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