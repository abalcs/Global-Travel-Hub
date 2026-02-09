import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileUpload } from './components/FileUpload';
import { ResultsTable } from './components/ResultsTable';
import { ConfigPanel } from './components/ConfigPanel';
import { TeamComparison } from './components/TeamComparison';
import { DateRangeFilter } from './components/DateRangeFilter';
import { TrendsView } from './components/TrendsView';
import { RegionalView } from './components/RegionalView';
import { InsightsView } from './components/InsightsView';
import { ChannelPerformanceView } from './components/ChannelPerformanceView';
import { RecordsView } from './components/RecordsView';
// RecordNotification import removed - notifications disabled
import { PresentationGenerator } from './components/PresentationGenerator';
import { AgentAnalytics } from './components/AgentAnalytics';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './contexts/ThemeContext';
import audleyLogo from './assets/audley-logo.png';
import type { Team, Metrics, FileUploadState, TimeSeriesData } from './types';
import type { CSVRow } from './utils/csvParser';
import { loadTeams, saveTeams, loadSeniors, saveSeniors, loadNewHires, saveNewHires, loadMetrics, saveMetrics, clearMetrics, loadTimeSeriesData, saveTimeSeriesData, clearTimeSeriesData } from './utils/storage';
import { loadRawDataFromDB, saveRawDataToDB, clearRawDataFromDB, type RawParsedData } from './utils/indexedDB';
import { useFileProcessor } from './hooks/useFileProcessor';
import {
  findAgentColumn,
  findDateColumn,
  countByAgentOptimized,
  countNonConvertedWithDates,
  buildTripDateMap,
  calculateMetrics,
  buildTimeSeriesOptimized,
  calculateSegmentDailyAverages,
  countRepeatByAgent,
  countB2bByAgent,
  countQuotesStartedByAgent
} from './utils/metricsCalculator';
import {
  loadRecords,
  saveRecords,
  analyzeAndUpdateRecords,
  type AllRecords,
} from './utils/recordsTracker';
import { parseDate } from './utils/dateParser';
import { findColumn, COLUMN_PATTERNS } from './utils/columnDetection';

