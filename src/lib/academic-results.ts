import type {
  AcademicCalculationRules,
  Assessment,
  AssessmentScore,
  AssessmentType,
  Class,
  GradingScale,
  ReportCard,
  Student,
  Subject,
} from '@/types';

export interface AssessmentComponentResult {
  assessment: Assessment;
  assessmentTypeName: string;
  score: number | null;
  isSubmitted: boolean;
  weightedScore: number | null;
}

export interface SubjectResult {
  subjectId: string;
  subjectName: string;
  components: AssessmentComponentResult[];
  totalScore: number | null;
  grade: string | null;
  isComplete: boolean;
}

export interface StudentClassResult {
  student: Student;
  subjects: SubjectResult[];
  total: number;
  average: number | null;
  grade: string | null;
  position: number | null;
  isComplete: boolean;
}

const roundScore = (value: number) => Math.round(value * 100) / 100;

export function calculateClassResults({
  students,
  schoolClass,
  subjects,
  assessments,
  assessmentTypes,
  scores,
  gradingScale,
  reportCards = [],
}: {
  students: Student[];
  schoolClass?: Class;
  subjects: Subject[];
  assessments: Assessment[];
  assessmentTypes: AssessmentType[];
  scores: AssessmentScore[];
  gradingScale?: GradingScale;
  reportCards?: ReportCard[];
}): StudentClassResult[] {
  const subjectNames = new Map(subjects.map((subject) => [subject.id, subject.name]));
  const typeNames = new Map(assessmentTypes.map((type) => [type.id, type.name]));
  const scoresByKey = new Map(scores.map((score) => [`${score.assessmentId}:${score.studentId}`, score]));
  const publishedCards = new Map(
    reportCards.filter((card) => card.status === 'published').map((card) => [card.studentId, card])
  );
  const assignedSubjectIds = schoolClass?.subjectIds?.length
    ? schoolClass.subjectIds
    : [...new Set(assessments.map((assessment) => assessment.subjectId))];

  const results = students.map((student): StudentClassResult => {
    const subjectResults = assignedSubjectIds.map((subjectId): SubjectResult => {
      const subjectAssessments = assessments.filter((assessment) => assessment.subjectId === subjectId);
      const totalWeight = subjectAssessments.reduce((sum, assessment) => sum + assessment.weight, 0);
      const validWeighting = subjectAssessments.length > 0 && Math.abs(totalWeight - 100) < 0.01;
      const components = subjectAssessments.map((assessment): AssessmentComponentResult => {
        const scoreRecord = scoresByKey.get(`${assessment.id}:${student.id}`);
        const score = scoreRecord?.score ?? null;
        const weightedScore = score === null || !validWeighting
          ? null
          : roundScore((score / assessment.maxScore) * assessment.weight);
        return {
          assessment,
          assessmentTypeName: typeNames.get(assessment.assessmentTypeId) ?? 'Assessment',
          score,
          isSubmitted: scoreRecord?.status === 'submitted',
          weightedScore,
        };
      });
      const isComplete = validWeighting && components.every((component) => component.score !== null && component.isSubmitted);
      return {
        subjectId,
        subjectName: subjectNames.get(subjectId) ?? 'Subject',
        components,
        totalScore: isComplete
          ? roundScore(components.reduce((sum, component) => sum + (component.weightedScore ?? 0), 0))
          : null,
        grade: isComplete
          ? gradingScale?.grades.find((grade) => {
            const total = roundScore(components.reduce((sum, component) => sum + (component.weightedScore ?? 0), 0));
            return total >= grade.minScore && total <= grade.maxScore;
          })?.grade ?? null
          : null,
        isComplete,
      };
    });

    const isComplete = subjectResults.length > 0 && subjectResults.every((subject) => subject.isComplete);
    const total = subjectResults.reduce((sum, subject) => sum + (subject.totalScore ?? 0), 0);
    const average = isComplete ? roundScore(total / subjectResults.length) : null;
    const currentGrade = average === null
      ? null
      : gradingScale?.grades.find((item) => average >= item.minScore && average <= item.maxScore)?.grade ?? null;
    const baseResult: StudentClassResult = {
      student,
      subjects: subjectResults,
      total: roundScore(total),
      average,
      grade: currentGrade,
      position: null,
      isComplete,
    };
    const savedCard = publishedCards.get(student.id);
    if (!savedCard) return baseResult;

    const savedGrades = savedCard.calculationSnapshot?.gradingScale?.grades ?? gradingScale?.grades ?? [];
    const savedSubjects = savedCard.subjects.map((savedSubject): SubjectResult => ({
      subjectId: savedSubject.subjectId,
      subjectName: savedSubject.subjectName,
      totalScore: savedSubject.totalScore,
      grade: savedSubject.grade,
      isComplete: true,
      components: (savedSubject.components ?? []).map((component) => {
        const assessment = assessments.find((item) => item.id === component.assessmentId) ?? {
          id: component.assessmentId,
          name: component.assessmentName,
          assessmentTypeId: '',
          classId: savedCard.classId,
          subjectId: savedSubject.subjectId,
          termId: savedCard.termId,
          academicYearId: savedCard.academicYearId,
          maxScore: component.maxScore,
          weight: component.weight,
          date: '',
          status: 'closed' as const,
          createdAt: savedCard.createdAt,
          updatedAt: savedCard.updatedAt,
        };
        return {
          assessment,
          assessmentTypeName: component.assessmentTypeName,
          score: component.score,
          isSubmitted: true,
          weightedScore: component.weightedScore,
        };
      }),
    }));
    const savedAverage = savedCard.averageScore;
    return {
      student,
      subjects: savedSubjects.length ? savedSubjects : subjectResults,
      total: savedCard.totalScore,
      average: savedAverage,
      grade: savedCard.overallGrade ??
        savedGrades.find((item) => savedAverage >= item.minScore && savedAverage <= item.maxScore)?.grade ?? null,
      position: savedCard.position ?? null,
      isComplete: savedSubjects.length > 0,
    };
  });

  const ranked = results
    .filter((result) => result.average !== null)
    .sort((left, right) =>
      (right.average ?? 0) - (left.average ?? 0) ||
      left.student.lastName.localeCompare(right.student.lastName) ||
      left.student.firstName.localeCompare(right.student.firstName)
    );
  const rankingMethod: AcademicCalculationRules['rankingMethod'] =
    gradingScale?.calculationRules?.rankingMethod ?? 'competition';
  let priorAverage: number | null = null;
  let priorPosition = 0;
  ranked.forEach((result, index) => {
    const tied = rankingMethod !== 'ordinal' && priorAverage !== null && result.average === priorAverage;
    const position = tied
      ? priorPosition
      : rankingMethod === 'dense'
        ? priorPosition + 1
        : index + 1;
    if (!publishedCards.has(result.student.id)) result.position = position;
    priorAverage = result.average;
    priorPosition = position;
  });

  return results;
}
