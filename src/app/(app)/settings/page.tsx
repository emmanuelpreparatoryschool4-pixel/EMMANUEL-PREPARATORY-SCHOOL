'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, School } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FileUpload } from '@/components/ui/FileUpload';
import { Tabs } from '@/components/ui/Tabs';
import { UserManagementPanel } from '@/components/settings/UserManagementPanel';
import { MyProfilePanel } from '@/components/settings/MyProfilePanel';
import { SchoolResetPanel } from '@/components/settings/SchoolResetPanel';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { schoolSettingsSchema, type SchoolSettingsFormValues } from '@/lib/validations';
import { dataService } from '@/lib/db';
import { SchoolSettings } from '@/types';
import { getErrorMessage } from '@/lib/utils';

export default function SettingsPage() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [activeTab, setActiveTab] = useState(user?.role === 'owner' ? 'school' : 'profile');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logo, setLogo] = useState<string | undefined>();
  const [profileImage, setProfileImage] = useState<string | undefined>();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<SchoolSettingsFormValues>({
    resolver: zodResolver(schoolSettingsSchema),
  });

  useEffect(() => {
    async function load() {
      const s = await dataService.getSchoolSettings();
      if (s) {
        setSettings(s);
        setLogo(s.logo || '');
        setProfileImage(s.profileImage || '');
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
      await dataService.updateSchoolSettings({
        ...data,
        logo: logo ?? settings?.logo,
        profileImage: profileImage ?? settings?.profileImage,
      });
      addToast({ type: 'success', title: 'Settings saved' });
      setSettings((current) => current ? {
        ...current,
        ...data,
        logo: logo ?? current.logo,
        profileImage: profileImage ?? current.profileImage,
      } : current);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: getErrorMessage(error, 'Failed to save settings.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageSelect = (
    file: File,
    setImage: React.Dispatch<React.SetStateAction<string | undefined>>,
    label: string
  ) => {
    if (!file.type.startsWith('image/')) {
      addToast({ type: 'error', title: 'Unsupported file', message: `Choose a PNG, JPG, or other image for the ${label}.` });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      addToast({ type: 'error', title: 'Image is too large', message: `Choose a ${label} image smaller than 2 MB.` });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result.startsWith('data:image/')) {
        addToast({ type: 'error', title: 'Could not read image', message: 'Choose a valid image file and try again.' });
        return;
      }
      setImage(reader.result);
    };
    reader.onerror = () => {
      addToast({ type: 'error', title: 'Could not read image', message: 'The selected logo could not be read.' });
    };
    reader.readAsDataURL(file);
  };

  const tabs = [
    ...(user?.role === 'owner' ? [
      { id: 'school', label: 'School Information' },
      { id: 'users', label: 'User Management' },
    ] : []),
    { id: 'profile', label: 'My Profile' },
  ];

  return (
    <div>
      <PageHeader title="Settings" description="Manage school information, users, and your profile" />

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

      {activeTab === 'school' && user?.role === 'owner' && (
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
                  {logo ? (
                    <div
                      role="img"
                      aria-label="School logo preview"
                      className="h-full w-full rounded-lg bg-contain bg-center bg-no-repeat"
                      style={{ backgroundImage: `url("${logo}")` }}
                    />
                  ) : (
                    <School className="h-10 w-10 text-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <FileUpload
                    accept="image/*"
                    onFileSelect={(file) => handleImageSelect(file, setLogo, 'school logo')}
                    label="Upload Logo"
                    hint="PNG or JPG, up to 2 MB"
                  />
                  {logo && (
                    <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setLogo('')}>
                      Remove logo
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader><CardTitle>School Profile Image</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50">
                  {profileImage ? (
                    <div
                      role="img"
                      aria-label="School profile image preview"
                      className="h-full w-full rounded-lg bg-cover bg-center"
                      style={{ backgroundImage: `url("${profileImage}")` }}
                    />
                  ) : (
                    <School className="h-10 w-10 text-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <FileUpload
                    accept="image/*"
                    onFileSelect={(file) => handleImageSelect(file, setProfileImage, 'school profile')}
                    label="Upload Profile Image"
                    hint="PNG or JPG, up to 2 MB"
                  />
                  {profileImage && (
                    <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setProfileImage('')}>
                      Remove profile image
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 flex justify-end">
            <Button type="submit" isLoading={isSubmitting} leftIcon={<Save className="h-4 w-4" />}>Save Settings</Button>
          </div>
        </form>
      )}

      {activeTab === 'school' && user?.role === 'owner' && <SchoolResetPanel />}
      {activeTab === 'users' && user?.role === 'owner' && <UserManagementPanel />}
      {activeTab === 'profile' && <MyProfilePanel />}
    </div>
  );
}