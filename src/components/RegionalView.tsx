import { useState, useMemo } from 'react';
import type { RawParsedData } from '../utils/indexedDB';
import {
  analyzeRegionalPerformance,
  analyzeAgentRegionalDeviations,
  generateDepartmentRecommendations,
  generatePqDepartmentRecommendations,
  extractUSPrograms,
  extractProgramDestinationAssociations,
  generateMeetingAgendaData,
  type RegionalTimeframe,
  type DepartmentRegionalPerformance,
  type AgentRegionalAnalysis,
  type DepartmentImprovementRecommendation,
  type MeetingAgendaData,
} from '../utils/insightsAnalytics';
import { generatePDFDocument, generatePowerPoint } from '../utils/documentGenerator';

interface RegionalViewProps {
  rawData: RawParsedData;
  seniors: string[];
}

type SortColumn = 'region' | 'tpRate' | 'hotPassRate' | 'pqRate' | 'trips' | 'passthroughs';
type SortDirection = 'asc' | 'desc';

type RecommendationType = 'tp' | 'pq';

export const RegionalView: React.FC<RegionalViewProps> = ({ rawData, seniors: _seniors }) => {
  const [regionalTimeframe, setRegionalTimeframe] = useState<RegionalTimeframe>('all');
  const [selectedAgentForRegions, setSelectedAgentForRegions] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('tpRate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [recommendationType, setRecommendationType] = useState<RecommendationType>('tp');

  // Meeting agenda state
  const [showAgendaModal, setShowAgendaModal] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [agendaData, setAgendaData] = useState<MeetingAgendaData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Regional performance analysis
  const filteredRegionalPerformance = useMemo((): DepartmentRegionalPerformance | null => {
    if (!rawData.trips || rawData.trips.length === 0) return null;
    return analyzeRegionalPerformance(rawData.trips, regionalTimeframe, rawData.hotPass, rawData.quotes);
  }, [rawData.trips, rawData.hotPass, rawData.quotes, regionalTimeframe]);

  const filteredAgentRegionalAnalysis = useMemo((): AgentRegionalAnalysis[] => {
    if (!rawData.trips || rawData.trips.length === 0 || !filteredRegionalPerformance) return [];
    return analyzeAgentRegionalDeviations(rawData.trips, filteredRegionalPerformance, regionalTimeframe);
  }, [rawData.trips, filteredRegionalPerformance, regionalTimeframe]);

  const departmentRecommendations = useMemo((): DepartmentImprovementRecommendation[] => {
    if (!filteredRegionalPerformance) return [];
    return generateDepartmentRecommendations(filteredRegionalPerformance);
  }, [filteredRegionalPerformance]);

  const pqDepartmentRecommendations = useMemo((): DepartmentImprovementRecommendation[] => {
    if (!filteredRegionalPerformance) return [];
    return generatePqDepartmentRecommendations(filteredRegionalPerformance);
  }, [filteredRegionalPerformance]);

  // Get the active recommendations based on toggle
  const activeRecommendations = recommendationType === 'tp' ? departmentRecommendations : pqDepartmentRecommendations;

  // Available US Programs for meeting agenda
  const availablePrograms = useMemo(() => {
    return extractUSPrograms(rawData);
  }, [rawData]);

  // Handle agenda generation
  const handleGenerateAgenda = () => {
    if (!selectedProgram) return;

    const data = generateMeetingAgendaData(rawData, selectedProgram, regionalTimeframe);
    setAgendaData(data);
  };

  // Handle PDF document download
  const handleDownloadPDF = async () => {
    if (!agendaData) {
      console.error('No agenda data available');
      return;
    }
    setIsGenerating(true);
    try {
      await generatePDFDocument(agendaData);
    } catch (err) {
      console.error('Failed to generate PDF document:', err);
      alert('Failed to generate PDF. Please check the console for details.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle PowerPoint download
  const handleDownloadPowerPoint = async () => {
    if (!agendaData) {
      console.error('No agenda data available');
      return;
    }
    setIsGenerating(true);
    try {
      await generatePowerPoint(agendaData);
    } catch (err) {
      console.error('Failed to generate PowerPoint:', err);
      alert('Failed to generate PowerPoint. Please check the console for details.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle download both
  const handleDownloadBoth = async () => {
    if (!agendaData) return;
    setIsGenerating(true);
    try {
      await generatePDFDocument(agendaData);
      // Small delay between downloads to prevent browser issues
      await new Promise(resolve => setTimeout(resolve, 500));
      await generatePowerPoint(agendaData);
    } catch (err) {
      console.error('Failed to generate documents:', err);
      alert('Failed to generate documents. Please check the console for details.');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedAgentAnalysis = useMemo(() => {
    if (!selectedAgentForRegions) return null;
    return filteredAgentRegionalAnalysis.find(a => a.agentName === selectedAgentForRegions) || null;
  }, [filteredAgentRegionalAnalysis, selectedAgentForRegions]);

  // Sorted regions for the table
  const sortedRegions = useMemo(() => {
    if (!filteredRegionalPerformance) return [];
    const regions = [...filteredRegionalPerformance.allRegions];

    regions.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortColumn) {
        case 'region':
          aVal = a.region.toLowerCase();
          bVal = b.region.toLowerCase();
          break;
        case 'tpRate':
          aVal = a.tpRate;
          bVal = b.tpRate;
          break;
        case 'hotPassRate':
          aVal = a.hotPassRate;
          bVal = b.hotPassRate;
          break;
        case 'pqRate':
          aVal = a.pqRate;
          bVal = b.pqRate;
          break;
        case 'trips':
          aVal = a.trips;
          bVal = b.trips;
          break;
        case 'passthroughs':
          aVal = a.passthroughs;
          bVal = b.passthroughs;
          break;
        default:
          aVal = a.tpRate;
          bVal = b.tpRate;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return regions;
  }, [filteredRegionalPerformance, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'region' ? 'asc' : 'desc');
    }
  };

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <span className="text-slate-600 ml-1">↕</span>;
    }
    return <span className="text-teal-400 ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  if (!filteredRegionalPerformance || filteredRegionalPerformance.allRegions.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-xl font-semibold text-white mb-2">No Regional Data Available</h2>
        <p className="text-slate-400 max-w-md mx-auto">
          Upload trip data with a Destination column to see regional performance analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Regional Performance
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            T&gt;P conversion rates by destination with training opportunities
          </p>
        </div>
        {/* Create Champ Meeting Button */}
        {availablePrograms.length > 0 && (
          <button
            onClick={() => {
              // Log program-destination associations for debugging
              extractProgramDestinationAssociations(rawData);
              setShowAgendaModal(true);
              setSelectedProgram('');
              setAgendaData(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg transition-all shadow-lg hover:shadow-indigo-500/25 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            Create Champ Meeting
          </button>
        )}
      </div>

      {/* Timeframe Toggle */}
      <div className="flex flex-wrap gap-1 bg-slate-800/50 p-1 rounded-lg w-fit">
        {[
          { value: 'lastWeek', label: 'Last Week' },
          { value: 'thisMonth', label: 'This Month' },
          { value: 'lastMonth', label: 'Last Month' },
          { value: 'thisQuarter', label: 'This Qtr' },
          { value: 'lastQuarter', label: 'Last Qtr' },
          { value: 'lastYear', label: 'Last Year' },
          { value: 'all', label: 'All Time' },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setRegionalTimeframe(value as RegionalTimeframe)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              regionalTimeframe === value
                ? 'bg-teal-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Department Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-2xl font-bold text-white">{filteredRegionalPerformance.totalTrips.toLocaleString()}</div>
          <div className="text-sm text-slate-400">Total Trips</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-2xl font-bold text-white">{filteredRegionalPerformance.totalPassthroughs.toLocaleString()}</div>
          <div className="text-sm text-slate-400">Passthroughs</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-2xl font-bold text-teal-400">{filteredRegionalPerformance.overallTpRate.toFixed(1)}%</div>
          <div className="text-sm text-slate-400">Overall T&gt;P Rate</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-2xl font-bold text-amber-400">{filteredRegionalPerformance.overallHotPassRate.toFixed(1)}%</div>
          <div className="text-sm text-slate-400">Hot Pass Rate</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-2xl font-bold text-purple-400">{filteredRegionalPerformance.overallPqRate.toFixed(1)}%</div>
          <div className="text-sm text-slate-400">P&gt;Q Rate</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-2xl font-bold text-white">{filteredRegionalPerformance.allRegions.length}</div>
          <div className="text-sm text-slate-400">Destinations</div>
        </div>
      </div>

      {/* Top & Bottom Regions Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Performing Regions */}
        <div className="bg-gradient-to-br from-teal-600/20 to-emerald-600/20 rounded-xl p-5 border border-teal-500/30">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <h3 className="text-base font-medium text-teal-300">Top Performing Destinations</h3>
          </div>
          <div className="space-y-3">
            {filteredRegionalPerformance.topRegions.slice(0, 5).map((region, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-teal-400 font-bold w-6">{i + 1}.</span>
                  <span className="text-sm text-white">{region.region}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-teal-400">{region.tpRate.toFixed(1)}%</span>
                  <span className="text-xs text-slate-500 ml-2">({region.passthroughs}/{region.trips})</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Needs Improvement Regions */}
        <div className="bg-gradient-to-br from-rose-600/20 to-red-600/20 rounded-xl p-5 border border-rose-500/30">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
            <h3 className="text-base font-medium text-rose-300">Training Opportunities</h3>
          </div>
          <div className="space-y-3">
            {filteredRegionalPerformance.bottomRegions.slice(0, 5).map((region, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-rose-400 font-bold w-6">{i + 1}.</span>
                  <span className="text-sm text-white">{region.region}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-rose-400">{region.tpRate.toFixed(1)}%</span>
                  <span className="text-xs text-slate-500 ml-2">({region.passthroughs}/{region.trips})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hot Pass Performance Cards */}
      {filteredRegionalPerformance.totalHotPasses > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Best Hot Pass Destinations */}
          <div className="bg-gradient-to-br from-amber-600/20 to-orange-600/20 rounded-xl p-5 border border-amber-500/30">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
              <h3 className="text-base font-medium text-amber-300">Best Hot Pass Destinations</h3>
            </div>
            <div className="space-y-3">
              {filteredRegionalPerformance.topHotPassRegions.length > 0 ? (
                filteredRegionalPerformance.topHotPassRegions.slice(0, 5).map((region, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-amber-400 font-bold w-6">{i + 1}.</span>
                      <span className="text-sm text-white">{region.region}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-amber-400">{region.hotPassRate.toFixed(1)}%</span>
                      <span className="text-xs text-slate-500 ml-2">({region.hotPasses}/{region.passthroughs})</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">No hot pass data available for destinations</div>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-amber-500/20 text-xs text-slate-400">
              <span className="text-amber-400 font-medium">T&gt;P</span> and <span className="text-purple-400 font-medium">P&gt;Q</span> rates for top hot pass destinations:
              {filteredRegionalPerformance.topHotPassRegions.slice(0, 3).map((r, i) => (
                <span key={i} className="ml-2">
                  {r.region.split(' ')[0]}: <span className="text-teal-400">{r.tpRate.toFixed(0)}%</span>/<span className="text-purple-400">{r.pqRate.toFixed(0)}%</span>
                </span>
              ))}
            </div>
          </div>

          {/* Lowest Hot Pass Destinations */}
          <div className="bg-gradient-to-br from-slate-600/20 to-slate-700/20 rounded-xl p-5 border border-slate-500/30">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
              <h3 className="text-base font-medium text-slate-300">Hot Pass Improvement Opportunities</h3>
            </div>
            <div className="space-y-3">
              {filteredRegionalPerformance.bottomHotPassRegions.length > 0 ? (
                filteredRegionalPerformance.bottomHotPassRegions.slice(0, 5).map((region, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-400 font-bold w-6">{i + 1}.</span>
                      <span className="text-sm text-white">{region.region}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-400">{region.hotPassRate.toFixed(1)}%</span>
                      <span className="text-xs text-slate-500 ml-2">({region.hotPasses}/{region.passthroughs})</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">No hot pass improvement data available</div>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-500/20 text-xs text-slate-400">
              <span className="text-amber-400 font-medium">T&gt;P</span> and <span className="text-purple-400 font-medium">P&gt;Q</span> rates for these destinations:
              {filteredRegionalPerformance.bottomHotPassRegions.slice(0, 3).map((r, i) => (
                <span key={i} className="ml-2">
                  {r.region.split(' ')[0]}: <span className="text-teal-400">{r.tpRate.toFixed(0)}%</span>/<span className="text-purple-400">{r.pqRate.toFixed(0)}%</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Department Improvement Recommendations */}
      {(departmentRecommendations.length > 0 || pqDepartmentRecommendations.length > 0) && (
        <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 rounded-xl p-5 border border-indigo-600/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="text-base font-medium text-indigo-300">Recommended Focus Areas</h3>
              <span className="text-xs text-indigo-500/70">
                {recommendationType === 'tp' ? 'T>P training opportunities' : 'P>Q quoting opportunities'}
              </span>
            </div>
            {/* T>P / P>Q Toggle */}
            <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg">
              <button
                onClick={() => setRecommendationType('tp')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  recommendationType === 'tp'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                T&gt;P
              </button>
              <button
                onClick={() => setRecommendationType('pq')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  recommendationType === 'pq'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                P&gt;Q
              </button>
            </div>
          </div>
          {activeRecommendations.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {activeRecommendations.map((rec, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-4 border ${
                    rec.priority === 'high'
                      ? 'bg-rose-900/30 border-rose-600/40'
                      : rec.priority === 'medium'
                      ? 'bg-amber-900/30 border-amber-600/40'
                      : 'bg-slate-800/50 border-slate-600/40'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      rec.priority === 'high'
                        ? 'bg-rose-500/30 text-rose-300'
                        : rec.priority === 'medium'
                        ? 'bg-amber-500/30 text-amber-300'
                        : 'bg-slate-500/30 text-slate-300'
                    }`}>
                      {rec.priority.toUpperCase()}
                    </span>
                    <span className="text-white font-medium text-sm truncate">{rec.region}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm">
                      <span className={`font-medium ${recommendationType === 'tp' ? 'text-rose-400' : 'text-purple-400'}`}>
                        {rec.tpRate.toFixed(1)}%
                      </span>
                      <span className="text-slate-500 mx-1">vs</span>
                      <span className="text-slate-300">{rec.departmentAvgRate.toFixed(1)}% avg</span>
                    </div>
                    <span className={`text-xs ${recommendationType === 'tp' ? 'text-rose-400' : 'text-purple-400'}`}>
                      {rec.deviation.toFixed(1)}pp
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{rec.reason}</p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{rec.trips} {recommendationType === 'tp' ? 'trips' : 'passthroughs'}</span>
                    {rec.potentialGain > 0 && (
                      <span className={recommendationType === 'tp' ? 'text-teal-400' : 'text-purple-400'}>
                        +{Math.round(rec.potentialGain)} potential {recommendationType === 'tp' ? 'PT' : 'quotes'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 text-center py-4">
              No {recommendationType === 'tp' ? 'T>P' : 'P>Q'} improvement recommendations available for this timeframe.
            </div>
          )}
        </div>
      )}

      {/* All Regions Table */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
        <h3 className="text-base font-medium text-slate-300 mb-4">
          All Destinations ({filteredRegionalPerformance.allRegions.length} destinations)
          <span className="text-xs text-slate-500 ml-2">Click column headers to sort</span>
        </h3>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-800">
              <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                <th className="pb-2 pl-2">#</th>
                <th
                  className="pb-2 cursor-pointer hover:text-white select-none"
                  onClick={() => handleSort('region')}
                >
                  Destination<SortIndicator column="region" />
                </th>
                <th
                  className="pb-2 text-right cursor-pointer hover:text-white select-none"
                  onClick={() => handleSort('tpRate')}
                >
                  T&gt;P<SortIndicator column="tpRate" />
                </th>
                <th
                  className="pb-2 text-right cursor-pointer hover:text-white select-none"
                  onClick={() => handleSort('hotPassRate')}
                >
                  HP Rate<SortIndicator column="hotPassRate" />
                </th>
                <th
                  className="pb-2 text-right cursor-pointer hover:text-white select-none"
                  onClick={() => handleSort('pqRate')}
                >
                  P&gt;Q<SortIndicator column="pqRate" />
                </th>
                <th
                  className="pb-2 text-right cursor-pointer hover:text-white select-none"
                  onClick={() => handleSort('trips')}
                >
                  Trips<SortIndicator column="trips" />
                </th>
                <th
                  className="pb-2 text-right pr-2 cursor-pointer hover:text-white select-none"
                  onClick={() => handleSort('passthroughs')}
                >
                  PT<SortIndicator column="passthroughs" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRegions.map((region, index) => {
                const tpColor = region.tpRate >= filteredRegionalPerformance.overallTpRate ? 'text-teal-400' : 'text-rose-400';
                const hpColor = region.hotPassRate >= filteredRegionalPerformance.overallHotPassRate ? 'text-amber-400' : 'text-slate-400';
                const pqColor = region.pqRate >= filteredRegionalPerformance.overallPqRate ? 'text-purple-400' : 'text-slate-400';
                return (
                  <tr
                    key={region.region}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="py-2 pl-2 text-xs text-slate-500">{index + 1}</td>
                    <td className="py-2 text-sm text-slate-200">{region.region}</td>
                    <td className={`py-2 text-right text-sm font-medium ${tpColor}`}>
                      {region.tpRate.toFixed(1)}%
                    </td>
                    <td className={`py-2 text-right text-sm ${hpColor}`}>
                      {region.passthroughs > 0 ? `${region.hotPassRate.toFixed(1)}%` : '-'}
                    </td>
                    <td className={`py-2 text-right text-sm ${pqColor}`}>
                      {region.passthroughs > 0 ? `${region.pqRate.toFixed(1)}%` : '-'}
                    </td>
                    <td className="py-2 text-right text-sm text-slate-400">{region.trips}</td>
                    <td className="py-2 text-right text-sm text-slate-400 pr-2">{region.passthroughs}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent Regional Performance */}
      {filteredAgentRegionalAnalysis.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
          <h3 className="text-base font-medium text-slate-300 mb-4">Agent Regional Performance vs Department</h3>
          <div className="space-y-4">
            <select
              value={selectedAgentForRegions}
              onChange={(e) => setSelectedAgentForRegions(e.target.value)}
              className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white min-w-[280px]"
            >
              <option value="">Select agent to analyze...</option>
              {filteredAgentRegionalAnalysis.map(a => (
                <option key={a.agentName} value={a.agentName}>
                  {a.agentName} ({a.totalTrips} trips, {a.overallTpRate.toFixed(1)}% T&gt;P)
                </option>
              ))}
            </select>

            {selectedAgentAnalysis && (
              <div className="space-y-6">
                {/* Agent Overview */}
                <div className="flex items-center gap-4 flex-wrap bg-slate-700/30 rounded-lg p-4">
                  <div className="text-lg text-white font-medium">{selectedAgentAnalysis.agentName}</div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-slate-400">{selectedAgentAnalysis.totalTrips} trips</span>
                    <span className="text-teal-400 font-medium">{selectedAgentAnalysis.overallTpRate.toFixed(1)}% T&gt;P</span>
                    <span className="text-slate-500">
                      (Dept avg: {filteredRegionalPerformance?.overallTpRate.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {/* Above/Below Department Average */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Above Average Regions */}
                  <div className="bg-teal-900/20 rounded-lg p-4 border border-teal-700/30">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      <span className="text-sm font-medium text-teal-300">Above Department Average</span>
                      <span className="text-xs text-teal-500">({selectedAgentAnalysis.aboveAverage.length} destinations)</span>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto space-y-2">
                      {selectedAgentAnalysis.aboveAverage.slice(0, 10).map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-sm bg-slate-800/50 rounded px-2 py-1.5">
                          <span className="text-slate-200 truncate max-w-[140px]">{d.region}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-white">{d.agentTpRate.toFixed(1)}%</span>
                            <span className="text-teal-400 text-xs font-medium">+{d.deviation.toFixed(1)}pp</span>
                          </div>
                        </div>
                      ))}
                      {selectedAgentAnalysis.aboveAverage.length === 0 && (
                        <div className="text-slate-500 text-xs">No destinations above department average</div>
                      )}
                    </div>
                  </div>

                  {/* Below Average Regions */}
                  <div className="bg-rose-900/20 rounded-lg p-4 border border-rose-700/30">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      <span className="text-sm font-medium text-rose-300">Below Department Average</span>
                      <span className="text-xs text-rose-500">({selectedAgentAnalysis.belowAverage.length} destinations)</span>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto space-y-2">
                      {selectedAgentAnalysis.belowAverage.slice(0, 10).map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-sm bg-slate-800/50 rounded px-2 py-1.5">
                          <span className="text-slate-200 truncate max-w-[140px]">{d.region}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-white">{d.agentTpRate.toFixed(1)}%</span>
                            <span className="text-rose-400 text-xs font-medium">{d.deviation.toFixed(1)}pp</span>
                          </div>
                        </div>
                      ))}
                      {selectedAgentAnalysis.belowAverage.length === 0 && (
                        <div className="text-slate-500 text-xs">No destinations below department average</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Agent Improvement Recommendations */}
                {selectedAgentAnalysis.recommendations.length > 0 && (
                  <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 rounded-xl p-4 border border-amber-600/30">
                    <div className="flex items-center gap-2 mb-4">
                      <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <h4 className="text-sm font-medium text-amber-300">Agent Training Focus Areas</h4>
                      <span className="text-xs text-amber-500/70">Based on deviation &amp; volume impact</span>
                    </div>
                    <div className="space-y-3">
                      {selectedAgentAnalysis.recommendations.map((rec, i) => (
                        <div
                          key={i}
                          className={`rounded-lg p-3 border ${
                            rec.priority === 'high'
                              ? 'bg-rose-900/30 border-rose-600/40'
                              : rec.priority === 'medium'
                              ? 'bg-amber-900/30 border-amber-600/40'
                              : 'bg-slate-800/50 border-slate-600/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                  rec.priority === 'high'
                                    ? 'bg-rose-500/30 text-rose-300'
                                    : rec.priority === 'medium'
                                    ? 'bg-amber-500/30 text-amber-300'
                                    : 'bg-slate-500/30 text-slate-300'
                                }`}>
                                  {rec.priority.toUpperCase()}
                                </span>
                                <span className="text-white font-medium">{rec.region}</span>
                              </div>
                              <p className="text-xs text-slate-400">{rec.reason}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm">
                                <span className="text-white">{rec.agentTpRate.toFixed(1)}%</span>
                                <span className="text-slate-500 mx-1">vs</span>
                                <span className="text-slate-300">{rec.departmentTpRate.toFixed(1)}%</span>
                              </div>
                              <div className="text-xs text-rose-400 font-medium">{rec.deviation.toFixed(1)}pp gap</div>
                              <div className="text-xs text-slate-500">{rec.agentTrips} agent / {rec.departmentTrips} dept trips</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Champ Meeting Modal */}
      {showAgendaModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-700 bg-gradient-to-r from-indigo-900/50 to-purple-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Create Champ Meeting</h3>
                  <p className="text-sm text-slate-400">Generate PDF & PowerPoint for your 30-min meeting</p>
                </div>
              </div>
              <button
                onClick={() => setShowAgendaModal(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 flex-1 overflow-y-auto">
              {!agendaData ? (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Which US Program is this meeting for?
                    </label>
                    <select
                      value={selectedProgram}
                      onChange={(e) => setSelectedProgram(e.target.value)}
                      className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white text-base"
                    >
                      <option value="">Select a program...</option>
                      {availablePrograms.map(program => (
                        <option key={program} value={program}>{program}</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-gradient-to-br from-slate-700/30 to-slate-800/30 rounded-xl p-5 border border-slate-600/50">
                    <p className="font-medium text-white mb-3 flex items-center gap-2">
                      <span className="text-lg">📋</span> Meeting Agenda (30 min)
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="w-2 h-2 bg-teal-400 rounded-full"></span>
                        T&gt;P Opportunities (10 min)
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                        P&gt;Q Opportunities (5 min)
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                        Agent Performance (10 min)
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
                        Actions & Next Steps (5 min)
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-700/20 rounded-xl p-5 border border-slate-600/30">
                    <p className="font-medium text-white mb-3 flex items-center gap-2">
                      <span className="text-lg">📦</span> You'll get:
                    </p>
                    <div className="flex gap-4">
                      <div className="flex-1 bg-slate-800/50 rounded-lg p-4 border border-slate-600/50">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                          </svg>
                          <span className="text-sm font-medium text-white">PDF Document</span>
                        </div>
                        <p className="text-xs text-slate-400">Detailed meeting agenda with stats</p>
                      </div>
                      <div className="flex-1 bg-slate-800/50 rounded-lg p-4 border border-slate-600/50">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
                            <path d="M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z"/>
                          </svg>
                          <span className="text-sm font-medium text-white">PowerPoint</span>
                        </div>
                        <p className="text-xs text-slate-400">Modern slides ready to present</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateAgenda}
                    disabled={!selectedProgram}
                    className={`w-full py-4 rounded-xl font-medium transition-all text-base ${
                      selectedProgram
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-indigo-500/25'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {selectedProgram ? `Generate Materials for ${selectedProgram}` : 'Select a Program'}
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Success State */}
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h4 className="text-xl font-semibold text-white mb-1">Materials Ready!</h4>
                    <p className="text-slate-400">Your meeting materials for <span className="text-indigo-400 font-medium">{selectedProgram}</span> are ready to download</p>
                  </div>

                  {/* Stats Preview */}
                  <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-teal-400">{agendaData.overallStats.tpRate.toFixed(1)}%</div>
                        <div className="text-xs text-slate-400">T&gt;P Rate</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-amber-400">{agendaData.overallStats.hotPassRate.toFixed(1)}%</div>
                        <div className="text-xs text-slate-400">Hot Pass Rate</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-400">{agendaData.overallStats.pqRate.toFixed(1)}%</div>
                        <div className="text-xs text-slate-400">P&gt;Q Rate</div>
                      </div>
                    </div>
                  </div>

                  {/* Download Options */}
                  <div className="space-y-3">
                    <button
                      onClick={handleDownloadBoth}
                      disabled={isGenerating}
                      className="w-full py-4 rounded-xl font-medium bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white transition-all shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <>
                          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download Both Files
                        </>
                      )}
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleDownloadPDF}
                        disabled={isGenerating}
                        className="py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                        </svg>
                        PDF Only
                      </button>
                      <button
                        onClick={handleDownloadPowerPoint}
                        disabled={isGenerating}
                        className="py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
                          <path d="M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z"/>
                        </svg>
                        PowerPoint Only
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {agendaData && (
              <div className="p-4 border-t border-slate-700 flex items-center justify-center">
                <button
                  onClick={() => {
                    setAgendaData(null);
                    setSelectedProgram('');
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm"
                >
                  ← Generate for Different Program
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
