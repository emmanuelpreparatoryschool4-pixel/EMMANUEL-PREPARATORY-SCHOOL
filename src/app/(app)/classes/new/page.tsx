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
import { classSchema, type ClassFormValues } from '@/lib/validations';
import { dataService } from '@/lib/db';
import { getErrorMessage } from '@/lib/utils';
import { AcademicYear, Subject } from '@/types';

export default function NewClassPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, setValue, control } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: { capacity: 40, subjectIds: [] },
  });
  const selectedSubjectIds = useWatch({ control, name: 'subjectIds' }) ?? [];

  useEffect(() => {
    async function load() {
      const [years, availableSubjects] = await Promise.all([
        dataService.getAcademicYears(),
        dataService.getSubjects(),
      ]);
      setAcademicYears(years);
      setSubjects(availableSubjects);
      const current = years.find((y) => y.isCurrent);
      if (current) setValue('academicYearId', current.id);
    }
    load();
  }, [setValue]);

  const onSubmit = async (data: ClassFormValues) => {
    setIsSubmitting(true);
    try {
      const existing = await dataService.getClasses();
      await dataService.addClass({ ...data, status: 'active', order: existing.length + 1 });
      addToast({ type: 'success', title: 'Class added' });
      router.push('/classes');
    } catch (error) {
      addToast({ type: 'error', title: 'Could not add class', message: getErrorMessage(error, 'Failed to add class.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Add Class" breadcrumbs={[{ label: 'Classes', href: '/classes' }, { label: 'Add' }]}
        actions={<Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>Back</Button>} />
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader><CardTitle>Class Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Class Name" required error={errors.name?.message} {...register('name')} placeholder="e.g. Primary 1" />
            <Input label="Stream" {...register('stream')} placeholder="e.g. A" />
            <Select label="Academic Year" required options={academicYears.map((y) => ({ value: y.id, label: y.name }))} error={errors.academicYearId?.message} {...register('academicYearId')} />
            <Input label="Capacity" type="number" required error={errors.capacity?.message} {...register('capacity', { valueAsNumber: true })} />
            <Input label="Location" {...register('location')} placeholder="e.g. Block A, Room 3" />
            <fieldset className="md:col-span-2">
              <legend className="mb-2 text-sm font-medium text-gray-700">Subjects offered in this class</legend>
              {subjects.length === 0 ? (
                <p className="text-sm text-gray-500">Create subjects in Academics before assigning them to a class.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {subjects.map((subject) => (
                    <label key={subject.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedSubjectIds.includes(subject.id)}
                        onChange={(event) => setValue(
                          'subjectIds',
                          event.target.checked
                            ? [...selectedSubjectIds, subject.id]
                            : selectedSubjectIds.filter((subjectId) => subjectId !== subject.id),
                          { shouldDirty: true }
                        )}
                      />
                      {subject.name}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <Input label="Notes" className="md:col-span-2" {...register('notes')} />
          </CardContent>
        </Card>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting} leftIcon={<Save className="h-4 w-4" />}>Save Class</Button>
        </div>
      </form>
    </div>
  );
}