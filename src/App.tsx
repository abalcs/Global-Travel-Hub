// @ts-nocheck
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { ResultsTable } from './components/ResultsTable';
import { ConfigPanel } from './components/ConfigPanel';
import { TeamComparison } from './components/TeamComparison';
import type { Timeframe } from './components/TimeframeSelector';
import { TrendsView } from './components/TrendsView';
import { RegionalView } from './components/RegionalView';
import { InsightsView } from './components/InsightsView';
import { ChannelPerformanceView } from './components/ChannelPerformanceView';
import { RecordsView } from './components/RecordsView';
import { SlidingPillGroup } from './components/SlidingPillGroup';
import type { PillOption } from './components/SlidingPillGroup';
// RecordNotification import removed - notifications disabled

import { AgentAnalytics } from './components/AgentAnalytics';
import { GlobeLoader } from './components/GlobeLoader';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './contexts/ThemeContext';
// Auth disabled for now — uncomment when ready to re-enable
// import { useAuthContext } from './contexts/AuthContext';
import { getDb } from './firebase.config';
import audleyLogo from './assets/audley-logo.png';
import type { Team, Metrics, FileUploadState, TimeSeriesData } from './types';
import type { CSVRow } from './utils/csvParser';
import { loadTeams, saveTeams, loadSeniors, saveSeniors, loadNewHires, saveNewHires, loadMetrics, saveMetrics, clearMetrics, loadTimeSeriesData, saveTimeSeriesData, clearTimeSeriesData } from './utils/storage';
import { loadRawDataFromDB, saveRawDataToDB, clearRawDataFromDB, type RawParsedData } from './utils/indexedDB';
import { saveRawDataToFirestore, loadConfigFromFirestore, saveConfigToFirestore } from './utils/firestoreSync';
// firestoreService save calls removed — metrics/timeseries/summary are recalculated
// from raw data on every load, so caching them in Firestore is unnecessary.
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
  countByTripClassification,
  countQuotesStartedByAgent,
  isMetadataRow,
  isGroupedColumn,
  fillDownAgent
} from './utils/metricsCalculator';
import {
  loadRecords,
  saveRecords,
  analyzeAndUpdateRecords,
  type AllRecords,
} from './utils/recordsTracker';
import { parseDate } from './utils/dateParser';
import { findColumn, COLUMN_PATTERNS } from './utils/columnDetection';

/** Tag each row with its origin file so data doesn't get mixed up after storage */
const tagRows = (rows: CSVRow[], source: string): CSVRow[] =>
  rows.map(row => (row._source === source ? row : { ...row, _source: source }));

/** Strip rows whose _source tag doesn't match (cross-contamination guard) */
const filterBySource = (rows: CSVRow[], source: string): CSVRow[] =>
  rows.filter(row => !row._source || row._source === source);

/**
 * Enrich trips rows with destination/original-interest from passthroughs data.
 * Uses "trip: trip name" as the join key. Only runs if trips lack a destination column
 * but passthroughs have one. This lets Regional performance analysis work even when
 * the Salesforce trips report doesn't include a destination column.
 */
