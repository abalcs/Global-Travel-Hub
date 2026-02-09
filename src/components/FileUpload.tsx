import React, { useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface FileUploadProps {
  label: string;
  file: File | null;
  onFileSelect: (file: File | null) => void;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'cyan' | 'rose' | 'amber';
}

const colorClasses = {
  blue: {
    border: 'border-blue-500/30 hover:border-blue-400/50',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    icon: 'text-blue-400',
    activeBg: 'bg-blue-500/20',
  },
  green: {
    border: 'border-emerald-500/30 hover:border-emerald-400/50',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    icon: 'text-emerald-400',
    activeBg: 'bg-emerald-500/20',
  },
  purple: {
    border: 'border-purple-500/30 hover:border-purple-400/50',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    icon: 'text-purple-400',
    activeBg: 'bg-purple-500/20',
  },
  orange: {
    border: 'border-orange-500/30 hover:border-orange-400/50',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    icon: 'text-orange-400',
    activeBg: 'bg-orange-500/20',
  },
  cyan: {
    border: 'border-cyan-500/30 hover:border-cyan-400/50',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    icon: 'text-cyan-400',
    activeBg: 'bg-cyan-500/20',
  },
  rose: {
    border: 'border-rose-500/30 hover:border-rose-400/50',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    icon: 'text-rose-400',
    activeBg: 'bg-rose-500/20',
  },
  amber: {
    border: 'border-amber-500/30 hover:border-amber-400/50',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    icon: 'text-amber-400',
    activeBg: 'bg-amber-500/20',
  },
};

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  file,
  onFileSelect,
  icon,
  color,
}) => {
  const colors = colorClasses[color];
  const { isAudley } = useTheme();

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.csv'))) {
        onFileSelect(droppedFile);
      }
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        onFileSelect(selectedFile);
      }
    },
    [onFileSelect]
  );

  return (
    <div
      className={`relative flex items-center gap-3 p-3 border rounded-lg transition-all duration-200 cursor-pointer ${colors.border} ${file ? colors.activeBg : colors.bg}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => document.getElementById(`file-${label}`)?.click()}
    >
      <input
        id={`file-${label}`}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileInput}
      />

      <div className={`flex-shrink-0 ${colors.icon}`}>
        <div className="w-8 h-8 [&>svg]:w-8 [&>svg]:h-8">
          {icon}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className={`text-sm font-medium ${colors.text}`}>{label}</h3>
        {file ? (
          <p className={`text-xs truncate ${isAudley ? 'text-slate-600' : 'text-slate-400'}`}>{file.name}</p>
        ) : (
          <p className={`text-xs ${isAudley ? 'text-slate-500' : 'text-slate-500'}`}>Click or drop file</p>
        )}
      </div>

      {file ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFileSelect(null);
          }}
          className={`flex-shrink-0 p-1 transition-colors ${
            isAudley ? 'text-slate-500 hover:text-red-600' : 'text-slate-400 hover:text-red-400'
          }`}
          title="Remove file"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ) : (
        <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 ${colors.border}`} />
      )}
    </div>
  );
};
