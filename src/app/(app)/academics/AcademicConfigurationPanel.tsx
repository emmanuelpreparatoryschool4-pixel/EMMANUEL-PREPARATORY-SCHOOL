'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/contexts/ToastContext';
import { dataService } from '@/lib/db';
import { getErrorMessage } from '@/lib/utils';
import { AcademicYear, Grade, GradingScale, Subject, Term } from '@/types';

interface PeriodForm {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

const EMPTY_PERIOD: PeriodForm = { id: '', name: '', startDate: '', endDate: '' };

function fetchAcademicConfiguration() {
  return Promise.all([
    dataService.getAcademicYears(),
    dataService.getTerms(),
    dataService.getDefaultGradingScale(),
    dataService.getSubjects(),
  ]);
}

export function AcademicConfigurationPanel() {
  const { addToast } = useToast();
  const notify = useCallback((message: string, type: 'success' | 'error') => {
    addToast({ type, title: message });
  }, [addToast]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [yearForm, setYearForm] = useState<PeriodForm>(EMPTY_PERIOD);
  const [termForm, setTermForm] = useState<PeriodForm>(EMPTY_PERIOD);
  const [gradingScale, setGradingScale] = useState<GradingScale>();
  const [gradingScaleName, setGradingScaleName] = useState('');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectForm, setSubjectForm] = useState({ id: '', name: '', code: '', description: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');

  const applyConfiguration = useCallback(([loadedYears, loadedTerms, loadedScale, loadedSubjects]: Awaited<ReturnType<typeof fetchAcademicConfiguration>>) => {
    setYears(loadedYears);
    setTerms(loadedTerms);
    setSubjects(loadedSubjects.sort((a, b) => a.name.localeCompare(b.name)));
    setGradingScale(loadedScale);
    setGradingScaleName(loadedScale?.name ?? '');
    setGrades(loadedScale?.grades.map((grade) => ({ ...grade })) ?? []);
    setSelectedYearId((current) =>
      loadedYears.some((year) => year.id === current)
        ? current
        : loadedYears.find((year) => year.isCurrent)?.id ?? loadedYears[0]?.id ?? ''
    );
  }, []);

  const reload = useCallback(async () => {
    applyConfiguration(await fetchAcademicConfiguration());
  }, [applyConfiguration]);

  useEffect(() => {
    let active = true;
    fetchAcademicConfiguration()
      .then((configuration) => {
        if (active) applyConfiguration(configuration);
      })
      .catch((error) => {
        if (active) notify(getErrorMessage(error, 'Could not load academic configuration.'), 'error');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [applyConfiguration, notify]);

  function editYear(year: AcademicYear) {
    setYearForm({ id: year.id, name: year.name, startDate: year.startDate, endDate: year.endDate });
    setSelectedYearId(year.id);
  }

  function editTerm(term: Term) {
    setTermForm({ id: term.id, name: term.name, startDate: term.startDate, endDate: term.endDate });
  }

  async function submitYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!yearForm.name.trim()) {
      notify('Enter an academic year name.', 'error');
      return;
    }
    if (yearForm.endDate < yearForm.startDate) {
      notify('The academic year end date must be on or after its start date.', 'error');
      return;
    }
    if (terms.some((term) => term.academicYearId === yearForm.id &&
      (term.startDate < yearForm.startDate || term.endDate > yearForm.endDate))) {
      notify('Academic year dates cannot exclude dates from its existing terms.', 'error');
      return;
    }
    setBusyAction('year-save');
    try {
      if (yearForm.id) {
        await dataService.updateAcademicYear(yearForm.id, {
          name: yearForm.name.trim(),
          startDate: yearForm.startDate,
          endDate: yearForm.endDate,
        });
      } else {
        await dataService.addAcademicYear({
          name: yearForm.name.trim(),
          startDate: yearForm.startDate,
          endDate: yearForm.endDate,
          isCurrent: false,
          status: 'active',
        });
      }
      setYearForm(EMPTY_PERIOD);
      await reload();
      notify(yearForm.id ? 'Academic year updated.' : 'Academic year created.', 'success');
    } catch (error) {
      notify(getErrorMessage(error, 'Could not save the academic year.'), 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function toggleYearCompletion(year: AcademicYear) {
    const nextStatus = year.status === 'archived' ? 'active' : 'archived';
    if (nextStatus === 'archived' && year.isCurrent) {
      notify('Select another active academic year before completing this one.', 'error');
      return;
    }
    if (nextStatus === 'archived' && terms.some((term) => term.academicYearId === year.id && term.status !== 'archived')) {
      notify('Complete all terms in this academic year before completing the year.', 'error');
      return;
    }
    setBusyAction(`year-${year.id}`);
    try {
      await dataService.updateAcademicYear(year.id, { status: nextStatus });
      await reload();
      notify(nextStatus === 'archived' ? 'Academic year marked complete.' : 'Academic year reopened.', 'success');
    } catch (error) {
      notify(getErrorMessage(error, 'Could not update the academic year.'), 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function activateYear(year: AcademicYear) {
    setBusyAction(`year-${year.id}`);
    try {
      await dataService.setCurrentAcademicYear(year.id);
      await reload();
      notify(`${year.name} is now the active academic year.`, 'success');
    } catch (error) {
      notify(getErrorMessage(error, 'Could not change the active academic year.'), 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function submitTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!termForm.name.trim()) {
      notify('Enter a term name.', 'error');
      return;
    }
    const selectedYear = years.find((year) => year.id === selectedYearId);
    if (!selectedYear) {
      notify('Create or select an academic year first.', 'error');
      return;
    }
    if (termForm.endDate < termForm.startDate) {
      notify('The term end date must be on or after its start date.', 'error');
      return;
    }
    if (termForm.startDate < selectedYear.startDate || termForm.endDate > selectedYear.endDate) {
      notify('Term dates must fall within the selected academic year.', 'error');
      return;
    }
    setBusyAction('term-save');
    try {
      if (termForm.id) {
        await dataService.updateTerm(termForm.id, {
          name: termForm.name.trim(),
          startDate: termForm.startDate,
          endDate: termForm.endDate,
        });
      } else {
        await dataService.addTerm({
          academicYearId: selectedYearId,
          name: termForm.name.trim(),
          startDate: termForm.startDate,
          endDate: termForm.endDate,
          isCurrent: false,
          status: 'active',
        });
      }
      setTermForm(EMPTY_PERIOD);
      await reload();
      notify(termForm.id ? 'Term updated.' : 'Term created.', 'success');
    } catch (error) {
      notify(getErrorMessage(error, 'Could not save the term.'), 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function toggleTermCompletion(term: Term) {
    const nextStatus = term.status === 'archived' ? 'active' : 'archived';
    if (nextStatus === 'archived' && term.isCurrent) {
      notify('Select another active term before completing this one.', 'error');
      return;
    }
    setBusyAction(`term-${term.id}`);
    try {
      await dataService.updateTerm(term.id, { status: nextStatus });
      await reload();
      notify(nextStatus === 'archived' ? 'Term marked complete.' : 'Term reopened.', 'success');
    } catch (error) {
      notify(getErrorMessage(error, 'Could not update the term.'), 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function activateTerm(term: Term) {
    setBusyAction(`term-${term.id}`);
    try {
      await dataService.setCurrentTerm(term.id);
      await reload();
      notify(`${term.name} is now the active term.`, 'success');
    } catch (error) {
      notify(getErrorMessage(error, 'Could not change the active term.'), 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function saveGrades(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gradingScaleName.trim() || !grades.length) {
      notify('Enter a grading scale name and add at least one grade.', 'error');
      return;
    }
    const ordered = [...grades].sort((a, b) => a.minScore - b.minScore);
    if (ordered.some((grade) => !grade.grade.trim() || !grade.remark.trim() ||
      grade.minScore < 0 || grade.maxScore > 100 || grade.minScore > grade.maxScore)) {
      notify('Grades need a label, remark, and valid score boundaries from 0 to 100.', 'error');
      return;
    }
    if (ordered.some((grade, index) => index > 0 && grade.minScore <= ordered[index - 1].maxScore)) {
      notify('Grade score ranges cannot overlap.', 'error');
      return;
    }
    if (new Set(ordered.map((grade) => grade.grade.trim().toLowerCase())).size !== ordered.length) {
      notify('Each grade label must be unique.', 'error');
      return;
    }
    setBusyAction('grades-save');
    try {
      if (gradingScale) {
        await dataService.updateGradingScale(gradingScale.id, { name: gradingScaleName.trim(), grades: ordered });
      } else {
        await dataService.addGradingScale(gradingScaleName.trim(), ordered);
      }
      await reload();
      notify('Grading boundaries saved.', 'success');
    } catch (error) {
      notify(getErrorMessage(error, 'Could not save grading boundaries.'), 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function submitSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subjectForm.name.trim() || !subjectForm.code.trim()) {
      notify('Enter a subject name and code.', 'error');
      return;
    }
    setBusyAction('subject-save');
    try {
      const details = {
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim().toUpperCase(),
        description: subjectForm.description.trim(),
      };
      if (subjectForm.id) {
        await dataService.updateSubject(subjectForm.id, details);
      } else {
        await dataService.addSubject({ ...details, status: 'active' });
      }
      setSubjectForm({ id: '', name: '', code: '', description: '' });
      await reload();
      notify(subjectForm.id ? 'Subject updated.' : 'Subject created.', 'success');
    } catch (error) {
      notify(getErrorMessage(error, 'Could not save the subject.'), 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function toggleSubject(subject: Subject) {
    const status = subject.status === 'active' ? 'archived' : 'active';
    setBusyAction(`subject-${subject.id}`);
    try {
      await dataService.updateSubject(subject.id, { status });
      await reload();
      notify(status === 'archived' ? 'Subject archived.' : 'Subject reactivated.', 'success');
    } catch (error) {
      notify(getErrorMessage(error, 'Could not update the subject.'), 'error');
    } finally {
      setBusyAction('');
    }
  }

  const yearTerms = terms.filter((term) => term.academicYearId === selectedYearId)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Academic years</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={submitYear} className="grid gap-3 md:grid-cols-4">
            <Input label="Academic year" required value={yearForm.name}
              onChange={(event) => setYearForm({ ...yearForm, name: event.target.value })} />
            <Input label="Start date" type="date" required value={yearForm.startDate}
              onChange={(event) => setYearForm({ ...yearForm, startDate: event.target.value })} />
            <Input label="End date" type="date" required value={yearForm.endDate}
              onChange={(event) => setYearForm({ ...yearForm, endDate: event.target.value })} />
            <div className="flex items-end gap-2">
              <Button type="submit" isLoading={busyAction === 'year-save'}>{yearForm.id ? 'Save year' : 'Add year'}</Button>
              {yearForm.id && <Button type="button" variant="outline" onClick={() => setYearForm(EMPTY_PERIOD)}>Cancel</Button>}
            </div>
          </form>
          <div className="space-y-2">
            {years.map((year) => (
              <div key={year.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium">{year.name} {year.isCurrent && <span className="text-primary-700">(Active)</span>}</p>
                  <p className="text-sm text-gray-500">{year.startDate} – {year.endDate} · {year.status === 'archived' ? 'Completed' : 'Open'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => editYear(year)}>Edit</Button>
                  {!year.isCurrent && <Button size="sm" variant="outline" isLoading={busyAction === `year-${year.id}`} onClick={() => void activateYear(year)}>Set active</Button>}
                  <Button size="sm" variant="outline" isLoading={busyAction === `year-${year.id}`} onClick={() => void toggleYearCompletion(year)}>
                    {year.status === 'archived' ? 'Reopen' : 'Mark complete'}
                  </Button>
                </div>
              </div>
            ))}
            {!years.length && <p className="text-sm text-gray-500">No academic years configured yet.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Terms</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="max-w-sm">
            <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="term-year">Academic year</label>
            <select id="term-year" className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
              value={selectedYearId} onChange={(event) => { setSelectedYearId(event.target.value); setTermForm(EMPTY_PERIOD); }}>
              <option value="">Select an academic year</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
          </div>
          <form onSubmit={submitTerm} className="grid gap-3 md:grid-cols-4">
            <Input label="Term name" required value={termForm.name}
              onChange={(event) => setTermForm({ ...termForm, name: event.target.value })} />
            <Input label="Start date" type="date" required value={termForm.startDate}
              onChange={(event) => setTermForm({ ...termForm, startDate: event.target.value })} />
            <Input label="End date" type="date" required value={termForm.endDate}
              onChange={(event) => setTermForm({ ...termForm, endDate: event.target.value })} />
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={!selectedYearId} isLoading={busyAction === 'term-save'}>{termForm.id ? 'Save term' : 'Add term'}</Button>
              {termForm.id && <Button type="button" variant="outline" onClick={() => setTermForm(EMPTY_PERIOD)}>Cancel</Button>}
            </div>
          </form>
          <div className="space-y-2">
            {yearTerms.map((term) => (
              <div key={term.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium">{term.name} {term.isCurrent && <span className="text-primary-700">(Active)</span>}</p>
                  <p className="text-sm text-gray-500">{term.startDate} – {term.endDate} · {term.status === 'archived' ? 'Completed' : 'Open'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => editTerm(term)}>Edit</Button>
                  {!term.isCurrent && <Button size="sm" variant="outline" isLoading={busyAction === `term-${term.id}`} onClick={() => void activateTerm(term)}>Set active</Button>}
                  <Button size="sm" variant="outline" isLoading={busyAction === `term-${term.id}`} onClick={() => void toggleTermCompletion(term)}>
                    {term.status === 'archived' ? 'Reopen' : 'Mark complete'}
                  </Button>
                </div>
              </div>
            ))}
            {selectedYearId && !yearTerms.length && <p className="text-sm text-gray-500">No terms configured for this year.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Grading boundaries</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveGrades} className="space-y-4">
              <Input label="Grading scale name" required value={gradingScaleName}
                onChange={(event) => setGradingScaleName(event.target.value)} />
              <p className="text-sm text-gray-500">Configure the score ranges used for grades and remarks. Ranges must not overlap.</p>
              <div className="space-y-3">
                {grades.map((grade, index) => (
                  <div key={`${grade.grade}-${index}`} className="grid gap-3 sm:grid-cols-5">
                    <Input label="Grade" required value={grade.grade}
                      onChange={(event) => setGrades(grades.map((item, current) => current === index ? { ...item, grade: event.target.value } : item))} />
                    <Input label="Minimum score" type="number" min="0" max="100" required value={grade.minScore}
                      onChange={(event) => setGrades(grades.map((item, current) => current === index ? { ...item, minScore: Number(event.target.value) } : item))} />
                    <Input label="Maximum score" type="number" min="0" max="100" required value={grade.maxScore}
                      onChange={(event) => setGrades(grades.map((item, current) => current === index ? { ...item, maxScore: Number(event.target.value) } : item))} />
                    <Input label="Performance remark" required value={grade.remark}
                      onChange={(event) => setGrades(grades.map((item, current) => current === index ? { ...item, remark: event.target.value } : item))} />
                    <div className="flex items-end">
                      <Button type="button" size="sm" variant="outline"
                        onClick={() => setGrades(grades.filter((_, current) => current !== index))}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setGrades([
                  ...grades,
                  { grade: '', minScore: 0, maxScore: 100, remark: '' },
                ])}>Add grade</Button>
              <Button type="submit" isLoading={busyAction === 'grades-save'}>Save grading scale</Button>
              </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Subjects</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={submitSubject} className="grid gap-3 md:grid-cols-4">
            <Input label="Subject name" required value={subjectForm.name}
              onChange={(event) => setSubjectForm({ ...subjectForm, name: event.target.value })} />
            <Input label="Subject code" required value={subjectForm.code}
              onChange={(event) => setSubjectForm({ ...subjectForm, code: event.target.value })} />
            <Input label="Description" value={subjectForm.description}
              onChange={(event) => setSubjectForm({ ...subjectForm, description: event.target.value })} />
            <div className="flex items-end gap-2">
              <Button type="submit" isLoading={busyAction === 'subject-save'}>{subjectForm.id ? 'Save subject' : 'Add subject'}</Button>
              {subjectForm.id && <Button type="button" variant="outline" onClick={() => setSubjectForm({ id: '', name: '', code: '', description: '' })}>Cancel</Button>}
            </div>
          </form>
          <div className="space-y-2">
            {subjects.map((subject) => (
              <div key={subject.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium">{subject.name} <span className="font-normal text-gray-500">({subject.code})</span></p>
                  <p className="text-sm text-gray-500">{subject.description || 'No description'} · {subject.status}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSubjectForm({
                    id: subject.id, name: subject.name, code: subject.code, description: subject.description ?? '',
                  })}>Edit</Button>
                  <Button size="sm" variant="outline" isLoading={busyAction === `subject-${subject.id}`} onClick={() => void toggleSubject(subject)}>
                    {subject.status === 'active' ? 'Archive' : 'Reactivate'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