const enrichTripsWithDestination = (data: RawParsedData): RawParsedData => {
  if (!data.trips?.length || !data.passthroughs?.length) return data;

  // Check if trips already have a destination column
  const tripsHasDest = findColumn(data.trips[0], COLUMN_PATTERNS.region) !== null;
  if (tripsHasDest) return data; // no enrichment needed

  // Check if passthroughs have destination
  const ptDestCol = findColumn(data.passthroughs[0], COLUMN_PATTERNS.region);
  if (!ptDestCol) return data;

  // Also try to get original interest from passthroughs
  const ptOrigInterestCol = findColumn(data.passthroughs[0], ['original interest']);

  // Find trip name columns
  const ptTripNameCol = findColumn(data.passthroughs[0], ['trip: trip name', 'trip name']);
  const tripsTripNameCol = findColumn(data.trips[0], ['trip: trip name', 'trip name']);
  if (!ptTripNameCol || !tripsTripNameCol) return data;

  // Build lookup: tripName → { destination, originalInterest }
  const destLookup = new Map<string, { dest: string; origInterest: string }>();
  for (const ptRow of data.passthroughs) {
    const tripName = (ptRow[ptTripNameCol] || '').trim();
    if (!tripName) continue;
    const dest = (ptRow[ptDestCol] || '').trim();
    if (!dest) continue;
    const origInterest = ptOrigInterestCol ? (ptRow[ptOrigInterestCol] || '').trim() : '';
    // Only set if not already present (first match wins)
    if (!destLookup.has(tripName)) {
      destLookup.set(tripName, { dest, origInterest });
    }
  }

  // Enrich each trip row — add destination key to ALL rows (even unmatched)
  // so that findColumn(trips[0], ...) can detect the column exists.
  const enrichedTrips = data.trips.map(row => {
    const tripName = (row[tripsTripNameCol] || '').trim();
    const match = tripName ? destLookup.get(tripName) : undefined;
    if (match) {
      return { ...row, destination: match.dest, 'original interest': match.origInterest || '' };
    }
    return { ...row, destination: '', 'original interest': '' };
  });

  return { ...data, trips: enrichedTrips };
};

