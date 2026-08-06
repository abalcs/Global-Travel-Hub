import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { formatDateString } from '../utils/dateParser';
import type { CrmParsedData } from '../utils/indexedDB';
import type { CrmRow } from '../utils/excelParser';
import type { Team } from '../types';

interface IncentiveViewProps {
  crmData: CrmParsedData;
  teams: Team[];
}

interface AgentIncentive {
  agentName: string;
  count: number;
  earnings: number;
  progress: number; // count % 10
  remaining: number; // 10 - progress
  team: Team | undefined;
}

interface MonthSummary {
  label: string;
  totalPts: number;
  totalPayout: number;
  topEarners: { agentName: string; count: number; earnings: number }[];
  agentCount: number;
}

const MONTHS: { label: string; start: string; end: string }[] = [
  { label: 'July', start: '2026-07-01', end: '2026-07-31' },
  { label: 'August', start: '2026-08-01', end: '2026-08-31' },
  { label: 'September', start: '2026-09-01', end: '2026-09-30' },
];

function filterPtsByRange(pts: CrmRow[], start: string, end: string): CrmRow[] {
  return pts.filter((row) => {
    const d = formatDateString(row.passthroughDate);
    return d && d >= start && d <= end;
  });
}

function buildAgentCounts(rows: CrmRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = row.agentName?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

export const IncentiveView: React.FC<IncentiveViewProps> = ({ crmData, teams }) => {
  const { isAudley } = useTheme();

  // Full Q3 agent data (Jul 1 – Sep 30)
  const agentData = useMemo(() => {
    const q3Pts = filterPtsByRange(crmData.passthroughs, '2026-07-01', '2026-09-30');
    const counts = buildAgentCounts(q3Pts);

    const agents: AgentIncentive[] = Array.from(counts.entries()).map(([agentName, count]) => ({
      agentName,
      count,
      earnings: Math.floor(count / 10) * 15,
      progress: count % 10,
      remaining: 10 - (count % 10),
      team: teams.find((t) => t.agentNames.includes(agentName)),
    }));

    agents.sort((a, b) => b.count - a.count);
    return agents;
  }, [crmData, teams]);

  // Monthly breakdown summaries
  const monthSummaries = useMemo<MonthSummary[]>(() => {
    return MONTHS.map(({ label, start, end }) => {
      const rows = filterPtsByRange(crmData.passthroughs, start, end);
      const counts = buildAgentCounts(rows);

      const sorted = Array.from(counts.entries())
        .map(([agentName, count]) => ({
          agentName,
          count,
          earnings: Math.floor(count / 10) * 15,
        }))
        .sort((a, b) => b.count - a.count);

      return {
        label,
        totalPts: sorted.reduce((s, a) => s + a.count, 0),
        totalPayout: sorted.reduce((s, a) => s + a.earnings, 0),
        topEarners: sorted.filter((a) => a.earnings > 0).slice(0, 3),
        agentCount: sorted.length,
      };
    });
  }, [crmData]);

  const totalPts = useMemo(() => agentData.reduce((s, a) => s + a.count, 0), [agentData]);
  const totalPayout = useMemo(() => agentData.reduce((s, a) => s + a.earnings, 0), [agentData]);
  const leader = agentData[0];

  // Theme classes
  const cardClass = isAudley
    ? 'bg-white border-[#ede8e0] rounded-2xl p-6 border'
    : 'bg-slate-800/50 border-slate-700/50 rounded-2xl p-6 border backdrop-blur';
  const labelClass = isAudley ? 'text-[#7a7a7a]' : 'text-slate-400';
  const valueClass = isAudley ? 'text-[#0a1628]' : 'text-white';
  const accentClass = isAudley ? 'text-[#4d726d]' : 'text-indigo-400';
  const tableHeaderBg = isAudley ? 'bg-[#faf8f5]' : 'bg-slate-700/50';
  const rowEvenBg = isAudley ? 'bg-white' : 'bg-slate-800/30';
  const rowOddBg = isAudley ? 'bg-[#faf8f5]' : 'bg-slate-800/60';
  const borderColor = isAudley ? 'border-[#ede8e0]' : 'border-slate-700/50';

  // Team colors for badges
  const teamColors = [
    { bg: 'bg-blue-100 text-blue-700', dark: 'bg-blue-900/30 text-blue-400' },
    { bg: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-900/30 text-emerald-400' },
    { bg: 'bg-amber-100 text-amber-700', dark: 'bg-amber-900/30 text-amber-400' },
    { bg: 'bg-purple-100 text-purple-700', dark: 'bg-purple-900/30 text-purple-400' },
    { bg: 'bg-rose-100 text-rose-700', dark: 'bg-rose-900/30 text-rose-400' },
  ];

  const getTeamBadgeClass = (team: Team | undefined) => {
    if (!team) return isAudley ? 'bg-gray-100 text-gray-500' : 'bg-slate-700 text-slate-400';
    const idx = teams.indexOf(team) % teamColors.length;
    return isAudley ? teamColors[idx].bg : teamColors[idx].dark;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-bold ${valueClass}`} style={{ fontFamily: "'DM Serif Display', serif" }}>
          Passthrough Incentive
        </h2>
        <p className={`text-sm mt-1 ${labelClass}`}>
          Every 10 passthroughs = $15 &middot; July &ndash; September 2026
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={cardClass}>
          <p className={`text-xs uppercase tracking-wider font-semibold ${labelClass}`}>Total Passthroughs</p>
          <p className={`text-3xl font-bold mt-1 ${accentClass}`}>{totalPts}</p>
        </div>
        <div className={cardClass}>
          <p className={`text-xs uppercase tracking-wider font-semibold ${labelClass}`}>Total Payout</p>
          <p className={`text-3xl font-bold mt-1 ${accentClass}`}>${totalPayout}</p>
        </div>
        <div className={cardClass}>
          <p className={`text-xs uppercase tracking-wider font-semibold ${labelClass}`}>Leader</p>
          {leader ? (
            <>
              <p className={`text-xl font-bold mt-1 ${valueClass}`}>{leader.agentName}</p>
              <p className={`text-sm ${labelClass}`}>{leader.count} passthroughs &middot; ${leader.earnings}</p>
            </>
          ) : (
            <p className={`text-lg mt-1 ${labelClass}`}>No data yet</p>
          )}
        </div>
      </div>

      {/* Monthly Recap */}
      <div>
        <h3 className={`text-lg font-bold mb-3 ${valueClass}`} style={{ fontFamily: "'DM Serif Display', serif" }}>
          Monthly Recap
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {monthSummaries.map((month) => (
            <div key={month.label} className={cardClass}>
              <div className="flex items-center justify-between mb-3">
                <h4 className={`text-base font-bold ${valueClass}`}>{month.label}</h4>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isAudley ? 'bg-[#ede8e0] text-[#4d726d]' : 'bg-slate-700 text-slate-300'}`}>
                  {month.agentCount} agents
                </span>
              </div>
              <div className="flex gap-6 mb-4">
                <div>
                  <p className={`text-xs uppercase tracking-wider ${labelClass}`}>Passthroughs</p>
                  <p className={`text-xl font-bold ${accentClass}`}>{month.totalPts}</p>
                </div>
                <div>
                  <p className={`text-xs uppercase tracking-wider ${labelClass}`}>Payout</p>
                  <p className={`text-xl font-bold ${accentClass}`}>${month.totalPayout}</p>
                </div>
              </div>
              {month.topEarners.length > 0 ? (
                <div>
                  <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${labelClass}`}>Top Earners</p>
                  <div className="space-y-1.5">
                    {month.topEarners.map((earner, i) => (
                      <div key={earner.agentName} className="flex items-center justify-between">
                        <span className={`text-sm ${valueClass}`}>
                          <span className={`${labelClass} mr-1`}>{i + 1}.</span>
                          {earner.agentName}
                        </span>
                        <span className="text-sm font-semibold text-emerald-500">${earner.earnings}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className={`text-sm italic ${labelClass}`}>No earners yet</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Agent Table */}
      <div>
        <h3 className={`text-lg font-bold mb-3 ${valueClass}`} style={{ fontFamily: "'DM Serif Display', serif" }}>
          All Agents
        </h3>
        {agentData.length === 0 ? (
          <div className={`${cardClass} text-center py-12`}>
            <p className={`text-lg ${labelClass}`}>No passthroughs found for Jul&ndash;Sep 2026 in CRM data.</p>
          </div>
        ) : (
          <div className={`rounded-2xl border overflow-hidden ${borderColor}`}>
            <table className="w-full">
              <thead>
                <tr className={tableHeaderBg}>
                  <th className={`text-left px-5 py-3 text-xs uppercase tracking-wider font-semibold ${labelClass}`}>#</th>
                  <th className={`text-left px-5 py-3 text-xs uppercase tracking-wider font-semibold ${labelClass}`}>Agent</th>
                  <th className={`text-center px-5 py-3 text-xs uppercase tracking-wider font-semibold ${labelClass}`}>Passthroughs</th>
                  <th className={`text-center px-5 py-3 text-xs uppercase tracking-wider font-semibold ${labelClass}`}>Earned</th>
                  <th className={`text-left px-5 py-3 text-xs uppercase tracking-wider font-semibold ${labelClass} min-w-[200px]`}>Progress to Next $15</th>
                </tr>
              </thead>
              <tbody>
                {agentData.map((agent, idx) => (
                  <tr key={agent.agentName} className={idx % 2 === 0 ? rowEvenBg : rowOddBg}>
                    <td className={`px-5 py-3 text-sm ${labelClass}`}>{idx + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${valueClass}`}>{agent.agentName}</span>
                        {agent.team && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getTeamBadgeClass(agent.team)}`}>
                            {agent.team.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-5 py-3 text-center text-lg font-bold ${valueClass}`}>{agent.count}</td>
                    <td className={`px-5 py-3 text-center text-lg font-bold ${agent.earnings > 0 ? 'text-emerald-500' : labelClass}`}>
                      ${agent.earnings}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex-1 h-2.5 rounded-full overflow-hidden ${isAudley ? 'bg-[#ede8e0]' : 'bg-slate-700'}`}>
                          <div
                            className={`h-full rounded-full transition-all ${isAudley ? 'bg-[#4d726d]' : 'bg-indigo-500'}`}
                            style={{ width: `${(agent.progress / 10) * 100}%` }}
                          />
                        </div>
                        <span className={`text-xs whitespace-nowrap ${labelClass}`}>
                          {agent.progress === 0 && agent.earnings > 0
                            ? '10 more'
                            : `${agent.remaining} more`}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
