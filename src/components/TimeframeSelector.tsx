import { useTheme } from '../contexts/ThemeContext';

export type Timeframe = 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'lastYear' | 'all';

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (timeframe: Timeframe) => void;
}

const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'lastWeek', label: 'Last Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisQuarter', label: 'This Qtr' },
  { value: 'lastQuarter', label: 'Last Qtr' },
  { value: 'lastYear', label: 'Last Year' },
  { value: 'all', label: 'All Time' },
];

/** Convert a timeframe preset into { startDate, endDate } YYYY-MM-DD strings.
 *  Empty string means "no bound" (i.e. include everything). */
export function timeframeToDates(tf: Timeframe): { startDate: string; endDate: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  switch (tf) {
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return { startDate: fmt(yesterday), endDate: fmt(yesterday) };
    }
    case 'thisWeek': {
      // Sunday through today
      const dayOfWeek = today.getDay();
      const sunday = new Date(today);
      sunday.setDate(today.getDate() - dayOfWeek);
      return { startDate: fmt(sunday), endDate: fmt(today) };
    }
    case 'lastWeek': {
      const dayOfWeek = today.getDay();
      const lastSunday = new Date(today);
      lastSunday.setDate(today.getDate() - dayOfWeek - 7);
      const lastSaturday = new Date(lastSunday);
      lastSaturday.setDate(lastSunday.getDate() + 6);
      return { startDate: fmt(lastSunday), endDate: fmt(lastSaturday) };
    }
    case 'thisMonth': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: fmt(first), endDate: fmt(today) };
    }
    case 'lastMonth': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { startDate: fmt(first), endDate: fmt(last) };
    }
    case 'thisQuarter': {
      const qm = Math.floor(today.getMonth() / 3) * 3;
      const first = new Date(today.getFullYear(), qm, 1);
      return { startDate: fmt(first), endDate: fmt(today) };
    }
    case 'lastQuarter': {
      const cq = Math.floor(today.getMonth() / 3);
      const lq = cq === 0 ? 3 : cq - 1;
      const yr = cq === 0 ? today.getFullYear() - 1 : today.getFullYear();
      const first = new Date(yr, lq * 3, 1);
      const last = new Date(yr, (lq + 1) * 3, 0);
      return { startDate: fmt(first), endDate: fmt(last) };
    }
    case 'lastYear': {
      const yr = today.getFullYear() - 1;
      return { startDate: `${yr}-01-01`, endDate: `${yr}-12-31` };
    }
    case 'all':
    default:
      return { startDate: '', endDate: '' };
  }
}

export const TimeframeSelector = ({ value, onChange }: TimeframeSelectorProps) => {
  const { isAudley } = useTheme();

  return (
    <div className={`flex flex-wrap gap-1 p-1 rounded-lg w-fit ${
      isAudley ? 'bg-[#eef5f4] border border-[#4d726d]/30 shadow-sm' : 'bg-slate-800/50'
    }`}>
      {TIMEFRAME_OPTIONS.map(({ value: tf, label }) => (
        <button
          key={tf}
          onClick={() => {
            onChange(tf);
            if (navigator.vibrate) navigator.vibrate(10);
          }}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${
            value === tf
              ? isAudley
                ? 'bg-gradient-to-r from-[#4d726d] to-[#007bc7] text-white shadow-sm'
                : 'bg-gradient-to-r from-[#1a5c6e] to-[#1a7fa8] text-white shadow-sm'
              : isAudley
                ? 'text-[#4d726d] hover:text-[#007bc7] hover:bg-[#e8f0ef]'
                : 'text-slate-300 hover:text-white hover:bg-slate-600/60'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
