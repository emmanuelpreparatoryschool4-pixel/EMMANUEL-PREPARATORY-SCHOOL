'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Avatar } from '@/components/ui/Avatar';
import { dataService } from '@/lib/db';
import { Class, Student, Staff, TableColumn } from '@/types';

export default function ClassDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;
  const [cls, setCls] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [teacher, setTeacher] = useState<Staff | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const c = await dataService.getClass(classId);
      if (!c) { router.push('/classes'); return; }
      setCls(c);
      const [s, t] = await Promise.all([
        dataService.getStudents({ classId }),
        c.classTeacherId ? dataService.getStaffMember(c.classTeacherId) : Promise.resolve(null),
      ]);
      setStudents(s);
      setTeacher(t || null);
      setIsLoading(false);
    }
    load();
  }, [classId, router]);

  if (isLoading || !cls) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  const columns: TableColumn<Student>[] = [
    { key: 'name', header: 'Student', render: (s) => (
      <div className="flex items-center gap-3">
        <Avatar firstName={s.firstName} lastName={s.lastName} size="sm" />
        <div><p className="font-medium text-gray-900">{s.lastName} {s.firstName}</p><p className="text-xs text-gray-500">{s.admissionNumber}</p></div>
      </div>
    )},
    { key: 'gender', header: 'Gender', render: (s) => <span className="capitalize">{s.gender}</span> },
    { key: 'transportArrangement', header: 'Transport', render: (s) => <span className="capitalize">{s.transportArrangement.replace('_', ' ')}</span> },
  ];

  return (
    <div>
      <PageHeader title={`${cls.name}${cls.stream ? ` ${cls.stream}` : ''}`} description={`${students.length} students enrolled`}
        breadcrumbs={[{ label: 'Classes', href: '/classes' }, { label: cls.name }]}
        actions={<Button variant="outline" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => router.push(`/classes/${cls.id}/edit`)}>Edit</Button>} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-gray-500">Class Teacher</p><p className="mt-1 font-semibold text-gray-900">{teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unassigned'}</p></Card>
        <Card className="p-5"><p className="text-sm text-gray-500">Capacity</p><p className="mt-1 font-semibold text-gray-900">{students.length} / {cls.capacity}</p></Card>
        <Card className="p-5"><p className="text-sm text-gray-500">Location</p><p className="mt-1 font-semibold text-gray-900">{cls.location || '—'}</p></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Student Roster</CardTitle></CardHeader>
        <CardContent>
          <Table columns={columns} data={students} keyExtractor={(s) => s.id} onRowClick={(s) => router.push(`/students/${s.id}`)}
            emptyMessage="No students in this class" />
        </CardContent>
      </Card>
    </div>
  );
}