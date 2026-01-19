import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { FileUpload } from './components/FileUpload';
import { ResultsTable } from './components/ResultsTable';
import { TeamManagement } from './components/TeamManagement';
import { TeamComparison } from './components/TeamComparison';
import { DateRangeFilter } from './components/DateRangeFilter';
import { SeniorManagement } from './components/SeniorManagement';
import type { Team, Metrics, FileUploadState } from './types';
import { findAgentColumn, countByAgent } from './utils/csvParser';
import type { CSVRow } from './utils/csvParser';
import { loadTeams, saveTeams, loadSeniors, saveSeniors, loadMetrics, saveMetrics, clearMetrics } from './utils/storage';

// Helper to parse date from various formats (Excel serial, string formats)
const parseDate = (value: string): Date | null => {
  if (!value || value.trim() === '') return null;

  // Try parsing as Excel serial number (days since 1900-01-01)
  const numValue = parseFloat(value);
  if (!isNaN(numValue) && numValue > 1000 && numValue < 100000) {
    // Excel serial date - convert to JS Date
    const excelEpoch = new Date(1899, 11, 30); // Excel epoch is Dec 30, 1899
    const jsDate = new Date(excelEpoch.getTime() + numValue * 24 * 60 * 60 * 1000);
    if (!isNaN(jsDate.getTime())) return jsDate;
  }

  // Try parsing as standard date string
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed;

  // Try MM/DD/YYYY format
  const parts = value.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }

  return null;
};

// Helper to find date column in a row
const findDateColumn = (row: CSVRow, patterns: string[]): string | null => {
  const keys = Object.keys(row);
  for (const pattern of patterns) {
    const found = keys.find(k => k.toLowerCase().includes(pattern.toLowerCase()));
    if (found) return found;
  }
  return null;
};

// Helper to filter rows by date range
const filterRowsByDate = (
  rows: CSVRow[],
  dateColumn: string | null,
  startDate: string,
  endDate: string
): CSVRow[] => {
  if (!dateColumn || (!startDate && !endDate)) return rows;

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (end) end.setHours(23, 59, 59, 999); // Include entire end day

  return rows.filter(row => {
    const dateValue = row[dateColumn];
    const rowDate = parseDate(dateValue);
    if (!rowDate) return true; // Keep rows without valid dates

    if (start && rowDate < start) return false;
    if (end && rowDate > end) return false;
    return true;
  });
};

