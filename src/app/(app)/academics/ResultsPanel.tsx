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
import { AcademicYear, Assessment, AssessmentScore, AssessmentType, Class, Student, Subject, Term } from '@/types';

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
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [destinationClassId, setDestinationClassId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPromoting, setIsPromoting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      try {
        const [loadedClasses, years, loadedTerms, types, loadedSubjects] = await Promise.all([
          dataService.getClasses(),
          dataService.getAcademicYears(),
          dataService.getTerms(),
          dataService.getAssessmentTypes(),
          dataService.getSubjects(),
        ]);
        if (cancelled) return;
        setClasses(loadedClasses);
        setAcademicYears(years);
        setTerms(loadedTerms);
        setAssessmentTypes(types);
        setSubjects(loadedSubjects);

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
        return;
      }
      setLoadError('');
      try {
      const [classStudents, allAssessments] = await Promise.all([
        dataService.getStudentsForClassTerm(selectedClassId, selectedYearId, selectedTermId),
        dataService.getAssessments(),
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

    const subjectIds = [...new Set(assessments.map((assessment) => assessment.subjectId))];
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
  }, [assessmentTypes, assessments, scores, students, subjects]);

  const resultSubjects = [...new Map(
    results.flatMap((result) => result.subjects.map((subject) => [subject.subjectId, subject.subjectName] as const))
  )];
  const selectedStudentResult = results.find((result) => result.student.id === selectedStudentId);
  const visibleResults = results.filter((result) =>
    `${result.student.firstName} ${result.student.otherNames ?? ''} ${result.student.lastName} ${result.student.admissionNumber}`
      .toLowerCase().includes(search.toLowerCase())
  );
  const availableTerms = terms.filter((term) => term.academicYearId === selectedYearId);
  const destinationClasses = classes.filter((schoolClass) =>
    schoolClass.id !== selectedClassId && schoolClass.status === 'active'
  );
  const canPromote = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'headmaster';

  const promoteSelectedStudents = async () => {
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
        enrollmentDate: new Date().toISOString().split('T')[0],
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
              {canPromote && destinationClasses.length === 0 && (
                <p className="mb-3 text-sm text-amber-700 print:hidden">Create the next academic year&apos;s class before promoting students.</p>
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
