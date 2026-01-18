import React, { useCallback } from 'react';

interface FileUploadProps {
  label: string;
  file: File | null;
  onFileSelect: (file: File | null) => void;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple';
}

const colorClasses = {
  blue: {
    border: 'border-blue-300 hover:border-blue-400',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    icon: 'text-blue-500',
  },
  green: {
    border: 'border-green-300 hover:border-green-400',
    bg: 'bg-green-50',
    text: 'text-green-600',
    icon: 'text-green-500',
  },
  purple: {
    border: 'border-purple-300 hover:border-purple-400',
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    icon: 'text-purple-500',
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
      className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer ${colors.border} ${colors.bg}`}
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

      <div className={`mb-3 ${colors.icon}`}>
        {icon}
      </div>

      <h3 className={`text-lg font-semibold mb-1 ${colors.text}`}>{label}</h3>

      {file ? (
        <div className="text-center">
          <p className="text-sm text-gray-600 truncate max-w-[180px]">{file.name}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFileSelect(null);
            }}
            className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Drop Excel file or click to upload</p>
      )}
    </div>
  );
};
