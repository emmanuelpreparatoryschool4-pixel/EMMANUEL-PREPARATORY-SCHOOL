'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

export default function EditClassPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.id as string;
  const { addToast } = useToast();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { register, handleSubmit, formState: { errors }, reset, setValue, control } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: { subjectIds: [] },
  });
  const selectedSubjectIds = useWatch({ control, name: 'subjectIds' }) ?? [];

  useEffect(() => {
    async function load() {
      const [c, years, availableSubjects] = await Promise.all([
        dataService.getClass(classId),
        dataService.getAcademicYears(),
        dataService.getSubjects(),
      ]);
      if (!c) { router.push('/classes'); return; }
      setAcademicYears(years);
      setSubjects(availableSubjects);
      reset({ name: c.name, stream: c.stream || '', academicYearId: c.academicYearId, subjectIds: c.subjectIds ?? [], capacity: c.capacity, location: c.location || '', notes: c.notes || '' });
      setIsLoading(false);
    }
    load();
  }, [classId, reset, router]);

  const onSubmit = async (data: ClassFormValues) => {
    setIsSubmitting(true);
    try {
      await dataService.updateClass(classId, data);
      addToast({ type: 'success', title: 'Updated' });
      router.push(`/classes/${classId}`);
    } catch (error) {
      addToast({ type: 'error', title: 'Could not update class', message: getErrorMessage(error, 'Failed to update class.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  return (
    <div>
      <PageHeader title="Edit Class" breadcrumbs={[{ label: 'Classes', href: '/classes' }, { label: 'Edit' }]}
        actions={<Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>Back</Button>} />
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader><CardTitle>Class Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Class Name" required error={errors.name?.message} {...register('name')} />
            <Input label="Stream" {...register('stream')} />
            <Select label="Academic Year" required options={academicYears.map((y) => ({ value: y.id, label: y.name }))} {...register('academicYearId')} />
            <Input label="Capacity" type="number" required {...register('capacity', { valueAsNumber: true })} />
            <Input label="Location" {...register('location')} />
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
          <Button type="submit" isLoading={isSubmitting} leftIcon={<Save className="h-4 w-4" />}>Save Changes</Button>
        </div>
      </form>
    </div>
  );
}