import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileUpload } from './components/FileUpload';
import { ResultsTable } from './components/ResultsTable';
import { TeamManagement } from './components/TeamManagement';
import { TeamComparison } from './components/TeamComparison';
import { DateRangeFilter } from './components/DateRangeFilter';
import { SeniorManagement } from './components/SeniorManagement';
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

  // Worker-based file processor for parallel parsing
  const { processFiles: processFilesWithWorker, state: workerState } = useFileProcessor();

  useEffect(() => {
    setTeams(loadTeams());
    setSeniors(loadSeniors());
    setMetrics(loadMetrics());
    setTimeSeriesData(loadTimeSeriesData());

    // Load raw data from IndexedDB (async)
    loadRawDataFromDB().then((data) => {
      if (data) {
        setRawParsedData(data);
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

  // Optimized processing function
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
        // Use Web Worker for parallel file parsing
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

        // Save raw data for future use
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
      } else {
        // Use stored raw data
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

      // Find columns
      const tripsAgentCol = findAgentColumn(tripsRows[0]);
      const quotesAgentCol = quotesRows.length > 0 ? findAgentColumn(quotesRows[0]) : null;
      const passthroughsAgentCol = passthroughsRows.length > 0 ? findAgentColumn(passthroughsRows[0]) : null;
      const hotPassAgentCol = hotPassRows.length > 0 ? findAgentColumn(hotPassRows[0]) : null;
      const bookingsAgentCol = bookingsRows.length > 0 ? findAgentColumn(bookingsRows[0]) : null;

      if (!tripsAgentCol) {
        throw new Error('Could not identify agent column in Trips file.');
      }

      // Find date columns
      const tripsDateCol = findDateColumn(tripsRows[0], ['created date', 'trip: created date']);
      const quotesDateCol = quotesRows.length > 0 ? findDateColumn(quotesRows[0], ['quote first sent', 'first sent date', 'created date']) : null;
      const passthroughsDateCol = passthroughsRows.length > 0 ? findDateColumn(passthroughsRows[0], ['passthrough to sales date', 'passthrough date', 'created date']) : null;
      const hotPassDateCol = hotPassRows.length > 0 ? findDateColumn(hotPassRows[0], ['created date', 'trip: created date']) : null;
      const bookingsDateCol = bookingsRows.length > 0 ? findDateColumn(bookingsRows[0], ['created date', 'booking date', 'date']) : null;

      // Find trip name column in trips for linking to non-converted
      const tripKeys = Object.keys(tripsRows[0] || {});
      console.log('Trips columns:', tripKeys);
      const tripNameColInTrips = tripKeys.find(k => {
        const lower = k.toLowerCase();
        return lower.includes('trip name') ||
          lower === 'trip' ||
          lower === 'name' ||
          lower.includes('opportunity');
      });
      console.log('Trip name column in trips:', tripNameColInTrips);
      console.log('Trips date column:', tripsDateCol);

      // Build trip date map for non-converted filtering
      const tripDateMap = buildTripDateMap(tripsRows, tripNameColInTrips || null, tripsDateCol);
      console.log('Trip date map size:', tripDateMap.size);
      if (tripDateMap.size > 0) {
        const sampleEntries = Array.from(tripDateMap.entries()).slice(0, 3);
        console.log('Sample trip date map entries:', sampleEntries);
      }

      // Try to find date column in non-converted file
      let nonConvertedDateCol: string | null = null;
      if (nonConvertedRows.length > 0) {
        const ncColumns = Object.keys(nonConvertedRows[0]);
        console.log('Non-converted columns:', ncColumns);

        // First try direct date patterns (order matters - more specific first)
        // Note: Don't use generic 'date' pattern as it matches 'validated' in 'non validated reason'
        nonConvertedDateCol = findDateColumn(nonConvertedRows[0], [
          'last modified', 'modified date', 'created date', 'lead created date',
          'trip created date', 'trip: created date', 'close date', 'timestamp'
        ]);

        console.log('Non-converted date column found:', nonConvertedDateCol);

        // Show sample dates from non-converted file
        if (nonConvertedDateCol) {
          const dateCol = nonConvertedDateCol; // TypeScript narrowing
          const sampleDates = nonConvertedRows.slice(0, 5).map(r => r[dateCol]);
          console.log('Sample non-converted date values:', sampleDates);
          console.log('Date filter range:', startDate, 'to', endDate);
        }
      }

      // Optimized counting with date filtering in single pass
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

      // Count non-converted with date filtering (uses direct date column or trip date map)
      const nonConvertedCountsMap = countNonConvertedOptimized(
        nonConvertedRows,
        nonConvertedDateCol,
        startDate,
        endDate,
        tripDateMap
      );

      // Calculate metrics
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

      // Build time-series data
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">
            KPI Report Generator
          </h1>
          <p className="text-slate-400">
            Upload your Excel files to analyze agent performance metrics
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <FileUpload
            label="Trips"
            file={files.trips}
            onFileSelect={handleFileSelect('trips')}
            color="blue"
            icon={
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
            }
          />

          <FileUpload
            label="Quotes"
            file={files.quotes}
            onFileSelect={handleFileSelect('quotes')}
            color="green"
            icon={
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />

          <FileUpload
            label="Passthroughs"
            file={files.passthroughs}
            onFileSelect={handleFileSelect('passthroughs')}
            color="purple"
            icon={
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            }
          />

          <FileUpload
            label="Hot Pass"
            file={files.hotPass}
            onFileSelect={handleFileSelect('hotPass')}
            color="orange"
            icon={
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
            }
          />

          <FileUpload
            label="Bookings"
            file={files.bookings}
            onFileSelect={handleFileSelect('bookings')}
            color="cyan"
            icon={
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            }
          />

          <FileUpload
            label="% Non-Converted"
            file={files.nonConverted}
            onFileSelect={handleFileSelect('nonConverted')}
            color="rose"
            icon={
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            }
          />
        </div>

        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClear={handleClearDateFilter}
        />

        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={processFiles}
            disabled={!canAnalyze || isProcessing}
            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {workerState.stage || 'Processing...'}
              </span>
            ) : (
              'Analyze Data'
            )}
          </button>

          {metrics.length > 0 && (
            <>
              <button
                onClick={handleClearData}
                className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-xl shadow-lg hover:bg-gray-700 transition-all duration-200"
              >
                Clear Data
              </button>
              <PresentationGenerator metrics={metrics} seniors={seniors} teams={teams} />
            </>
          )}
        </div>

        {/* Progress bar */}
        {isProcessing && workerState.progress > 0 && (
          <div className="mb-8 max-w-md mx-auto">
            <div className="bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                style={{ width: `${workerState.progress}%` }}
              />
            </div>
            <p className="text-center text-slate-400 text-sm mt-2">{workerState.progress}%</p>
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center">
            {error}
          </div>
        )}

        {/* View Toggle Tabs */}
        {metrics.length > 0 && (
          <div className="flex justify-center mb-8">
            <div className="bg-slate-800/50 rounded-xl p-1 flex gap-1">
              <button
                onClick={() => setActiveView('summary')}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  activeView === 'summary'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setActiveView('trends')}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  activeView === 'trends'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                Trends
              </button>
            </div>
          </div>
        )}

        {/* Summary View */}
        {activeView === 'summary' && (
          <div className="space-y-8">
            <TeamManagement
              teams={teams}
              onTeamsChange={handleTeamsChange}
              availableAgents={allAgentNames}
            />

            <SeniorManagement
              seniors={seniors}
              onSeniorsChange={handleSeniorsChange}
              availableAgents={allAgentNames}
            />

            {metrics.length > 0 && (
              <AgentAnalytics metrics={metrics} seniors={seniors} />
            )}

            <TeamComparison metrics={metrics} teams={teams} seniors={seniors} />

            <ResultsTable metrics={metrics} teams={teams} seniors={seniors} />
          </div>
        )}

        {/* Trends View */}
        {activeView === 'trends' && timeSeriesData && (
          <TrendsView timeSeriesData={timeSeriesData} seniors={seniors} />
        )}
      </div>
    </div>
  );
}

export default App;
