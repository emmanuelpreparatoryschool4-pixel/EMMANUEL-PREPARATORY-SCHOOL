'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/contexts/ToastContext';
import { dataService } from '@/lib/db';
import { getErrorMessage } from '@/lib/utils';
import type { AssessmentType } from '@/types';

const EMPTY_FORM = { id: '', name: '', description: '', defaultWeight: '0', defaultMaxScore: '100' };

export function AssessmentTypesPanel() {
  const { addToast } = useToast();
  const [types, setTypes] = useState<AssessmentType[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');

  async function reload() {
    setTypes((await dataService.getAssessmentTypes()).sort((left, right) => left.name.localeCompare(right.name)));
  }

  useEffect(() => {
    let active = true;
    async function loadTypes() {
      try {
        const loadedTypes = await dataService.getAssessmentTypes();
        if (active) setTypes(loadedTypes.sort((left, right) => left.name.localeCompare(right.name)));
      } catch (error) {
        if (active) addToast({
          type: 'error',
          title: 'Could not load assessment types',
          message: getErrorMessage(error, 'Assessment types are unavailable.'),
        });
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadTypes();
    return () => { active = false; };
  }, [addToast]);

  async function saveType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const weight = Number(form.defaultWeight);
    const maxScore = Number(form.defaultMaxScore);
    if (!form.name.trim() || !Number.isFinite(weight) || weight < 0 || weight > 100 ||
      !Number.isFinite(maxScore) || maxScore <= 0) {
      addToast({
        type: 'error',
        title: 'Check the assessment type',
        message: 'Enter a name, a default weight from 0 to 100, and a maximum score greater than zero.',
      });
      return;
    }

    setBusyAction('save');
    try {
      const details = {
        name: form.name.trim(),
        description: form.description.trim(),
        defaultWeight: weight,
        defaultMaxScore: maxScore,
      };
      if (form.id) await dataService.updateAssessmentType(form.id, details);
      else await dataService.addAssessmentType({ ...details, status: 'active' });
      await reload();
      setForm(EMPTY_FORM);
      addToast({ type: 'success', title: form.id ? 'Assessment type updated' : 'Assessment type created' });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not save assessment type',
        message: getErrorMessage(error, 'Check that the name is not already in use.'),
      });
    } finally {
      setBusyAction('');
    }
  }

  async function toggleType(type: AssessmentType) {
    setBusyAction(type.id);
    try {
      await dataService.updateAssessmentType(type.id, {
        status: type.status === 'active' ? 'archived' : 'active',
      });
      await reload();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not update assessment type',
        message: getErrorMessage(error, 'The assessment type status was not changed.'),
      });
    } finally {
      setBusyAction('');
    }
  }

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-gray-200" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{form.id ? 'Edit assessment type' : 'Add assessment type'}</CardTitle>
          <p className="text-sm text-gray-500">Default values are copied to new assessments. Existing assessment weights and results remain unchanged.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveType} className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Input label="Assessment type name" required value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            <Input label="Description" value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            <Input label="Default contribution (%)" type="number" min="0" max="100" step="0.01" required value={form.defaultWeight}
              onChange={(event) => setForm((current) => ({ ...current, defaultWeight: event.target.value }))} />
            <Input label="Default maximum score" type="number" min="0.01" step="0.01" required value={form.defaultMaxScore}
              onChange={(event) => setForm((current) => ({ ...current, defaultMaxScore: event.target.value }))} />
            <div className="flex gap-2 md:col-span-2 lg:col-span-4">
              <Button type="submit" isLoading={busyAction === 'save'}>{form.id ? 'Save changes' : 'Add assessment type'}</Button>
              {form.id && <Button type="button" variant="outline" onClick={() => setForm(EMPTY_FORM)}>Cancel</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Configured assessment types</CardTitle></CardHeader>
        <CardContent>
          {!types.length ? (
            <p className="py-6 text-center text-sm text-gray-500">No assessment types have been configured.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50"><tr>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Default contribution</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Default maximum</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {types.map((type) => (
                    <tr key={type.id}>
                      <td className="px-3 py-3 text-sm font-medium">{type.name}</td>
                      <td className="px-3 py-3 text-sm">{type.defaultWeight}%</td>
                      <td className="px-3 py-3 text-sm">{type.defaultMaxScore}</td>
                      <td className="px-3 py-3 text-sm capitalize">{type.status}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setForm({
                            id: type.id,
                            name: type.name,
                            description: type.description ?? '',
                            defaultWeight: String(type.defaultWeight),
                            defaultMaxScore: String(type.defaultMaxScore),
                          })}>Edit</Button>
                          <Button size="sm" variant="outline" isLoading={busyAction === type.id} onClick={() => void toggleType(type)}>
                            {type.status === 'active' ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
