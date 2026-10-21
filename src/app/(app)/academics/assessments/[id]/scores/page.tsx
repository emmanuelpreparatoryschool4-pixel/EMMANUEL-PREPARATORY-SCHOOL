'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { dataService } from '@/lib/db';
import { Assessment, Student } from '@/types';

export default function AssessmentScoresPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();
	const { addToast } = useToast();
	const [assessment, setAssessment] = useState<Assessment | null>(null);
	const [students, setStudents] = useState<Student[]>([]);
	const [scores, setScores] = useState<Record<string, string>>({});
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [loadError, setLoadError] = useState('');

	useEffect(() => {
		let cancelled = false;

		async function loadAssessment() {
			try {
				const result = await dataService.getAssessment(id);
				if (!result) {
					if (!cancelled) setLoadError('This assessment could not be found.');
					return;
				}

				const [classStudents, savedScores] = await Promise.all([
					dataService.getStudents({
						classId: result.classId,
						academicYearId: result.academicYearId,
						enrollmentStatus: 'active',
					}),
					dataService.getAssessmentScores(id),
				]);

				if (cancelled) return;
				const savedByStudent = new Map(savedScores.map((score) => [score.studentId, score.score]));
				setAssessment(result);
				setStudents(classStudents);
				setScores(
					Object.fromEntries(
						classStudents.map((student) => {
							const score = savedByStudent.get(student.id);
							return [student.id, score === undefined ? '' : String(score)];
						})
					)
				);
			} catch {
				if (!cancelled) setLoadError('Failed to load this assessment.');
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		}

		void loadAssessment();
		return () => {
			cancelled = true;
		};
	}, [id]);

	const handleSave = async () => {
		if (!assessment) return;

		const entries: Array<{ studentId: string; score: number | null }> = [];
		for (const student of students) {
			const value = scores[student.id]?.trim() ?? '';
			if (!value) {
				entries.push({ studentId: student.id, score: null });
				continue;
			}

			const score = Number(value);
			if (!Number.isFinite(score) || score < 0 || score > assessment.maxScore) {
				addToast({
					type: 'error',
					title: 'Check the scores',
					message: `Scores must be between 0 and ${assessment.maxScore}.`,
				});
				return;
			}
			entries.push({ studentId: student.id, score });
		}

		setIsSaving(true);
		try {
			await dataService.saveAssessmentScores(id, entries);
			const savedScores = await dataService.getAssessmentScores(id);
			setAssessment((current) =>
				current
					? {
							...current,
							status: entries.length > 0 && entries.every((entry) => entry.score !== null) ? 'graded' : 'open',
						}
					: current
			);
			setScores(
				Object.fromEntries(savedScores.map((score) => [score.studentId, String(score.score)]))
			);
			addToast({ type: 'success', title: 'Scores saved' });
		} catch {
			addToast({ type: 'error', title: 'Error', message: 'Failed to save assessment scores.' });
		} finally {
			setIsSaving(false);
		}
	};

	const enteredCount = students.filter((student) => scores[student.id]?.trim()).length;

	if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

	return (
		<div>
			<PageHeader
				title={assessment ? `Scores: ${assessment.name}` : 'Assessment Scores'}
				breadcrumbs={[
					{ label: 'Academics', href: '/academics' },
					{ label: 'Assessment Scores' },
				]}
				actions={
					<Button
						variant="outline"
						leftIcon={<ArrowLeft className="h-4 w-4" />}
						onClick={() => router.push('/academics')}
					>
						Back to Academics
					</Button>
				}
			/>

			{loadError || !assessment ? (
				<Card>
					<CardContent className="py-10 text-center text-sm text-gray-600">
						{loadError || 'This assessment could not be found.'}
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardHeader>
						<div>
							<CardTitle>{assessment.name}</CardTitle>
							<p className="mt-1 text-sm text-gray-500">
								Maximum score: {assessment.maxScore} · {enteredCount} of {students.length} scores entered
							</p>
						</div>
						<Button
							onClick={handleSave}
							isLoading={isSaving}
							disabled={students.length === 0}
							leftIcon={<Save className="h-4 w-4" />}
						>
							Save Scores
						</Button>
					</CardHeader>
					<CardContent>
						{students.length === 0 ? (
							<p className="py-8 text-center text-sm text-gray-500">
								No active students are enrolled in this assessment&apos;s class and academic year.
							</p>
						) : (
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-gray-200">
									<thead className="bg-gray-50">
										<tr>
											<th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Student</th>
											<th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Admission number</th>
											<th className="w-40 px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Score</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-200 bg-white">
										{students.map((student) => (
											<tr key={student.id}>
												<td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
													{student.firstName} {student.otherNames ? `${student.otherNames} ` : ''}{student.lastName}
												</td>
												<td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
													{student.admissionNumber}
												</td>
												<td className="px-4 py-3">
													<input
														aria-label={`Score for ${student.firstName} ${student.lastName}`}
														type="number"
														min="0"
														max={assessment.maxScore}
														step="any"
														value={scores[student.id] ?? ''}
														onChange={(event) =>
															setScores((current) => ({ ...current, [student.id]: event.target.value }))
														}
														className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
													/>
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
		</div>
	);
}
