import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear: () => void;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
}) => {
  const hasFilter = startDate || endDate;
  const { isAudley } = useTheme();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <svg className={`w-4 h-4 ${isAudley ? 'text-[#0a1628]' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className={`text-sm ${isAudley ? 'text-[#0a1628]' : 'text-slate-400'}`}>Date Range:</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${
            isAudley
              ? 'bg-white border-[#ede8e0] text-[#0a1628] focus:ring-2 focus:ring-[#c4956a]/50 focus:border-[#c4956a]'
              : 'bg-slate-800 border-slate-600 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 [color-scheme:dark]'
          }`}
          title="Start date (inclusive)"
        />
        <span className={isAudley ? 'text-[#0a1628]/70' : 'text-slate-500'}>to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${
            isAudley
              ? 'bg-white border-[#ede8e0] text-[#0a1628] focus:ring-2 focus:ring-[#c4956a]/50 focus:border-[#c4956a]'
              : 'bg-slate-800 border-slate-600 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 [color-scheme:dark]'
          }`}
          title="End date (inclusive)"
        />
      </div>

      {hasFilter && (
        <button
          onClick={onClear}
          className={`p-1.5 rounded-lg transition-colors ${
            isAudley ? 'text-slate-500 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
          }`}
          title="Clear date filter"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <span className={`text-xs hidden sm:inline ${isAudley ? 'text-slate-600' : 'text-slate-500'}`}>
        (both dates inclusive)
      </span>
    </div>
  );
};
