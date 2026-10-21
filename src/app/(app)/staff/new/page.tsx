'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/contexts/ToastContext';
import { staffSchema, type StaffFormValues } from '@/lib/validations';
import { dataService } from '@/lib/db';
import { generateStaffId } from '@/lib/utils';
import { GENDERS, STAFF_CATEGORIES, EMPLOYMENT_STATUSES, MARITAL_STATUSES, GHANA_REGIONS } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';

export default function NewStaffPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isOwner = user?.role === 'owner';

  const { register, handleSubmit, formState: { errors } } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      languagesSpoken: ['English'],
      employmentStatus: 'active',
      staffCategory: 'teacher',
      isTrained: false,
      appointmentDate: new Date().toISOString().split('T')[0],
      subjectsTaught: [],
    },
  });

  const onSubmit = async (data: StaffFormValues) => {
    setIsSubmitting(true);
    try {
      await dataService.addStaff({
        staffId: generateStaffId(),
        ...data,
      });
      addToast({ type: 'success', title: 'Staff added', message: 'Staff member added successfully.' });
      router.push('/staff');
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to add staff member.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Add Staff Member"
        breadcrumbs={[{ label: 'Staff', href: '/staff' }, { label: 'Add Staff' }]}
        actions={<Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>Back</Button>}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input label="First Name" required error={errors.firstName?.message} {...register('firstName')} />
            <Input label="Last Name" required error={errors.lastName?.message} {...register('lastName')} />
            <Input label="Other Names" {...register('otherNames')} />
            <Select label="Gender" required options={GENDERS} error={errors.gender?.message} {...register('gender')} />
            <Input label="Date of Birth" type="date" required {...register('dateOfBirth')} />
            <Input label="Hometown" {...register('hometown')} />
            <Input label="Place of Birth" {...register('placeOfBirth')} />
            <Input label="District" {...register('district')} />
            <Input label="District Capital" {...register('districtCapital')} />
            <Select label="Region" options={GHANA_REGIONS} {...register('region')} />
            <Input label="Residential Address" className="md:col-span-2" {...register('residentialAddress')} />
            <Input label="Digital Address" {...register('digitalAddress')} />
            <Input label="Phone Number" required error={errors.phoneNumber?.message} {...register('phoneNumber')} />
            <Input label="Email" type="email" {...register('email')} />
            <Select label="Marital Status" options={MARITAL_STATUSES} placeholder="Select" {...register('maritalStatus')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Employment Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Select label="Staff Category" required options={STAFF_CATEGORIES} error={errors.staffCategory?.message} {...register('staffCategory')} />
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" {...register('isTrained')} />
                Trained Teacher
              </label>
            </div>
            <Input label="Registration Number" {...register('registrationNumber')} />
            <Input label="File Number" {...register('fileNumber')} />
            <Input label="Appointment Date" type="date" required {...register('appointmentDate')} />
            <Input label="Current Rank" {...register('currentRank')} />
            <Input label="Date Promoted" type="date" {...register('datePromoted')} />
            <Input label="Pay Level" {...register('payLevel')} />
            <Input label="Date Posted to Station" type="date" {...register('datePostedToStation')} />
            <Input label="Former School" {...register('formerSchool')} />
            <Select label="Employment Status" options={EMPLOYMENT_STATUSES} {...register('employmentStatus')} />
            <Input label="School Portfolio" {...register('schoolPortfolio')} />
          </CardContent>
        </Card>

        {isOwner && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                <CardTitle>Sensitive Information (Admin Only)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Input label="SSNIT Number" {...register('ssnitNumber')} />
              <Input label="TIN" {...register('tin')} />
              <Input label="Ghana Card Number" {...register('ghanaCardNumber')} />
              <Input label="NHIS Number" {...register('nhisNumber')} />
              <Input label="Bank Name" {...register('bankName')} />
              <Input label="Bank Account Name" {...register('bankAccountName')} />
              <Input label="Bank Account Number" {...register('bankAccountNumber')} />
              <Input label="Bank Branch" {...register('bankBranch')} />
              <Input label="Next of Kin Name" {...register('nextOfKinName')} />
              <Input label="Relationship" {...register('nextOfKinRelationship')} />
              <Input label="Contact Number" {...register('nextOfKinContact')} />
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting} leftIcon={<Save className="h-4 w-4" />}>Save Staff</Button>
        </div>
      </form>
    </div>
  );
}