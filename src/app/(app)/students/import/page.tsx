'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, FileText, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';

export default function StudentImportPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!validTypes.includes(f.type) && !f.name.endsWith('.csv')) {
      addToast({ type: 'error', title: 'Invalid file', message: 'Please upload a CSV file.' });
      return;
    }
    setFile(f);
  };

  const handleImport = () => {
    addToast({
      type: 'info',
      title: 'Import Queued',
      message: 'CSV import requires backend processing. Frontend validation complete.',
    });
  };

  return (
    <div>
      <PageHeader
        title="Import Students"
        description="Bulk import student records from a CSV file"
        breadcrumbs={[{ label: 'Students', href: '/students' }, { label: 'Import' }]}
        actions={
          <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>
            Back
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Upload CSV File</CardTitle></CardHeader>
            <CardContent>
              <div
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
                  isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
              >
                <Upload className="h-10 w-10 text-gray-400" />
                <p className="mt-3 text-sm font-medium text-gray-900">
                  Drag and drop your CSV file here
                </p>
                <p className="mt-1 text-sm text-gray-500">or</p>
                <Button variant="outline" className="mt-3" onClick={() => inputRef.current?.click()}>
                  Browse Files
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>

              {file && (
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">{file.name}</p>
                    <p className="text-xs text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setFile(null)}>Remove</Button>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
                <Button disabled={!file} onClick={handleImport}>Start Import</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader><CardTitle>Expected Columns</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm text-gray-600">
                {['firstName', 'lastName', 'gender', 'dateOfBirth', 'placeOfBirth', 'district', 'region', 'residentialAddress', 'admissionDate', 'classId'].map((col) => (
                  <li key={col} className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-gray-400" />
                    <code className="text-xs">{col}</code>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}