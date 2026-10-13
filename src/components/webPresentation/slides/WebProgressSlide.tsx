import { motion } from 'framer-motion';
import React, { useMemo, useState } from 'react';
import type { SlideColors } from '../../../utils/presentationGenerator';
import type { LayoutStyles } from '../webPresentationConfig';
import type { Team, Metrics } from '../../../types';
import type { SegmentData } from '../webPresentationConfig';

// Scenic travel images for progress background
const PROGRESS_IMAGES = [
  'https://images.pexels.com/photos/1271619/pexels-photo-1271619.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/2387418/pexels-photo-2387418.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/1658967/pexels-photo-1658967.jpeg?auto=compress&cs=tinysrgb&w=1600',
];

interface WebProgressSlideProps {
  teams: Team[];
  metrics: Metrics[];
  seniors: string[];
  teamName: string;
  colors: SlideColors;
  layout?: LayoutStyles;
  prospectData?: SegmentData;
  taData?: SegmentData;
  repeatData?: SegmentData;
  deptProspectData?: SegmentData;
  deptTaData?: SegmentData;
  deptRepeatData?: SegmentData;
}

interface TeamStats {
  name: string;
  enquiries: number;
  passthroughs: number;
  quotes: number;
  bookings: number;
  epRate: number;
  eqRate: number;
  pqRate: number;
  ebRate: number;
}

const METRIC_ROWS: { key: keyof Omit<TeamStats, 'name'>; label: string; isRate: boolean }[] = [
  { key: 'enquiries', label: 'Enquiries', isRate: false },
  { key: 'passthroughs', label: 'Passthroughs', isRate: false },
  { key: 'quotes', label: 'Quotes', isRate: false },
  { key: 'bookings', label: 'Bookings', isRate: false },
  { key: 'epRate', label: 'E>P', isRate: true },
  { key: 'eqRate', label: 'E>Q', isRate: true },
  { key: 'pqRate', label: 'P>Q', isRate: true },
  { key: 'ebRate', label: 'E>B', isRate: true },
];

