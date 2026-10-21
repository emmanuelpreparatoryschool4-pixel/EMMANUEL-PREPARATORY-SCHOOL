'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface FileUploadProps {
  accept?: string;
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  label?: string;
  hint?: string;
  error?: string;
  currentFile?: File | null;
}

export function FileUpload({ accept, onFileSelect, onFileRemove, label, hint, error, currentFile }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    onFileSelect(file);
  };

  return (
    <div className="w-full">
      {label && <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>}
      {currentFile ? (
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
          <File className="h-5 w-5 text-gray-400" />
          <div className="flex-1"><p className="text-sm font-medium text-gray-900">{currentFile.name}</p></div>
          <Button type="button" variant="ghost" size="icon" onClick={onFileRemove}><X className="h-4 w-4" /></Button>
        </div>
      ) : (
        <div
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
            isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400',
            error && 'border-red-500'
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-700">Click to upload or drag and drop</p>
          {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
          <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}