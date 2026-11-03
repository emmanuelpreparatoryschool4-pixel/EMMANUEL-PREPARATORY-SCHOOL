'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ClipboardList, Users, School as SchoolIcon, BookOpen, Printer } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { dataService } from '@/lib/db';
import { AcademicYear, Assessment, AssessmentType, Class, ReportCard, Student, Subject, Term } from '@/types';
import { formatDate } from '@/lib/utils';
import { ResultsPanel } from './ResultsPanel';
import { AcademicConfigurationPanel } from './AcademicConfigurationPanel';

export default function AcademicsPage() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [a, at, s, c, enrolledStudents, years, loadedTerms, cards] = await Promise.all([
        dataService.getAssessments(),
        dataService.getAssessmentTypes(),
        dataService.getSubjects(),
        dataService.getClasses(),
        dataService.getStudents(),
        dataService.getAcademicYears(),
        dataService.getTerms(),
        dataService.getReportCards(),
      ]);
      setAssessments(a);
      setAssessmentTypes(at);
      setSubjects(s);
      setClasses(c);
      setStudents(enrolledStudents);
      setAcademicYears(years);
      setTerms(loadedTerms);
      setReportCards(cards);
      setIsLoading(false);
    }
    load();
  }, []);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'assessments', label: 'Assessments', count: assessments.length },
    { id: 'types', label: 'Assessment Types', count: assessmentTypes.length },
    { id: 'subjects', label: 'Subjects', count: subjects.length },
    { id: 'configuration', label: 'Academic Configuration' },
    { id: 'reports', label: 'Class Results' },
  ];

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  const typeMap: Record<string, string> = {};
  assessmentTypes.forEach((t) => { typeMap[t.id] = t.name; });

  const subjectMap: Record<string, string> = {};
  subjects.forEach((s) => { subjectMap[s.id] = s.name; });
  const currentYear = academicYears.find((year) => year.isCurrent) ?? academicYears[0];
  const currentTerm = terms.find((term) => term.isCurrent && term.academicYearId === currentYear?.id) ??
    terms.find((term) => term.academicYearId === currentYear?.id);
  const currentClasses = classes.filter((schoolClass) => schoolClass.academicYearId === currentYear?.id && schoolClass.status === 'active');
  const currentStudents = students.filter((student) =>
    student.academicYearId === currentYear?.id && student.enrollmentStatus === 'active'
  );
  const currentReportCards = reportCards.filter((card) =>
    card.academicYearId === currentYear?.id && card.termId === currentTerm?.id
  );
  const publishedCount = currentReportCards.filter((card) => card.status === 'published').length;
  const reviewCount = currentReportCards.filter((card) => card.status === 'ready_for_review').length;
  const completeCount = new Set(currentReportCards.map((card) => card.studentId)).size;
  const classPerformance = currentClasses.map((schoolClass) => {
    const classStudents = currentStudents.filter((student) => student.currentClassId === schoolClass.id);
    const classCards = currentReportCards.filter((card) => card.classId === schoolClass.id);
    const publishedCards = classCards.filter((card) => card.status === 'published');
    const topper = publishedCards.find((card) => card.position === 1);
    const topperStudent = topper ? students.find((student) => student.id === topper.studentId) : undefined;
    return {
      schoolClass,
      enrolled: classStudents.length,
      subjectsCount: schoolClass.subjectIds?.length ?? 0,
      completed: classCards.length,
      completionPercent: classStudents.length ? Math.round((classCards.length / classStudents.length) * 100) : 0,
      average: publishedCards.length
        ? publishedCards.reduce((sum, card) => sum + card.averageScore, 0) / publishedCards.length
        : null,
      topper: topperStudent ? `${topperStudent.firstName} ${topperStudent.lastName}` : '—',
      publication: publishedCards.length === classStudents.length && classStudents.length > 0
        ? 'Published'
        : classCards.some((card) => card.status === 'ready_for_review')
          ? 'Ready for review'
          : classCards.length
            ? 'Draft'
            : 'Not started',
    };
  });

  return (
    <div>
      <PageHeader title="Academics & Results" description="Manage assessments, scores, and report cards"
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push('/academics/assessments/new')}>
            Create Assessment
          </Button>
        } />

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6 print:hidden" />

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Enrolled students', value: currentStudents.length, icon: Users },
              { label: 'Active classes', value: currentClasses.length, icon: SchoolIcon },
              { label: 'Subjects', value: subjects.length, icon: BookOpen },
              { label: 'Current academic period', value: `${currentYear?.name ?? 'Not set'} · ${currentTerm?.name ?? 'Term not set'}`, icon: ClipboardList },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="p-5">
                <div className="flex items-start gap-3">
                  <Icon className="h-5 w-5 text-primary-600" />
                  <div><p className="text-sm text-gray-500">{label}</p><p className="mt-1 text-xl font-bold text-gray-900">{value}</p></div>
                </div>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Complete report cards', completeCount],
              ['Incomplete results', Math.max(0, currentStudents.length - completeCount)],
              ['Awaiting publication', reviewCount],
              ['Published report cards', publishedCount],
            ].map(([label, count]) => (
              <Card key={label} className="p-5">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{count}</p>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Class performance overview</CardTitle>
              <p className="text-sm text-gray-500">{currentYear?.name ?? 'Current year'} · {currentTerm?.name ?? 'Current term'}</p>
            </CardHeader>
            <CardContent>
              {classPerformance.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr>
                      {['Class', 'Students', 'Subjects', 'Completion', 'Class average', 'Top student', 'Publication'].map((heading) => (
                        <th key={heading} className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">{heading}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {classPerformance.map((item) => (
                        <tr key={item.schoolClass.id}>
                          <td className="px-3 py-3 text-sm font-medium">{item.schoolClass.name}</td>
                          <td className="px-3 py-3 text-sm">{item.enrolled}</td>
                          <td className="px-3 py-3 text-sm">{item.subjectsCount}</td>
                          <td className="px-3 py-3 text-sm">{item.completed}/{item.enrolled} ({item.completionPercent}%)</td>
                          <td className="px-3 py-3 text-sm">{item.average === null ? '—' : `${item.average.toFixed(2)}%`}</td>
                          <td className="px-3 py-3 text-sm">{item.topper}</td>
                          <td className="px-3 py-3 text-sm">{item.publication}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-gray-500">No active classes are configured for the current academic year.</p>
              )}
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-3">
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push('/academics/assessments/new')}>Results entry</Button>
            <Button variant="outline" leftIcon={<Printer className="h-4 w-4" />} onClick={() => setActiveTab('reports')}>Class results</Button>
            <Button variant="outline" onClick={() => setActiveTab('configuration')}>Academic configuration</Button>
          </div>
        </div>
      )}

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
        <ResultsPanel />
      )}

      {activeTab === 'configuration' && (
        <AcademicConfigurationPanel />
      )}
    </div>
  );
}