export const WebProgressSlide: React.FC<WebProgressSlideProps> = ({
  teams,
  metrics,
  seniors: _seniors,
  teamName,
  colors,
  layout,
  prospectData,
  taData,
  repeatData,
  deptProspectData,
  deptTaData,
  deptRepeatData,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const imageIndex = teamName.length % PROGRESS_IMAGES.length;
  const backgroundImage = PROGRESS_IMAGES[imageIndex];

  // Compute per-team stats + department average
  const { teamStats, deptAvg } = useMemo(() => {
    const stats: TeamStats[] = teams.map(team => {
      const memberSet = new Set(team.agentNames.map(n => n.trim().toLowerCase()));
      const teamMetrics = metrics.filter(m => memberSet.has(m.agentName.trim().toLowerCase()));

      const enquiries = teamMetrics.reduce((s, m) => s + m.trips, 0);
      const passthroughs = teamMetrics.reduce((s, m) => s + m.passthroughs, 0);
      const quotes = teamMetrics.reduce((s, m) => s + m.quotes, 0);
      const bookings = teamMetrics.reduce((s, m) => s + m.bookings, 0);

      return {
        name: team.name,
        enquiries,
        passthroughs,
        quotes,
        bookings,
        epRate: enquiries > 0 ? (passthroughs / enquiries) * 100 : 0,
        eqRate: enquiries > 0 ? (quotes / enquiries) * 100 : 0,
        pqRate: passthroughs > 0 ? (quotes / passthroughs) * 100 : 0,
        ebRate: enquiries > 0 ? (bookings / enquiries) * 100 : 0,
      };
    });

    // Department average
    const totalEnquiries = metrics.reduce((s, m) => s + m.trips, 0);
    const totalPTs = metrics.reduce((s, m) => s + m.passthroughs, 0);
    const totalQuotes = metrics.reduce((s, m) => s + m.quotes, 0);
    const totalBookings = metrics.reduce((s, m) => s + m.bookings, 0);

    const avg: TeamStats = {
      name: 'Dept Avg',
      enquiries: totalEnquiries,
      passthroughs: totalPTs,
      quotes: totalQuotes,
      bookings: totalBookings,
      epRate: totalEnquiries > 0 ? (totalPTs / totalEnquiries) * 100 : 0,
      eqRate: totalEnquiries > 0 ? (totalQuotes / totalEnquiries) * 100 : 0,
      pqRate: totalPTs > 0 ? (totalQuotes / totalPTs) * 100 : 0,
      ebRate: totalEnquiries > 0 ? (totalBookings / totalEnquiries) * 100 : 0,
    };

    return { teamStats: stats, deptAvg: avg };
  }, [teams, metrics]);

  // All columns including dept average
  const allColumns = [...teamStats, deptAvg];

  // Find best/worst per metric row (excluding dept avg)
  const bestWorst = useMemo(() => {
    const result: Record<string, { bestIdx: number; worstIdx: number }> = {};
    for (const row of METRIC_ROWS) {
      let bestVal = -Infinity;
      let worstVal = Infinity;
      let bestIdx = -1;
      let worstIdx = -1;
      teamStats.forEach((ts, i) => {
        const val = ts[row.key] as number;
        if (val > bestVal) { bestVal = val; bestIdx = i; }
        if (val < worstVal) { worstVal = val; worstIdx = i; }
      });
      // Only color-code if there's actually a difference
      if (bestVal === worstVal) {
        result[row.key] = { bestIdx: -1, worstIdx: -1 };
      } else {
        result[row.key] = { bestIdx, worstIdx };
      }
    }
    return result;
  }, [teamStats]);

  const formatValue = (val: number, isRate: boolean) => {
    if (isRate) return `${val.toFixed(1)}%`;
    return val.toLocaleString();
  };

  const getCellColor = (rowKey: string, colIdx: number, isDeptAvg: boolean) => {
    if (isDeptAvg) return `#${colors.accent}`;
    const bw = bestWorst[rowKey];
    if (!bw) return `#${colors.text}`;
    if (colIdx === bw.bestIdx) return '#22c55e'; // green
    if (colIdx === bw.worstIdx) return '#ef4444'; // red
    return `#${colors.text}`;
  };

  return (
    <div
      className="w-full h-full flex flex-col px-10 py-6 relative overflow-hidden"
      style={{ backgroundColor: `#${colors.background}` }}
    >
      {/* Background Image */}
      <img
        src={backgroundImage}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: imageLoaded ? 0.4 : 0, transition: 'opacity 0.8s ease-in-out' }}
        onLoad={() => setImageLoaded(true)}
      />

      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `#${colors.background}`, opacity: 0.75 }}
      />

      {/* Left accent bar */}
      <motion.div
        className="absolute left-0 top-0 w-2 h-full z-10"
        style={{ backgroundColor: `#${colors.primary}` }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Header */}
      <div className={`${layout?.headerMargin || 'mb-4'} relative z-10`}>
        <motion.h2
          className={`${layout?.titleSize || 'text-3xl'} font-bold`}
          style={{ color: `#${colors.text}` }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          TEAM COMPARISON
        </motion.h2>
        <motion.div
          className="h-1 w-40 mt-2"
          style={{ backgroundColor: `#${colors.accent}` }}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        />
        <motion.p
          className="mt-1 text-sm"
          style={{ color: `#${colors.textLight}` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          All Teams — Key Metrics Overview
        </motion.p>
      </div>

      {/* Table */}
      <motion.div
        className="flex-1 relative z-10 overflow-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th
                className="text-left py-2 px-3 border-b font-bold text-xs tracking-wider"
                style={{ color: `#${colors.textLight}`, borderColor: `#${colors.accent}40` }}
              >
                METRIC
              </th>
              {allColumns.map((col, i) => {
                const isDeptAvg = i === allColumns.length - 1;
                return (
                  <motion.th
                    key={col.name}
                    className="text-center py-2 px-2 border-b font-bold text-xs tracking-wider"
                    style={{
                      color: isDeptAvg ? `#${colors.accent}` : `#${colors.text}`,
                      borderColor: `#${colors.accent}40`,
                      backgroundColor: isDeptAvg ? `#${colors.accent}15` : 'transparent',
                    }}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                  >
                    {col.name}
                  </motion.th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map((row, rowIdx) => (
              <motion.tr
                key={row.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + rowIdx * 0.05 }}
                style={{
                  backgroundColor: rowIdx >= 4 ? `#${colors.cardBg}` : 'transparent',
                }}
              >
                <td
                  className="py-2 px-3 border-b font-semibold text-xs"
                  style={{
                    color: `#${colors.textLight}`,
                    borderColor: `#${colors.accent}20`,
                  }}
                >
                  {row.label}
                </td>
                {allColumns.map((col, colIdx) => {
                  const isDeptAvg = colIdx === allColumns.length - 1;
                  const val = col[row.key] as number;
                  const cellColor = getCellColor(row.key, colIdx, isDeptAvg);

                  return (
                    <td
                      key={col.name}
                      className="text-center py-2 px-2 border-b font-semibold tabular-nums"
                      style={{
                        color: cellColor,
                        borderColor: `#${colors.accent}20`,
                        backgroundColor: isDeptAvg ? `#${colors.accent}10` : 'transparent',
                        fontWeight: isDeptAvg ? 700 : (cellColor !== `#${colors.text}` ? 700 : 500),
                      }}
                    >
                      {formatValue(val, row.isRate)}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>

        {/* Legend */}
        <motion.div
          className="flex items-center gap-4 mt-2 justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }} />
            <span className="text-xs" style={{ color: `#${colors.textLight}` }}>Best</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }} />
            <span className="text-xs" style={{ color: `#${colors.textLight}` }}>Needs Focus</span>
          </div>
        </motion.div>

        {/* Segment Rate Comparison: Team vs Dept */}
        {prospectData && deptProspectData && taData && deptTaData && repeatData && deptRepeatData && (
          <motion.div
            className="mt-4"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <h3
              className="text-xs font-bold tracking-wider mb-2"
              style={{ color: `#${colors.accent}` }}
            >
              {teamName.toUpperCase()} — SEGMENT RATE COMPARISON VS DEPT
            </h3>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th
                    className="text-left py-1.5 px-2 border-b font-bold tracking-wider"
                    style={{ color: `#${colors.textLight}`, borderColor: `#${colors.accent}40` }}
                  >
                    SEGMENT
                  </th>
                  {['E>P', 'E>Q', 'E>B'].map(label => (
                    <th
                      key={label}
                      colSpan={2}
                      className="text-center py-1.5 px-1 border-b font-bold tracking-wider"
                      style={{ color: `#${colors.text}`, borderColor: `#${colors.accent}40` }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th
                    className="py-1 px-2 border-b"
                    style={{ borderColor: `#${colors.accent}20` }}
                  />
                  {['E>P', 'E>Q', 'E>B'].map(label => (
                    <React.Fragment key={label}>
                      <th
                        className="text-center py-1 px-1 border-b text-[10px] font-semibold"
                        style={{ color: `#${colors.textLight}`, borderColor: `#${colors.accent}20` }}
                      >
                        Team
                      </th>
                      <th
                        className="text-center py-1 px-1 border-b text-[10px] font-semibold"
                        style={{ color: `#${colors.accent}`, borderColor: `#${colors.accent}20`, backgroundColor: `#${colors.accent}10` }}
                      >
                        Dept
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([
                  { label: 'Prospects', team: prospectData, dept: deptProspectData },
                  { label: 'Travel Agents', team: taData, dept: deptTaData },
                  { label: 'Repeat', team: repeatData, dept: deptRepeatData },
                ] as const).map((seg, idx) => (
                  <motion.tr
                    key={seg.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + idx * 0.05 }}
                  >
                    <td
                      className="py-1.5 px-2 border-b font-semibold"
                      style={{ color: `#${colors.textLight}`, borderColor: `#${colors.accent}20` }}
                    >
                      {seg.label}
                    </td>
                    {([
                      { teamVal: seg.team.epRate, deptVal: seg.dept.epRate },
                      { teamVal: seg.team.eqRate, deptVal: seg.dept.eqRate },
                      { teamVal: seg.team.ebRate, deptVal: seg.dept.ebRate },
                    ]).map((pair, pi) => (
                      <React.Fragment key={`${seg.label}-${pi}`}>
                        <td
                          className="text-center py-1.5 px-1 border-b font-semibold tabular-nums"
                          style={{
                            color: pair.teamVal >= pair.deptVal ? '#22c55e' : '#ef4444',
                            borderColor: `#${colors.accent}20`,
                          }}
                        >
                          {pair.teamVal.toFixed(1)}%
                        </td>
                        <td
                          className="text-center py-1.5 px-1 border-b font-semibold tabular-nums"
                          style={{
                            color: `#${colors.accent}`,
                            borderColor: `#${colors.accent}20`,
                            backgroundColor: `#${colors.accent}10`,
                          }}
                        >
                          {pair.deptVal.toFixed(1)}%
                        </td>
                      </React.Fragment>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
