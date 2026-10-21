'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, User, Phone, Mail, MapPin, Calendar, BookOpen, DollarSign, CalendarCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Avatar } from '@/components/ui/Avatar';
import { dataService } from '@/lib/db';
import { Student, Guardian, Class, Invoice } from '@/types';
import { formatDate, formatCurrency, calculateAge, getEnrollmentStatusLabel } from '@/lib/utils';

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [studentClass, setStudentClass] = useState<Class | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    async function load() {
      const s = await dataService.getStudent(studentId);
      if (!s) {
        router.push('/students');
        return;
      }
      setStudent(s);
      const [g, c, inv] = await Promise.all([
        dataService.getGuardians(studentId),
        dataService.getClass(s.currentClassId),
        dataService.getInvoices({ studentId }),
      ]);
      setGuardians(g);
      setStudentClass(c || null);
      setInvoices(inv);
      setIsLoading(false);
    }
    load();
  }, [studentId, router]);

  if (isLoading || !student) {
    return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'guardians', label: 'Guardians', count: guardians.length },
    { id: 'attendance', label: 'Attendance' },
    { id: 'results', label: 'Academic Results' },
    { id: 'fees', label: 'Fee Account', count: invoices.length },
    { id: 'history', label: 'Enrollment History' },
  ];

  const outstanding = invoices.reduce((sum, i) => sum + i.outstandingBalance, 0);

  return (
    <div>
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        description={`${student.admissionNumber} · ${studentClass?.name || 'No class'}`}
        breadcrumbs={[
          { label: 'Students', href: '/students' },
          { label: `${student.firstName} ${student.lastName}` },
        ]}
        actions={
          <Button variant="outline" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => router.push(`/students/${student.id}/edit`)}>
            Edit
          </Button>
        }
      />

      {/* Profile header */}
      <Card className="mb-6 p-6">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Avatar firstName={student.firstName} lastName={student.lastName} size="xl" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">
                {student.lastName} {student.firstName} {student.otherNames}
              </h2>
              <Badge variant="status" status={student.enrollmentStatus}>
                {getEnrollmentStatusLabel(student.enrollmentStatus)}
              </Badge>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 sm:grid-cols-4">
              <p><span className="font-medium text-gray-500">Student ID:</span> {student.studentId}</p>
              <p><span className="font-medium text-gray-500">Gender:</span> <span className="capitalize">{student.gender}</span></p>
              <p><span className="font-medium text-gray-500">Age:</span> {calculateAge(student.dateOfBirth)} years</p>
              <p><span className="font-medium text-gray-500">DOB:</span> {formatDate(student.dateOfBirth)}</p>
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
                ['Admission Number', student.admissionNumber],
                ['Place of Birth', student.placeOfBirth],
                ['District', student.district],
                ['District Capital', student.districtCapital],
                ['Region', student.region],
                ['Religion', student.religion || '—'],
                ['Residential Address', student.residentialAddress],
                ['Digital Address', student.digitalAddress || '—'],
                ['NHIS Number', student.nhisNumber || '—'],
                ['Languages', student.languagesSpoken.join(', ')],
                ['Mother Tongue', student.motherTongue || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-900">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Enrollment & Transport</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                <span className="text-gray-500">Admission Date</span>
                <span className="font-medium text-gray-900">{formatDate(student.admissionDate)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                <span className="text-gray-500">Current Class</span>
                <span className="font-medium text-gray-900">{studentClass?.name || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                <span className="text-gray-500">Transport</span>
                <span className="font-medium capitalize text-gray-900">
                  {student.transportArrangement.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                <span className="text-gray-500">Outstanding Balance</span>
                <span className={`font-medium ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(outstanding)}
                </span>
              </div>
              {student.emergencyNotes && (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  <p className="font-medium">Emergency Notes</p>
                  <p className="mt-1">{student.emergencyNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'guardians' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {guardians.map((g) => (
            <Card key={g.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{g.fullName}</p>
                    <p className="text-sm text-gray-500">{g.relationship}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {g.isPrimaryContact && <Badge>Primary</Badge>}
                  {g.isEmergencyContact && <Badge>Emergency</Badge>}
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4 text-gray-400" />
                  {g.phoneNumber}
                  {g.alternativePhone && ` / ${g.alternativePhone}`}
                </div>
                {g.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="h-4 w-4 text-gray-400" />
                    {g.email}
                  </div>
                )}
                {g.address && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    {g.address}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'attendance' && (
        <Card>
          <CardHeader><CardTitle>Attendance Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {['Present', 'Absent', 'Late', 'Total Days'].map((label) => (
                <div key={label} className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">—</p>
                  <p className="text-sm text-gray-500">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Attendance history will appear here once attendance records are entered.
            </p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'results' && (
        <Card>
          <CardHeader><CardTitle>Academic Results</CardTitle></CardHeader>
          <CardContent>
            <p className="py-8 text-center text-sm text-gray-500">
              Academic results will appear here once assessments are graded.
            </p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'fees' && (
        <Card>
          <CardHeader><CardTitle>Fee Account</CardTitle></CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No invoices on record.</p>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                    <div>
                      <p className="font-medium text-gray-900">{inv.invoiceNumber}</p>
                      <p className="text-sm text-gray-500">Due {formatDate(inv.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatCurrency(inv.totalAmount)}</p>
                      <p className="text-sm text-red-600">{formatCurrency(inv.outstandingBalance)} outstanding</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card>
          <CardHeader><CardTitle>Enrollment History</CardTitle></CardHeader>
          <CardContent>
            <p className="py-8 text-center text-sm text-gray-500">
              Enrollment history will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}