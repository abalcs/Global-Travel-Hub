import * as XLSX from 'xlsx';

export interface CSVRow {
  [key: string]: string;
}

export interface ProcessedFileData {
  trips: CSVRow[];
  quotes: CSVRow[];
  passthroughs: CSVRow[];
  hotPass: CSVRow[];
  bookings: CSVRow[];
  nonConverted: CSVRow[];
  nonConvertedCounts: Record<string, number>;
  quotesStarted?: CSVRow[];
}

export interface WorkerMessage {
  type: 'process';
  files: {
    trips: ArrayBuffer;
    quotes: ArrayBuffer;
    passthroughs: ArrayBuffer;
    hotPass: ArrayBuffer;
    bookings: ArrayBuffer;
    nonConverted: ArrayBuffer;
    quotesStarted?: ArrayBuffer;
  };
}

export interface WorkerResponse {
  type: 'success' | 'error' | 'progress';
  data?: ProcessedFileData;
  error?: string;
  progress?: number;
  stage?: string;
}

// Optimized Excel file parsing
const parseExcelFile = (buffer: ArrayBuffer): CSVRow[] => {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get raw data as array of arrays - more efficient than json
  const rawData = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: false // Convert all to strings
  });

  if (rawData.length === 0) return [];

  // Find header row
  let headerRowIndex = -1;
  let headers: string[] = [];

  const headerPatterns = ['owner name', 'last gtt action by', 'trip name', 'account name', 'created date', 'quote first sent', 'passthrough'];

  for (let i = 0; i < Math.min(50, rawData.length); i++) {
    const row = rawData[i];
    if (!row) continue;

    const rowStr = row.join('|').toLowerCase();

    // Skip filter rows
    if (rowStr.includes('contains ') || rowStr.includes('equals ')) continue;

    const nonEmptyCells = row.filter(cell => cell !== null && cell !== '');
    if (nonEmptyCells.length < 4) continue;

    const hasHeaderPattern = headerPatterns.some(p => rowStr.includes(p));
    if (hasHeaderPattern) {
      headerRowIndex = i;
      headers = row.map((cell, idx) => {
        const val = String(cell ?? `column_${idx}`).toLowerCase().trim();
        return val || `column_${idx}`;
      });
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    headers = (rawData[0] || []).map((cell, idx) =>
      String(cell ?? `column_${idx}`).toLowerCase().trim() || `column_${idx}`
    );
  }

  // Find owner key once
  const ownerKey = headers.find(h =>
    h.includes('gtt owner') ||
    h.includes('owner name') ||
    h.includes('agent') ||
    h.includes('last gtt action by')
  );

  // Pre-allocate array
  const rows: CSVRow[] = [];

  let currentAgent = '';
  const headerLen = headers.length;

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row) continue;

    // Quick check for empty row
    let hasData = false;
    for (let j = 0; j < row.length; j++) {
      if (row[j] !== null && row[j] !== '') {
        hasData = true;
        break;
      }
    }
    if (!hasData) continue;

    // Build row object
    const rowObj: CSVRow = {};
    for (let j = 0; j < headerLen; j++) {
      rowObj[headers[j]] = String(row[j] ?? '').trim();
    }

    // Check for group header
    const firstValue = rowObj[headers[0]] || '';
    const nonEmptyCount = Object.values(rowObj).filter(v => v && v !== '').length;

    const looksLikeGroupHeader = nonEmptyCount <= 2 &&
      firstValue.length > 3 &&
      (firstValue.includes(' ') || firstValue.includes(',')) &&
      !/^\d/.test(firstValue) &&
      !firstValue.toLowerCase().includes('total');

    if (looksLikeGroupHeader) {
      currentAgent = firstValue;
      continue;
    }

    // Handle owner column
    if (ownerKey) {
      if (rowObj[ownerKey] && rowObj[ownerKey] !== '') {
        currentAgent = rowObj[ownerKey];
      } else {
        rowObj[ownerKey] = currentAgent;
      }
    } else if (currentAgent) {
      rowObj['_agent'] = currentAgent;
    }

    // Skip summary rows
    const ownerVal = ownerKey ? rowObj[ownerKey].toLowerCase() : '';
    if (ownerVal === 'total' || ownerVal === 'subtotal' || ownerVal.includes('grand total')) {
      continue;
    }

    rows.push(rowObj);
  }

  return rows;
};

