'use client';

import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';

export function SchoolResetPanel() {
  const { addToast } = useToast();
  const [confirmation, setConfirmation] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (confirmation !== 'RESET') return;
    if (!window.confirm('This permanently deletes school records, including students, staff, academics, fees, inventory, and activity history. User accounts and school settings will remain. Continue?')) return;
    if (!window.confirm('Final confirmation: permanently delete all school records now? This action cannot be undone.')) return;

    if (!supabase) {
      addToast({ type: 'error', title: 'Supabase is not configured' });
      return;
    }

    setIsResetting(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error('Your session has expired. Sign in again.');

      const response = await fetch('/api/school/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ confirmation }),
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to reset school data.');

      setConfirmation('');
      addToast({ type: 'success', title: 'School data reset', message: result.message });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not reset school data',
        message: error instanceof Error ? error.message : 'Unable to reset school data.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card className="mt-6 border-red-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-gray-700">
          Resetting permanently deletes student, staff, academic, attendance, fee, inventory, and activity records.
          School user accounts and school information/settings are preserved.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Input
            label="Type RESET to enable the reset"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            type="button"
            variant="danger"
            isLoading={isResetting}
            disabled={confirmation !== 'RESET'}
            leftIcon={<Trash2 className="h-4 w-4" />}
            onClick={() => void handleReset()}
          >
            Reset All School Data
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
