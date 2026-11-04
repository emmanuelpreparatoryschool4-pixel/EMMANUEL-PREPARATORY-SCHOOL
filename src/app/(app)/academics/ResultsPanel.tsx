'use client';

import { useEffect, useMemo, useState } from 'react';
import { Printer, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { dataService } from '@/lib/db';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { AcademicYear, Assessment, AssessmentScore, AssessmentType, Class, ReportCard, Student, Subject, Term } from '@/types';

interface StudentSubjectResult {
  subjectId: string;
  subjectName: string;
  classScore: number | null;
  examScore: number | null;
  totalScore: number | null;
}

interface StudentResult {
  student: Student;
  subjects: StudentSubjectResult[];
  total: number;
  average: number | null;
  position: number | null;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function ResultsPanel() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [scores, setScores] = useState<AssessmentScore[]>([]);
  const [classReportCards, setClassReportCards] = useState<ReportCard[]>([]);
  const [gradingScale, setGradingScale] = useState<Awaited<ReturnType<typeof dataService.getDefaultGradingScale>>>();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [destinationClassId, setDestinationClassId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isSavingReportStage, setIsSavingReportStage] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      try {
        const [loadedClasses, years, loadedTerms, types, loadedSubjects, defaultScale] = await Promise.all([
          dataService.getClasses(),
          dataService.getAcademicYears(),
          dataService.getTerms(),
          dataService.getAssessmentTypes(),
          dataService.getSubjects(),
          dataService.getDefaultGradingScale(),
        ]);
        if (cancelled) return;
        setClasses(loadedClasses);
        setAcademicYears(years);
        setTerms(loadedTerms);
        setAssessmentTypes(types);
        setSubjects(loadedSubjects);
        setGradingScale(defaultScale);

        const currentYear = years.find((year) => year.isCurrent) ?? years[0];
        const currentTerm = loadedTerms.find((term) => term.isCurrent) ??
          loadedTerms.find((term) => term.academicYearId === currentYear?.id);
        setSelectedYearId(currentYear?.id ?? '');
        setSelectedTermId(currentTerm?.id ?? '');
        setSelectedClassId(loadedClasses.find((schoolClass) => schoolClass.academicYearId === currentYear?.id)?.id ?? loadedClasses[0]?.id ?? '');
      } catch (error) {
        if (!cancelled) setLoadError(getErrorMessage(error, 'Could not load results options.'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadOptions();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadResults() {
      if (!selectedClassId || !selectedYearId || !selectedTermId) {
        setStudents([]);
        setAssessments([]);
        setScores([]);
        setClassReportCards([]);
        return;
      }
      setLoadError('');
      try {
      const [classStudents, allAssessments, allReportCards] = await Promise.all([
        dataService.getStudentsForClassTerm(selectedClassId, selectedYearId, selectedTermId),
        dataService.getAssessments(),
        dataService.getReportCards(),
      ]);
        const matchingAssessments = allAssessments.filter((assessment) =>
          assessment.classId === selectedClassId &&
          assessment.academicYearId === selectedYearId &&
          assessment.termId === selectedTermId
        );
        const scoreGroups = await Promise.all(
          matchingAssessments.map((assessment) => dataService.getAssessmentScores(assessment.id))
        );
        if (cancelled) return;
        setStudents(classStudents);
        setAssessments(matchingAssessments);
        setScores(scoreGroups.flat());
        setClassReportCards(allReportCards.filter((card) =>
          card.classId === selectedClassId &&
          card.academicYearId === selectedYearId &&
          card.termId === selectedTermId
        ));
        setSelectedStudentIds([]);
        setSelectedStudentId((current) => classStudents.some((student) => student.id === current)
          ? current
          : classStudents[0]?.id ?? '');
      } catch (error) {
        if (!cancelled) setLoadError(getErrorMessage(error, 'Could not load class results.'));
      }
    }
    void loadResults();
    return () => { cancelled = true; };
  }, [selectedClassId, selectedYearId, selectedTermId, refreshToken]);

  const results = useMemo(() => {
    const typeNames = new Map(assessmentTypes.map((type) => [type.id, type.name.toLowerCase()]));
    const subjectNames = new Map(subjects.map((subject) => [subject.id, subject.name]));
    const scoresByAssessmentStudent = new Map<string, number>();
    for (const score of scores) scoresByAssessmentStudent.set(`${score.assessmentId}:${score.studentId}`, score.score);

    const classSubjectIds = classes.find((schoolClass) => schoolClass.id === selectedClassId)?.subjectIds ?? [];
    const subjectIds = classSubjectIds.length
      ? classSubjectIds
      : [...new Set(assessments.map((assessment) => assessment.subjectId))];
    const rows = students.map((student): StudentResult => {
      const subjectResults = subjectIds.map((subjectId): StudentSubjectResult => {
        const subjectAssessments = assessments.filter((assessment) => assessment.subjectId === subjectId);
        const classMarks: number[] = [];
        const examMarks: number[] = [];
        for (const assessment of subjectAssessments) {
          const score = scoresByAssessmentStudent.get(`${assessment.id}:${student.id}`);
          if (score === undefined) continue;
          const percentage = Math.max(0, Math.min(100, (score / assessment.maxScore) * 100));
          const typeName = typeNames.get(assessment.assessmentTypeId) ?? '';
          if (typeName.includes('exam')) examMarks.push(percentage);
          else classMarks.push(percentage);
        }

        const classScore = classMarks.length
          ? roundScore((classMarks.reduce((sum, mark) => sum + mark, 0) / classMarks.length) * 0.3)
          : null;
        const examScore = examMarks.length
          ? roundScore((examMarks.reduce((sum, mark) => sum + mark, 0) / examMarks.length) * 0.7)
          : null;
        return {
          subjectId,
          subjectName: subjectNames.get(subjectId) ?? 'Subject',
          classScore,
          examScore,
          totalScore: classScore !== null && examScore !== null ? roundScore(classScore + examScore) : null,
        };
      });
      const completeResults = subjectResults.filter((subject) => subject.totalScore !== null);
      const isComplete = subjectResults.length > 0 && completeResults.length === subjectResults.length;
      const total = roundScore(completeResults.reduce((sum, subject) => sum + (subject.totalScore ?? 0), 0));
      return {
        student,
        subjects: subjectResults,
        total,
        average: isComplete ? roundScore(total / subjectResults.length) : null,
        position: null,
      };
    });

    const ranked = rows
      .filter((row) => row.average !== null)
      .sort((left, right) => (right.total - left.total) ||
        `${left.student.lastName} ${left.student.firstName}`.localeCompare(`${right.student.lastName} ${right.student.firstName}`));
    let lastTotal: number | null = null;
    let position = 0;
    for (let index = 0; index < ranked.length; index += 1) {
      const row = ranked[index];
      if (row.total !== lastTotal) position = index + 1;
      row.position = position;
      lastTotal = row.total;
    }
    return rows.sort((left, right) =>
      (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER) ||
      `${left.student.lastName} ${left.student.firstName}`.localeCompare(`${right.student.lastName} ${right.student.firstName}`)
    );
  }, [assessmentTypes, assessments, classes, scores, selectedClassId, students, subjects]);

  const resultSubjects = [...new Map(
    results.flatMap((result) => result.subjects.map((subject) => [subject.subjectId, subject.subjectName] as const))
  )];
  const selectedStudentResult = results.find((result) => result.student.id === selectedStudentId);
  const visibleResults = results.filter((result) =>
    `${result.student.firstName} ${result.student.otherNames ?? ''} ${result.student.lastName} ${result.student.admissionNumber}`
      .toLowerCase().includes(search.toLowerCase())
  );
  const availableTerms = terms.filter((term) => term.academicYearId === selectedYearId);
  const canPromote = user?.role === 'owner' || user?.role === 'headmaster';
  const sourceYear = academicYears.find((year) => year.id === selectedYearId);
  const sourceTerm = terms.find((term) => term.id === selectedTermId);
  const finalTerm = terms
    .filter((term) => term.academicYearId === selectedYearId)
    .sort((left, right) => right.endDate.localeCompare(left.endDate))[0];
  const promotionAllowed = Boolean(
    canPromote &&
    sourceYear?.status === 'archived' &&
    sourceTerm?.status === 'archived' &&
    sourceTerm.id === finalTerm?.id
  );
  const nextAcademicYear = sourceYear
    ? academicYears
      .filter((year) => year.startDate > sourceYear.endDate)
      .sort((left, right) => left.startDate.localeCompare(right.startDate))[0]
    : undefined;
  const sourceClass = classes.find((schoolClass) => schoolClass.id === selectedClassId);
  const destinationClasses = promotionAllowed && nextAcademicYear
    ? classes.filter((schoolClass) =>
      schoolClass.academicYearId === nextAcademicYear.id &&
      schoolClass.status === 'active' &&
      schoolClass.order >= (sourceClass?.order ?? 0)
    )
    : [];
  const allResultsComplete = results.length > 0 && results.every((result) => result.average !== null);
  const publishedReportCount = classReportCards.filter((card) => card.status === 'published').length;
  const readyReportCount = classReportCards.filter((card) => card.status === 'ready_for_review').length;
  const reportWorkflowLabel = publishedReportCount === students.length && students.length > 0
    ? 'Published'
    : publishedReportCount > 0
      ? 'Partially published'
      : readyReportCount > 0
      ? 'Ready for review'
      : classReportCards.length > 0
        ? 'Draft'
        : 'Not started';

  const saveReportStage = async (status: ReportCard['status']) => {
    if (!allResultsComplete) {
      addToast({
        type: 'error',
        title: 'Results are incomplete',
        message: 'Enter assessment and examination scores for every student and assigned subject before preparing report cards.',
      });
      return;
    }
    if (!gradingScale) {
      addToast({ type: 'error', title: 'Grading scale unavailable', message: 'Configure a default grading scale before publishing results.' });
      return;
    }
    if (publishedReportCount > 0 && status !== 'published' &&
      !window.confirm('Reopen published report cards for correction? This changes the current report-card status.')) return;
    if (status === 'published' && !window.confirm('Publish the completed report cards for this class, year, and term?')) return;

    setIsSavingReportStage(true);
    try {
      const selectedTerm = terms.find((term) => term.id === selectedTermId);
      const attendanceRows = selectedTerm
        ? await dataService.getAttendanceRecords({
          classId: selectedClassId,
          startDate: selectedTerm.startDate,
          endDate: selectedTerm.endDate,
        })
        : [];
      const cards = results.map((result) => ({
        studentId: result.student.id,
        classId: selectedClassId,
        termId: selectedTermId,
        academicYearId: selectedYearId,
        subjects: result.subjects.map((subject) => {
          const finalScore = subject.totalScore;
          if (finalScore === null || subject.classScore === null || subject.examScore === null) {
            throw new Error(`${result.student.firstName} ${result.student.lastName} has incomplete subject scores.`);
          }
          const grade = gradingScale.grades.find((candidate) =>
            finalScore >= candidate.minScore && finalScore <= candidate.maxScore
          );
          if (!grade) throw new Error(`No grade is configured for a score of ${finalScore}.`);
          return {
            subjectId: subject.subjectId,
            subjectName: subject.subjectName,
            classScore: subject.classScore,
            examScore: subject.examScore,
            totalScore: finalScore,
            grade: grade.grade,
            remark: grade.remark,
          };
        }),
        totalScore: result.total,
        averageScore: result.average ?? 0,
        position: result.position ?? undefined,
        attendancePresent: attendanceRows.filter((record) =>
          record.studentId === result.student.id && record.status === 'present'
        ).length,
        attendanceTotal: attendanceRows.filter((record) => record.studentId === result.student.id).length,
        status,
      }));
      await dataService.saveReportCards(cards);
      setClassReportCards((await dataService.getReportCards()).filter((card) =>
        card.classId === selectedClassId &&
        card.academicYearId === selectedYearId &&
        card.termId === selectedTermId
      ));

      if (user) {
        try {
          await dataService.addActivityLog({
            userId: user.id,
            userName: user.name,
            action: status === 'published' ? 'Published report cards' : `Marked report cards ${status.replace(/_/g, ' ')}`,
            entityType: 'report_cards',
            entityId: selectedClassId,
            details: `${className(classes, selectedClassId)} · ${termName(terms, selectedTermId)} · ${students.length} student(s)`,
            timestamp: new Date().toISOString(),
          });
        } catch (auditError) {
          addToast({
            type: 'warning',
            title: 'Results saved, but the activity log failed',
            message: getErrorMessage(auditError, 'Could not record the report-card action in activity history.'),
          });
        }
      }

      addToast({
        type: 'success',
        title: status === 'published' ? 'Results published' : 'Report-card status updated',
        message: `${students.length} report card(s) saved as ${status.replace(/_/g, ' ')}.`,
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not update report cards',
        message: getErrorMessage(error, 'Report cards were not saved.'),
      });
    } finally {
      setIsSavingReportStage(false);
    }
  };

  const promoteSelectedStudents = async () => {
    if (!promotionAllowed) {
      addToast({
        type: 'error',
        title: 'Promotion is not available',
        message: 'Complete and archive the academic year and its final term before promoting students.',
      });
      return;
    }
    if (!selectedStudentIds.length || !destinationClassId || !selectedTermId) {
      addToast({ type: 'error', title: 'Select students and a destination class' });
      return;
    }
    setIsPromoting(true);
    try {
      await dataService.promoteStudents({
        studentIds: selectedStudentIds,
        sourceClassId: selectedClassId,
        destinationClassId,
        termId: selectedTermId,
        enrollmentDate: nextAcademicYear?.startDate ?? new Date().toISOString().split('T')[0],
      });
      addToast({ type: 'success', title: 'Students promoted', message: `${selectedStudentIds.length} student(s) were moved to the selected class.` });
      setSelectedStudentIds([]);
      setRefreshToken((current) => current + 1);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not promote students',
        message: getErrorMessage(error, 'The promotion was not completed.'),
      });
    } finally {
      setIsPromoting(false);
    }
  };

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  if (loadError && classes.length === 0) {
    return <Card><CardContent className="py-8 text-sm text-red-700">{loadError}</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Card className="print:hidden">
        <CardHeader><CardTitle>Find class results</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Academic year"
            options={academicYears.map((year) => ({ value: year.id, label: year.name }))}
            value={selectedYearId}
            onChange={(event) => {
              const yearId = event.target.value;
              setSelectedYearId(yearId);
              setSelectedTermId(terms.find((term) => term.academicYearId === yearId)?.id ?? '');
              setSelectedClassId(classes.find((schoolClass) => schoolClass.academicYearId === yearId)?.id ?? '');
            }}
          />
          <Select
            label="Term"
            options={availableTerms.map((term) => ({ value: term.id, label: term.name }))}
            value={selectedTermId}
            onChange={(event) => setSelectedTermId(event.target.value)}
          />
          <Select
            label="Class"
            options={classes.filter((schoolClass) => schoolClass.academicYearId === selectedYearId)
              .map((schoolClass) => ({ value: schoolClass.id, label: schoolClass.stream ? `${schoolClass.name} - ${schoolClass.stream}` : schoolClass.name }))}
            value={selectedClassId}
            onChange={(event) => setSelectedClassId(event.target.value)}
          />
          <Select
            label="Student result"
            options={students.map((student) => ({
              value: student.id,
              label: `${student.lastName}, ${student.firstName} (${student.admissionNumber})`,
            }))}
            value={selectedStudentId}
            onChange={(event) => setSelectedStudentId(event.target.value)}
          />
          <div className="flex items-end">
            <Button type="button" variant="outline" className="w-full" leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()} disabled={!results.length}>
              Print results
            </Button>
          </div>
        </CardContent>
      </Card>

      {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}

      {selectedStudentResult && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{selectedStudentResult.student.firstName} {selectedStudentResult.student.otherNames ? `${selectedStudentResult.student.otherNames} ` : ''}{selectedStudentResult.student.lastName}</CardTitle>
              <p className="mt-1 text-sm text-gray-500">
                {className(classes, selectedClassId)} · {termName(terms, selectedTermId)} · {selectedStudentResult.student.admissionNumber}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-gray-500">Class position</p>
              <p className="text-xl font-bold text-primary-700">
                {selectedStudentResult.position ? `${selectedStudentResult.position} / ${results.filter((result) => result.position !== null).length}` : 'Pending'}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {selectedStudentResult.subjects.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">No class-score or examination assessments have been set up for this term.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Subject</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Class score / 30</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Exam / 70</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Final / 100</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedStudentResult.subjects.map((subject) => (
                      <tr key={subject.subjectId}>
                        <td className="px-3 py-3 text-sm font-medium text-gray-900">{subject.subjectName}</td>
                        <td className="px-3 py-3 text-right text-sm">{subject.classScore?.toFixed(2) ?? 'Pending'}</td>
                        <td className="px-3 py-3 text-right text-sm">{subject.examScore?.toFixed(2) ?? 'Pending'}</td>
                        <td className="px-3 py-3 text-right text-sm font-semibold">{subject.totalScore?.toFixed(2) ?? 'Pending'}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-3 py-3 text-sm">Overall</td>
                      <td colSpan={2} className="px-3 py-3 text-right text-sm">Total across {selectedStudentResult.subjects.length} subject(s)</td>
                      <td className="px-3 py-3 text-right text-sm">
                        {selectedStudentResult.average === null ? 'Pending' : `${selectedStudentResult.total.toFixed(2)} (${selectedStudentResult.average.toFixed(2)} avg)`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Class ranking</CardTitle>
            <p className="mt-1 text-sm text-gray-500">Students are ranked only after class and exam marks are entered for every assessed subject.</p>
          </div>
          <span className="text-sm text-gray-500">{results.length} active students</span>
        </CardHeader>
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 print:hidden">
          <div className="text-sm">
            <span className="text-gray-500">Report-card workflow: </span>
            <span className="font-semibold text-gray-900">{reportWorkflowLabel}</span>
            <span className="ml-2 text-gray-500">
              {publishedReportCount} published · {readyReportCount} ready for review · {results.filter((result) => result.average === null).length} incomplete
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              isLoading={isSavingReportStage}
              disabled={!allResultsComplete}
              onClick={() => void saveReportStage('draft')}
            >
              Save drafts
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              isLoading={isSavingReportStage}
              disabled={!allResultsComplete}
              onClick={() => void saveReportStage('ready_for_review')}
            >
              Ready for review
            </Button>
            {canPromote && (
              <Button
                type="button"
                size="sm"
                isLoading={isSavingReportStage}
                disabled={!allResultsComplete || readyReportCount !== students.length}
                onClick={() => void saveReportStage('published')}
              >
                Publish results
              </Button>
            )}
          </div>
        </div>
        <CardContent>
          {!results.length ? (
            <p className="py-8 text-center text-sm text-gray-500">No active students or assessments found for this class and term.</p>
          ) : (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
                <label className="relative block w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input aria-label="Search students" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students" className="min-h-11 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm" />
                </label>
                {canPromote && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select
                      aria-label="Destination class"
                      options={destinationClasses.map((schoolClass) => ({
                        value: schoolClass.id,
                        label: `${schoolClass.name}${schoolClass.stream ? ` - ${schoolClass.stream}` : ''} (${academicYears.find((year) => year.id === schoolClass.academicYearId)?.name ?? 'year'})`,
                      }))}
                      value={destinationClassId}
                      onChange={(event) => setDestinationClassId(event.target.value)}
                      className="sm:min-w-64"
                    />
                    <Button
                      type="button"
                      leftIcon={<Users className="h-4 w-4" />}
                      isLoading={isPromoting}
                      disabled={!selectedStudentIds.length || !destinationClassId}
                      onClick={promoteSelectedStudents}
                    >
                      Promote ({selectedStudentIds.length})
                    </Button>
                  </div>
                )}
              </div>
              {canPromote && !promotionAllowed && (
                <p className="mb-3 text-sm text-amber-700 print:hidden">
                  Promotion unlocks after this academic year and its final term are marked completed.
                </p>
              )}
              {canPromote && promotionAllowed && destinationClasses.length === 0 && (
                <p className="mb-3 text-sm text-amber-700 print:hidden">Create the next academic year and its class progression before promoting students.</p>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    {canPromote && <th className="px-3 py-3 print:hidden"><span className="sr-only">Select</span></th>}
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Position</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Student</th>
                    {resultSubjects.map(([subjectId, subjectName]) => (
                      <th key={subjectId} className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">{subjectName}</th>
                    ))}
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Total</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Average</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {visibleResults.map((result) => (
                      <tr key={result.student.id} className={result.student.id === selectedStudentId ? 'bg-primary-50' : ''}>
                        {canPromote && (
                          <td className="px-3 py-3 print:hidden">
                            <input
                              type="checkbox"
                              aria-label={`Select ${result.student.firstName} ${result.student.lastName} for promotion`}
                              checked={selectedStudentIds.includes(result.student.id)}
                              onChange={(event) => setSelectedStudentIds((current) =>
                                event.target.checked
                                  ? [...current, result.student.id]
                                  : current.filter((studentId) => studentId !== result.student.id)
                              )}
                            />
                          </td>
                        )}
                        <td className="px-3 py-3 text-sm font-semibold">{result.position ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm">
                          <button type="button" className="text-left font-medium text-primary-700 hover:underline print:text-black" onClick={() => setSelectedStudentId(result.student.id)}>
                            {result.student.lastName}, {result.student.firstName} {result.student.otherNames ?? ''}
                          </button>
                          <p className="text-xs text-gray-500">{result.student.admissionNumber}</p>
                        </td>
                        {resultSubjects.map(([subjectId]) => {
                          const subject = result.subjects.find((item) => item.subjectId === subjectId);
                          return <td key={subjectId} className="px-3 py-3 text-right text-sm">{subject?.totalScore?.toFixed(2) ?? '—'}</td>;
                        })}
                        <td className="px-3 py-3 text-right text-sm font-semibold">{result.average === null ? 'Incomplete' : result.total.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-sm">{result.average?.toFixed(2) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-gray-500 print:block">
        Results for {className(classes, selectedClassId)} · {termName(terms, selectedTermId)} · Printed {formatDate(new Date().toISOString())}
      </p>
    </div>
  );
}

function className(classes: Class[], classId: string): string {
  const selectedClass = classes.find((schoolClass) => schoolClass.id === classId);
  return selectedClass ? `${selectedClass.name}${selectedClass.stream ? ` ${selectedClass.stream}` : ''}` : 'Class';
}

function termName(terms: Term[], termId: string): string {
  return terms.find((term) => term.id === termId)?.name ?? 'Term';
}
