'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/contexts/ToastContext';
import { studentSchema, type StudentFormValues } from '@/lib/validations';
import { dataService } from '@/lib/db';
import { GENDERS, GHANA_REGIONS, TRANSPORT_ARRANGEMENTS, ENROLLMENT_STATUSES } from '@/lib/constants';
import { Class, AcademicYear, Guardian } from '@/types';

export default function EditStudentPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;
  const { addToast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { register, handleSubmit, control, formState: { errors }, reset } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'guardians' });

  useEffect(() => {
    async function load() {
      const [student, guardians, cls, years] = await Promise.all([
        dataService.getStudent(studentId),
        dataService.getGuardians(studentId),
        dataService.getClasses(),
        dataService.getAcademicYears(),
      ]);
      if (!student) {
        router.push('/students');
        return;
      }
      setClasses(cls);
      setAcademicYears(years);
      reset({
        firstName: student.firstName,
        lastName: student.lastName,
        otherNames: student.otherNames || '',
        preferredName: student.preferredName || '',
        gender: student.gender,
        dateOfBirth: student.dateOfBirth,
        nhisNumber: student.nhisNumber || '',
        languagesSpoken: student.languagesSpoken,
        motherTongue: student.motherTongue || '',
        placeOfBirth: student.placeOfBirth,
        district: student.district,
        districtCapital: student.districtCapital,
        region: student.region,
        religion: student.religion || '',
        residentialAddress: student.residentialAddress,
        digitalAddress: student.digitalAddress || '',
        admissionDate: student.admissionDate,
        currentClassId: student.currentClassId,
        stream: student.stream || '',
        academicYearId: student.academicYearId,
        enrollmentStatus: student.enrollmentStatus,
        transportArrangement: student.transportArrangement,
        emergencyNotes: student.emergencyNotes || '',
        guardians: guardians.map((g: Guardian) => ({
          fullName: g.fullName,
          relationship: g.relationship,
          phoneNumber: g.phoneNumber,
          alternativePhone: g.alternativePhone || '',
          email: g.email || '',
          address: g.address || '',
          isPrimaryContact: g.isPrimaryContact,
          isEmergencyContact: g.isEmergencyContact,
          isAuthorizedPickup: g.isAuthorizedPickup,
        })),
      });
      setIsLoading(false);
    }
    load();
  }, [studentId, reset, router]);

  const onSubmit = async (data: StudentFormValues) => {
    setIsSubmitting(true);
    try {
      const { guardians, ...studentData } = data;
      await dataService.updateStudent(studentId, studentData);

      const existing = await dataService.getGuardians(studentId);
      for (const g of existing) await dataService.deleteGuardian(g.id);
      for (const g of guardians) await dataService.addGuardian({ ...g, studentId });

      addToast({ type: 'success', title: 'Updated', message: 'Student updated successfully.' });
      router.push(`/students/${studentId}`);
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to update student.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  return (
    <div>
      <PageHeader
        title="Edit Student"
        breadcrumbs={[
          { label: 'Students', href: '/students' },
          { label: 'Edit' },
        ]}
        actions={
          <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input label="First Name" required error={errors.firstName?.message} {...register('firstName')} />
            <Input label="Last Name" required error={errors.lastName?.message} {...register('lastName')} />
            <Input label="Other Names" {...register('otherNames')} />
            <Select label="Gender" required options={GENDERS} error={errors.gender?.message} {...register('gender')} />
            <Input label="Date of Birth" type="date" required error={errors.dateOfBirth?.message} {...register('dateOfBirth')} />
            <Input label="NHIS Number" {...register('nhisNumber')} />
            <Input label="Place of Birth" required {...register('placeOfBirth')} />
            <Input label="District" required {...register('district')} />
            <Input label="District Capital" required {...register('districtCapital')} />
            <Select label="Region" required options={GHANA_REGIONS} error={errors.region?.message} {...register('region')} />
            <Input label="Residential Address" required className="md:col-span-2" {...register('residentialAddress')} />
            <Input label="Digital Address" {...register('digitalAddress')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Enrollment Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input label="Admission Date" type="date" required {...register('admissionDate')} />
            <Select label="Class" required options={classes.map((c) => ({ value: c.id, label: c.name }))} {...register('currentClassId')} />
            <Input label="Stream" {...register('stream')} />
            <Select label="Academic Year" required options={academicYears.map((y) => ({ value: y.id, label: y.name }))} {...register('academicYearId')} />
            <Select label="Enrollment Status" options={ENROLLMENT_STATUSES} {...register('enrollmentStatus')} />
            <Select label="Transport" options={TRANSPORT_ARRANGEMENTS} {...register('transportArrangement')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            action={
              <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => append({ fullName: '', relationship: 'Parent', phoneNumber: '', isPrimaryContact: false, isEmergencyContact: false, isAuthorizedPickup: false })}>
                Add Guardian
              </Button>
            }
          >
            <CardTitle>Guardians</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700">Guardian {index + 1}</h4>
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Input label="Full Name" required {...register(`guardians.${index}.fullName`)} />
                  <Input label="Relationship" required {...register(`guardians.${index}.relationship`)} />
                  <Input label="Phone" required {...register(`guardians.${index}.phoneNumber`)} />
                  <Input label="Alt Phone" {...register(`guardians.${index}.alternativePhone`)} />
                  <Input label="Email" {...register(`guardians.${index}.email`)} />
                  <Input label="Address" {...register(`guardians.${index}.address`)} />
                </div>
                <div className="mt-3 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" className="h-4 w-4 rounded" {...register(`guardians.${index}.isPrimaryContact`)} /> Primary
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" className="h-4 w-4 rounded" {...register(`guardians.${index}.isEmergencyContact`)} /> Emergency
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" className="h-4 w-4 rounded" {...register(`guardians.${index}.isAuthorizedPickup`)} /> Authorized Pickup
                  </label>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting} leftIcon={<Save className="h-4 w-4" />}>Save Changes</Button>
        </div>
      </form>
    </div>
  );
}