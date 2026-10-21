'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Plus, FileText, ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { dataService } from '@/lib/db';
import { Assessment, AssessmentType, Subject } from '@/types';
import { formatDate } from '@/lib/utils';

export default function AcademicsPage() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeTab, setActiveTab] = useState('assessments');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [a, at, s] = await Promise.all([
        dataService.getAssessments(),
        dataService.getAssessmentTypes(),
        dataService.getSubjects(),
      ]);
      setAssessments(a);
      setAssessmentTypes(at);
      setSubjects(s);
      setIsLoading(false);
    }
    load();
  }, []);

  const tabs = [
    { id: 'assessments', label: 'Assessments', count: assessments.length },
    { id: 'types', label: 'Assessment Types', count: assessmentTypes.length },
    { id: 'subjects', label: 'Subjects', count: subjects.length },
    { id: 'reports', label: 'Report Cards' },
  ];

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  const typeMap: Record<string, string> = {};
  assessmentTypes.forEach((t) => { typeMap[t.id] = t.name; });

  const subjectMap: Record<string, string> = {};
  subjects.forEach((s) => { subjectMap[s.id] = s.name; });

  return (
    <div>
      <PageHeader title="Academics & Results" description="Manage assessments, scores, and report cards"
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push('/academics/assessments/new')}>
            Create Assessment
          </Button>
        } />

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

      {activeTab === 'assessments' && (
        <Card>
          <CardHeader><CardTitle>Assessments</CardTitle></CardHeader>
          <CardContent>
            {assessments.length === 0 ? (
              <div className="py-12 text-center">
                <ClipboardList className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-900">No assessments created</p>
                <p className="mt-1 text-sm text-gray-500">Create an assessment to begin entering scores.</p>
                <Button className="mt-4" leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push('/academics/assessments/new')}>
                  Create Assessment
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {assessments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                    <div>
                      <p className="font-medium text-gray-900">{a.name}</p>
                      <p className="text-sm text-gray-500">
                        {typeMap[a.assessmentTypeId]} · {subjectMap[a.subjectId]} · Max: {a.maxScore}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">{formatDate(a.date)}</p>
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/academics/assessments/${a.id}/scores`)}>
                        Enter Scores
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'types' && (
        <Card>
          <CardHeader><CardTitle>Assessment Types</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assessmentTypes.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                  <div>
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <p className="text-sm text-gray-500">Default weight: {t.defaultWeight}% · Max score: {t.defaultMaxScore}</p>
                  </div>
                  <Badge variant="status" status={t.status}>{t.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'subjects' && (
        <Card>
          <CardHeader><CardTitle>Subjects</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((s) => (
                <div key={s.id} className="rounded-lg border border-gray-200 p-4">
                  <p className="font-medium text-gray-900">{s.name}</p>
                  <p className="text-sm text-gray-500">Code: {s.code}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'reports' && (
        <Card>
          <CardHeader><CardTitle>Report Cards</CardTitle></CardHeader>
          <CardContent>
            <div className="py-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-900">Report Cards</p>
              <p className="mt-1 text-sm text-gray-500">Generate report cards once scores are entered.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}