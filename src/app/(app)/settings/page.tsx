'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, School, Calendar, BookOpen, DollarSign, Users, Upload } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/contexts/ToastContext';
import { schoolSettingsSchema, type SchoolSettingsFormValues } from '@/lib/validations';
import { dataService } from '@/lib/db';
import { SchoolSettings } from '@/types';

export default function SettingsPage() {
  const { addToast } = useToast();
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [activeTab, setActiveTab] = useState('school');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<SchoolSettingsFormValues>({
    resolver: zodResolver(schoolSettingsSchema),
  });

  useEffect(() => {
    async function load() {
      const s = await dataService.getSchoolSettings();
      if (s) {
        setSettings(s);
        reset({
          name: s.name, abbreviation: s.abbreviation, address: s.address,
          digitalAddress: s.digitalAddress, phoneNumbers: s.phoneNumbers,
          email: s.email, establishmentDate: s.establishmentDate,
          proprietorName: s.proprietorName, headteacherName: s.headteacherName, motto: s.motto,
        });
      }
    }
    load();
  }, [reset]);

  const onSubmit = async (data: SchoolSettingsFormValues) => {
    setIsSubmitting(true);
    try {
      await dataService.updateSchoolSettings(data);
      addToast({ type: 'success', title: 'Settings saved' });
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to save settings.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'school', label: 'School Info' },
    { id: 'academic', label: 'Academic' },
    { id: 'classes', label: 'Classes' },
    { id: 'fees', label: 'Fee Categories' },
  ];

  return (
    <div>
      <PageHeader title="School Settings" description="Configure school information and system settings" />

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

      {activeTab === 'school' && (
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card>
            <CardHeader><CardTitle>School Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="School Name" required error={errors.name?.message} {...register('name')} />
              <Input label="Abbreviation" required error={errors.abbreviation?.message} {...register('abbreviation')} />
              <Input label="Address" required className="md:col-span-2" error={errors.address?.message} {...register('address')} />
              <Input label="Digital Address" {...register('digitalAddress')} />
              <Input label="Email" type="email" {...register('email')} />
              <Input label="Phone Number(s)" required error={errors.phoneNumbers?.message} placeholder="Comma separated" {...register('phoneNumbers.0')} />
              <Input label="Establishment Date" type="date" {...register('establishmentDate')} />
              <Input label="Proprietor's Name" {...register('proprietorName')} />
              <Input label="Headteacher's Name" {...register('headteacherName')} />
              <Input label="School Motto" className="md:col-span-2" {...register('motto')} />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader><CardTitle>School Logo</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50">
                  <School className="h-10 w-10 text-gray-300" />
                </div>
                <div>
                  <Button type="button" variant="outline" leftIcon={<Upload className="h-4 w-4" />}>Upload Logo</Button>
                  <p className="mt-2 text-xs text-gray-500">PNG or JPG, recommended 512x512px</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 flex justify-end">
            <Button type="submit" isLoading={isSubmitting} leftIcon={<Save className="h-4 w-4" />}>Save Settings</Button>
          </div>
        </form>
      )}

      {activeTab === 'academic' && (
        <Card><CardContent><p className="py-8 text-center text-sm text-gray-500">Academic year and term configuration. Manage from the Academics module.</p></CardContent></Card>
      )}

      {activeTab === 'classes' && (
        <Card><CardContent><p className="py-8 text-center text-sm text-gray-500">Class configuration. Manage from the Classes module.</p></CardContent></Card>
      )}

      {activeTab === 'fees' && (
        <Card><CardContent><p className="py-8 text-center text-sm text-gray-500">Fee category configuration. Categories are pre-configured with defaults.</p></CardContent></Card>
      )}
    </div>
  );
}