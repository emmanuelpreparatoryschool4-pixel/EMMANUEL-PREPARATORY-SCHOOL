'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

export default function EditClassPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.id as string;
  const { addToast } = useToast();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
  });

  useEffect(() => {
    async function load() {
      const [c, years, staff] = await Promise.all([
        dataService.getClass(classId),
        dataService.getAcademicYears(),
        dataService.getStaff({ category: 'teacher' }),
      ]);
      if (!c) { router.push('/classes'); return; }
      setAcademicYears(years);
      setTeachers(staff);
      reset({ name: c.name, stream: c.stream || '', academicYearId: c.academicYearId, classTeacherId: c.classTeacherId || '', capacity: c.capacity, location: c.location || '', notes: c.notes || '' });
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
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to update class.' });
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
            <Select label="Class Teacher" options={[{ value: '', label: 'Unassigned' }, ...teachers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))]} {...register('classTeacherId')} />
            <Input label="Capacity" type="number" required {...register('capacity', { valueAsNumber: true })} />
            <Input label="Location" {...register('location')} />
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