// Parse non-converted file with special logic
const parseNonConvertedFile = (buffer: ArrayBuffer): { rows: CSVRow[], counts: Record<string, number> } => {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: null });

  const counts: Record<string, number> = {};
  const rows: CSVRow[] = [];

  // Find header row
  let headerRowIdx = -1;
  let leadOwnerColIdx = -1;
  let nonValidatedReasonColIdx = -1;

  for (let i = 0; i < Math.min(30, rawData.length); i++) {
    const row = rawData[i];
    if (!row) continue;
    const rowStr = row.join('|').toLowerCase();

    if (rowStr.includes('lead owner') && rowStr.includes('non validated reason')) {
      headerRowIdx = i;
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').toLowerCase();
        if (cell.includes('lead owner')) leadOwnerColIdx = j;
        if (cell.includes('non validated reason')) nonValidatedReasonColIdx = j;
      }
      break;
    }
  }

  if (headerRowIdx >= 0 && leadOwnerColIdx >= 0 && nonValidatedReasonColIdx >= 0) {
    let currentAgent = '';
    const headers = (rawData[headerRowIdx] as (string | number | null)[]).map((cell, idx) =>
      String(cell ?? `column_${idx}`).toLowerCase().trim()
    );

    for (let i = headerRowIdx + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row) continue;

      const leadOwner = String(row[leadOwnerColIdx] || '').trim();
      const nonValidatedReason = String(row[nonValidatedReasonColIdx] || '').trim();

      if (leadOwner && leadOwner !== '') {
        currentAgent = leadOwner;
      }

      if (currentAgent && nonValidatedReason && nonValidatedReason !== '') {
        counts[currentAgent] = (counts[currentAgent] || 0) + 1;
      }

      // Also build row for storage
      const rowObj: CSVRow = {};
      for (let j = 0; j < headers.length; j++) {
        rowObj[headers[j]] = String(row[j] ?? '').trim();
      }
      if (!rowObj['lead owner'] && currentAgent) {
        rowObj['lead owner'] = currentAgent;
      }
      rows.push(rowObj);
    }
  }

  return { rows, counts };
};

// Main worker message handler
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, files } = e.data;

  if (type !== 'process') return;

  try {
    const response = (msg: WorkerResponse) => self.postMessage(msg);

    response({ type: 'progress', progress: 0, stage: 'Parsing trips...' });
    const trips = parseExcelFile(files.trips);

    response({ type: 'progress', progress: 15, stage: 'Parsing quotes...' });
    const quotes = parseExcelFile(files.quotes);

    response({ type: 'progress', progress: 30, stage: 'Parsing passthroughs...' });
    const passthroughs = parseExcelFile(files.passthroughs);

    response({ type: 'progress', progress: 45, stage: 'Parsing hot passes...' });
    const hotPass = parseExcelFile(files.hotPass);

    response({ type: 'progress', progress: 60, stage: 'Parsing bookings...' });
    const bookings = parseExcelFile(files.bookings);

    response({ type: 'progress', progress: 70, stage: 'Parsing non-converted...' });
    const { rows: nonConverted, counts: nonConvertedCounts } = parseNonConvertedFile(files.nonConverted);

    // Parse quotes started if provided
    let quotesStarted: CSVRow[] | undefined;
    if (files.quotesStarted) {
      response({ type: 'progress', progress: 85, stage: 'Parsing quotes started...' });
      quotesStarted = parseExcelFile(files.quotesStarted);
    }

    response({ type: 'progress', progress: 100, stage: 'Complete!' });

    response({
      type: 'success',
      data: {
        trips,
        quotes,
        passthroughs,
        hotPass,
        bookings,
        nonConverted,
        nonConvertedCounts,
        quotesStarted,
      },
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error during processing',
    });
  }
};

export {};
