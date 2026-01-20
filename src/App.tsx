import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileUpload } from './components/FileUpload';
import { ResultsTable } from './components/ResultsTable';
import { ConfigPanel } from './components/ConfigPanel';
import { TeamComparison } from './components/TeamComparison';
import { DateRangeFilter } from './components/DateRangeFilter';
import { TrendsView } from './components/TrendsView';
import { PresentationGenerator } from './components/PresentationGenerator';
import { AgentAnalytics } from './components/AgentAnalytics';
import type { Team, Metrics, FileUploadState, TimeSeriesData } from './types';
import type { CSVRow } from './utils/csvParser';
import { loadTeams, saveTeams, loadSeniors, saveSeniors, loadMetrics, saveMetrics, clearMetrics, loadTimeSeriesData, saveTimeSeriesData, clearTimeSeriesData } from './utils/storage';
import { loadRawDataFromDB, saveRawDataToDB, clearRawDataFromDB, type RawParsedData } from './utils/indexedDB';
import { useFileProcessor } from './hooks/useFileProcessor';
import {
  findAgentColumn,
  findDateColumn,
  countByAgentOptimized,
  countNonConvertedOptimized,
  buildTripDateMap,
  calculateMetrics,
  buildTimeSeriesOptimized
} from './utils/metricsCalculator';

function App() {
  const [files, setFiles] = useState<FileUploadState>({
    passthroughs: null,
    trips: null,
    quotes: null,
    hotPass: null,
    bookings: null,
    nonConverted: null,
  });

  const [teams, setTeams] = useState<Team[]>([]);
  const [seniors, setSeniors] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<Metrics[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData | null>(null);
  const [rawParsedData, setRawParsedData] = useState<RawParsedData | null>(null);
  const [activeView, setActiveView] = useState<'summary' | 'trends'>('summary');
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDataPanel, setShowDataPanel] = useState(true);

  const { processFiles: processFilesWithWorker, state: workerState } = useFileProcessor();

  useEffect(() => {
    setTeams(loadTeams());
    setSeniors(loadSeniors());
    setMetrics(loadMetrics());
    setTimeSeriesData(loadTimeSeriesData());

    loadRawDataFromDB().then((data) => {
      if (data) {
        setRawParsedData(data);
        setShowDataPanel(false);
      }
    });
  }, []);

  const handleTeamsChange = useCallback((newTeams: Team[]) => {
    setTeams(newTeams);
    saveTeams(newTeams);
  }, []);

  const handleSeniorsChange = useCallback((newSeniors: string[]) => {
    setSeniors(newSeniors);
    saveSeniors(newSeniors);
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

      if (hasAllFiles) {
        const result = await processFilesWithWorker({
          trips: files.trips!,
          quotes: files.quotes!,
          passthroughs: files.passthroughs!,
          hotPass: files.hotPass!,
          bookings: files.bookings!,
          nonConverted: files.nonConverted!,
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

        const newRawData: RawParsedData = {
          trips: tripsRows,
          quotes: quotesRows,
          passthroughs: passthroughsRows,
          hotPass: hotPassRows,
          bookings: bookingsRows,
          nonConverted: nonConvertedRows,
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
      const hotPassDateCol = hotPassRows.length > 0 ? findDateColumn(hotPassRows[0], ['created date', 'trip: created date']) : null;
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

      const nonConvertedCountsMap = countNonConvertedOptimized(
        nonConvertedRows,
        nonConvertedDateCol,
        startDate,
        endDate,
        tripDateMap
      );

      const calculatedMetrics = calculateMetrics(
        tripsResult.total,
        quotesResult.total,
        passthroughsResult.total,
        hotPassResult.total,
        bookingsResult.total,
        nonConvertedCountsMap
      );

      setMetrics(calculatedMetrics);
      saveMetrics(calculatedMetrics);

      const tsData = buildTimeSeriesOptimized(
        tripsResult.byDate,
        quotesResult.byDate,
        passthroughsResult.byDate,
        hotPassResult.byDate,
        bookingsResult.byDate,
        seniors
      );

      setTimeSeriesData(tsData);
      saveTimeSeriesData(tsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing files');
    }
  }, [files, startDate, endDate, rawParsedData, processFilesWithWorker, seniors]);

  const handleClearData = useCallback(() => {
    setMetrics([]);
    clearMetrics();
    setTimeSeriesData(null);
    clearTimeSeriesData();
    setRawParsedData(null);
    clearRawDataFromDB();
    setFiles({
      passthroughs: null,
      trips: null,
      quotes: null,
      hotPass: null,
      bookings: null,
      nonConverted: null,
    });
    setShowDataPanel(true);
  }, []);

  const handleClearDateFilter = useCallback(() => {
    setStartDate('');
    setEndDate('');
  }, []);

  const allAgentNames = useMemo(() => metrics.map((m) => m.agentName), [metrics]);
  const allFilesUploaded = files.trips && files.quotes && files.passthroughs && files.hotPass && files.bookings && files.nonConverted;
  const hasStoredData = rawParsedData !== null;
  const canAnalyze = allFilesUploaded || hasStoredData;
  const isProcessing = workerState.isProcessing;
  const uploadedCount = [files.trips, files.quotes, files.passthroughs, files.hotPass, files.bookings, files.nonConverted].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">KPI Report Generator</h1>
            <p className="text-sm text-slate-400">Analyze agent performance metrics</p>
          </div>
          {metrics.length > 0 && (
            <div className="flex items-center gap-2">
              <PresentationGenerator metrics={metrics} seniors={seniors} teams={teams} />
              <button
                onClick={handleClearData}
                className="px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Clear All
              </button>
            </div>
          )}
        </header>

        {/* Data Source Panel - Collapsible */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 mb-4 overflow-hidden">
          <button
            onClick={() => setShowDataPanel(!showDataPanel)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="font-medium text-white">Data Source</span>
              {hasStoredData && !showDataPanel && (
                <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs">
                  Data loaded
                </span>
              )}
              {!hasStoredData && uploadedCount > 0 && (
                <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs">
                  {uploadedCount}/6 files
                </span>
              )}
            </div>
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform ${showDataPanel ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDataPanel && (
            <div className="px-4 pb-4 border-t border-slate-700/50 pt-4">
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
            </div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 px-4 py-3 mb-4">
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
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
            <div className="bg-slate-800/50 rounded-lg p-1 flex gap-1">
              <button
                onClick={() => setActiveView('summary')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'summary'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setActiveView('trends')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'trends'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                Trends
              </button>
            </div>

            {activeView === 'summary' && (
              <div className="flex-1 max-w-xl">
                <ConfigPanel
                  teams={teams}
                  onTeamsChange={handleTeamsChange}
                  seniors={seniors}
                  onSeniorsChange={handleSeniorsChange}
                  availableAgents={allAgentNames}
                />
              </div>
            )}
          </div>
        )}

        {/* Summary View */}
        {activeView === 'summary' && metrics.length > 0 && (
          <div className="space-y-4">
            <AgentAnalytics metrics={metrics} seniors={seniors} />
            <TeamComparison metrics={metrics} teams={teams} seniors={seniors} />
            <ResultsTable metrics={metrics} teams={teams} seniors={seniors} />
          </div>
        )}

        {/* Trends View */}
        {activeView === 'trends' && timeSeriesData && (
          <TrendsView timeSeriesData={timeSeriesData} seniors={seniors} />
        )}

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
