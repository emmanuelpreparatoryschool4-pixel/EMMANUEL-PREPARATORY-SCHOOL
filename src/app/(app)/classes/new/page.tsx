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
import { classSchema, type ClassFormValues } from '@/lib/validations';
import { dataService } from '@/lib/db';
import { AcademicYear, Staff } from '@/types';

export default function NewClassPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: { capacity: 40 },
  });

  useEffect(() => {
    async function load() {
      const [years, staff] = await Promise.all([dataService.getAcademicYears(), dataService.getStaff({ category: 'teacher' })]);
      setAcademicYears(years);
      setTeachers(staff);
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
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to add class.' });
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
            <Select label="Class Teacher" options={[{ value: '', label: 'Unassigned' }, ...teachers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))]} {...register('classTeacherId')} />
            <Input label="Capacity" type="number" required error={errors.capacity?.message} {...register('capacity', { valueAsNumber: true })} />
            <Input label="Location" {...register('location')} placeholder="e.g. Block A, Room 3" />
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