// Helper to parse Excel files with header detection
const parseExcelFile = async (file: File): Promise<CSVRow[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Get the first sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get raw data as array of arrays
  const rawData = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: null });

  // Find the header row (look for a row that looks like actual table headers)
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(50, rawData.length); i++) {
    const row = rawData[i];
    if (!row) continue;

    const nonEmptyCells = row.filter(cell => cell !== null && cell !== '');
    const rowStr = row.join('|').toLowerCase();

    // Skip filter description rows (they contain "contains" or "equals" in a single cell)
    if (rowStr.includes('contains ') || rowStr.includes('equals ')) continue;

    // Look for rows that have multiple cells and contain header-like patterns
    // Headers typically have short text in multiple columns
    const hasMultipleColumns = nonEmptyCells.length >= 4;
    const hasHeaderPattern = rowStr.includes('owner name') ||
                            rowStr.includes('last gtt action by') ||
                            rowStr.includes('trip name') ||
                            rowStr.includes('account name') ||
                            rowStr.includes('created date') ||
                            rowStr.includes('quote first sent') ||
                            rowStr.includes('passthrough');

    if (hasMultipleColumns && hasHeaderPattern) {
      headerRowIndex = i;
      headers = row.map((cell, idx) => {
        const val = String(cell ?? `column_${idx}`).toLowerCase().trim();
        return val || `column_${idx}`;
      });
      break;
    }
  }

  if (headerRowIndex === -1) {
    // Fallback: use first row with data
    headerRowIndex = 0;
    headers = (rawData[0] || []).map((cell, idx) =>
      String(cell ?? `column_${idx}`).toLowerCase().trim() || `column_${idx}`
    );
  }

  // Parse data rows, handling grouped format where agent name may be blank
  const rows: CSVRow[] = [];
  let currentAgent = '';

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.every(cell => cell === null || cell === '')) continue;

    const rowObj: CSVRow = {};
    headers.forEach((header, idx) => {
      rowObj[header] = String(row[idx] ?? '').trim();
    });

    // Handle grouped format: if owner/agent name column is empty, use previous
    const ownerKey = headers.find(h =>
      h.includes('owner name') ||
      h.includes('agent') ||
      h.includes('last gtt action by')
    );
    if (ownerKey) {
      if (rowObj[ownerKey] && rowObj[ownerKey] !== '') {
        currentAgent = rowObj[ownerKey];
      } else {
        rowObj[ownerKey] = currentAgent;
      }
    }

    // Skip summary rows (Total, Subtotal, Grand Total, etc.)
    const rowValues = Object.values(rowObj).join(' ').toLowerCase();
    const isSummaryRow = rowValues.includes('subtotal') ||
                         rowValues.includes('grand total') ||
                         (ownerKey && (
                           rowObj[ownerKey].toLowerCase() === 'total' ||
                           rowObj[ownerKey].toLowerCase() === 'subtotal' ||
                           rowObj[ownerKey].toLowerCase().includes('grand total')
                         ));
    if (isSummaryRow) continue;

    // Only add rows that have some meaningful data
    if (Object.values(rowObj).some(v => v && v !== '')) {
      rows.push(rowObj);
    }
  }

  return rows;
};

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    setTeams(loadTeams());
    setSeniors(loadSeniors());
    setMetrics(loadMetrics());
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
    if (!files.trips || !files.quotes || !files.passthroughs || !files.hotPass || !files.bookings || !files.nonConverted) {
      setError('Please upload all six files');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const [tripsRows, quotesRows, passthroughsRows, hotPassRows, bookingsRows, nonConvertedRows] = await Promise.all([
        parseExcelFile(files.trips),
        parseExcelFile(files.quotes),
        parseExcelFile(files.passthroughs),
        parseExcelFile(files.hotPass),
        parseExcelFile(files.bookings),
        parseExcelFile(files.nonConverted),
      ]);

      console.log('Trips rows:', tripsRows.length, 'First row:', tripsRows[0]);
      console.log('Quotes rows:', quotesRows.length, 'First row:', quotesRows[0]);
      console.log('Passthroughs rows:', passthroughsRows.length, 'First row:', passthroughsRows[0]);
      console.log('Hot Pass rows:', hotPassRows.length, 'First row:', hotPassRows[0]);
      console.log('Bookings rows:', bookingsRows.length, 'First row:', bookingsRows[0]);
      console.log('Non-Converted rows:', nonConvertedRows.length, 'First row:', nonConvertedRows[0]);

      if (tripsRows.length === 0) {
        throw new Error('Trips file appears to be empty or invalid. Please check that the file contains data.');
      }

      // Find date columns for each file type
      const tripsDateCol = tripsRows.length > 0
        ? findDateColumn(tripsRows[0], ['created date', 'trip: created date'])
        : null;
      const quotesDateCol = quotesRows.length > 0
        ? findDateColumn(quotesRows[0], ['quote first sent', 'first sent date', 'created date'])
        : null;
      const passthroughsDateCol = passthroughsRows.length > 0
        ? findDateColumn(passthroughsRows[0], ['passthrough to sales date', 'passthrough date', 'created date'])
        : null;
      const hotPassDateCol = hotPassRows.length > 0
        ? findDateColumn(hotPassRows[0], ['created date', 'trip: created date'])
        : null;
      const bookingsDateCol = bookingsRows.length > 0
        ? findDateColumn(bookingsRows[0], ['created date', 'booking date', 'date'])
        : null;
      const nonConvertedDateCol = nonConvertedRows.length > 0
        ? findDateColumn(nonConvertedRows[0], ['created date', 'date'])
        : null;

      console.log('Date columns found - Trips:', tripsDateCol, 'Quotes:', quotesDateCol, 'Passthroughs:', passthroughsDateCol, 'Hot Pass:', hotPassDateCol, 'Bookings:', bookingsDateCol, 'Non-Converted:', nonConvertedDateCol);

      // Filter rows by date range
      const filteredTripsRows = filterRowsByDate(tripsRows, tripsDateCol, startDate, endDate);
      const filteredQuotesRows = filterRowsByDate(quotesRows, quotesDateCol, startDate, endDate);
      const filteredPassthroughsRows = filterRowsByDate(passthroughsRows, passthroughsDateCol, startDate, endDate);
      const filteredHotPassRows = filterRowsByDate(hotPassRows, hotPassDateCol, startDate, endDate);
      const filteredBookingsRows = filterRowsByDate(bookingsRows, bookingsDateCol, startDate, endDate);
      const filteredNonConvertedRows = filterRowsByDate(nonConvertedRows, nonConvertedDateCol, startDate, endDate);

      console.log('Filtered counts - Trips:', filteredTripsRows.length, 'Quotes:', filteredQuotesRows.length, 'Passthroughs:', filteredPassthroughsRows.length, 'Hot Pass:', filteredHotPassRows.length, 'Bookings:', filteredBookingsRows.length, 'Non-Converted:', filteredNonConvertedRows.length);

      const tripsAgentCol = findAgentColumn(filteredTripsRows[0] || tripsRows[0]);
      const quotesAgentCol = filteredQuotesRows.length > 0 ? findAgentColumn(filteredQuotesRows[0]) : null;
      const passthroughsAgentCol = filteredPassthroughsRows.length > 0 ? findAgentColumn(filteredPassthroughsRows[0]) : null;

      console.log('Agent columns found - Trips:', tripsAgentCol, 'Quotes:', quotesAgentCol, 'Passthroughs:', passthroughsAgentCol);

      if (!tripsAgentCol) {
        const availableColumns = Object.keys(tripsRows[0] || {}).join(', ');
        throw new Error(`Could not identify agent column in Trips file. Available columns: ${availableColumns}`);
      }

      const tripsCounts = countByAgent(filteredTripsRows, tripsAgentCol);
      const quotesCounts = quotesAgentCol
        ? countByAgent(filteredQuotesRows, quotesAgentCol)
        : new Map<string, number>();
      const passthroughsCounts = passthroughsAgentCol
        ? countByAgent(filteredPassthroughsRows, passthroughsAgentCol)
        : new Map<string, number>();

      // Count hot passes from the Hot Pass file (trips per agent)
      const hotPassAgentCol = filteredHotPassRows.length > 0 ? findAgentColumn(filteredHotPassRows[0]) : null;
      console.log('Hot Pass agent column found:', hotPassAgentCol);

      const hotPassCounts = hotPassAgentCol
        ? countByAgent(filteredHotPassRows, hotPassAgentCol)
        : new Map<string, number>();

      console.log('Hot Pass counts:', Object.fromEntries(hotPassCounts));

      // Count bookings from the Bookings file
      const bookingsAgentCol = filteredBookingsRows.length > 0 ? findAgentColumn(filteredBookingsRows[0]) : null;
      console.log('Bookings agent column found:', bookingsAgentCol);

      const bookingsCounts = bookingsAgentCol
        ? countByAgent(filteredBookingsRows, bookingsAgentCol)
        : new Map<string, number>();

      console.log('Bookings counts:', Object.fromEntries(bookingsCounts));

      // Count non-converted leads and total leads from the Non-Converted file
      const nonConvertedAgentCol = filteredNonConvertedRows.length > 0 ? findAgentColumn(filteredNonConvertedRows[0]) : null;
      console.log('Non-Converted agent column found:', nonConvertedAgentCol);

      // For non-converted, we need to count non-validated leads and total leads per agent
      const nonConvertedCounts = new Map<string, { nonValidated: number; total: number }>();
      if (nonConvertedAgentCol && filteredNonConvertedRows.length > 0) {
        // Find the column that indicates validation status (look for "validated" or similar)
        const firstRow = filteredNonConvertedRows[0];
        const validatedColKey = Object.keys(firstRow).find(k =>
          k.toLowerCase().includes('validated') || k.toLowerCase().includes('status') || k.toLowerCase().includes('converted')
        );

        for (const row of filteredNonConvertedRows) {
          const agent = row[nonConvertedAgentCol];
          if (agent) {
            const current = nonConvertedCounts.get(agent) || { nonValidated: 0, total: 0 };
            current.total += 1;

            // Check if this lead is non-validated (the value should indicate non-validated status)
            if (validatedColKey) {
              const validatedValue = row[validatedColKey]?.toLowerCase() || '';
              // Count as non-validated if it's empty, "no", "false", "0", or contains "non" or "not"
              if (!validatedValue || validatedValue === 'no' || validatedValue === 'false' || validatedValue === '0' ||
                  validatedValue.includes('non') || validatedValue.includes('not') || validatedValue === 'n') {
                current.nonValidated += 1;
              }
            } else {
              // If no validation column found, count all as the data structure we have
              // Each row represents a non-converted lead
              current.nonValidated += 1;
            }

            nonConvertedCounts.set(agent, current);
          }
        }
      }

      console.log('Non-Converted counts:', Object.fromEntries(nonConvertedCounts));

      const allAgents = new Set([
        ...tripsCounts.keys(),
        ...quotesCounts.keys(),
        ...passthroughsCounts.keys(),
        ...bookingsCounts.keys(),
        ...nonConvertedCounts.keys(),
      ]);

      const calculatedMetrics: Metrics[] = Array.from(allAgents)
        .map((agentName) => {
          const trips = tripsCounts.get(agentName) || 0;
          const quotes = quotesCounts.get(agentName) || 0;
          const passthroughs = passthroughsCounts.get(agentName) || 0;
          const hotPasses = hotPassCounts.get(agentName) || 0;
          const bookings = bookingsCounts.get(agentName) || 0;
          const nonConvertedData = nonConvertedCounts.get(agentName) || { nonValidated: 0, total: 0 };

          return {
            agentName,
            trips,
            quotes,
            passthroughs,
            hotPasses,
            bookings,
            nonConvertedLeads: nonConvertedData.nonValidated,
            totalLeads: nonConvertedData.total,
            quotesFromTrips: trips > 0 ? (quotes / trips) * 100 : 0,
            passthroughsFromTrips: trips > 0 ? (passthroughs / trips) * 100 : 0,
            quotesFromPassthroughs: passthroughs > 0 ? (quotes / passthroughs) * 100 : 0,
            hotPassRate: passthroughs > 0 ? (hotPasses / passthroughs) * 100 : 0,
            nonConvertedRate: nonConvertedData.total > 0 ? (nonConvertedData.nonValidated / nonConvertedData.total) * 100 : 0,
          };
        })
        .sort((a, b) => a.agentName.localeCompare(b.agentName));

      setMetrics(calculatedMetrics);
      saveMetrics(calculatedMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing files');
    } finally {
      setIsProcessing(false);
    }
  }, [files, startDate, endDate]);

  const handleClearData = useCallback(() => {
    setMetrics([]);
    clearMetrics();
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

  const allAgentNames = metrics.map((m) => m.agentName);
  const allFilesUploaded = files.trips && files.quotes && files.passthroughs && files.hotPass && files.bookings && files.nonConverted;

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
            disabled={!allFilesUploaded || isProcessing}
            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              'Analyze Data'
            )}
          </button>

          {metrics.length > 0 && (
            <button
              onClick={handleClearData}
              className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-xl shadow-lg hover:bg-gray-700 transition-all duration-200"
            >
              Clear Data
            </button>
          )}
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center">
            {error}
          </div>
        )}

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

          <TeamComparison metrics={metrics} teams={teams} seniors={seniors} />

          <ResultsTable metrics={metrics} teams={teams} seniors={seniors} />
        </div>
      </div>
    </div>
  );
}

export default App;
