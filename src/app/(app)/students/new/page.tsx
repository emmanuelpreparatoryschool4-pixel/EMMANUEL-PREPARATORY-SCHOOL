'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, useWatch, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { studentSchema, type StudentFormValues } from '@/lib/validations';
import { dataService, seedSchoolSetup } from '@/lib/db';
import { generateStudentId, generateAdmissionNumber, getErrorMessage } from '@/lib/utils';
import { GENDERS, GHANA_REGIONS, TRANSPORT_ARRANGEMENTS, ENROLLMENT_STATUSES } from '@/lib/constants';
import { Class, AcademicYear } from '@/types';

const studentDraftStorageKey = 'eps-new-student-draft';

const initialFormValues: DefaultValues<StudentFormValues> = {
  languagesSpoken: ['English'],
  enrollmentStatus: 'active',
  transportArrangement: 'walking',
  admissionDate: new Date().toISOString().split('T')[0],
  guardians: [
    {
      fullName: '',
      relationship: 'Parent',
      phoneNumber: '',
      isPrimaryContact: true,
      isEmergencyContact: true,
      isAuthorizedPickup: true,
    },
  ],
};

function isStudentDraft(value: unknown): value is Partial<StudentFormValues> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const draft = value as Record<string, unknown>;
  return Object.entries(draft).every(([key, item]) => {
    if (key === 'languagesSpoken') {
      return Array.isArray(item) && item.every((language) => typeof language === 'string');
    }
    if (key === 'guardians') {
      return Array.isArray(item) && item.every((guardian) => (
        !!guardian &&
        typeof guardian === 'object' &&
        !Array.isArray(guardian) &&
        Object.values(guardian).every((field) => (
          field === undefined || typeof field === 'string' || typeof field === 'boolean'
        ))
      ));
    }
    return item === undefined || typeof item === 'string' || typeof item === 'boolean';
  });
}

