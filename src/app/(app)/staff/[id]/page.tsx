'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Phone, Mail, MapPin, Briefcase, Shield } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { dataService } from '@/lib/db';
import { Staff, Qualification } from '@/types';
import { formatDate, calculateYearsBetween, getStaffCategoryLabel } from '@/lib/utils';

export default function StaffProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const staffId = params.id as string;
  const isOwner = user?.role === 'owner';

  const [staff, setStaff] = useState<Staff | null>(null);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const s = await dataService.getStaffMember(staffId);
      if (!s) { router.push('/staff'); return; }
      setStaff(s);
      const q = await dataService.getQualifications(staffId);
      setQualifications(q);
      setIsLoading(false);
    }
    load();
  }, [staffId, router]);

  if (isLoading || !staff) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'qualifications', label: 'Qualifications', count: qualifications.length },
    { id: 'employment', label: 'Employment History' },
    ...(isOwner ? [{ id: 'sensitive', label: 'Sensitive Data' }] : []),
  ];

  return (
    <div>
      <PageHeader
        title={`${staff.firstName} ${staff.lastName}`}
        description={`${staff.staffId} · ${getStaffCategoryLabel(staff.staffCategory)}`}
        breadcrumbs={[{ label: 'Staff', href: '/staff' }, { label: `${staff.firstName} ${staff.lastName}` }]}
        actions={
          <Button variant="outline" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => router.push(`/staff/${staff.id}/edit`)}>
            Edit
          </Button>
        }
      />

      <Card className="mb-6 p-6">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Avatar firstName={staff.firstName} lastName={staff.lastName} size="xl" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">{staff.lastName} {staff.firstName}</h2>
              <Badge variant="status" status={staff.employmentStatus}>{staff.employmentStatus.replace('_', ' ')}</Badge>
              {staff.isTrained && <Badge className="bg-blue-100 text-blue-800">Trained</Badge>}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 sm:grid-cols-4">
              <p><span className="font-medium text-gray-500">ID:</span> {staff.staffId}</p>
              <p><span className="font-medium text-gray-500">Gender:</span> <span className="capitalize">{staff.gender}</span></p>
              <p><span className="font-medium text-gray-500">Category:</span> {getStaffCategoryLabel(staff.staffCategory)}</p>
              <p><span className="font-medium text-gray-500">Station:</span> {staff.currentStation || '—'}</p>
            </div>
          </div>
        </div>
      </Card>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                ['Date of Birth', formatDate(staff.dateOfBirth)],
                ['Hometown', staff.hometown || '—'],
                ['District', staff.district || '—'],
                ['Region', staff.region || '—'],
                ['Phone', staff.phoneNumber],
                ['Email', staff.email || '—'],
                ['Marital Status', staff.maritalStatus || '—'],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                  <span className="text-gray-500">{l}</span><span className="font-medium text-gray-900">{v}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Employment Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                ['Appointment Date', formatDate(staff.appointmentDate)],
                ['Current Rank', staff.currentRank || '—'],
                ['Pay Level', staff.payLevel || '—'],
                ['Date Posted to Station', staff.datePostedToStation ? formatDate(staff.datePostedToStation) : '—'],
                ['Years at Station', staff.datePostedToStation ? `${calculateYearsBetween(staff.datePostedToStation)} years` : '—'],
                ['Registration Number', staff.registrationNumber || '—'],
                ['File Number', staff.fileNumber || '—'],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                  <span className="text-gray-500">{l}</span><span className="font-medium text-gray-900">{v}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'qualifications' && (
        <Card>
          <CardHeader><CardTitle>Qualifications</CardTitle></CardHeader>
          <CardContent>
            {qualifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No qualifications recorded.</p>
            ) : (
              <div className="space-y-3">
                {qualifications.map((q) => (
                  <div key={q.id} className="rounded-lg border border-gray-200 p-4">
                    <p className="font-medium text-gray-900">{q.qualification}</p>
                    <p className="text-sm text-gray-600">{q.institution}</p>
                    <p className="text-xs text-gray-500">{q.yearStarted} - {q.yearCompleted}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'employment' && (
        <Card><CardContent><p className="py-8 text-center text-sm text-gray-500">Employment history will appear here.</p></CardContent></Card>
      )}

      {activeTab === 'sensitive' && isOwner && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              <CardTitle>Sensitive Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              ['SSNIT Number', staff.ssnitNumber], ['TIN', staff.tin],
              ['Ghana Card', staff.ghanaCardNumber], ['NHIS Number', staff.nhisNumber],
              ['Bank Name', staff.bankName], ['Account Name', staff.bankAccountName],
              ['Account Number', staff.bankAccountNumber], ['Bank Branch', staff.bankBranch],
            ].map(([l, v]) => (
              <div key={l as string} className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                <span className="text-gray-500">{l}</span><span className="font-medium text-gray-900">{v || '—'}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}