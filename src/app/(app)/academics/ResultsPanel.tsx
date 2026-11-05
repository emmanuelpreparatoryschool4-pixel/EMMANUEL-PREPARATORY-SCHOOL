'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, Save, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { calculateClassResults } from '@/lib/academic-results';
import { dataService } from '@/lib/db';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { AcademicYear, Assessment, AssessmentScore, AssessmentType, Class, ReportCard, Student, Subject, Term } from '@/types';

export function ResultsPanel() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [studentDirectory, setStudentDirectory] = useState<Student[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [scores, setScores] = useState<AssessmentScore[]>([]);
  const [classReportCards, setClassReportCards] = useState<ReportCard[]>([]);
  const [allReportCards, setAllReportCards] = useState<ReportCard[]>([]);
  const [gradingScale, setGradingScale] = useState<Awaited<ReturnType<typeof dataService.getDefaultGradingScale>>>();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [destinationClassId, setDestinationClassId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [resultsView, setResultsView] = useState<'entry' | 'register'>('entry');
  const [isLoading, setIsLoading] = useState(true);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isSavingScores, setIsSavingScores] = useState(false);
  const [isSavingReportStage, setIsSavingReportStage] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const selectedStudentIdRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      try {
        const [loadedClasses, years, loadedTerms, types, loadedSubjects, defaultScale, allStudents] = await Promise.all([
          dataService.getClasses(),
          dataService.getAcademicYears(),
          dataService.getTerms(),
          dataService.getAssessmentTypes(),
          dataService.getSubjects(),
          dataService.getDefaultGradingScale(),
          dataService.getStudents(),
        ]);
        if (cancelled) return;
        setClasses(loadedClasses);
        setStudentDirectory(allStudents);
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
        setAllReportCards([]);
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
        const classScores = await dataService.getAssessmentScoresForAssessments(
          matchingAssessments.map((assessment) => assessment.id)
        );
        if (cancelled) return;
        setStudents(classStudents);
        setAssessments(matchingAssessments);
        setScores(classScores);
        setAllReportCards(allReportCards);
        setClassReportCards(allReportCards.filter((card) =>
          card.classId === selectedClassId &&
          card.academicYearId === selectedYearId &&
          card.termId === selectedTermId
        ));
        setSelectedStudentIds([]);
        const nextStudentId = classStudents.some((student) => student.id === selectedStudentIdRef.current)
          ? selectedStudentIdRef.current
          : classStudents[0]?.id ?? '';
        selectedStudentIdRef.current = nextStudentId;
        setSelectedStudentId(nextStudentId);
        const savedForStudent = new Map(
          classScores.filter((score) => score.studentId === nextStudentId)
            .map((score) => [score.assessmentId, String(score.score)])
        );
        setScoreDrafts(Object.fromEntries(matchingAssessments.map((assessment) => [
          assessment.id,
          savedForStudent.get(assessment.id) ?? '',
        ])));
      } catch (error) {
        if (!cancelled) setLoadError(getErrorMessage(error, 'Could not load class results.'));
      }
    }
    void loadResults();
    return () => { cancelled = true; };
  }, [selectedClassId, selectedYearId, selectedTermId, refreshToken]);

  const selectStudent = (studentId: string) => {
    selectedStudentIdRef.current = studentId;
    setSelectedStudentId(studentId);
    const savedForStudent = new Map(
      scores.filter((score) => score.studentId === studentId)
        .map((score) => [score.assessmentId, String(score.score)])
    );
    setScoreDrafts(Object.fromEntries(assessments.map((assessment) => [
      assessment.id,
      savedForStudent.get(assessment.id) ?? '',
    ])));
  };

  const results = useMemo(() => calculateClassResults({
    students,
    schoolClass: classes.find((schoolClass) => schoolClass.id === selectedClassId),
    subjects,
    assessments,
    assessmentTypes,
    scores,
    gradingScale,
    reportCards: classReportCards,
  }), [assessmentTypes, assessments, classes, classReportCards, gradingScale, scores, selectedClassId, students, subjects]);

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
  const selectedStudentCard = classReportCards.find((card) => card.studentId === selectedStudentId);

  const saveStudentScores = async (status: 'draft' | 'submitted') => {
    if (!selectedStudentResult || !assessments.length) {
      addToast({ type: 'error', title: 'No assessments to save', message: 'Create assessments for this class before entering results.' });
      return;
    }
    if (selectedStudentCard?.status === 'published') {
      addToast({ type: 'error', title: 'Report card is published', message: 'An authorized administrator must reopen the report cards before scores can be changed.' });
      return;
    }
    const invalidScore = assessments.find((assessment) => {
      const rawValue = scoreDrafts[assessment.id] ?? '';
      if (rawValue.trim() === '') return false;
      const value = Number(rawValue);
      return !Number.isFinite(value) || value < 0 || value > assessment.maxScore;
    });
    if (invalidScore) {
      addToast({
        type: 'error',
        title: 'Check the entered scores',
        message: `${invalidScore.name} must be between zero and ${invalidScore.maxScore}.`,
      });
      return;
    }
    if (status === 'submitted') {
      const incompleteSubject = selectedStudentResult.subjects.find((subject) => {
        const weight = subject.components.reduce((sum, component) => sum + component.assessment.weight, 0);
        return !subject.components.length ||
          Math.abs(weight - 100) >= 0.01 ||
          subject.components.some((component) => (scoreDrafts[component.assessment.id] ?? '').trim() === '');
      });
      if (incompleteSubject) {
        addToast({
          type: 'error',
          title: 'Results are incomplete',
          message: `${incompleteSubject.subjectName} needs a score for every assessment and assessment weights totaling 100%.`,
        });
        return;
      }
    }
    setIsSavingScores(true);
    try {
      await dataService.saveStudentAssessmentScores(
        selectedStudentResult.student.id,
        assessments.map((assessment) => {
          const value = (scoreDrafts[assessment.id] ?? '').trim();
          return {
            assessmentId: assessment.id,
            score: value === '' ? null : Number(value),
          };
        }),
        status
      );
      addToast({
        type: 'success',
        title: status === 'draft' ? 'Scores saved as draft' : 'Results saved',
        message: `${selectedStudentResult.student.firstName}'s scores have been saved.`,
      });
      setRefreshToken((current) => current + 1);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not save scores',
        message: getErrorMessage(error, 'The results were not saved.'),
      });
    } finally {
      setIsSavingScores(false);
    }
  };

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
          if (finalScore === null || subject.components.some((component) => component.score === null)) {
            throw new Error(`${result.student.firstName} ${result.student.lastName} has incomplete subject scores.`);
          }
          const grade = gradingScale.grades.find((candidate) =>
            finalScore >= candidate.minScore && finalScore <= candidate.maxScore
          );
          if (!grade) throw new Error(`No grade is configured for a score of ${finalScore}.`);
          return {
            subjectId: subject.subjectId,
            subjectName: subject.subjectName,
            totalScore: finalScore,
            grade: grade.grade,
            remark: grade.remark,
            components: subject.components.map((component) => ({
              assessmentId: component.assessment.id,
              assessmentName: component.assessment.name,
              assessmentTypeName: component.assessmentTypeName,
              score: component.score as number,
              maxScore: component.assessment.maxScore,
              weight: component.assessment.weight,
              weightedScore: component.weightedScore ?? 0,
            })),
          };
        }),
        totalScore: result.total,
        averageScore: result.average ?? 0,
        overallGrade: result.grade ?? undefined,
        overallRemark: gradingScale.grades.find((candidate) =>
          result.average !== null &&
          result.average >= candidate.minScore &&
          result.average <= candidate.maxScore
        )?.remark,
        position: result.position ?? undefined,
        calculationSnapshot: {
          version: 1,
          rankingMethod: gradingScale.calculationRules?.rankingMethod ?? 'competition',
          capturedAt: new Date().toISOString(),
          gradingScaleId: gradingScale.id,
          gradingScale: { name: gradingScale.name, grades: gradingScale.grades },
        },
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
          <div className="flex items-end">
            <Button type="button" variant="outline" className="w-full" leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()} disabled={!results.length}>
              Print results
            </Button>
          </div>
        </CardContent>
      </Card>

      {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {classes.filter((schoolClass) => schoolClass.academicYearId === selectedYearId && schoolClass.status === 'active').map((schoolClass) => {
          const enrolled = studentDirectory.filter((student) =>
            student.currentClassId === schoolClass.id &&
            student.academicYearId === selectedYearId &&
            student.enrollmentStatus === 'active'
          ).length;
          const classCards = allReportCards.filter((card) =>
            card.classId === schoolClass.id && card.academicYearId === selectedYearId && card.termId === selectedTermId
          );
          const completed = classCards.filter((card) => card.status === 'published').length;
          const progress = enrolled ? Math.round((completed / enrolled) * 100) : 0;
          return (
            <button
              type="button"
              key={schoolClass.id}
              onClick={() => {
                setSelectedClassId(schoolClass.id);
                setResultsView('entry');
              }}
              className={`rounded-xl border p-4 text-left transition hover:border-primary-400 ${selectedClassId === schoolClass.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'}`}
            >
              <span className="block font-semibold text-gray-900">{className(classes, schoolClass.id)}</span>
              <span className="mt-1 block text-sm text-gray-500">{enrolled} students · {schoolClass.subjectIds?.length ?? 0} subjects</span>
              <span className="mt-2 block text-xs text-gray-500">Published results: {completed}/{enrolled} ({progress}%)</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={resultsView === 'entry' ? 'primary' : 'outline'} onClick={() => setResultsView('entry')}>Student score entry</Button>
        <Button size="sm" variant={resultsView === 'register' ? 'primary' : 'outline'} onClick={() => setResultsView('register')}>Class results register</Button>
      </div>

      {resultsView === 'entry' && (
        <Card>
          <CardHeader>
            <CardTitle>Students in {className(classes, selectedClassId)}</CardTitle>
            <label className="relative block w-full sm:max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input aria-label="Search students" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or admission number" className="min-h-11 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm" />
            </label>
          </CardHeader>
          <CardContent>
            {!visibleResults.length ? (
              <p className="py-6 text-center text-sm text-gray-500">No students match this search.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Student</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Admission number</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Results status</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Action</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleResults.map((result) => (
                      <tr key={result.student.id} className={selectedStudentId === result.student.id ? 'bg-primary-50' : ''}>
                        <td className="px-3 py-3 text-sm font-medium">{result.student.firstName} {result.student.otherNames ?? ''} {result.student.lastName}</td>
                        <td className="px-3 py-3 text-sm">{result.student.admissionNumber}</td>
                        <td className="px-3 py-3 text-sm">{result.isComplete
                          ? 'Complete'
                          : result.subjects.some((subject) => subject.components.some((component) => component.score !== null))
                            ? 'Draft or incomplete'
                            : 'Not started'}</td>
                        <td className="px-3 py-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => selectStudent(result.student.id)}>
                            Enter or edit results
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedStudentResult && resultsView === 'entry' && (
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
              <p className="py-6 text-center text-sm text-gray-500">Assign subjects to this class and create assessments before entering scores.</p>
            ) : (
              <div className="space-y-4">
                {selectedStudentCard?.status === 'published' && (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">This report card is published. An owner or headmaster must reopen it before scores can be edited.</p>
                )}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr>
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Subject</th>
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Assessment component</th>
                      <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Score / maximum</th>
                      <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Weight</th>
                      <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Weighted score</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedStudentResult.subjects.map((subject) => (
                        subject.components.length ? subject.components.map((component, index) => (
                          <tr key={component.assessment.id}>
                            <td className="px-3 py-3 text-sm font-medium text-gray-900">{index === 0 ? subject.subjectName : ''}</td>
                            <td className="px-3 py-3 text-sm">{component.assessment.name}<span className="ml-1 text-xs text-gray-500">· {component.assessmentTypeName}</span></td>
                            <td className="px-3 py-3 text-right">
                              <div className="inline-flex items-center gap-2">
                                <input
                                  aria-label={`${subject.subjectName} ${component.assessment.name} score`}
                                  type="number"
                                  min="0"
                                  max={component.assessment.maxScore}
                                  step="0.01"
                                  disabled={selectedStudentCard?.status === 'published'}
                                  value={scoreDrafts[component.assessment.id] ?? ''}
                                  onChange={(event) => setScoreDrafts((current) => ({ ...current, [component.assessment.id]: event.target.value }))}
                                  className="min-h-10 w-24 rounded-md border border-gray-300 px-2 text-right text-sm disabled:bg-gray-100"
                                />
                                <span className="text-sm text-gray-500">/ {component.assessment.maxScore}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right text-sm">{component.assessment.weight}%</td>
                            <td className="px-3 py-3 text-right text-sm">{component.weightedScore?.toFixed(2) ?? '—'}</td>
                          </tr>
                        )) : (
                          <tr key={subject.subjectId}>
                            <td className="px-3 py-3 text-sm font-medium">{subject.subjectName}</td>
                            <td colSpan={4} className="px-3 py-3 text-sm text-amber-700">No assessments have been created for this subject.</td>
                          </tr>
                        )
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      {selectedStudentResult.subjects.map((subject) => {
                        const weight = subject.components.reduce((sum, component) => sum + component.assessment.weight, 0);
                        return (
                          <tr key={subject.subjectId}>
                            <td colSpan={4} className="px-3 py-2 text-right text-sm font-medium">
                              {subject.subjectName} · {Math.round(weight * 100) / 100}% configured
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-semibold">{subject.totalScore?.toFixed(2) ?? 'Incomplete'}</td>
                          </tr>
                        );
                      })}
                      <tr>
                        <td colSpan={4} className="px-3 py-3 text-right text-sm font-semibold">Overall average</td>
                        <td className="px-3 py-3 text-right text-sm font-semibold">{selectedStudentResult.average?.toFixed(2) ?? 'Incomplete'}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    leftIcon={<Save className="h-4 w-4" />}
                    isLoading={isSavingScores}
                    disabled={selectedStudentCard?.status === 'published' || !assessments.length}
                    onClick={() => void saveStudentScores('draft')}
                  >
                    Save draft
                  </Button>
                  <Button
                    type="button"
                    leftIcon={<Save className="h-4 w-4" />}
                    isLoading={isSavingScores}
                    disabled={selectedStudentCard?.status === 'published' || !assessments.length}
                    onClick={() => void saveStudentScores('submitted')}
                  >
                    Save results
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {resultsView === 'register' && <Card>
        <CardHeader>
          <div>
            <CardTitle>Consolidated class results</CardTitle>
            <p className="mt-1 text-sm text-gray-500">Totals use each assessment’s configured contribution. Incomplete results are not ranked.</p>
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
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Grade</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Completion</th>
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
                          <button type="button" className="text-left font-medium text-primary-700 hover:underline print:text-black" onClick={() => {
                            selectStudent(result.student.id);
                            setResultsView('entry');
                          }}>
                            {result.student.lastName}, {result.student.firstName} {result.student.otherNames ?? ''}
                          </button>
                          <p className="text-xs text-gray-500">{result.student.admissionNumber}</p>
                        </td>
                        {resultSubjects.map(([subjectId]) => {
                          const subject = result.subjects.find((item) => item.subjectId === subjectId);
                          return (
                            <td key={subjectId} className="px-3 py-3 text-right text-sm">
                              {subject?.components.length ? (
                                <details className="text-left">
                                  <summary className="cursor-pointer text-right">{subject.totalScore?.toFixed(2) ?? 'Incomplete'}</summary>
                                  <div className="min-w-48 py-2 text-xs">
                                    <p className="font-semibold">Grade: {subject.grade ?? '—'}</p>
                                    {subject.components.map((component) => (
                                      <p key={component.assessment.id}>
                                        {component.assessment.name}: {component.score ?? '—'}/{component.assessment.maxScore} ({component.assessment.weight}%)
                                      </p>
                                    ))}
                                  </div>
                                </details>
                              ) : '—'}
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-right text-sm font-semibold">{result.average === null ? 'Incomplete' : result.total.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-sm">{result.average?.toFixed(2) ?? '—'}</td>
                        <td className="px-3 py-3 text-right text-sm">{result.grade ?? '—'}</td>
                        <td className="px-3 py-3 text-sm">{result.isComplete ? 'Complete' : 'Incomplete'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>}
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
