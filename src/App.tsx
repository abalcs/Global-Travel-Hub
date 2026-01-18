import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { FileUpload } from './components/FileUpload';
import { ResultsTable } from './components/ResultsTable';
import { TeamManagement } from './components/TeamManagement';
import type { Team, Metrics, FileUploadState } from './types';
import { findAgentColumn, countByAgent } from './utils/csvParser';
import type { CSVRow } from './utils/csvParser';
import { loadTeams, saveTeams } from './utils/storage';

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
  });

  const [teams, setTeams] = useState<Team[]>([]);
  const [metrics, setMetrics] = useState<Metrics[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTeams(loadTeams());
  }, []);

  const handleTeamsChange = useCallback((newTeams: Team[]) => {
    setTeams(newTeams);
    saveTeams(newTeams);
  }, []);

  const handleFileSelect = useCallback(
    (type: keyof FileUploadState) => (file: File | null) => {
      setFiles((prev) => ({ ...prev, [type]: file }));
      setError(null);
    },
    []
  );

  const processFiles = useCallback(async () => {
    if (!files.trips || !files.quotes || !files.passthroughs) {
      setError('Please upload all three files');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const [tripsRows, quotesRows, passthroughsRows] = await Promise.all([
        parseExcelFile(files.trips),
        parseExcelFile(files.quotes),
        parseExcelFile(files.passthroughs),
      ]);

      console.log('Trips rows:', tripsRows.length, 'First row:', tripsRows[0]);
      console.log('Quotes rows:', quotesRows.length, 'First row:', quotesRows[0]);
      console.log('Passthroughs rows:', passthroughsRows.length, 'First row:', passthroughsRows[0]);

      if (tripsRows.length === 0) {
        throw new Error('Trips file appears to be empty or invalid. Please check that the file contains data.');
      }

      const tripsAgentCol = findAgentColumn(tripsRows[0]);
      const quotesAgentCol = quotesRows.length > 0 ? findAgentColumn(quotesRows[0]) : null;
      const passthroughsAgentCol = passthroughsRows.length > 0 ? findAgentColumn(passthroughsRows[0]) : null;

      console.log('Agent columns found - Trips:', tripsAgentCol, 'Quotes:', quotesAgentCol, 'Passthroughs:', passthroughsAgentCol);

      if (!tripsAgentCol) {
        const availableColumns = Object.keys(tripsRows[0] || {}).join(', ');
        throw new Error(`Could not identify agent column in Trips file. Available columns: ${availableColumns}`);
      }

      const tripsCounts = countByAgent(tripsRows, tripsAgentCol);
      const quotesCounts = quotesAgentCol
        ? countByAgent(quotesRows, quotesAgentCol)
        : new Map<string, number>();
      const passthroughsCounts = passthroughsAgentCol
        ? countByAgent(passthroughsRows, passthroughsAgentCol)
        : new Map<string, number>();

      const allAgents = new Set([
        ...tripsCounts.keys(),
        ...quotesCounts.keys(),
        ...passthroughsCounts.keys(),
      ]);

      const calculatedMetrics: Metrics[] = Array.from(allAgents)
        .map((agentName) => {
          const trips = tripsCounts.get(agentName) || 0;
          const quotes = quotesCounts.get(agentName) || 0;
          const passthroughs = passthroughsCounts.get(agentName) || 0;

          return {
            agentName,
            trips,
            quotes,
            passthroughs,
            quotesFromTrips: trips > 0 ? (quotes / trips) * 100 : 0,
            passthroughsFromTrips: trips > 0 ? (passthroughs / trips) * 100 : 0,
            quotesFromPassthroughs: passthroughs > 0 ? (quotes / passthroughs) * 100 : 0,
          };
        })
        .sort((a, b) => a.agentName.localeCompare(b.agentName));

      setMetrics(calculatedMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing files');
    } finally {
      setIsProcessing(false);
    }
  }, [files]);

  const allAgentNames = metrics.map((m) => m.agentName);
  const allFilesUploaded = files.trips && files.quotes && files.passthroughs;

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
        </div>

        <div className="flex justify-center mb-8">
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

          <ResultsTable metrics={metrics} teams={teams} />
        </div>
      </div>
    </div>
  );
}

export default App;