// LogoutButton disabled — auth removed for now
// Uncomment when ready to re-enable authentication
/*
function LogoutButton() {
  const { user, logout } = useAuthContext();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { isAudley } = useTheme();
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { await logout(); } catch (error) { console.error('Logout error:', error); setIsLoggingOut(false); }
  };
  if (!user) return null;
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border" style={{ borderColor: isAudley ? '#4d726d' : '#475569', backgroundColor: isAudley ? '#f0f7fc' : '#1e293b' }}>
      <span className="text-sm" style={{ color: isAudley ? '#4d726d' : '#94a3b8' }}>{user.email}</span>
      <button onClick={handleLogout} disabled={isLoggingOut} className="text-xs px-2 py-1 rounded transition-all cursor-pointer active:scale-95" style={{ color: isAudley ? '#dc2626' : '#f87171', backgroundColor: isAudley ? '#fee2e2' : '#7f1d1d', opacity: isLoggingOut ? 0.6 : 1, cursor: isLoggingOut ? 'not-allowed' : 'pointer' }}>
        {isLoggingOut ? 'Logging out...' : 'Logout'}
      </button>
    </div>
  );
}
*/

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
    return 'summary'; // Show Summary by default
  });
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<AllRecords>(() => loadRecords());
  const [timeframe, setTimeframe] = useState<Timeframe>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDataPanel, setShowDataPanel] = useState(true);
  const [dataLoadProgress, setDataLoadProgress] = useState<{ loading: boolean; progress: number; stage: string }>({
    loading: false, progress: 0, stage: ''
  });
  // Transition state: 'idle' → 'loading' → 'completing' → 'idle'
  // 'completing' keeps the globe visible while it fades out and the UI fades in
  const [loadTransition, setLoadTransition] = useState<'idle' | 'loading' | 'completing'>('idle');
  const [autoAnalyzePending, setAutoAnalyzePending] = useState(false);

  const { processFiles: processFilesWithWorker, state: workerState } = useFileProcessor();
  const isProcessing = workerState.isProcessing;

  useEffect(() => {
    // Load config: try Firestore first, fall back to localStorage
    loadConfigFromFirestore().then((config) => {
      if (config && (config.teams.length > 0 || config.seniors.length > 0 || config.newHires.length > 0)) {
        // Config loaded from Firestore
        setTeams(config.teams);
        setSeniors(config.seniors);
        setNewHires(config.newHires);
        // Update localStorage cache
        saveTeams(config.teams);
        saveSeniors(config.seniors);
        saveNewHires(config.newHires);
      } else {
        // Fall back to localStorage
        // No Firestore config, using localStorage
        setTeams(loadTeams());
        setSeniors(loadSeniors());
        setNewHires(loadNewHires());
      }
    }).catch(() => {
      // Firestore failed, use localStorage
      setTeams(loadTeams());
      setSeniors(loadSeniors());
      setNewHires(loadNewHires());
    });

    setMetrics(loadMetrics());
    setTimeSeriesData(loadTimeSeriesData());

    loadData();
  }, []);

  // Smooth transition: when loading finishes, fade out globe then fade in UI
  const finishLoading = useCallback(() => {
    setDataLoadProgress({ loading: true, progress: 100, stage: "Let's go!" });
    setLoadTransition('completing');
    // After globe fade-out (600ms), hide it and show UI
    setTimeout(() => {
      setDataLoadProgress({ loading: false, progress: 0, stage: '' });
      setLoadTransition('idle');
    }, 800);
  }, []);

  // Load raw data from IndexedDB or Firestore — extracted so it can be re-called
  const loadData = useCallback(async () => {
      setLoadTransition('loading');
      setDataLoadProgress({ loading: true, progress: 5, stage: 'Planning the trip...' });

      // First try IndexedDB
      let localData: RawParsedData | null = null;
      try {
        localData = await loadRawDataFromDB();
      } catch (e) {
        console.warn('[App] IndexedDB load failed:', e);
      }

      // Only use IndexedDB data if it actually has rows
      const hasLocalData = localData && Object.values(localData).some((arr: any) => Array.isArray(arr) && arr.length > 0);
      if (hasLocalData) {
        setDataLoadProgress({ loading: true, progress: 90, stage: 'Making memories...' });
        setRawParsedData(enrichTripsWithDestination(localData!));
        setShowDataPanel(false);
        setAutoAnalyzePending(true);
        finishLoading();
        return;
      }

      // Try loading from Firestore (supports both batched and single-doc formats)
      let db: any;
      try {
        db = await getDb();
      } catch (e) {
        console.warn('[App] Firebase init failed:', e);
      }

      if (!db) {
        console.warn('[App] Firestore not available — skipping remote data load');
        setDataLoadProgress({ loading: false, progress: 0, stage: '' });
        return;
      }

      const { doc, getDoc } = await import('firebase/firestore');

      setDataLoadProgress({ loading: true, progress: 10, stage: 'Packing the bags...' });

      try {
        const datasets: any = {};
        const allDataTypes = ['trips', 'quotes', 'passthroughs', 'hotPass', 'bookings', 'nonConverted', 'quotesStarted'];

        // Helper: load a dataset, trying batched format first, then single doc
        const loadDataset = async (dataType: string): Promise<any[]> => {
          let batchedData: any[] = [];
          let batchNum = 0;
          try {
            const firstBatch = await getDoc(doc(db, 'gtt_raw_data', `${dataType}_batch_0`));
            if (firstBatch.exists()) {
              batchedData = batchedData.concat(firstBatch.data()?.data || []);
              batchNum = 1;
              while (batchNum < 100) {
                try {
                  const batchSnap = await getDoc(doc(db, 'gtt_raw_data', `${dataType}_batch_${batchNum}`));
                  if (batchSnap.exists()) {
                    batchedData = batchedData.concat(batchSnap.data()?.data || []);
                    batchNum++;
                  } else { break; }
                } catch (e) { break; }
              }
              return batchedData;
            }
          } catch (e) { /* batch format not available */ }

          try {
            const snap = await getDoc(doc(db, 'gtt_raw_data', dataType));
            if (snap.exists()) { return snap.data()?.data || []; }
          } catch (e) { /* ignore */ }

          return [];
        };

        // Load datasets sequentially so we can show per-dataset progress
        const travelStages = [
          'Heading to the airport...',
          'Boarding the flight...',
          'Cruising at altitude...',
          'Touching down...',
          'Checking into the hotel...',
          'Exploring new places...',
          'Collecting souvenirs...',
        ];
        for (let i = 0; i < allDataTypes.length; i++) {
          const dt = allDataTypes[i];
          const progressBase = 10 + Math.round((i / allDataTypes.length) * 75);
          setDataLoadProgress({ loading: true, progress: progressBase, stage: travelStages[i] || 'Almost there...' });
          datasets[dt] = await loadDataset(dt);
        }

        setDataLoadProgress({ loading: true, progress: 90, stage: 'Making memories...' });

        const hasData = Object.values(datasets).some((arr: any) => Array.isArray(arr) && arr.length > 0);
        if (hasData) {
          const parsedData: RawParsedData = {
            trips: tagRows(datasets.trips || [], 'trips'),
            quotes: tagRows(datasets.quotes || [], 'quotes'),
            passthroughs: tagRows(datasets.passthroughs || [], 'passthroughs'),
            hotPass: tagRows(datasets.hotPass || [], 'hotPass'),
            bookings: tagRows(datasets.bookings || [], 'bookings'),
            nonConverted: tagRows(datasets.nonConverted || [], 'nonConverted'),
            quotesStarted: tagRows(datasets.quotesStarted || [], 'quotesStarted'),
          };

          const enrichedData = enrichTripsWithDestination(parsedData);
          setRawParsedData(enrichedData);
          saveRawDataToDB(enrichedData);
          setShowDataPanel(false);
          setAutoAnalyzePending(true);
          finishLoading();
        } else {
          setDataLoadProgress({ loading: false, progress: 0, stage: '' });
        }
      } catch (error) {
        console.error('[App] Firestore load error:', error);
        setDataLoadProgress({ loading: false, progress: 0, stage: '' });
      }
  }, []);

  // Persist active view tab
  useEffect(() => {
    localStorage.setItem('gtt-active-view', activeView);
  }, [activeView]);

  const handleTeamsChange = useCallback((newTeams: Team[]) => {
    setTeams(newTeams);
    saveTeams(newTeams);
    saveConfigToFirestore({ teams: newTeams }).catch(err =>
      console.warn('[App] Firestore config save failed (non-critical):', err)
    );
  }, []);

  const handleSeniorsChange = useCallback((newSeniors: string[]) => {
    setSeniors(newSeniors);
    saveSeniors(newSeniors);
    saveConfigToFirestore({ seniors: newSeniors }).catch(err =>
      console.warn('[App] Firestore config save failed (non-critical):', err)
    );
  }, []);

  const handleNewHiresChange = useCallback((updatedNewHires: string[]) => {
    setNewHires(updatedNewHires);
    saveNewHires(updatedNewHires);
    saveConfigToFirestore({ newHires: updatedNewHires }).catch(err =>
      console.warn('[App] Firestore config save failed (non-critical):', err)
    );
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
          trips: tagRows(tripsRows, 'trips'),
          quotes: tagRows(quotesRows, 'quotes'),
          passthroughs: tagRows(passthroughsRows, 'passthroughs'),
          hotPass: tagRows(hotPassRows, 'hotPass'),
          bookings: tagRows(bookingsRows, 'bookings'),
          nonConverted: tagRows(nonConvertedRows, 'nonConverted'),
          quotesStarted: tagRows(quotesStartedRows, 'quotesStarted'),
        };
        const enrichedRawData = enrichTripsWithDestination(newRawData);
        saveRawDataToDB(enrichedRawData);
        // Also persist to Firestore so ANY browser session can load this data
        saveRawDataToFirestore(enrichedRawData).catch(err =>
          console.warn('[App] Firestore write-back failed (non-critical):', err)
        );
        setRawParsedData(enrichedRawData);
        setShowDataPanel(false);
      } else {
        // Filter by _source tag to prevent cross-contamination from storage
        tripsRows = filterBySource(rawParsedData!.trips, 'trips');
        quotesRows = filterBySource(rawParsedData!.quotes, 'quotes');
        passthroughsRows = filterBySource(rawParsedData!.passthroughs, 'passthroughs');
        hotPassRows = filterBySource(rawParsedData!.hotPass, 'hotPass');
        bookingsRows = filterBySource(rawParsedData!.bookings, 'bookings');
        nonConvertedRows = filterBySource(rawParsedData!.nonConverted, 'nonConverted');
        quotesStartedRows = filterBySource(rawParsedData!.quotesStarted || [], 'quotesStarted');
        setShowDataPanel(false);
      }

      if (tripsRows.length === 0) {
        throw new Error('Trips file appears to be empty or invalid.');
      }

      // ── Agent column detection with fill-down for grouped Salesforce reports ──
      // Salesforce grouped reports only show the agent name on the first row of
      // each group. All subsequent rows in the group are blank in that column.
      // We detect this pattern and "fill down" the value to every row, writing
      // the result into a new '_agent' column so the rest of the pipeline can
      // work normally.
      const applyFillDownIfNeeded = (rows: CSVRow[]): CSVRow[] => {
        if (rows.length === 0) return rows;
        const col = findAgentColumn(rows[0]);
        if (!col || col === '_agent') return rows; // Already filled
        // Guard: skip fill-down if the column name looks bogus (e.g. "undefined",
        // "_source", or a generic first-column fallback that isn't an agent column)
        const colLower = col.toLowerCase();
        if (colLower === 'undefined' || colLower.startsWith('_')) return rows;
        if (isGroupedColumn(rows, col)) {
          return fillDownAgent(rows, col);
        }
        return rows;
      };

      tripsRows = applyFillDownIfNeeded(tripsRows);
      quotesRows = applyFillDownIfNeeded(quotesRows);
      passthroughsRows = applyFillDownIfNeeded(passthroughsRows);
      hotPassRows = applyFillDownIfNeeded(hotPassRows);
      bookingsRows = applyFillDownIfNeeded(bookingsRows);
      nonConvertedRows = applyFillDownIfNeeded(nonConvertedRows);
      quotesStartedRows = applyFillDownIfNeeded(quotesStartedRows);

      // Update rawParsedData with fill-down processed rows so that
      // downstream consumers (PresentationGenerator, RegionalView, etc.)
      // get data with agent columns fully populated.
      const processedRawData: RawParsedData = {
        trips: tagRows(tripsRows, 'trips'),
        quotes: tagRows(quotesRows, 'quotes'),
        passthroughs: tagRows(passthroughsRows, 'passthroughs'),
        hotPass: tagRows(hotPassRows, 'hotPass'),
        bookings: tagRows(bookingsRows, 'bookings'),
        nonConverted: tagRows(nonConvertedRows, 'nonConverted'),
        quotesStarted: tagRows(quotesStartedRows, 'quotesStarted'),
      };
      setRawParsedData(processedRawData);
      // Persist the fill-down processed data to IndexedDB so that
      // on next load the agent columns are already fully populated.
      saveRawDataToDB(processedRawData);

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
      const classificationData = countByTripClassification(tripsRows, tripsAgentCol, tripsDateCol, startDate, endDate);

      // Calculate quotes started per agent
      // Quotes started is always timeframe-independent — it represents ALL pending
      // quotes started since Oct 1, 2025 regardless of the selected date range
      const quotesStartedData = countQuotesStartedByAgent(quotesStartedRows, '', '');

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
        quotesStartedData,
        classificationData.partnerTrips,
        classificationData.partnerPassthroughs,
        classificationData.taTrips,
        classificationData.taPassthroughs
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

  // Auto-analyze when data finishes loading (skip the Analyze button)
  useEffect(() => {
    if (autoAnalyzePending && rawParsedData && !isProcessing) {
      setAutoAnalyzePending(false);
      processFiles();
    }
  }, [autoAnalyzePending, rawParsedData, isProcessing, processFiles]);

  // Pending date range state — only applied when user clicks "Update"
  const [pendingStartDate, setPendingStartDate] = useState<string>('');
  const [pendingEndDate, setPendingEndDate] = useState<string>('');
  const [dateRangeTrigger, setDateRangeTrigger] = useState(0);

  // Re-process when date range is applied via the Update button
  const prevTriggerRef = useRef(dateRangeTrigger);
  useEffect(() => {
    if (dateRangeTrigger !== prevTriggerRef.current && metrics.length > 0 && rawParsedData && !isProcessing) {
      prevTriggerRef.current = dateRangeTrigger;
      processFiles();
    }
  }, [dateRangeTrigger, metrics.length, rawParsedData, isProcessing, processFiles]);

  const handleClearData = useCallback(() => {
    // Clear everything — analyzed results AND stored raw data
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
      quotesStarted: null,
    });
    setShowDataPanel(false);
  }, []);

  const handleClearStoredData = useCallback(() => {
    // Clear the stored raw data from IndexedDB
    setRawParsedData(null);
    clearRawDataFromDB();
  }, []);


  const handleApplyDateRange = useCallback(() => {
    setStartDate(pendingStartDate);
    setEndDate(pendingEndDate);
    setTimeframe('all');
    setDateRangeTrigger(prev => prev + 1);
  }, [pendingStartDate, pendingEndDate]);

  const handleClearDateRange = useCallback(() => {
    setPendingStartDate('');
    setPendingEndDate('');
    setStartDate('');
    setEndDate('');
    setTimeframe('all');
    setDateRangeTrigger(prev => prev + 1);
  }, []);

  const handleClearRecords = useCallback(() => {
    setRecords({ agents: {}, lastUpdated: new Date().toISOString() });
  }, []);


  const allAgentNames = useMemo(() => metrics.map((m) => m.agentName), [metrics]);
  const allFilesUploaded = files.trips && files.quotes && files.passthroughs && files.hotPass && files.bookings && files.nonConverted && files.quotesStarted;
  const hasStoredData = rawParsedData !== null;
  const canAnalyze = allFilesUploaded || hasStoredData;
  const requiredFilesCount = [files.trips, files.quotes, files.passthroughs, files.hotPass, files.bookings, files.nonConverted, files.quotesStarted].filter(Boolean).length;

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
        : 'bg-gradient-to-br from-[#0c1a24] via-[#142028] to-[#0c1a24]'
    }`}>
      {/* Header Bar - Audley teal/blue gradient */}
      <div className={`w-full h-1 bg-gradient-to-r from-[#007bc7] via-[#4d726d] to-[#007bc7] ${
        isAudley ? 'opacity-100' : 'opacity-60'
      }`} />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-5">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Audley Logo - shown in both themes */}
            <div className={`flex items-center justify-center min-w-[3.5rem] pr-4 border-r ${
              isAudley ? 'border-[#4d726d]/30' : 'border-slate-600/50'
            }`}>
              {isAudley ? (
                <img
                  src={audleyLogo}
                  alt="Audley Travel"
                  className="h-14 w-auto mix-blend-multiply"
                />
              ) : (
                <svg className="h-14 w-auto" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="Audley Travel">
                  {/* Stylized Audley "A" in white/teal for dark mode */}
                  <defs>
                    <linearGradient id="audleyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#7ec4de" />
                      <stop offset="100%" stopColor="#4d726d" />
                    </linearGradient>
                  </defs>
                  {/* Cursive A stroke */}
                  <path
                    d="M25,78 C25,78 30,72 35,60 C40,48 48,28 55,22 C58,19 60,20 61,22 C64,28 68,42 72,55 C74,61 76,66 78,70"
                    fill="none" stroke="url(#audleyGrad)" strokeWidth="1.8" strokeLinecap="round"
                  />
                  {/* Left swash/loop */}
                  <path
                    d="M25,78 C20,82 15,84 14,80 C12,74 18,68 28,65 C35,63 40,63 45,64"
                    fill="none" stroke="url(#audleyGrad)" strokeWidth="1.8" strokeLinecap="round"
                  />
                  {/* Right tail */}
                  <path
                    d="M78,70 C80,74 83,78 86,78 C89,78 90,75 88,72"
                    fill="none" stroke="url(#audleyGrad)" strokeWidth="1.8" strokeLinecap="round"
                  />
                  {/* Crossbar */}
                  <line x1="30" y1="58" x2="75" y2="58" stroke="url(#audleyGrad)" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <div>
              <h1 className={`text-2xl font-bold transition-colors ${
                isAudley ? 'text-[#4d726d]' : 'text-white'
              }`}>
                Global Travel Hub
              </h1>
            <p className={`text-sm transition-colors ${isAudley ? 'text-[#4d726d]/80' : 'text-slate-400'}`}>
              Analyze agent performance metrics
            </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ThemeToggle />
            {metrics.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    processFiles();
                    if (navigator.vibrate) navigator.vibrate(10);
                  }}
                  disabled={!canAnalyze || isProcessing}
                  className={`px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95 flex items-center gap-2 ${
                    isAudley
                      ? 'bg-[#007bc7] hover:bg-[#005a94] text-white'
                      : 'bg-[#1a7fa8] hover:bg-[#15667f] text-white'
                  }`}
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
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh Data
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    handleClearData();
                    if (navigator.vibrate) navigator.vibrate(10);
                  }}
                  className={`px-3 py-2 text-sm rounded-lg transition-all cursor-pointer active:scale-95 ${
                    isAudley
                      ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                      : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                  }`}
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Loading Globe — shown while fetching data from Firestore/IndexedDB */}
        {dataLoadProgress.loading && (
          <div
            className={`transition-all duration-700 ease-in-out ${
              loadTransition === 'completing'
                ? 'opacity-0 scale-95 -translate-y-4'
                : 'opacity-100 scale-100 translate-y-0'
            }`}
          >
            <GlobeLoader stage={dataLoadProgress.stage} progress={dataLoadProgress.progress} />
          </div>
        )}

        {/* Data Source Panel — HIDDEN when stored data exists, only shown when no data */}
        {!hasStoredData && !dataLoadProgress.loading && (
          <div className="flex flex-col items-center gap-4 mb-4 animate-fadeIn">
            {/* Reload from Database button */}
            <button
              onClick={() => {
                loadData();
                if (navigator.vibrate) navigator.vibrate(10);
              }}
              className={`px-6 py-3 rounded-xl font-medium transition-all cursor-pointer active:scale-95 flex items-center gap-3 shadow-lg ${
                isAudley
                  ? 'bg-gradient-to-r from-[#4d726d] to-[#007bc7] text-white hover:from-[#3d5c58] hover:to-[#0066a6]'
                  : 'bg-gradient-to-r from-[#1a5c6e] to-[#1a7fa8] text-white hover:from-[#15506a] hover:to-[#15667f]'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              Reload from Database
            </button>
            <span className={`text-sm ${isAudley ? 'text-slate-500' : 'text-slate-400'}`}>or upload files manually</span>
          </div>
        )}

        {!hasStoredData && !dataLoadProgress.loading && (
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
                <span className={`font-medium ${isAudley ? 'text-[#313131]' : 'text-white'}`}>Upload Data Files</span>
                {requiredFilesCount > 0 && (
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    isAudley ? 'bg-[#007bc7]/10 text-[#007bc7]' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {requiredFilesCount}/7 files
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

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
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
                  <FileUpload
                    label="Quotes Started"
                    file={files.quotesStarted}
                    onFileSelect={handleFileSelect('quotesStarted')}
                    color="amber"
                    icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                  />
                </div>

                {/* Analyze button when files uploaded manually */}
                {allFilesUploaded && (
                  <div className="mt-4">
                    <button
                      onClick={processFiles}
                      disabled={isProcessing}
                      className={`w-full px-4 py-3 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] ${
                        isAudley
                          ? 'bg-gradient-to-r from-[#4d726d] to-[#007bc7] hover:from-[#3d5c58] hover:to-[#005a94] shadow-md shadow-[#4d726d]/20'
                          : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                      }`}
                    >
                      {isProcessing ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>{workerState.stage || 'Processing...'}</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Upload & Analyze</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Processing progress indicator (shown during data reprocessing) */}
        {isProcessing && workerState.progress > 0 && (
          <div className={`backdrop-blur rounded-xl border px-4 py-3 mb-4 ${
            isAudley
              ? 'bg-white border-[#007bc7]/20 shadow-sm'
              : 'bg-slate-800/50 border-slate-700/50'
          }`}>
            <div className="flex items-center gap-3">
              <svg className={`animate-spin h-4 w-4 ${isAudley ? 'text-[#007bc7]' : 'text-[#5ba8c8]'}`} viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <div className={`flex-1 max-w-xs rounded-full h-1.5 overflow-hidden ${isAudley ? 'bg-[#e6f3fb]' : 'bg-slate-700'}`}>
                <div
                  className={`h-full transition-all duration-300 ${isAudley ? 'bg-[#007bc7]' : 'bg-[#1a7fa8]'}`}
                  style={{ width: `${workerState.progress}%` }}
                />
              </div>
              <span className={`text-sm ${isAudley ? 'text-[#007bc7]' : 'text-slate-400'}`}>
                {workerState.stage || 'Processing'} {workerState.progress}%
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Hide all content while loading data — fade in when ready */}
        {!dataLoadProgress.loading && (
        <div className="animate-fadeIn">

        {/* View Toggle & Config - Always show tabs, disable data-dependent ones */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <SlidingPillGroup
            options={[
              { value: 'summary', label: 'Summary', disabled: metrics.length === 0 },
              { value: 'regional', label: 'Regional', disabled: metrics.length === 0 },
              { value: 'channels', label: 'Channels', disabled: metrics.length === 0 },
              { value: 'trends', label: 'Trends' },
              { value: 'insights', label: 'Insights', disabled: metrics.length === 0 },
              { value: 'records', label: 'Records' },
            ]}
            value={activeView}
            onChange={(v) => setActiveView(v as typeof activeView)}
            className="overflow-x-auto max-w-full scrollbar-hide"
          />

          {activeView === 'summary' && metrics.length > 0 && (
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

        {/* View Content — keyed for smooth transition on tab switch */}
        <div key={activeView} className="animate-tabEnter">
          {/* Summary View */}
          {activeView === 'summary' && metrics.length > 0 && (
            <div className="space-y-4">
              <TeamComparison
                metrics={metrics}
                teams={teams}
                seniors={seniors}
                rawData={rawParsedData}
                records={records}
                startDate={pendingStartDate}
                endDate={pendingEndDate}
                onStartDateChange={setPendingStartDate}
                onEndDateChange={setPendingEndDate}
                onApplyDateRange={handleApplyDateRange}
                onClearDateRange={handleClearDateRange}
              />
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
        </div>

        {/* Record Notifications disabled - records shown in Records tab */}

        {/* Empty State — only when no data and not loading */}
        {metrics.length === 0 && !isProcessing && !dataLoadProgress.loading && !autoAnalyzePending && (
          <div className="text-center py-16">
            <svg className={`w-16 h-16 mx-auto mb-4 ${isAudley ? 'text-[#4d726d]/40' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className={`text-xl font-semibold mb-2 ${isAudley ? 'text-[#313131]' : 'text-white'}`}>Ready to Analyze</h2>
            <p className={`max-w-md mx-auto ${isAudley ? 'text-slate-500' : 'text-slate-400'}`}>
              Upload your Excel files above to generate KPI metrics.
            </p>
          </div>
        )}

        </div>)}
      </div>
    </div>
  );
}

export default App;
