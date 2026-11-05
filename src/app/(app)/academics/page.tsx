'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ClipboardList, Users, School as SchoolIcon, BookOpen, Printer, Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/contexts/ToastContext';
import { dataService } from '@/lib/db';
import { AcademicYear, Assessment, AssessmentType, Class, ReportCard, Student, Subject, Term } from '@/types';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { ResultsPanel } from './ResultsPanel';
import { AcademicConfigurationPanel } from './AcademicConfigurationPanel';
import { AssessmentTypesPanel } from './AssessmentTypesPanel';

export default function AcademicsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [assessmentForm, setAssessmentForm] = useState({ name: '', maxScore: '', weight: '', date: '' });
  const [canEditAssessmentCalculation, setCanEditAssessmentCalculation] = useState(true);
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [assessmentYearFilter, setAssessmentYearFilter] = useState('');
  const [assessmentTermFilter, setAssessmentTermFilter] = useState('');
  const [assessmentClassFilter, setAssessmentClassFilter] = useState('');
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
    { id: 'configuration', label: 'Academic Configuration' },
    { id: 'results', label: 'Class Results' },
  ];

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  const typeMap: Record<string, string> = {};
  assessmentTypes.forEach((t) => { typeMap[t.id] = t.name; });

  const subjectMap: Record<string, string> = {};
  subjects.forEach((s) => { subjectMap[s.id] = s.name; });
  const filteredAssessments = assessments.filter((assessment) =>
    (!assessmentYearFilter || assessment.academicYearId === assessmentYearFilter) &&
    (!assessmentTermFilter || assessment.termId === assessmentTermFilter) &&
    (!assessmentClassFilter || assessment.classId === assessmentClassFilter)
  );
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
  const currentAssessments = assessments.filter((assessment) =>
    assessment.academicYearId === currentYear?.id && assessment.termId === currentTerm?.id
  );
  const completedAssessments = currentAssessments.filter((assessment) => assessment.status === 'graded').length;
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

  const editAssessment = async (assessment: Assessment) => {
    try {
      const savedScores = await dataService.getAssessmentScores(assessment.id);
      const calculationLocked = savedScores.length > 0 || reportCards.some((card) =>
        card.classId === assessment.classId &&
        card.academicYearId === assessment.academicYearId &&
        card.termId === assessment.termId &&
        card.status === 'published'
      );
      if (calculationLocked) {
        addToast({
          type: 'error',
          title: 'Assessment calculation is locked',
          message: 'Maximum score and weight cannot be changed after scores are saved or report cards are published.',
        });
      }
      setCanEditAssessmentCalculation(!calculationLocked);
      setEditingAssessment(assessment);
      setAssessmentForm({
        name: assessment.name,
        maxScore: String(assessment.maxScore),
        weight: String(assessment.weight),
        date: assessment.date,
      });
    } catch (error) {
      addToast({ type: 'error', title: 'Could not open assessment', message: getErrorMessage(error, 'Assessment details are unavailable.') });
    }
  };

  const saveAssessment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingAssessment) return;
    const maxScore = Number(assessmentForm.maxScore);
    const weight = Number(assessmentForm.weight);
    if (!assessmentForm.name.trim() || !Number.isFinite(maxScore) || maxScore <= 0 ||
      !Number.isFinite(weight) || weight <= 0 || weight > 100 || !assessmentForm.date) {
      addToast({ type: 'error', title: 'Check the assessment details', message: 'Enter a name, positive maximum score, contribution from 0 to 100, and date.' });
      return;
    }
    setSavingAssessment(true);
    try {
      await dataService.updateAssessment(editingAssessment.id, {
        name: assessmentForm.name.trim(),
        date: assessmentForm.date,
        ...(canEditAssessmentCalculation ? { maxScore, weight } : {}),
      });
      const updated = await dataService.getAssessments();
      setAssessments(updated);
      setEditingAssessment(null);
      addToast({ type: 'success', title: 'Assessment updated' });
    } catch (error) {
      addToast({ type: 'error', title: 'Could not update assessment', message: getErrorMessage(error, 'The assessment was not changed.') });
    } finally {
      setSavingAssessment(false);
    }
  };

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
              ['Completed assessments', completedAssessments],
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
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push('/academics/assessments/new')}>Create assessment</Button>
            <Button variant="outline" leftIcon={<Printer className="h-4 w-4" />} onClick={() => setActiveTab('results')}>Class results</Button>
            <Button variant="outline" onClick={() => setActiveTab('configuration')}>Academic configuration</Button>
          </div>
        </div>
      )}

      {activeTab === 'assessments' && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Assessments</CardTitle>
              <p className="text-sm text-gray-500">Each assessment is linked to its class, subject, term, and configured contribution.</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-5 grid gap-3 md:grid-cols-3">
              <Select
                label="Academic year"
                options={[{ value: '', label: 'All academic years' }, ...academicYears.map((year) => ({ value: year.id, label: year.name }))]}
                value={assessmentYearFilter}
                onChange={(event) => {
                  setAssessmentYearFilter(event.target.value);
                  setAssessmentTermFilter('');
                  setAssessmentClassFilter('');
                }}
              />
              <Select
                label="Term"
                options={[{ value: '', label: 'All terms' }, ...terms
                  .filter((term) => !assessmentYearFilter || term.academicYearId === assessmentYearFilter)
                  .map((term) => ({ value: term.id, label: term.name }))]}
                value={assessmentTermFilter}
                onChange={(event) => setAssessmentTermFilter(event.target.value)}
              />
              <Select
                label="Class"
                options={[{ value: '', label: 'All classes' }, ...classes
                  .filter((schoolClass) => !assessmentYearFilter || schoolClass.academicYearId === assessmentYearFilter)
                  .map((schoolClass) => ({ value: schoolClass.id, label: `${schoolClass.name}${schoolClass.stream ? ` - ${schoolClass.stream}` : ''}` }))]}
                value={assessmentClassFilter}
                onChange={(event) => setAssessmentClassFilter(event.target.value)}
              />
            </div>
            {editingAssessment && (
              <form onSubmit={saveAssessment} className="mb-5 grid gap-3 rounded-lg border p-4 md:grid-cols-2 lg:grid-cols-5">
                <input aria-label="Assessment name" required value={assessmentForm.name} onChange={(event) => setAssessmentForm((current) => ({ ...current, name: event.target.value }))} className="min-h-11 rounded-md border px-3 text-sm" />
                <input aria-label="Maximum score" type="number" min="0.01" step="0.01" required disabled={!canEditAssessmentCalculation} value={assessmentForm.maxScore} onChange={(event) => setAssessmentForm((current) => ({ ...current, maxScore: event.target.value }))} className="min-h-11 rounded-md border px-3 text-sm disabled:bg-gray-100" />
                <input aria-label="Contribution percentage" type="number" min="0.01" max="100" step="0.01" required disabled={!canEditAssessmentCalculation} value={assessmentForm.weight} onChange={(event) => setAssessmentForm((current) => ({ ...current, weight: event.target.value }))} className="min-h-11 rounded-md border px-3 text-sm disabled:bg-gray-100" />
                <input aria-label="Assessment date" type="date" required value={assessmentForm.date} onChange={(event) => setAssessmentForm((current) => ({ ...current, date: event.target.value }))} className="min-h-11 rounded-md border px-3 text-sm" />
                <div className="flex gap-2">
                  <Button type="submit" isLoading={savingAssessment} leftIcon={<Save className="h-4 w-4" />}>Save</Button>
                  <Button type="button" variant="outline" onClick={() => setEditingAssessment(null)}>Cancel</Button>
                </div>
              </form>
            )}
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
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    {['Assessment', 'Year · Term', 'Class', 'Subject · Type', 'Maximum', 'Weight', 'Status', 'Actions'].map((heading) => (
                      <th key={heading} className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">{heading}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                {filteredAssessments.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-3 text-sm font-medium">{a.name}<p className="text-xs text-gray-500">{formatDate(a.date)}</p></td>
                    <td className="px-3 py-3 text-sm">{academicYears.find((year) => year.id === a.academicYearId)?.name ?? '—'} · {terms.find((term) => term.id === a.termId)?.name ?? '—'}</td>
                    <td className="px-3 py-3 text-sm">{classes.find((schoolClass) => schoolClass.id === a.classId)?.name ?? '—'}</td>
                    <td className="px-3 py-3 text-sm">{subjectMap[a.subjectId] ?? '—'} · {typeMap[a.assessmentTypeId] ?? '—'}</td>
                    <td className="px-3 py-3 text-sm">{a.maxScore}</td>
                    <td className="px-3 py-3 text-sm">{a.weight}%</td>
                    <td className="px-3 py-3"><Badge variant="status" status={a.status}>{a.status}</Badge></td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => void editAssessment(a)}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/academics/assessments/${a.id}/scores`)}>Assessment scores</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                    {!filteredAssessments.length && (
                      <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">No assessments match these filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'types' && <AssessmentTypesPanel />}

      {activeTab === 'results' && (
        <ResultsPanel />
      )}

      {activeTab === 'configuration' && (
        <AcademicConfigurationPanel />
      )}
    </div>
  );
}