export default function NewStudentPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [draftError, setDraftError] = useState('');
  const [isDraftReady, setIsDraftReady] = useState(false);
  const restoredDraft = useRef(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    reset,
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: initialFormValues,
  });
  const formValues = useWatch({ control });

  const { fields: guardianFields, append: appendGuardian, remove: removeGuardian } = useFieldArray({
    control,
    name: 'guardians',
  });

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const savedDraft = sessionStorage.getItem(studentDraftStorageKey);
        if (savedDraft) {
          const parsedDraft: unknown = JSON.parse(savedDraft);
          if (!isStudentDraft(parsedDraft)) {
            throw new Error('The saved student draft has an invalid format.');
          }
          restoredDraft.current = true;
          reset({
            ...initialFormValues,
            ...parsedDraft,
            guardians: parsedDraft.guardians ?? initialFormValues.guardians,
          });
        }
      } catch (error) {
        setDraftError(getErrorMessage(error, 'Could not restore the saved student draft.'));
      } finally {
        setIsDraftReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reset]);

  useEffect(() => {
    if (!isDraftReady) return;
    try {
      const savedDraft = JSON.stringify(formValues);
      if (savedDraft) sessionStorage.setItem(studentDraftStorageKey, savedDraft);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not save the student draft in this browser session.');
      queueMicrotask(() => setDraftError(message));
    }
  }, [formValues, isDraftReady]);

  useEffect(() => {
    async function load() {
      try {
        await seedSchoolSetup();
        const [cls, years] = await Promise.all([
          dataService.getClasses(),
          dataService.getAcademicYears(),
        ]);
        setClasses(cls);
        setAcademicYears(years);
        if (!restoredDraft.current) {
          const current = years.find((y) => y.isCurrent) || years[0];
          if (current) setValue('academicYearId', current.id);
          if (cls[0]) setValue('currentClassId', cls[0].id);
        }
      } catch (error) {
        setLoadError(getErrorMessage(error, 'Could not load classes and academic years.'));
      }
    }
    void load();
  }, [setValue]);

  const onSubmit = async (data: StudentFormValues) => {
    if (!user) {
      setSubmitError('Your sign-in session has expired. Sign out and sign in again before saving.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const { guardians, ...studentData } = data;
      const studentId = await dataService.addStudent({
        studentId: generateStudentId(),
        admissionNumber: generateAdmissionNumber(),
        ...studentData,
      });

      try {
        const savedGuardianIds = await dataService.addGuardians(
          guardians.map((guardian) => ({ ...guardian, studentId }))
        );
        const [savedStudent, savedGuardians] = await Promise.all([
          dataService.getStudent(studentId),
          dataService.getGuardians(studentId),
        ]);
        if (!savedStudent || savedGuardianIds.length !== guardians.length || savedGuardians.length !== guardians.length) {
          throw new Error('Supabase did not confirm that the student and all guardian records were saved.');
        }
      } catch (saveError) {
        try {
          await dataService.deleteStudent(studentId);
        } catch (rollbackError) {
          throw new Error(
            `${getErrorMessage(saveError, 'Saving the student or guardian records failed.')} The student record may still exist because cleanup also failed: ${getErrorMessage(rollbackError, 'Unknown cleanup error.')}`
          );
        }
        throw new Error(
          `${getErrorMessage(saveError, 'Saving the student or guardian records failed.')} The incomplete student record was removed.`
        );
      }

      try {
        await dataService.addActivityLog({
          userId: user.id,
          userName: user.name,
          action: 'Enrolled new student',
          entityType: 'student',
          entityId: studentId,
          details: `${data.firstName} ${data.lastName}`,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Student was saved but the activity log could not be written.', error);
        addToast({
          type: 'warning',
          title: 'Student saved; activity log unavailable',
          message: getErrorMessage(error, 'The student and guardian records were saved, but the activity log was not.'),
          duration: 12000,
        });
      }

      addToast({ type: 'success', title: 'Student added', message: 'Student enrolled successfully.' });
      try {
        sessionStorage.removeItem(studentDraftStorageKey);
      } catch (error) {
        console.error('Student was saved but the form draft could not be cleared.', error);
        addToast({
          type: 'warning',
          title: 'Draft could not be cleared',
          message: getErrorMessage(error, 'The student was saved, but the incomplete form draft remains in this browser session.'),
        });
      }
      router.push('/students');
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to add student.');
      setSubmitError(message);
      addToast({
        type: 'error',
        title: 'Student was not saved',
        message,
        duration: 15000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Add New Student"
        description="Enroll a new student into the school"
        breadcrumbs={[
          { label: 'Students', href: '/students' },
          { label: 'Add Student' },
        ]}
        actions={
          <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {(loadError || submitError || draftError) && (
          <div role="alert" className="break-words rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-semibold">
              {submitError ? 'Student was not saved' : loadError ? 'Could not load enrollment options' : 'Could not save or restore the draft'}
            </p>
            <p className="mt-1">{submitError || loadError || draftError}</p>
          </div>
        )}
        {/* Personal Information */}
        <Card>
          <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input label="First Name" required error={errors.firstName?.message} {...register('firstName')} />
            <Input label="Last Name" required error={errors.lastName?.message} {...register('lastName')} />
            <Input label="Other Names" {...register('otherNames')} />
            <Input label="Preferred Name" {...register('preferredName')} />
            <Select
              label="Gender"
              required
              options={GENDERS}
              placeholder="Select gender"
              error={errors.gender?.message}
              {...register('gender')}
            />
            <Input label="Date of Birth" type="date" required error={errors.dateOfBirth?.message} {...register('dateOfBirth')} />
            <Input label="NHIS Number" {...register('nhisNumber')} />
            <Input label="Place of Birth" required error={errors.placeOfBirth?.message} {...register('placeOfBirth')} />
            <Input label="District" required error={errors.district?.message} {...register('district')} />
            <Input label="District Capital" required error={errors.districtCapital?.message} {...register('districtCapital')} />
            <Select
              label="Region"
              required
              options={GHANA_REGIONS}
              placeholder="Select region"
              error={errors.region?.message}
              {...register('region')}
            />
            <Input label="Religion" {...register('religion')} />
            <Input label="Residential Address" required className="md:col-span-2" error={errors.residentialAddress?.message} {...register('residentialAddress')} />
            <Input label="Digital Address" {...register('digitalAddress')} />
          </CardContent>
        </Card>

        {/* Enrollment */}
        <Card>
          <CardHeader><CardTitle>Enrollment Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input label="Admission Date" type="date" required error={errors.admissionDate?.message} {...register('admissionDate')} />
            <Select
              label="Class"
              required
              options={classes.map((c) => ({ value: c.id, label: c.stream ? `${c.name} - ${c.stream}` : c.name }))}
              placeholder={classes.length ? 'Select class' : 'No classes available'}
              error={errors.currentClassId?.message}
              {...register('currentClassId')}
            />
            <Input label="Stream" placeholder="e.g. A, B" {...register('stream')} />
            <Select
              label="Academic Year"
              required
              options={academicYears.map((y) => ({ value: y.id, label: y.name }))}
              error={errors.academicYearId?.message}
              {...register('academicYearId')}
            />
            <Select
              label="Enrollment Status"
              options={ENROLLMENT_STATUSES}
              {...register('enrollmentStatus')}
            />
            <Select
              label="Transport Arrangement"
              options={TRANSPORT_ARRANGEMENTS}
              {...register('transportArrangement')}
            />
          </CardContent>
        </Card>

        {/* Guardians */}
        <Card>
          <CardHeader
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() =>
                  appendGuardian({
                    fullName: '',
                    relationship: 'Parent',
                    phoneNumber: '',
                    isPrimaryContact: false,
                    isEmergencyContact: false,
                    isAuthorizedPickup: false,
                  })
                }
              >
                Add Guardian
              </Button>
            }
          >
            <CardTitle>Parents / Guardians</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {guardianFields.map((field, index) => (
              <div key={field.id} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700">Guardian {index + 1}</h4>
                  {guardianFields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeGuardian(index)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Input label="Full Name" required error={errors.guardians?.[index]?.fullName?.message} {...register(`guardians.${index}.fullName`)} />
                  <Input label="Relationship" required {...register(`guardians.${index}.relationship`)} />
                  <Input label="Phone Number" required error={errors.guardians?.[index]?.phoneNumber?.message} {...register(`guardians.${index}.phoneNumber`)} />
                  <Input label="Alternative Phone" {...register(`guardians.${index}.alternativePhone`)} />
                  <Input label="Email" type="email" {...register(`guardians.${index}.email`)} />
                  <Input label="Address" {...register(`guardians.${index}.address`)} />
                </div>
                <div className="mt-3 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" {...register(`guardians.${index}.isPrimaryContact`)} />
                    Primary Contact
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" {...register(`guardians.${index}.isEmergencyContact`)} />
                    Emergency Contact
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" {...register(`guardians.${index}.isAuthorizedPickup`)} />
                    Authorized Pickup
                  </label>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle>Additional Notes</CardTitle></CardHeader>
          <CardContent>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={3}
              placeholder="Emergency notes, allergies, or other important information..."
              {...register('emergencyNotes')}
            />
          </CardContent>
        </Card>

        <div className="sticky bottom-0 -mx-3 flex flex-col-reverse gap-2 border-t border-gray-200 bg-gray-50/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0 sm:backdrop-blur-none">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto" leftIcon={<Save className="h-4 w-4" />}>
            Save Student
          </Button>
        </div>
      </form>
    </div>
  );
}