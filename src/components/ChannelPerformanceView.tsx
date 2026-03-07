import { useState, useMemo } from 'react';
import { SlidingPillGroup } from './SlidingPillGroup';
import type { RawParsedData } from '../utils/indexedDB';
import {
  analyzeRepeatClientPerformance,
  analyzeRepeatClientPerformanceByAgent,
  analyzeB2BPerformance,
  analyzeB2BPerformanceByAgent,
  type RegionalTimeframe,
  type DepartmentClientSegmentPerformance,
  type AgentClientSegmentPerformance,
} from '../utils/insightsAnalytics';
import { useTheme } from '../contexts/ThemeContext';

interface ChannelPerformanceViewProps {
  rawData: RawParsedData;
  seniors: string[];
}

export const ChannelPerformanceView: React.FC<ChannelPerformanceViewProps> = ({ rawData, seniors }) => {
  const { isAudley } = useTheme();
  const [repeatTimeframe, setRepeatTimeframe] = useState<RegionalTimeframe>('all');
  const [b2bTimeframe, setB2bTimeframe] = useState<RegionalTimeframe>('all');
  const [selectedAgentForRepeat, setSelectedAgentForRepeat] = useState<string>('');
  const [selectedAgentForB2B, setSelectedAgentForB2B] = useState<string>('');

  // Repeat client performance analysis
  const repeatClientPerformance = useMemo<DepartmentClientSegmentPerformance | null>(() => {
    if (!rawData.trips || rawData.trips.length === 0) return null;
    return analyzeRepeatClientPerformance(rawData.trips, repeatTimeframe);
  }, [rawData.trips, repeatTimeframe]);

  const repeatClientByAgent = useMemo<AgentClientSegmentPerformance[]>(() => {
    if (!rawData.trips || rawData.trips.length === 0) return [];
    return analyzeRepeatClientPerformanceByAgent(rawData.trips, repeatTimeframe);
  }, [rawData.trips, repeatTimeframe]);

  const selectedRepeatAgentData = useMemo(() => {
    return repeatClientByAgent.find(a => a.agentName === selectedAgentForRepeat);
  }, [repeatClientByAgent, selectedAgentForRepeat]);

  // B2B performance analysis
  const b2bPerformance = useMemo<DepartmentClientSegmentPerformance | null>(() => {
    if (!rawData.trips || rawData.trips.length === 0) return null;
    return analyzeB2BPerformance(rawData.trips, b2bTimeframe);
  }, [rawData.trips, b2bTimeframe]);

  const b2bByAgent = useMemo<AgentClientSegmentPerformance[]>(() => {
    if (!rawData.trips || rawData.trips.length === 0) return [];
    return analyzeB2BPerformanceByAgent(rawData.trips, b2bTimeframe);
  }, [rawData.trips, b2bTimeframe]);

  const selectedB2BAgentData = useMemo(() => {
    return b2bByAgent.find(a => a.agentName === selectedAgentForB2B);
  }, [b2bByAgent, selectedAgentForB2B]);

  // Create a Set for efficient senior lookup (case-insensitive)
  const seniorSet = useMemo(() => {
    return new Set(seniors.map(s => s.toLowerCase()));
  }, [seniors]);

  // Helper function to get T>P rate for repeat clients
  const getRepeatTpRate = (agent: AgentClientSegmentPerformance): number => {
    const repeatSeg = agent.segments.find(s => s.segment === 'Repeat');
    return repeatSeg?.tpRate ?? 0;
  };

  // Helper function to get T>P rate for B2B
  const getB2BTpRate = (agent: AgentClientSegmentPerformance): number => {
    const b2bSeg = agent.segments.find(s => s.segment === 'B2B');
    return b2bSeg?.tpRate ?? 0;
  };

  // Repeat client rankings by senior/non-senior
  const repeatAgentRankings = useMemo(() => {
    // Filter agents who have repeat client data
    const agentsWithRepeatData = repeatClientByAgent.filter(a => {
      const repeatSeg = a.segments.find(s => s.segment === 'Repeat');
      return repeatSeg && repeatSeg.trips >= 3; // Minimum 3 repeat trips for meaningful data
    });

    const seniorAgents = agentsWithRepeatData
      .filter(a => seniorSet.has(a.agentName.toLowerCase()))
      .sort((a, b) => getRepeatTpRate(b) - getRepeatTpRate(a));

    const nonSeniorAgents = agentsWithRepeatData
      .filter(a => !seniorSet.has(a.agentName.toLowerCase()))
      .sort((a, b) => getRepeatTpRate(b) - getRepeatTpRate(a));

    return {
      seniorTop3: seniorAgents.slice(0, 3),
      seniorBottom3: seniorAgents.slice(-3).reverse(),
      nonSeniorTop3: nonSeniorAgents.slice(0, 3),
      nonSeniorBottom3: nonSeniorAgents.slice(-3).reverse(),
    };
  }, [repeatClientByAgent, seniorSet]);

  // B2B rankings by senior/non-senior
  const b2bAgentRankings = useMemo(() => {
    // Filter agents who have B2B data
    const agentsWithB2BData = b2bByAgent.filter(a => {
      const b2bSeg = a.segments.find(s => s.segment === 'B2B');
      return b2bSeg && b2bSeg.trips >= 3; // Minimum 3 B2B trips for meaningful data
    });

    const seniorAgents = agentsWithB2BData
      .filter(a => seniorSet.has(a.agentName.toLowerCase()))
      .sort((a, b) => getB2BTpRate(b) - getB2BTpRate(a));

    const nonSeniorAgents = agentsWithB2BData
      .filter(a => !seniorSet.has(a.agentName.toLowerCase()))
      .sort((a, b) => getB2BTpRate(b) - getB2BTpRate(a));

    return {
      seniorTop3: seniorAgents.slice(0, 3),
      seniorBottom3: seniorAgents.slice(-3).reverse(),
      nonSeniorTop3: nonSeniorAgents.slice(0, 3),
      nonSeniorBottom3: nonSeniorAgents.slice(-3).reverse(),
    };
  }, [b2bByAgent, seniorSet]);

  const hasData = (repeatClientPerformance?.segments.length ?? 0) > 0 || (b2bPerformance?.segments.length ?? 0) > 0;

  if (!hasData) {
    return (
      <div className={`text-center py-16 ${isAudley ? 'text-[#7a7a7a]' : 'text-slate-400'}`}>
        <svg className={`w-12 h-12 mx-auto mb-4 ${isAudley ? 'text-slate-400' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p>No channel performance data available.</p>
        <p className="text-sm mt-2">Upload trip data with repeat client or B2B indicators to see this analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={`text-xl font-semibold flex items-center gap-2 ${isAudley ? 'text-[#0a1628]' : 'text-white'}`}>
          <svg className={`w-6 h-6 ${isAudley ? 'text-[#0a1628]' : 'text-cyan-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Channel Performance
        </h2>
        <p className={`text-sm mt-1 ${isAudley ? 'text-[#7a7a7a]' : 'text-slate-400'}`}>
          Repeat client and B2B conversion performance analysis
        </p>
      </div>

      {/* Repeat Client Performance */}
      {repeatClientPerformance && repeatClientPerformance.segments.length > 0 && (
        <div className={`backdrop-blur rounded-2xl p-6 border space-y-4 ${
          isAudley
            ? 'bg-white border-[#ede8e0]'
            : 'bg-slate-800/50 border-slate-700/50'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h3 className={`text-lg font-semibold flex items-center gap-2 ${isAudley ? 'text-[#0a1628]' : 'text-white'}`}>
              <svg className={`w-5 h-5 ${isAudley ? 'text-emerald-600' : 'text-emerald-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Repeat Client T&gt;P Performance
            </h3>
            {/* Timeframe Toggle */}
            <SlidingPillGroup
              options={[
                { value: 'lastWeek', label: 'Last Wk' },
                { value: 'thisMonth', label: 'This Mo' },
                { value: 'lastMonth', label: 'Last Mo' },
                { value: 'thisQuarter', label: 'This Q' },
                { value: 'lastQuarter', label: 'Last Q' },
                { value: 'lastYear', label: 'Last Yr' },
                { value: 'all', label: 'All' },
              ]}
              value={repeatTimeframe}
              onChange={(v) => setRepeatTimeframe(v as RegionalTimeframe)}
              activeGradient={{ light: 'linear-gradient(to right, #059669, #10b981)', dark: 'linear-gradient(to right, #059669, #10b981)' }}
              size="sm"
            />
          </div>

          {/* Department Level Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {repeatClientPerformance.segments.map((seg) => (
              <div
                key={seg.segment}
                className={`rounded-lg p-4 border ${
                  seg.segment === 'Repeat'
                    ? isAudley
                      ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
                      : 'bg-gradient-to-br from-emerald-600/20 to-teal-600/20 border-emerald-500/30'
                    : isAudley
                      ? 'bg-[#faf8f5] border-[#ede8e0]'
                      : 'bg-gradient-to-br from-slate-700/30 to-slate-800/30 border-slate-600/30'
                }`}
              >
                <div className={`text-xs mb-1 ${isAudley ? 'text-[#7a7a7a]' : 'text-slate-400'}`}>{seg.segment} Clients</div>
                <div className={`text-2xl font-bold ${seg.segment === 'Repeat' ? (isAudley ? 'text-emerald-600' : 'text-emerald-400') : (isAudley ? 'text-[#0a1628]' : 'text-white')}`}>
                  {seg.tpRate.toFixed(1)}%
                </div>
                <div className={`text-xs mt-1 ${isAudley ? 'text-slate-400' : 'text-slate-500'}`}>
                  {seg.passthroughs}/{seg.trips} trips
                </div>
              </div>
            ))}
            <div className={`rounded-lg p-4 border ${
              isAudley
                ? 'bg-[#faf8f5] border-[#ede8e0]'
                : 'bg-slate-800/40 border-slate-700/30'
            }`}>
              <div className={`text-xs mb-1 ${isAudley ? 'text-[#7a7a7a]' : 'text-slate-400'}`}>Total</div>
              <div className={`text-2xl font-bold ${isAudley ? 'text-[#0a1628]' : 'text-white'}`}>{repeatClientPerformance.totalTrips.toLocaleString()}</div>
              <div className={`text-xs mt-1 ${isAudley ? 'text-slate-400' : 'text-slate-500'}`}>trips analyzed</div>
            </div>
            {repeatClientPerformance.segments.length === 2 && (
              <div className={`rounded-lg p-4 border ${
                isAudley
                  ? 'bg-[#faf8f5] border-[#ede8e0]'
                  : 'bg-slate-800/40 border-slate-700/30'
              }`}>
                <div className={`text-xs mb-1 ${isAudley ? 'text-[#7a7a7a]' : 'text-slate-400'}`}>Difference</div>
                <div className={`text-2xl font-bold ${
                  (repeatClientPerformance.segments[0]?.tpRate || 0) > (repeatClientPerformance.segments[1]?.tpRate || 0)
                    ? (isAudley ? 'text-emerald-600' : 'text-emerald-400') : (isAudley ? 'text-rose-600' : 'text-rose-400')
                }`}>
                  {repeatClientPerformance.segments[0] && repeatClientPerformance.segments[1]
                    ? `${((repeatClientPerformance.segments[0].tpRate - repeatClientPerformance.segments[1].tpRate) > 0 ? '+' : '')}${(repeatClientPerformance.segments[0].tpRate - repeatClientPerformance.segments[1].tpRate).toFixed(1)}pp`
                    : '—'}
                </div>
                <div className={`text-xs mt-1 ${isAudley ? 'text-slate-400' : 'text-slate-500'}`}>
                  {repeatClientPerformance.segments[0]?.segment} vs {repeatClientPerformance.segments[1]?.segment}
                </div>
              </div>
            )}
          </div>

          {/* Agent Level Breakdown */}
          {repeatClientByAgent.length > 0 && (
            <div className={`rounded-lg p-4 border ${
              isAudley
                ? 'bg-[#faf8f5] border-[#ede8e0]'
                : 'bg-slate-900/50 border-slate-700/50'
            }`}>
              <h5 className={`text-xs font-medium mb-3 ${isAudley ? 'text-[#4a4a4a]' : 'text-slate-400'}`}>Agent Performance by Client Type</h5>
              <select
                value={selectedAgentForRepeat}
                onChange={(e) => setSelectedAgentForRepeat(e.target.value)}
                className={`border rounded-lg px-3 py-2 text-sm mb-3 ${
                  isAudley
                    ? 'bg-white border-[#ede8e0] text-[#0a1628]'
                    : 'bg-slate-700/50 border-slate-600 text-white'
                }`}
              >
                <option value="">Select agent...</option>
                {repeatClientByAgent.map(a => (
                  <option key={a.agentName} value={a.agentName}>
                    {a.agentName} ({a.totalTrips} trips)
                  </option>
                ))}
              </select>

              {selectedRepeatAgentData && (
                <div className="grid grid-cols-2 gap-3">
                  {selectedRepeatAgentData.segments.map(seg => (
                    <div
                      key={seg.segment}
                      className={`rounded-lg p-3 ${
                        seg.segment === 'Repeat'
                          ? isAudley ? 'bg-emerald-50' : 'bg-emerald-900/30'
                          : isAudley ? 'bg-[#faf8f5]' : 'bg-slate-700/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm ${isAudley ? 'text-slate-700' : 'text-slate-300'}`}>{seg.segment}</span>
                        <span className={`text-lg font-bold ${seg.segment === 'Repeat' ? (isAudley ? 'text-emerald-600' : 'text-emerald-400') : (isAudley ? 'text-[#0a1628]' : 'text-white')}`}>
                          {seg.tpRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className={`text-xs ${isAudley ? 'text-[#7a7a7a]' : 'text-slate-500'}`}>
                        {seg.passthroughs} passthroughs / {seg.trips} trips
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Agent Rankings by Senior/Non-Senior for Repeat Clients */}
          {(repeatAgentRankings.seniorTop3.length > 0 || repeatAgentRankings.nonSeniorTop3.length > 0) && (
            <div className={`rounded-lg p-4 border ${
              isAudley
                ? 'bg-[#faf8f5] border-[#ede8e0]'
                : 'bg-slate-900/50 border-slate-700/50'
            }`}>
              <h5 className={`text-xs font-medium mb-4 ${isAudley ? 'text-[#4a4a4a]' : 'text-slate-400'}`}>Agent Rankings - Repeat Client T&gt;P</h5>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Senior Agents */}
                {repeatAgentRankings.seniorTop3.length > 0 && (
                  <div className="space-y-3">
                    <div className={`text-xs font-medium ${isAudley ? 'text-emerald-600' : 'text-emerald-400'}`}>Senior Agents</div>
                    {/* Top 3 */}
                    <div className={`rounded-lg p-3 border ${
                      isAudley
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-emerald-900/20 border-emerald-700/30'
                    }`}>
                      <div className={`text-xs mb-2 ${isAudley ? 'text-emerald-700' : 'text-emerald-300'}`}>Top Performers</div>
                      <div className="space-y-1.5">
                        {repeatAgentRankings.seniorTop3.map((agent, i) => {
                          const repeatSeg = agent.segments.find(s => s.segment === 'Repeat');
                          return (
                            <div key={agent.agentName} className="flex items-center justify-between text-sm">
                              <span className={`truncate max-w-[150px] ${isAudley ? 'text-slate-700' : 'text-slate-300'}`}>
                                <span className={`mr-1 ${isAudley ? 'text-emerald-600' : 'text-emerald-400'}`}>{i + 1}.</span>
                                {agent.agentName}
                              </span>
                              <span className={`font-medium ${isAudley ? 'text-emerald-600' : 'text-emerald-400'}`}>{repeatSeg?.tpRate.toFixed(1)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Bottom 3 */}
                    {repeatAgentRankings.seniorBottom3.length > 0 && (
                      <div className={`rounded-lg p-3 border ${
                        isAudley
                          ? 'bg-rose-50 border-rose-200'
                          : 'bg-rose-900/20 border-rose-700/30'
                      }`}>
                        <div className={`text-xs mb-2 ${isAudley ? 'text-rose-700' : 'text-rose-300'}`}>Needs Improvement</div>
                        <div className="space-y-1.5">
                          {repeatAgentRankings.seniorBottom3.map((agent) => {
                            const repeatSeg = agent.segments.find(s => s.segment === 'Repeat');
                            return (
                              <div key={agent.agentName} className="flex items-center justify-between text-sm">
                                <span className={`truncate max-w-[150px] ${isAudley ? 'text-slate-700' : 'text-slate-300'}`}>{agent.agentName}</span>
                                <span className={`font-medium ${isAudley ? 'text-rose-600' : 'text-rose-400'}`}>{repeatSeg?.tpRate.toFixed(1)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Non-Senior Agents */}
                {repeatAgentRankings.nonSeniorTop3.length > 0 && (
                  <div className="space-y-3">
                    <div className={`text-xs font-medium ${isAudley ? 'text-[#4a4a4a]' : 'text-slate-400'}`}>Non-Senior Agents</div>
                    {/* Top 3 */}
                    <div className={`rounded-lg p-3 border ${
                      isAudley
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-emerald-900/20 border-emerald-700/30'
                    }`}>
                      <div className={`text-xs mb-2 ${isAudley ? 'text-emerald-700' : 'text-emerald-300'}`}>Top Performers</div>
                      <div className="space-y-1.5">
                        {repeatAgentRankings.nonSeniorTop3.map((agent, i) => {
                          const repeatSeg = agent.segments.find(s => s.segment === 'Repeat');
                          return (
                            <div key={agent.agentName} className="flex items-center justify-between text-sm">
                              <span className={`truncate max-w-[150px] ${isAudley ? 'text-slate-700' : 'text-slate-300'}`}>
                                <span className={`mr-1 ${isAudley ? 'text-emerald-600' : 'text-emerald-400'}`}>{i + 1}.</span>
                                {agent.agentName}
                              </span>
                              <span className={`font-medium ${isAudley ? 'text-emerald-600' : 'text-emerald-400'}`}>{repeatSeg?.tpRate.toFixed(1)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Bottom 3 */}
                    {repeatAgentRankings.nonSeniorBottom3.length > 0 && (
                      <div className={`rounded-lg p-3 border ${
                        isAudley
                          ? 'bg-rose-50 border-rose-200'
                          : 'bg-rose-900/20 border-rose-700/30'
                      }`}>
                        <div className={`text-xs mb-2 ${isAudley ? 'text-rose-700' : 'text-rose-300'}`}>Needs Improvement</div>
                        <div className="space-y-1.5">
                          {repeatAgentRankings.nonSeniorBottom3.map((agent) => {
                            const repeatSeg = agent.segments.find(s => s.segment === 'Repeat');
                            return (
                              <div key={agent.agentName} className="flex items-center justify-between text-sm">
                                <span className={`truncate max-w-[150px] ${isAudley ? 'text-slate-700' : 'text-slate-300'}`}>{agent.agentName}</span>
                                <span className={`font-medium ${isAudley ? 'text-rose-600' : 'text-rose-400'}`}>{repeatSeg?.tpRate.toFixed(1)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* B2B Performance */}
      {b2bPerformance && b2bPerformance.segments.length > 0 && (
        <div className={`backdrop-blur rounded-2xl p-6 border space-y-4 ${
          isAudley
            ? 'bg-white border-[#ede8e0]'
            : 'bg-slate-800/50 border-slate-700/50'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h3 className={`text-lg font-semibold flex items-center gap-2 ${isAudley ? 'text-[#0a1628]' : 'text-white'}`}>
              <svg className={`w-5 h-5 ${isAudley ? 'text-blue-600' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              B2B vs B2C T&gt;P Performance
            </h3>
            {/* Timeframe Toggle */}
            <SlidingPillGroup
              options={[
                { value: 'lastWeek', label: 'Last Wk' },
                { value: 'thisMonth', label: 'This Mo' },
                { value: 'lastMonth', label: 'Last Mo' },
                { value: 'thisQuarter', label: 'This Q' },
                { value: 'lastQuarter', label: 'Last Q' },
                { value: 'lastYear', label: 'Last Yr' },
                { value: 'all', label: 'All' },
              ]}
              value={b2bTimeframe}
              onChange={(v) => setB2bTimeframe(v as RegionalTimeframe)}
              activeGradient={{ light: 'linear-gradient(to right, #2563eb, #3b82f6)', dark: 'linear-gradient(to right, #2563eb, #3b82f6)' }}
              size="sm"
            />
          </div>

          {/* Department Level Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {b2bPerformance.segments.map((seg) => (
              <div
                key={seg.segment}
                className={`rounded-lg p-4 border ${
                  seg.segment === 'B2B'
                    ? isAudley
                      ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
                      : 'bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border-blue-500/30'
                    : isAudley
                      ? 'bg-[#faf8f5] border-[#ede8e0]'
                      : 'bg-gradient-to-br from-slate-700/30 to-slate-800/30 border-slate-600/30'
                }`}
              >
                <div className={`text-xs mb-1 ${isAudley ? 'text-[#7a7a7a]' : 'text-slate-400'}`}>{seg.segment}</div>
                <div className={`text-2xl font-bold ${seg.segment === 'B2B' ? (isAudley ? 'text-blue-600' : 'text-blue-400') : (isAudley ? 'text-[#0a1628]' : 'text-white')}`}>
                  {seg.tpRate.toFixed(1)}%
                </div>
                <div className={`text-xs mt-1 ${isAudley ? 'text-slate-400' : 'text-slate-500'}`}>
                  {seg.passthroughs}/{seg.trips} trips
                </div>
              </div>
            ))}
            <div className={`rounded-lg p-4 border ${
              isAudley
                ? 'bg-[#faf8f5] border-[#ede8e0]'
                : 'bg-slate-800/40 border-slate-700/30'
            }`}>
              <div className={`text-xs mb-1 ${isAudley ? 'text-[#7a7a7a]' : 'text-slate-400'}`}>Total</div>
              <div className={`text-2xl font-bold ${isAudley ? 'text-[#0a1628]' : 'text-white'}`}>{b2bPerformance.totalTrips.toLocaleString()}</div>
              <div className={`text-xs mt-1 ${isAudley ? 'text-slate-400' : 'text-slate-500'}`}>trips analyzed</div>
            </div>
            {b2bPerformance.segments.length === 2 && (
              <div className={`rounded-lg p-4 border ${
                isAudley
                  ? 'bg-[#faf8f5] border-[#ede8e0]'
                  : 'bg-slate-800/40 border-slate-700/30'
              }`}>
                <div className={`text-xs mb-1 ${isAudley ? 'text-[#7a7a7a]' : 'text-slate-400'}`}>Difference</div>
                <div className={`text-2xl font-bold ${
                  (b2bPerformance.segments[0]?.tpRate || 0) > (b2bPerformance.segments[1]?.tpRate || 0)
                    ? (isAudley ? 'text-blue-600' : 'text-blue-400') : (isAudley ? 'text-rose-600' : 'text-rose-400')
                }`}>
                  {b2bPerformance.segments[0] && b2bPerformance.segments[1]
                    ? `${((b2bPerformance.segments[0].tpRate - b2bPerformance.segments[1].tpRate) > 0 ? '+' : '')}${(b2bPerformance.segments[0].tpRate - b2bPerformance.segments[1].tpRate).toFixed(1)}pp`
                    : '—'}
                </div>
                <div className={`text-xs mt-1 ${isAudley ? 'text-slate-400' : 'text-slate-500'}`}>
                  {b2bPerformance.segments[0]?.segment} vs {b2bPerformance.segments[1]?.segment}
                </div>
              </div>
            )}
          </div>

          {/* Agent Level Breakdown */}
          {b2bByAgent.length > 0 && (
            <div className={`rounded-lg p-4 border ${
              isAudley
                ? 'bg-[#faf8f5] border-[#ede8e0]'
                : 'bg-slate-900/50 border-slate-700/50'
            }`}>
              <h5 className={`text-xs font-medium mb-3 ${isAudley ? 'text-[#4a4a4a]' : 'text-slate-400'}`}>Agent Performance by Business Type</h5>
              <select
                value={selectedAgentForB2B}
                onChange={(e) => setSelectedAgentForB2B(e.target.value)}
                className={`border rounded-lg px-3 py-2 text-sm mb-3 ${
                  isAudley
                    ? 'bg-white border-[#ede8e0] text-[#0a1628]'
                    : 'bg-slate-700/50 border-slate-600 text-white'
                }`}
              >
                <option value="">Select agent...</option>
                {b2bByAgent.map(a => (
                  <option key={a.agentName} value={a.agentName}>
                    {a.agentName} ({a.totalTrips} trips)
                  </option>
                ))}
              </select>

              {selectedB2BAgentData && (
                <div className="grid grid-cols-2 gap-3">
                  {selectedB2BAgentData.segments.map(seg => (
                    <div
                      key={seg.segment}
                      className={`rounded-lg p-3 ${
                        seg.segment === 'B2B'
                          ? isAudley ? 'bg-blue-50' : 'bg-blue-900/30'
                          : isAudley ? 'bg-[#faf8f5]' : 'bg-slate-700/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm ${isAudley ? 'text-slate-700' : 'text-slate-300'}`}>{seg.segment}</span>
                        <span className={`text-lg font-bold ${seg.segment === 'B2B' ? (isAudley ? 'text-blue-600' : 'text-blue-400') : (isAudley ? 'text-[#0a1628]' : 'text-white')}`}>
                          {seg.tpRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className={`text-xs ${isAudley ? 'text-[#7a7a7a]' : 'text-slate-500'}`}>
                        {seg.passthroughs} passthroughs / {seg.trips} trips
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Agent Rankings by Senior/Non-Senior for B2B */}
          {(b2bAgentRankings.seniorTop3.length > 0 || b2bAgentRankings.nonSeniorTop3.length > 0) && (
            <div className={`rounded-lg p-4 border ${
              isAudley
                ? 'bg-[#faf8f5] border-[#ede8e0]'
                : 'bg-slate-900/50 border-slate-700/50'
            }`}>
              <h5 className={`text-xs font-medium mb-4 ${isAudley ? 'text-[#4a4a4a]' : 'text-slate-400'}`}>Agent Rankings - B2B T&gt;P</h5>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Senior Agents */}
                {b2bAgentRankings.seniorTop3.length > 0 && (
                  <div className="space-y-3">
                    <div className={`text-xs font-medium ${isAudley ? 'text-blue-600' : 'text-blue-400'}`}>Senior Agents</div>
                    {/* Top 3 */}
                    <div className={`rounded-lg p-3 border ${
                      isAudley
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-blue-900/20 border-blue-700/30'
                    }`}>
                      <div className={`text-xs mb-2 ${isAudley ? 'text-blue-700' : 'text-blue-300'}`}>Top Performers</div>
                      <div className="space-y-1.5">
                        {b2bAgentRankings.seniorTop3.map((agent, i) => {
                          const b2bSeg = agent.segments.find(s => s.segment === 'B2B');
                          return (
                            <div key={agent.agentName} className="flex items-center justify-between text-sm">
                              <span className={`truncate max-w-[150px] ${isAudley ? 'text-slate-700' : 'text-slate-300'}`}>
                                <span className={`mr-1 ${isAudley ? 'text-blue-600' : 'text-blue-400'}`}>{i + 1}.</span>
                                {agent.agentName}
                              </span>
                              <span className={`font-medium ${isAudley ? 'text-blue-600' : 'text-blue-400'}`}>{b2bSeg?.tpRate.toFixed(1)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Bottom 3 */}
                    {b2bAgentRankings.seniorBottom3.length > 0 && (
                      <div className={`rounded-lg p-3 border ${
                        isAudley
                          ? 'bg-rose-50 border-rose-200'
                          : 'bg-rose-900/20 border-rose-700/30'
                      }`}>
                        <div className={`text-xs mb-2 ${isAudley ? 'text-rose-700' : 'text-rose-300'}`}>Needs Improvement</div>
                        <div className="space-y-1.5">
                          {b2bAgentRankings.seniorBottom3.map((agent) => {
                            const b2bSeg = agent.segments.find(s => s.segment === 'B2B');
                            return (
                              <div key={agent.agentName} className="flex items-center justify-between text-sm">
                                <span className={`truncate max-w-[150px] ${isAudley ? 'text-slate-700' : 'text-slate-300'}`}>{agent.agentName}</span>
                                <span className={`font-medium ${isAudley ? 'text-rose-600' : 'text-rose-400'}`}>{b2bSeg?.tpRate.toFixed(1)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Non-Senior Agents */}
                {b2bAgentRankings.nonSeniorTop3.length > 0 && (
                  <div className="space-y-3">
                    <div className={`text-xs font-medium ${isAudley ? 'text-[#4a4a4a]' : 'text-slate-400'}`}>Non-Senior Agents</div>
                    {/* Top 3 */}
                    <div className={`rounded-lg p-3 border ${
                      isAudley
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-blue-900/20 border-blue-700/30'
                    }`}>
                      <div className={`text-xs mb-2 ${isAudley ? 'text-blue-700' : 'text-blue-300'}`}>Top Performers</div>
                      <div className="space-y-1.5">
                        {b2bAgentRankings.nonSeniorTop3.map((agent, i) => {
                          const b2bSeg = agent.segments.find(s => s.segment === 'B2B');
                          return (
                            <div key={agent.agentName} className="flex items-center justify-between text-sm">
                              <span className={`truncate max-w-[150px] ${isAudley ? 'text-slate-700' : 'text-slate-300'}`}>
                                <span className={`mr-1 ${isAudley ? 'text-blue-600' : 'text-blue-400'}`}>{i + 1}.</span>
                                {agent.agentName}
                              </span>
                              <span className={`font-medium ${isAudley ? 'text-blue-600' : 'text-blue-400'}`}>{b2bSeg?.tpRate.toFixed(1)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Bottom 3 */}
                    {b2bAgentRankings.nonSeniorBottom3.length > 0 && (
                      <div className={`rounded-lg p-3 border ${
                        isAudley
                          ? 'bg-rose-50 border-rose-200'
                          : 'bg-rose-900/20 border-rose-700/30'
                      }`}>
                        <div className={`text-xs mb-2 ${isAudley ? 'text-rose-700' : 'text-rose-300'}`}>Needs Improvement</div>
                        <div className="space-y-1.5">
                          {b2bAgentRankings.nonSeniorBottom3.map((agent) => {
                            const b2bSeg = agent.segments.find(s => s.segment === 'B2B');
                            return (
                              <div key={agent.agentName} className="flex items-center justify-between text-sm">
                                <span className={`truncate max-w-[150px] ${isAudley ? 'text-slate-700' : 'text-slate-300'}`}>{agent.agentName}</span>
                                <span className={`font-medium ${isAudley ? 'text-rose-600' : 'text-rose-400'}`}>{b2bSeg?.tpRate.toFixed(1)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