function App() {
  const { isAudley } = useTheme();

  const [files, setFiles] = useState<FileUploadState>({
    passthroughs: null,
    trips: null,
    quotes: null,
    hotPass: null,
    bookings: null,
    nonConverted: null,
    quotesStarted: null,
  });

  const [teams, setTeams] = useState<Team[]>([]);
  const [seniors, setSeniors] = useState<string[]>([]);
  const [newHires, setNewHires] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<Metrics[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData | null>(null);
  const [rawParsedData, setRawParsedData] = useState<RawParsedData | null>(null);
  const [activeView, setActiveView] = useState<'summary' | 'regional' | 'channels' | 'trends' | 'insights' | 'records'>(() => {
    const saved = localStorage.getItem('gtt-active-view');
    if (saved === 'summary' || saved === 'regional' || saved === 'channels' || saved === 'trends' || saved === 'insights' || saved === 'records') {
      return saved;
    }
    return 'summary';
  });
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<AllRecords>(() => loadRecords());
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDataPanel, setShowDataPanel] = useState(true);

  const { processFiles: processFilesWithWorker, state: workerState } = useFileProcessor();

  useEffect(() => {
    setTeams(loadTeams());
    setSeniors(loadSeniors());
    setNewHires(loadNewHires());
    setMetrics(loadMetrics());
    setTimeSeriesData(loadTimeSeriesData());

    loadRawDataFromDB().then((data) => {
      if (data) {
        setRawParsedData(data);
        setShowDataPanel(false);
      }
    });
  }, []);

  // Persist active view tab
  useEffect(() => {
    localStorage.setItem('gtt-active-view', activeView);
  }, [activeView]);

  const handleTeamsChange = useCallback((newTeams: Team[]) => {
    setTeams(newTeams);
    saveTeams(newTeams);
  }, []);

  const handleSeniorsChange = useCallback((newSeniors: string[]) => {
    setSeniors(newSeniors);
    saveSeniors(newSeniors);
  }, []);

  const handleNewHiresChange = useCallback((updatedNewHires: string[]) => {
    setNewHires(updatedNewHires);
    saveNewHires(updatedNewHires);
  }, []);

  const handleFileSelect = useCallback(
    (type: keyof FileUploadState) => (file: File | null) => {
      setFiles((prev) => ({ ...prev, [type]: file }));
      setError(null);
    },
    []
  );

  const processFiles = useCallback(async () => {
    const hasAllFiles = files.trips && files.quotes && files.passthroughs && files.hotPass && files.bookings && files.nonConverted;
    const hasStoredData = rawParsedData !== null;

    if (!hasAllFiles && !hasStoredData) {
      setError('Please upload all six files');
      return;
    }

    setError(null);

    try {
      let tripsRows: CSVRow[];
      let quotesRows: CSVRow[];
      let passthroughsRows: CSVRow[];
      let hotPassRows: CSVRow[];
      let bookingsRows: CSVRow[];
      let nonConvertedRows: CSVRow[];
      let quotesStartedRows: CSVRow[] = [];

      if (hasAllFiles) {
        const result = await processFilesWithWorker({
          trips: files.trips!,
          quotes: files.quotes!,
          passthroughs: files.passthroughs!,
          hotPass: files.hotPass!,
          bookings: files.bookings!,
          nonConverted: files.nonConverted!,
          quotesStarted: files.quotesStarted || undefined,
        });

        if (!result) {
          throw new Error('Failed to process files');
        }

        tripsRows = result.trips;
        quotesRows = result.quotes;
        passthroughsRows = result.passthroughs;
        hotPassRows = result.hotPass;
        bookingsRows = result.bookings;
        nonConvertedRows = result.nonConverted;
        quotesStartedRows = result.quotesStarted || [];

        const newRawData: RawParsedData = {
          trips: tripsRows,
          quotes: quotesRows,
          passthroughs: passthroughsRows,
          hotPass: hotPassRows,
          bookings: bookingsRows,
          nonConverted: nonConvertedRows,
          quotesStarted: quotesStartedRows,
        };
        saveRawDataToDB(newRawData);
        setRawParsedData(newRawData);
        setShowDataPanel(false);
      } else {
        tripsRows = rawParsedData!.trips;
        quotesRows = rawParsedData!.quotes;
        passthroughsRows = rawParsedData!.passthroughs;
        hotPassRows = rawParsedData!.hotPass;
        bookingsRows = rawParsedData!.bookings;
        nonConvertedRows = rawParsedData!.nonConverted;
        quotesStartedRows = rawParsedData!.quotesStarted || [];
        setShowDataPanel(false);
      }

      if (tripsRows.length === 0) {
        throw new Error('Trips file appears to be empty or invalid.');
      }

      const tripsAgentCol = findAgentColumn(tripsRows[0]);
      const quotesAgentCol = quotesRows.length > 0 ? findAgentColumn(quotesRows[0]) : null;
      const passthroughsAgentCol = passthroughsRows.length > 0 ? findAgentColumn(passthroughsRows[0]) : null;
      const hotPassAgentCol = hotPassRows.length > 0 ? findAgentColumn(hotPassRows[0]) : null;
      const bookingsAgentCol = bookingsRows.length > 0 ? findAgentColumn(bookingsRows[0]) : null;

      if (!tripsAgentCol) {
        throw new Error('Could not identify agent column in Trips file.');
      }

      const tripsDateCol = findDateColumn(tripsRows[0], ['created date', 'trip: created date']);
      const quotesDateCol = quotesRows.length > 0 ? findDateColumn(quotesRows[0], ['quote first sent', 'first sent date', 'created date']) : null;
      const passthroughsDateCol = passthroughsRows.length > 0 ? findDateColumn(passthroughsRows[0], ['passthrough to sales date', 'passthrough date', 'created date']) : null;
      const hotPassDateCol = hotPassRows.length > 0 ? findDateColumn(hotPassRows[0], ['passthrough to sales date', 'passthrough date', 'created date']) : null;
      const bookingsDateCol = bookingsRows.length > 0 ? findDateColumn(bookingsRows[0], ['created date', 'booking date', 'date']) : null;

      const tripKeys = Object.keys(tripsRows[0] || {});
      const tripNameColInTrips = tripKeys.find(k => {
        const lower = k.toLowerCase();
        return lower.includes('trip name') || lower === 'trip' || lower === 'name' || lower.includes('opportunity');
      });

      const tripDateMap = buildTripDateMap(tripsRows, tripNameColInTrips || null, tripsDateCol);

      const nonConvertedDateCol = nonConvertedRows.length > 0
        ? findDateColumn(nonConvertedRows[0], [
            'last modified', 'modified date', 'created date', 'lead created date',
            'trip created date', 'trip: created date', 'close date', 'timestamp'
          ])
        : null;

      const tripsResult = countByAgentOptimized(tripsRows, tripsAgentCol, tripsDateCol, startDate, endDate);
      const quotesResult = quotesAgentCol
        ? countByAgentOptimized(quotesRows, quotesAgentCol, quotesDateCol, startDate, endDate)
        : { total: new Map<string, number>(), byDate: new Map<string, Map<string, number>>() };
      const passthroughsResult = passthroughsAgentCol
        ? countByAgentOptimized(passthroughsRows, passthroughsAgentCol, passthroughsDateCol, startDate, endDate)
        : { total: new Map<string, number>(), byDate: new Map<string, Map<string, number>>() };
      const hotPassResult = hotPassAgentCol
        ? countByAgentOptimized(hotPassRows, hotPassAgentCol, hotPassDateCol, startDate, endDate)
        : { total: new Map<string, number>(), byDate: new Map<string, Map<string, number>>() };
      const bookingsResult = bookingsAgentCol
        ? countByAgentOptimized(bookingsRows, bookingsAgentCol, bookingsDateCol, startDate, endDate)
        : { total: new Map<string, number>(), byDate: new Map<string, Map<string, number>>() };

      const nonConvertedResult = countNonConvertedWithDates(
        nonConvertedRows,
        nonConvertedDateCol,
        startDate,
        endDate,
        tripDateMap
      );

      // Calculate repeat client and B2B data per agent
      const repeatData = countRepeatByAgent(tripsRows, tripsAgentCol, tripsDateCol, startDate, endDate);
      const b2bData = countB2bByAgent(tripsRows, tripsAgentCol, tripsDateCol, startDate, endDate);

      // Calculate quotes started per agent
      const quotesStartedData = countQuotesStartedByAgent(quotesStartedRows, startDate, endDate);

      const calculatedMetrics = calculateMetrics(
        tripsResult.total,
        quotesResult.total,
        passthroughsResult.total,
        hotPassResult.total,
        bookingsResult.total,
        nonConvertedResult.total,
        repeatData.repeatTrips,
        repeatData.repeatPassthroughs,
        b2bData.b2bTrips,
        b2bData.b2bPassthroughs,
        quotesStartedData
      );

      setMetrics(calculatedMetrics);
      saveMetrics(calculatedMetrics);

      const tsData = buildTimeSeriesOptimized(
        tripsResult.byDate,
        quotesResult.byDate,
        passthroughsResult.byDate,
        hotPassResult.byDate,
        bookingsResult.byDate,
        seniors,
        nonConvertedResult.byDate
      );

      // Calculate segment-specific daily averages from raw trips data
      const repeatClientDaily = calculateSegmentDailyAverages(tripsRows, 'repeat', startDate, endDate);
      const b2bDaily = calculateSegmentDailyAverages(tripsRows, 'b2b', startDate, endDate);

      // Add segment data to time series
      const tsDataWithSegments: TimeSeriesData = {
        ...tsData,
        repeatClientDaily: repeatClientDaily.length > 0 ? repeatClientDaily : undefined,
        b2bDaily: b2bDaily.length > 0 ? b2bDaily : undefined,
      };

      setTimeSeriesData(tsDataWithSegments);
      saveTimeSeriesData(tsDataWithSegments);

      // Analyze and update personal records
      const currentRecords = loadRecords();
      const { updatedRecords, updates } = analyzeAndUpdateRecords(tsDataWithSegments, currentRecords);

      if (updates.length > 0) {
        saveRecords(updatedRecords);
        setRecords(updatedRecords);
        // Notifications disabled - records shown in Records tab instead
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing files');
    }
  }, [files, startDate, endDate, rawParsedData, processFilesWithWorker, seniors]);

  const handleClearData = useCallback(() => {
    // Clear analyzed results but preserve stored raw data
    setMetrics([]);
    clearMetrics();
    setTimeSeriesData(null);
    clearTimeSeriesData();
    setFiles({
      passthroughs: null,
      trips: null,
      quotes: null,
      hotPass: null,
      bookings: null,
      nonConverted: null,
      quotesStarted: null,
    });
    setShowDataPanel(true);
  }, []);

  const handleClearStoredData = useCallback(() => {
    // Clear the stored raw data from IndexedDB
    setRawParsedData(null);
    clearRawDataFromDB();
  }, []);

  const handleClearDateFilter = useCallback(() => {
    setStartDate('');
    setEndDate('');
  }, []);

  const handleClearRecords = useCallback(() => {
    setRecords({ agents: {}, lastUpdated: new Date().toISOString() });
  }, []);


  const allAgentNames = useMemo(() => metrics.map((m) => m.agentName), [metrics]);
  const allFilesUploaded = files.trips && files.quotes && files.passthroughs && files.hotPass && files.bookings && files.nonConverted;
  const hasStoredData = rawParsedData !== null;
  const canAnalyze = allFilesUploaded || hasStoredData;
  const isProcessing = workerState.isProcessing;
  // Count required files (6) plus optional quotesStarted
  const requiredFilesCount = [files.trips, files.quotes, files.passthroughs, files.hotPass, files.bookings, files.nonConverted].filter(Boolean).length;
  const optionalFilesCount = files.quotesStarted ? 1 : 0;

  // Calculate date range from stored data
  const dataDateRange = useMemo(() => {
    if (!rawParsedData?.trips || rawParsedData.trips.length === 0) return null;

    // Find date column using centralized utility
    const dateCol = findColumn(rawParsedData.trips[0], COLUMN_PATTERNS.createdDate);
    if (!dateCol) return null;

    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const row of rawParsedData.trips) {
      const date = parseDate(row[dateCol] || '');
      if (date) {
        if (!minDate || date < minDate) minDate = date;
        if (!maxDate || date > maxDate) maxDate = date;
      }
    }

    if (!minDate || !maxDate) return null;

    // Format dates nicely
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return {
      start: formatDate(minDate),
      end: formatDate(maxDate),
    };
  }, [rawParsedData?.trips]);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isAudley
        ? 'bg-gradient-to-br from-[#e6f3fb] via-white to-[#f0f7fc]'
        : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
    }`}>
      {/* Audley Header Bar - Blue and Teal gradient */}
      {isAudley && (
        <div className="h-1.5 w-full bg-gradient-to-r from-[#007bc7] via-[#4d726d] to-[#007bc7]" />
      )}

      <div className={`max-w-7xl mx-auto px-4 ${isAudley ? 'py-4' : 'py-6'}`}>
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Audley Logo when in Audley theme */}
            {isAudley && (
              <div className="flex items-center gap-3 pr-4 border-r border-[#4d726d]/30">
                <img
                  src={audleyLogo}
                  alt="Audley Travel"
                  className="h-14 w-auto mix-blend-multiply"
                />
              </div>
            )}
            <div>
              <h1 className={`text-2xl font-bold flex items-center gap-2 transition-colors ${
                isAudley ? 'text-[#4d726d]' : 'text-white'
              }`}>
Global Travel Hub
              {!isAudley && (
              <svg className="w-7 h-7" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <radialGradient id="globeSphere" cx="30%" cy="30%" r="65%" fx="25%" fy="25%">
                    <stop offset="0%" stopColor="#7dd3fc"/>
                    <stop offset="40%" stopColor="#0ea5e9"/>
                    <stop offset="70%" stopColor="#0369a1"/>
                    <stop offset="100%" stopColor="#0c4a6e"/>
                  </radialGradient>
                  <radialGradient id="globeGreen" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#86efac"/>
                    <stop offset="40%" stopColor="#22c55e"/>
                    <stop offset="100%" stopColor="#14532d"/>
                  </radialGradient>
                  <radialGradient id="globeTan" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#fde68a"/>
                    <stop offset="50%" stopColor="#d97706"/>
                    <stop offset="100%" stopColor="#78350f"/>
                  </radialGradient>
                  <radialGradient id="globeShine" cx="25%" cy="20%" r="35%">
                    <stop offset="0%" stopColor="white" stopOpacity="0.7"/>
                    <stop offset="50%" stopColor="white" stopOpacity="0.2"/>
                    <stop offset="100%" stopColor="white" stopOpacity="0"/>
                  </radialGradient>
                  <radialGradient id="globeAtmo" cx="50%" cy="50%" r="50%">
                    <stop offset="85%" stopColor="#0ea5e9" stopOpacity="0"/>
                    <stop offset="95%" stopColor="#7dd3fc" stopOpacity="0.3"/>
                    <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.5"/>
                  </radialGradient>
                </defs>
                <circle cx="50" cy="50" r="47" fill="url(#globeSphere)"/>
                <g opacity="0.4">
                  <ellipse cx="50" cy="50" rx="47" ry="16" fill="none" stroke="#bae6fd" strokeWidth="0.4" transform="rotate(-23 50 50)"/>
                  <ellipse cx="50" cy="50" rx="47" ry="32" fill="none" stroke="#bae6fd" strokeWidth="0.4" transform="rotate(-23 50 50)"/>
                  <ellipse cx="50" cy="50" rx="16" ry="47" fill="none" stroke="#bae6fd" strokeWidth="0.4" transform="rotate(-23 50 50)"/>
                  <ellipse cx="50" cy="50" rx="32" ry="47" fill="none" stroke="#bae6fd" strokeWidth="0.4" transform="rotate(-23 50 50)"/>
                </g>
                <path d="M22 20 C20 18 18 20 16 24 C14 28 12 34 14 38 C16 42 22 46 28 48 C32 49 36 48 40 44 C44 40 46 34 44 28 C42 24 38 20 34 18 C30 16 26 17 24 19 L22 20 Z" fill="url(#globeGreen)"/>
                <path d="M18 52 C16 54 17 58 20 64 C22 68 24 74 22 80 C21 84 18 86 16 85" fill="none" stroke="url(#globeGreen)" strokeWidth="8" strokeLinecap="round"/>
                <path d="M44 18 C42 16 46 14 50 16 C54 18 56 22 58 28 C59 32 58 38 54 42 C50 46 44 44 42 38 C40 32 42 26 44 22 Z" fill="url(#globeGreen)"/>
                <path d="M48 46 C46 44 50 42 56 44 C62 46 68 52 70 60 C72 68 70 78 64 84 C58 88 50 86 46 80 C42 74 44 64 48 56 Z" fill="url(#globeGreen)"/>
                <path d="M52 58 C54 56 58 58 60 64 C62 70 58 76 54 74 C50 72 50 64 52 58 Z" fill="url(#globeTan)"/>
                <path d="M60 14 C58 12 64 10 72 12 C80 14 88 20 90 28 C92 36 88 44 80 48 C72 52 62 48 58 40 C54 32 58 22 64 16 Z" fill="url(#globeGreen)"/>
                <path d="M70 24 C72 22 78 24 80 30 C82 36 78 40 74 38 C70 36 68 28 70 24 Z" fill="url(#globeTan)"/>
                <path d="M78 56 C76 52 82 50 88 54 C92 58 94 66 90 74 C86 80 78 82 74 78 C70 74 72 64 78 56 Z" fill="url(#globeTan)"/>
                <circle cx="50" cy="50" r="47" fill="url(#globeAtmo)"/>
                <ellipse cx="32" cy="28" rx="16" ry="12" fill="url(#globeShine)"/>
              </svg>
              )}
            </h1>
            <p className={`text-sm transition-colors ${isAudley ? 'text-[#4d726d]/80' : 'text-slate-400'}`}>
              Analyze agent performance metrics
            </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {metrics.length > 0 ? (
              <div className="flex items-center gap-2">
                <PresentationGenerator metrics={metrics} seniors={seniors} teams={teams} rawData={rawParsedData} records={records} startDate={startDate} endDate={endDate} />
                <button
                  onClick={handleClearData}
                  className={`px-3 py-2 text-sm rounded-lg transition-all cursor-pointer active:scale-95 ${
                    isAudley
                      ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                      : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                  }`}
                >
                  Clear All
                </button>
              </div>
            ) : canAnalyze && (
            <button
              onClick={processFiles}
              disabled={isProcessing}
              className={`px-4 py-2 text-white rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95 ${
                isAudley
                  ? 'bg-gradient-to-r from-[#4d726d] to-[#007bc7] hover:from-[#3d5c58] hover:to-[#005a94] shadow-md shadow-[#4d726d]/20'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
              }`}
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{workerState.stage || 'Processing'}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Reload & Analyze</span>
                </>
              )}
            </button>
            )}
          </div>
        </header>

        {/* Data Source Panel - Collapsible */}
        <div className={`backdrop-blur rounded-xl border mb-4 overflow-hidden transition-colors ${
          isAudley
            ? 'bg-white border-[#007bc7]/20 shadow-sm shadow-[#007bc7]/5'
            : 'bg-slate-800/50 border-slate-700/50'
        }`}>
          <button
            onClick={() => setShowDataPanel(!showDataPanel)}
            className={`w-full px-4 py-3 flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] ${
              isAudley ? 'hover:bg-[#e6f3fb]/50' : 'hover:bg-slate-700/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className={`w-5 h-5 ${isAudley ? 'text-[#007bc7]' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className={`font-medium ${isAudley ? 'text-[#313131]' : 'text-white'}`}>Data Source</span>
              {hasStoredData && !showDataPanel && (
                <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${
                  isAudley
                    ? 'bg-[#007bc7]/10 text-[#007bc7] border border-[#007bc7]/20'
                    : 'bg-green-500/20 text-green-400'
                }`}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {dataDateRange
                    ? `${dataDateRange.start} — ${dataDateRange.end}`
                    : 'Data loaded'
                  }
                </span>
              )}
              {!hasStoredData && requiredFilesCount > 0 && (
                <span className={`px-2 py-0.5 rounded text-xs ${
                  isAudley ? 'bg-[#007bc7]/10 text-[#007bc7]' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {requiredFilesCount}/6 files{optionalFilesCount > 0 ? ' + 1 optional' : ''}
                </span>
              )}
            </div>
            <svg
              className={`w-5 h-5 transition-transform ${showDataPanel ? 'rotate-180' : ''} ${
                isAudley ? 'text-[#007bc7]' : 'text-slate-400'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div
            className={`grid transition-all duration-300 ease-in-out ${
              showDataPanel ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className={`px-4 pb-4 border-t pt-4 ${
                isAudley ? 'border-[#4d726d]/10' : 'border-slate-700/50'
              }`}>
              {/* Quick Load Button for stored data */}
              {hasStoredData && (
                <div className={`mb-4 rounded-lg p-4 ${
                  isAudley ? 'bg-[#4d726d]/5 border border-[#4d726d]/20' : 'bg-slate-700/30'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg className={`w-5 h-5 ${isAudley ? 'text-[#4d726d]' : 'text-green-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      <span className={`font-medium ${isAudley ? 'text-[#4d726d]' : 'text-white'}`}>Stored Dataset</span>
                      {dataDateRange && (
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          isAudley ? 'bg-[#4d726d]/10 text-[#4d726d]' : 'bg-green-500/20 text-green-400'
                        }`}>
                          {dataDateRange.start} — {dataDateRange.end}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleClearStoredData}
                      className={`text-xs transition-all px-2 py-1 rounded cursor-pointer active:scale-95 ${
                        isAudley ? 'text-slate-500 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                      }`}
                    >
                      Clear Stored Data
                    </button>
                  </div>
                  <button
                    onClick={processFiles}
                    disabled={isProcessing}
                    className={`w-full px-4 py-3 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] ${
                      isAudley
                        ? 'bg-gradient-to-r from-[#4d726d] to-[#007bc7] hover:from-[#3d5c58] hover:to-[#005a94] shadow-md shadow-[#4d726d]/20'
                        : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Reload & Analyze Dataset</span>
                  </button>
                  <p className={`text-xs text-center mt-2 ${isAudley ? 'text-slate-600' : 'text-slate-500'}`}>
                    Or upload new files below to replace the stored data
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <FileUpload
                  label="Trips"
                  file={files.trips}
                  onFileSelect={handleFileSelect('trips')}
                  color="blue"
                  icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>}
                />
                <FileUpload
                  label="Quotes"
                  file={files.quotes}
                  onFileSelect={handleFileSelect('quotes')}
                  color="green"
                  icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                />
                <FileUpload
                  label="Passthroughs"
                  file={files.passthroughs}
                  onFileSelect={handleFileSelect('passthroughs')}
                  color="purple"
                  icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
                />
                <FileUpload
                  label="Hot Pass"
                  file={files.hotPass}
                  onFileSelect={handleFileSelect('hotPass')}
                  color="orange"
                  icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>}
                />
                <FileUpload
                  label="Bookings"
                  file={files.bookings}
                  onFileSelect={handleFileSelect('bookings')}
                  color="cyan"
                  icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
                />
                <FileUpload
                  label="Non-Converted"
                  file={files.nonConverted}
                  onFileSelect={handleFileSelect('nonConverted')}
                  color="rose"
                  icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
                />
              </div>
              {/* Optional file: Quotes Started */}
              <div className={`mt-3 pt-3 border-t ${isAudley ? 'border-[#4d726d]/20' : 'border-slate-700/50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-medium ${isAudley ? 'text-slate-500' : 'text-slate-400'}`}>Optional</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <FileUpload
                    label="Quotes Started"
                    file={files.quotesStarted}
                    onFileSelect={handleFileSelect('quotesStarted')}
                    color="amber"
                    icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                  />
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className={`backdrop-blur rounded-xl border px-4 py-3 mb-4 ${
          isAudley
            ? 'bg-white border-[#007bc7]/20 shadow-sm'
            : 'bg-slate-800/50 border-slate-700/50'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onClear={handleClearDateFilter}
            />

            <div className="flex items-center gap-3">
              {isProcessing && workerState.progress > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full transition-all duration-300"
                      style={{ width: `${workerState.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400">{workerState.progress}%</span>
                </div>
              )}

              <button
                onClick={processFiles}
                disabled={!canAnalyze || isProcessing}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95 flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {workerState.stage || 'Processing'}
                  </>
                ) : (
                  'Analyze'
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* View Toggle & Config */}
        {metrics.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className={`rounded-lg p-1 flex gap-1 transition-colors ${
              isAudley
                ? 'bg-white border border-[#4d726d]/20 shadow-sm'
                : 'bg-slate-800/50'
            }`}>
              {(['summary', 'regional', 'channels', 'trends', 'insights', 'records'] as const).map((view) => {
                const isDisabled = (view === 'regional' || view === 'channels' || view === 'insights') && !rawParsedData;
                const isActive = activeView === view;
                const labels = {
                  summary: 'Summary',
                  regional: 'Regional',
                  channels: 'Channels',
                  trends: 'Trends',
                  insights: 'Insights',
                  records: 'Records'
                };

                return (
                  <button
                    key={view}
                    onClick={() => setActiveView(view)}
                    disabled={isDisabled}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer active:scale-95 ${
                      isActive
                        ? isAudley
                          ? 'bg-gradient-to-r from-[#4d726d] to-[#007bc7] text-white shadow-sm'
                          : 'bg-indigo-600 text-white'
                        : isAudley
                          ? 'text-[#4d726d] hover:text-[#007bc7] hover:bg-[#e6f3fb] disabled:opacity-50 disabled:cursor-not-allowed'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {labels[view]}
                  </button>
                );
              })}
            </div>

            {activeView === 'summary' && (
              <div className="flex-1 max-w-xl">
                <ConfigPanel
                  teams={teams}
                  onTeamsChange={handleTeamsChange}
                  seniors={seniors}
                  onSeniorsChange={handleSeniorsChange}
                  newHires={newHires}
                  onNewHiresChange={handleNewHiresChange}
                  availableAgents={allAgentNames}
                />
              </div>
            )}
          </div>
        )}

        {/* Summary View */}
        {activeView === 'summary' && metrics.length > 0 && (
          <div className="space-y-4">
            <TeamComparison metrics={metrics} teams={teams} seniors={seniors} />
            <ResultsTable metrics={metrics} teams={teams} seniors={seniors} newHires={newHires} />
            <AgentAnalytics metrics={metrics} seniors={seniors} />
          </div>
        )}

        {/* Regional View */}
        {activeView === 'regional' && rawParsedData && (
          <RegionalView rawData={rawParsedData} />
        )}

        {/* Channel Performance View */}
        {activeView === 'channels' && rawParsedData && (
          <ChannelPerformanceView rawData={rawParsedData} seniors={seniors} />
        )}

        {/* Trends View */}
        {activeView === 'trends' && timeSeriesData && (
          <TrendsView timeSeriesData={timeSeriesData} seniors={seniors} />
        )}

        {/* Insights View */}
        {activeView === 'insights' && rawParsedData && (
          <InsightsView rawData={rawParsedData} />
        )}

        {/* Records View */}
        {activeView === 'records' && (
          <RecordsView records={records} teams={teams} onClearRecords={handleClearRecords} />
        )}

        {/* Record Notifications disabled - records shown in Records tab */}

        {/* Empty State */}
        {metrics.length === 0 && !isProcessing && (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-xl font-semibold text-white mb-2">Ready to Analyze</h2>
            <p className="text-slate-400 max-w-md mx-auto">
              {hasStoredData
                ? 'Previous data loaded. Adjust the date range and click Analyze to update results.'
                : 'Upload your Excel files above, then click Analyze to generate KPI metrics.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
