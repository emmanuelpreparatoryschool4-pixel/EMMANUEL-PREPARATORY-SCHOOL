'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { staffSchema, type StaffFormValues } from '@/lib/validations';
import { dataService } from '@/lib/db';
import { GENDERS, STAFF_CATEGORIES, EMPLOYMENT_STATUSES, MARITAL_STATUSES, GHANA_REGIONS } from '@/lib/constants';

export default function EditStaffPage() {
  const router = useRouter();
  const params = useParams();
  const staffId = params.id as string;
  const { addToast } = useToast();
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
  });

  useEffect(() => {
    async function load() {
      const s = await dataService.getStaffMember(staffId);
      if (!s) { router.push('/staff'); return; }
      reset({ ...s, subjectsTaught: s.subjectsTaught || [] } as unknown as StaffFormValues);
      setIsLoading(false);
    }
    load();
  }, [staffId, reset, router]);

  const onSubmit = async (data: StaffFormValues) => {
    setIsSubmitting(true);
    try {
      await dataService.updateStaff(staffId, data);
      addToast({ type: 'success', title: 'Updated', message: 'Staff record updated.' });
      router.push(`/staff/${staffId}`);
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to update staff.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  return (
    <div>
      <PageHeader title="Edit Staff" breadcrumbs={[{ label: 'Staff', href: '/staff' }, { label: 'Edit' }]}
        actions={<Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>Back</Button>} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input label="First Name" required error={errors.firstName?.message} {...register('firstName')} />
            <Input label="Last Name" required error={errors.lastName?.message} {...register('lastName')} />
            <Input label="Other Names" {...register('otherNames')} />
            <Select label="Gender" required options={GENDERS} {...register('gender')} />
            <Input label="Date of Birth" type="date" required {...register('dateOfBirth')} />
            <Input label="Hometown" {...register('hometown')} />
            <Input label="Phone Number" required {...register('phoneNumber')} />
            <Input label="Email" type="email" {...register('email')} />
            <Select label="Region" options={GHANA_REGIONS} {...register('region')} />
            <Select label="Marital Status" options={MARITAL_STATUSES} placeholder="Select" {...register('maritalStatus')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Employment Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Select label="Staff Category" required options={STAFF_CATEGORIES} {...register('staffCategory')} />
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" {...register('isTrained')} /> Trained
              </label>
            </div>
            <Input label="Registration Number" {...register('registrationNumber')} />
            <Input label="File Number" {...register('fileNumber')} />
            <Input label="Appointment Date" type="date" required {...register('appointmentDate')} />
            <Input label="Current Rank" {...register('currentRank')} />
            <Input label="Pay Level" {...register('payLevel')} />
            <Input label="Date Posted to Station" type="date" {...register('datePostedToStation')} />
            <Select label="Employment Status" options={EMPLOYMENT_STATUSES} {...register('employmentStatus')} />
          </CardContent>
        </Card>

        {isOwner && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                <CardTitle>Sensitive Information (Owner Only)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Input label="SSNIT Number" {...register('ssnitNumber')} />
              <Input label="TIN" {...register('tin')} />
              <Input label="Ghana Card Number" {...register('ghanaCardNumber')} />
              <Input label="Bank Name" {...register('bankName')} />
              <Input label="Account Number" {...register('bankAccountNumber')} />
              <Input label="Bank Branch" {...register('bankBranch')} />
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting} leftIcon={<Save className="h-4 w-4" />}>Save Changes</Button>
        </div>
      </form>
    </div>
  );
}