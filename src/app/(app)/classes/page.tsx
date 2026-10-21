'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, School, Users, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { dataService } from '@/lib/db';
import { Class, Student, Staff } from '@/types';

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [c, s, st] = await Promise.all([
        dataService.getClasses(),
        dataService.getStudents(),
        dataService.getStaff(),
      ]);
      setClasses(c);
      setStudents(s);
      setStaff(st);
      setIsLoading(false);
    }
    load();
  }, []);

  const staffMap: Record<string, string> = {};
  staff.forEach((s) => { staffMap[s.id] = `${s.firstName} ${s.lastName}`; });

  const classStats = classes.map((cls) => {
    const enrolled = students.filter((s) => s.currentClassId === cls.id && s.enrollmentStatus === 'active');
    const boys = enrolled.filter((s) => s.gender === 'male').length;
    const girls = enrolled.filter((s) => s.gender === 'female').length;
    const bus = enrolled.filter((s) => s.transportArrangement === 'school_bus').length;
    const walking = enrolled.filter((s) => s.transportArrangement === 'walking').length;
    const busBoys = enrolled.filter((s) => s.gender === 'male' && s.transportArrangement === 'school_bus').length;
    const busGirls = enrolled.filter((s) => s.gender === 'female' && s.transportArrangement === 'school_bus').length;
    const walkBoys = enrolled.filter((s) => s.gender === 'male' && s.transportArrangement === 'walking').length;
    const walkGirls = enrolled.filter((s) => s.gender === 'female' && s.transportArrangement === 'walking').length;

    return { cls, total: enrolled.length, boys, girls, bus, walking, busBoys, busGirls, walkBoys, walkGirls };
  });

  if (isLoading) return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-200" />)}</div>;

  return (
    <div>
      <PageHeader
        title="Classes & Enrollment"
        description={`${classes.length} classes configured`}
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push('/classes/new')}>Add Class</Button>}
      />

      {classes.length === 0 ? (
        <EmptyState icon={School} title="No classes configured" description="Add classes to start enrolling students." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classStats.map(({ cls, total, boys, girls, bus, walking }) => (
            <Card key={cls.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{cls.name}{cls.stream ? ` ${cls.stream}` : ''}</h3>
                  <p className="text-sm text-gray-500">
                    Teacher: {cls.classTeacherId ? staffMap[cls.classTeacherId] || '—' : 'Unassigned'}
                  </p>
                </div>
                <Badge variant="status" status={cls.status}>{cls.status}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-blue-50 p-3 text-center">
                  <p className="text-xl font-bold text-blue-700">{total}</p>
                  <p className="text-xs text-blue-600">Total Learners</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-xl font-bold text-gray-700">{cls.capacity}</p>
                  <p className="text-xs text-gray-500">Capacity</p>
                </div>
                <div className="rounded-lg bg-cyan-50 p-3 text-center">
                  <p className="text-lg font-bold text-cyan-700">{boys} / {girls}</p>
                  <p className="text-xs text-cyan-600">Boys / Girls</p>
                </div>
                <div className="rounded-lg bg-green-50 p-3 text-center">
                  <p className="text-lg font-bold text-green-700">{bus} / {walking}</p>
                  <p className="text-xs text-green-600">Bus / Walking</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                  <div className="bg-blue-500" style={{ width: `${(total / cls.capacity) * 100}%` }} />
                </div>
                <span className="ml-3 text-xs font-medium text-gray-500">{Math.round((total / cls.capacity) * 100)}%</span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => router.push(`/classes/${cls.id}`)}>View</Button>
                <Button variant="ghost" size="icon" onClick={() => router.push(`/classes/${cls.id}/edit`)}><Pencil className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}