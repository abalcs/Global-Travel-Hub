/**
 * Excel Parser for new CRM (Salesforce) grouped reports.
 *
 * Handles the "fill-down" grouped format where the agent name only appears
 * once per group, followed by data rows, then Subtotal/Count rows.
 *
 * Column positions are detected dynamically from the header row so the
 * same parser works for Passthroughs, Quotes, and Bookings reports.
 */
import * as XLSX from 'xlsx';
import type { Metrics } from '../types';
import type { CrmParsedData } from './indexedDB';
import { formatDateString } from './dateParser';

const REPEAT_CLIENT_TYPES = ['repeat', 'elite', 'multi-repeat'];

// ── Generic row parsed from any CRM report ──────────────────────────
export interface CrmRow {
  agentName: string;
  quoteName: string;
  tripRef: string;
  tripNumber: string;
  destination: string;
  interest: string;
  channel: string;
  media: string;
  clientType: string;
  enquiryDate: string;
  passthroughDate: string;
  quoteCreatedDate: string;
  bookingCreatedDate: string;
  depositAcquiredDate: string;
  timeTaken: number;
  owner: string;
  stage: string;
  orderStatus: string;
  totalAmountBCY: number;
  dropoutReason: string;
  dropoutStage: string;
  dropoutNotes: string;
  travelAgentName: string;
}

export interface ParsedReport {
  rows: CrmRow[];
  reportTitle: string;
  reportDate: string;
  dateRange: string;
}

// ── Column detection ─────────────────────────────────────────────────

interface ColumnMap {
  agent: number;
  quoteName: number;
  tripRef: number;
  tripNumber: number;
  destination: number;
  interest: number;
  channel: number;
  media: number;
  clientType: number;
  enquiryDate: number;
  passthroughDate: number;
  quoteCreatedDate: number;
  bookingCreatedDate: number;
  depositAcquiredDate: number;
  timeTaken: number;
  owner: number;
  stage: number;
  orderStatus: number;
  totalAmountBCY: number;
  dropoutReason: number;
  dropoutStage: number;
  dropoutNotes: number;
  travelAgentName: number;
}

const COLUMN_MATCHERS: Record<keyof ColumnMap, string[]> = {
  agent: ['last gtt action by', 'enquiry owner', 'full name'],
  quoteName: ['quote: quote name', 'quote name'],
  tripRef: ['trip reference', 'trip ref'],
  tripNumber: ['trip number', 'trip record name'],
  destination: ['destination: name', 'enquiry: destination'],
  interest: ['interest: interest name', 'interest name', 'sales programme'],
  channel: ['channel picklist', 'channel: name', 'channel'],
  media: ['enquiry: media', 'media'],
  clientType: ['client account: client type', 'client type'],
  enquiryDate: ['last transfer date', 'enquiry created date', 'enquiry: created date'],
  passthroughDate: ['passthrough to sales date', 'passthrough date'],
  quoteCreatedDate: ['quote: created date'],
  bookingCreatedDate: ['booking created date'],
  depositAcquiredDate: ['deposit acquired date'],
  timeTaken: ['gtt time taken', 'time taken', 'p>b lag'],
  owner: ['owner: full name', 'owner'],
  stage: ['quote: stage', 'enquiry: enquiry status', 'enquiry status'],
  orderStatus: ['order: status', 'order status'],
  totalAmountBCY: ['total amount bcy', 'total amount'],
  dropoutReason: ['dropout reason'],
  dropoutStage: ['dropout stage'],
  dropoutNotes: ['dropout notes'],
  travelAgentName: ['travel agent/partner contact', 'travel agent', 'partner contact'],
};

function detectColumns(headerRow: unknown[]): ColumnMap {
  const map: Partial<ColumnMap> = {};

  for (let i = 0; i < headerRow.length; i++) {
    const header = String(headerRow[i] ?? '').toLowerCase().trim()
      .replace(/\s*↑\s*$/, '').replace(/\s*↓\s*$/, ''); // strip sort arrows
    if (!header) continue;

    for (const [key, patterns] of Object.entries(COLUMN_MATCHERS)) {
      if (map[key as keyof ColumnMap] !== undefined) continue; // already found
      if (patterns.some(p => header.includes(p))) {
        map[key as keyof ColumnMap] = i;
      }
    }
  }

  // Return with -1 defaults for any missing columns
  const defaults: ColumnMap = {
    agent: 1, quoteName: -1, tripRef: -1, tripNumber: -1, destination: -1,
    interest: -1, channel: -1, media: -1, clientType: -1,
    enquiryDate: -1, passthroughDate: -1, quoteCreatedDate: -1,
    bookingCreatedDate: -1, depositAcquiredDate: -1,
    timeTaken: -1, owner: -1, stage: -1, orderStatus: -1,
    totalAmountBCY: -1,
    dropoutReason: -1, dropoutStage: -1, dropoutNotes: -1,
    travelAgentName: -1,
  };

  return { ...defaults, ...map };
}

// ── Shared helpers ───────────────────────────────────────────────────

function findHeaderRow(data: unknown[][]): number {
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    // Header row has many non-empty cells (column headers); filter rows have just one.
    const nonEmpty = row.filter(c => c != null && String(c).trim() !== '').length;
    if (nonEmpty < 4) continue;
    const joined = row.map(c => String(c ?? '')).join(' ');
    if (joined.includes('Last GTT Action By') || joined.includes('Enquiry Owner') || joined.includes('Quote: Quote Name')) return i;
  }
  return 12; // fallback
}

function extractDateRange(data: unknown[][]): string {
  for (let i = 0; i < Math.min(15, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const cell = String(row[1] ?? '');
    const match = cell.match(/\((\d{1,2}\/\d{1,2}\/\d{4}\s+to\s+\d{1,2}\/\d{1,2}\/\d{4})\)/);
    if (match) return match[1];
  }
  return '';
}

function extractReportDate(data: unknown[][]): string {
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const cell = String(data[i]?.[1] ?? '');
    if (cell.startsWith('As of')) return cell;
  }
  return '';
}

function extractReportTitle(data: unknown[][]): string {
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const cell = String(data[i]?.[1] ?? '').trim();
    if (cell && !cell.startsWith('As of') && cell !== 'Filtered By') return cell;
  }
  return '';
}

function safeStr(row: unknown[], idx: number): string {
  return idx >= 0 ? String(row[idx] ?? '') : '';
}

function safeNum(row: unknown[], idx: number): number {
  return idx >= 0 ? (Number(row[idx]) || 0) : 0;
}

// ── Generic report parser ────────────────────────────────────────────

export function parseCrmExcel(file: ArrayBuffer): ParsedReport {
  const wb = XLSX.read(file, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

  const headerIdx = findHeaderRow(data);
  const cols = detectColumns(data[headerIdx] || []);
  const reportDate = extractReportDate(data);
  const dateRange = extractDateRange(data);
  const reportTitle = extractReportTitle(data);

  const rows: CrmRow[] = [];
  let currentAgent: string | null = null;

  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const col1 = String(row[cols.agent] ?? '').trim();

    // Skip subtotal/total/aggregate rows
    if (col1 === 'Subtotal' || col1 === 'Total') continue;
    const col2 = String(row[2] ?? '').trim();
    if (['Count', 'Avg', 'Sum'].includes(col2)) continue;

    // Fill-down agent name
    if (col1 && col1 !== currentAgent) {
      currentAgent = col1;
    }
    if (!currentAgent) continue;

    // Must have some data (quote name, destination, or a date)
    const hasData = safeStr(row, cols.quoteName) || safeStr(row, cols.destination) ||
                    safeStr(row, cols.passthroughDate) || safeStr(row, cols.quoteCreatedDate);
    if (!hasData) continue;

    rows.push({
      agentName: currentAgent,
      quoteName: safeStr(row, cols.quoteName),
      tripRef: safeStr(row, cols.tripRef),
      tripNumber: safeStr(row, cols.tripNumber),
      destination: safeStr(row, cols.destination),
      interest: safeStr(row, cols.interest),
      channel: safeStr(row, cols.channel),
      media: safeStr(row, cols.media),
      clientType: safeStr(row, cols.clientType),
      enquiryDate: safeStr(row, cols.enquiryDate),
      passthroughDate: safeStr(row, cols.passthroughDate),
      quoteCreatedDate: safeStr(row, cols.quoteCreatedDate),
      bookingCreatedDate: safeStr(row, cols.bookingCreatedDate),
      depositAcquiredDate: safeStr(row, cols.depositAcquiredDate),
      timeTaken: safeNum(row, cols.timeTaken),
      owner: safeStr(row, cols.owner),
      stage: safeStr(row, cols.stage),
      orderStatus: safeStr(row, cols.orderStatus),
      totalAmountBCY: safeNum(row, cols.totalAmountBCY),
      dropoutReason: safeStr(row, cols.dropoutReason),
      dropoutStage: safeStr(row, cols.dropoutStage),
      dropoutNotes: safeStr(row, cols.dropoutNotes),
      travelAgentName: safeStr(row, cols.travelAgentName),
    });
  }

  return { rows, reportTitle, reportDate, dateRange };
}

// ── Aggregate agent stats from rows ──────────────────────────────────

interface AgentStats {
  enquiries: number;
  repeatEnquiries: number;
  prospectEnquiries: number;
  taEnquiries: number;
  b2bEnquiries: number;
  passthroughs: number;
  repeatPassthroughs: number;
  prospectPassthroughs: number;
  taPassthroughs: number;
  b2bPassthroughs: number;
  quotes: number;
  quotesWithTripRef: number;
  repeatQuotes: number;
  prospectQuotes: number;
  taQuotes: number;
  b2bQuotes: number;
  repeatQuotesWithTripRef: number;
  prospectQuotesWithTripRef: number;
  b2bQuotesWithTripRef: number;
  bookings: number;
  repeatBookings: number;
  prospectBookings: number;
  b2bBookings: number;
}

function emptyStats(): AgentStats {
  return {
    enquiries: 0, repeatEnquiries: 0, prospectEnquiries: 0,
    taEnquiries: 0, b2bEnquiries: 0,
    passthroughs: 0, repeatPassthroughs: 0, prospectPassthroughs: 0,
    taPassthroughs: 0, b2bPassthroughs: 0,
    quotes: 0, quotesWithTripRef: 0, repeatQuotes: 0, prospectQuotes: 0,
    taQuotes: 0, b2bQuotes: 0,
    repeatQuotesWithTripRef: 0, prospectQuotesWithTripRef: 0, b2bQuotesWithTripRef: 0,
    bookings: 0, repeatBookings: 0, prospectBookings: 0, b2bBookings: 0,
  };
}

function classifyRow(row: CrmRow): { isRepeat: boolean; isTA: boolean } {
  const ct = row.clientType.trim().toLowerCase();
  return {
    isRepeat: REPEAT_CLIENT_TYPES.includes(ct),
    isTA: row.channel.endsWith('B2B'),
  };
}

/**
 * Build unified Metrics[] from parsed enquiries, passthroughs, quotes, and bookings reports.
 * Any report can be null/undefined if not yet uploaded.
 *
 * Terminology mapping (old → new CRM):
 *   trips → enquiries
 *   T>P → E>P (Enquiry to Passthrough %)
 *   T>Q → E>Q (Enquiry to Quote %)
 *   E>B = Enquiry to Booking % (new)
 */
export function buildMetrics(
  enquiriesReport: ParsedReport | null,
  ptReport: ParsedReport | null,
  quotesReport: ParsedReport | null,
  bookingsReport: ParsedReport | null,
  queueStoppedCounts?: Map<string, number>,
): Metrics[] {
  const agentMap = new Map<string, AgentStats>();

  const ensure = (name: string) => {
    if (!agentMap.has(name)) agentMap.set(name, emptyStats());
    return agentMap.get(name)!;
  };

  // Enquiries (replaces "trips" — the baseline volume metric)
  if (enquiriesReport) {
    for (const row of enquiriesReport.rows) {
      const s = ensure(row.agentName);
      const { isRepeat, isTA } = classifyRow(row);
      s.enquiries++;
      if (isTA) { s.taEnquiries++; s.b2bEnquiries++; }
      else if (isRepeat) { s.repeatEnquiries++; }
      else { s.prospectEnquiries++; }
    }
  }

  // Passthroughs
  if (ptReport) {
    for (const row of ptReport.rows) {
      const s = ensure(row.agentName);
      const { isRepeat, isTA } = classifyRow(row);
      s.passthroughs++;
      if (isTA) { s.taPassthroughs++; s.b2bPassthroughs++; }
      else if (isRepeat) { s.repeatPassthroughs++; }
      else { s.prospectPassthroughs++; }
    }
  }

  // Quotes
  if (quotesReport) {
    for (const row of quotesReport.rows) {
      const s = ensure(row.agentName);
      const { isRepeat, isTA } = classifyRow(row);
      s.quotes++;
      if (row.tripRef.trim()) {
        s.quotesWithTripRef++;
        if (isTA) { s.b2bQuotesWithTripRef++; }
        else if (isRepeat) { s.repeatQuotesWithTripRef++; }
        else { s.prospectQuotesWithTripRef++; }
      }
      if (isTA) { s.taQuotes++; s.b2bQuotes++; }
      else if (isRepeat) { s.repeatQuotes++; }
      else { s.prospectQuotes++; }
    }
  }

  // Bookings
  if (bookingsReport) {
    for (const row of bookingsReport.rows) {
      const s = ensure(row.agentName);
      const { isRepeat, isTA } = classifyRow(row);
      s.bookings++;
      if (isTA) { s.b2bBookings++; }
      else if (isRepeat) { s.repeatBookings++; }
      else { s.prospectBookings++; }
    }
  }

  // Build Metrics objects
  // "trips" field now holds enquiries count for backward compat with existing components
  const metrics: Metrics[] = [];
  for (const [agentName, s] of agentMap) {
    // E>Q rate: quotes (with trip ref) / enquiries
    const eqRate = s.enquiries > 0 ? (s.quotesWithTripRef / s.enquiries) * 100 : 0;
    // E>P rate: passthroughs / enquiries
    const epRate = s.enquiries > 0 ? (s.passthroughs / s.enquiries) * 100 : 0;
    // P>Q rate: quotes with trip ref / passthroughs
    const pqRate = s.passthroughs > 0 ? (s.quotesWithTripRef / s.passthroughs) * 100 : 0;
    // E>B rate: bookings / enquiries
    const ebRate = s.enquiries > 0 ? (s.bookings / s.enquiries) * 100 : 0;

    const agentQueueStopped = queueStoppedCounts?.get(agentName) || 0;
    const agentHotPasses = Math.max(0, s.passthroughs - agentQueueStopped);

    metrics.push({
      agentName,
      // "trips" field = enquiries (backward compat with TeamComparison/ResultsTable)
      trips: s.enquiries,
      quotes: s.quotesWithTripRef,
      quotesWithTripRef: s.quotesWithTripRef,
      passthroughs: s.passthroughs,
      hotPasses: agentHotPasses,
      totalTripsAudited: 0,
      bookings: s.bookings,
      nonConvertedLeads: 0,
      totalLeads: 0,
      // Rate metrics: E>Q, E>P, P>Q
      quotesFromTrips: eqRate,        // E>Q %
      passthroughsFromTrips: epRate,  // E>P %
      quotesFromPassthroughs: pqRate,  // P>Q %
      bookingsFromEnquiries: ebRate,   // E>B %
      hotPassRate: s.passthroughs > 0 ? (agentHotPasses / s.passthroughs) * 100 : 0,
      nonConvertedRate: 0,
      // Repeat client metrics
      repeatTrips: s.repeatEnquiries,
      repeatPassthroughs: s.repeatPassthroughs,
      repeatTpRate: s.repeatEnquiries > 0 ? (s.repeatPassthroughs / s.repeatEnquiries) * 100 : 0,
      repeatQuotes: s.repeatQuotes,
      repeatQuotesWithTripRef: s.repeatQuotesWithTripRef,
      repeatBookings: s.repeatBookings,
      // Prospect client metrics
      prospectTrips: s.prospectEnquiries,
      prospectPassthroughs: s.prospectPassthroughs,
      prospectTpRate: s.prospectEnquiries > 0 ? (s.prospectPassthroughs / s.prospectEnquiries) * 100 : 0,
      prospectQuotes: s.prospectQuotes,
      prospectQuotesWithTripRef: s.prospectQuotesWithTripRef,
      prospectBookings: s.prospectBookings,
      // B2B metrics
      b2bTrips: s.b2bEnquiries,
      b2bPassthroughs: s.b2bPassthroughs,
      b2bTpRate: s.b2bEnquiries > 0 ? (s.b2bPassthroughs / s.b2bEnquiries) * 100 : 0,
      b2bQuotes: s.b2bQuotes,
      b2bQuotesWithTripRef: s.b2bQuotesWithTripRef,
      b2bBookings: s.b2bBookings,
      // Not available yet
      quotesStarted: 0,
      potentialTQ: 0,
      partnerTrips: 0,
      partnerPassthroughs: 0,
      partnerTpRate: 0,
      // TA metrics
      taTrips: s.taEnquiries,
      taPassthroughs: s.taPassthroughs,
      taTpRate: s.taEnquiries > 0 ? (s.taPassthroughs / s.taEnquiries) * 100 : 0,
    });
  }

  return metrics;
}

// ── Date filtering utilities ─────────────────────────────────────────

/** Date field to use for each report type */
const DATE_FIELD_MAP: Record<keyof CrmParsedData, keyof CrmRow> = {
  enquiries: 'enquiryDate',
  passthroughs: 'passthroughDate',
  quotes: 'quoteCreatedDate',
  bookings: 'depositAcquiredDate',
};

/**
 * Filter CRM data arrays by date range.
 * Each report type is filtered by its appropriate date field.
 * Returns unfiltered data when both dates are empty.
 */
export function filterCrmDataByDate(
  data: CrmParsedData,
  startDate: string,
  endDate: string,
): CrmParsedData {
  if (!startDate && !endDate) return data;

  const filterRows = (rows: CrmRow[], dateField: keyof CrmRow): CrmRow[] =>
    rows.filter(row => {
      const raw = row[dateField] as string;
      const normalized = formatDateString(raw);
      if (!normalized) return false;
      if (startDate && normalized < startDate) return false;
      if (endDate && normalized > endDate) return false;
      return true;
    });

  return {
    enquiries: filterRows(data.enquiries, DATE_FIELD_MAP.enquiries),
    passthroughs: filterRows(data.passthroughs, DATE_FIELD_MAP.passthroughs),
    quotes: filterRows(data.quotes, DATE_FIELD_MAP.quotes),
    bookings: filterRows(data.bookings, DATE_FIELD_MAP.bookings),
  };
}

/**
 * Scan all 4 report arrays to find the earliest and latest dates.
 * Returns { min, max } as YYYY-MM-DD strings (or null if no dates found).
 */
export function getCrmDateExtent(data: CrmParsedData): { min: string | null; max: string | null } {
  let min: string | null = null;
  let max: string | null = null;

  for (const [key, dateField] of Object.entries(DATE_FIELD_MAP)) {
    const rows = data[key as keyof CrmParsedData];
    for (const row of rows) {
      const raw = row[dateField as keyof CrmRow] as string;
      const normalized = formatDateString(raw);
      if (!normalized) continue;
      if (!min || normalized < min) min = normalized;
      if (!max || normalized > max) max = normalized;
    }
  }

  return { min, max };
}

// ── Owner Changes Parser ─────────────────────────────────────────────

export interface OwnerChangeRecord {
  agentName: string;
  tripRecordName: string;
  oldValue: string;
  newValue: string;
  editedBy: string;
  editDate: string;
}

/**
 * Parse an "Owner Changes" Salesforce grouped report.
 *
 * The file has two-level grouping: agent name → trip record name → change rows.
 * We detect the header row, then fill-down on both the agent and trip columns.
 */
export function parseOwnerChanges(file: ArrayBuffer): OwnerChangeRecord[] {
  const wb = XLSX.read(file, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

  // Find header row by looking for "Old Value" or "New Value"
  let headerIdx = -1;
  for (let i = 0; i < Math.min(25, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const joined = row.map(c => String(c ?? '').toLowerCase()).join(' ');
    if (joined.includes('old value') || joined.includes('new value')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const headerRow = data[headerIdx];
  // Detect column indices
  let agentCol = -1;
  let tripRefCol = -1;
  let oldValueCol = -1;
  let newValueCol = -1;
  let editedByCol = -1;
  let editDateCol = -1;

  for (let i = 0; i < headerRow.length; i++) {
    const h = String(headerRow[i] ?? '').toLowerCase().trim()
      .replace(/\s*↑\s*$/, '').replace(/\s*↓\s*$/, '');
    if (!h) continue;
    if (agentCol === -1 && (h.includes('full name') || h.includes('last gtt action by') || h.includes('enquiry owner'))) agentCol = i;
    if (tripRefCol === -1 && (h.includes('trip record name') || h.includes('trip number'))) tripRefCol = i;
    if (oldValueCol === -1 && h.includes('old value')) oldValueCol = i;
    if (newValueCol === -1 && h.includes('new value')) newValueCol = i;
    if (editedByCol === -1 && (h.includes('edited by') || h.includes('modified by'))) editedByCol = i;
    if (editDateCol === -1 && (h.includes('edit date') || h.includes('modified date') || h.includes('date'))) editDateCol = i;
  }

  // Agent column often is col 1 (grouped), trip ref col 2
  if (agentCol === -1) agentCol = 1;
  if (tripRefCol === -1) tripRefCol = 2;

  const records: OwnerChangeRecord[] = [];
  let currentAgent = '';
  let currentTrip = '';

  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const col1 = String(row[agentCol] ?? '').trim();
    const col2 = String(row[tripRefCol] ?? '').trim();

    // Skip subtotal/total/count rows
    if (/^(Subtotal|Total|Grand Total)/i.test(col1) || /^(Subtotal|Total|Grand Total)/i.test(col2)) continue;
    const checkStr = String(row[Math.min(agentCol + 1, row.length - 1)] ?? '').trim();
    if (['Count', 'Avg', 'Sum'].includes(checkStr)) continue;
    // Also skip rows where col1 itself is Count/Avg/Sum (some report formats)
    if (['Count', 'Avg', 'Sum'].includes(col1) || ['Count', 'Avg', 'Sum'].includes(col2)) continue;

    // Fill-down agent name (level 1 grouping)
    if (col1 && col1 !== currentAgent && !/^(count|avg|sum)$/i.test(col1)) {
      currentAgent = col1;
      currentTrip = ''; // Reset trip ref when agent changes
    }
    // Fill-down trip record name (level 2 grouping)
    if (col2 && col2 !== currentTrip && !/^(count|avg|sum)$/i.test(col2)) {
      currentTrip = col2;
    }

    if (!currentAgent) continue;

    // Must have old value or new value to be a real data row
    const oldVal = safeStr(row, oldValueCol);
    const newVal = safeStr(row, newValueCol);
    if (!oldVal && !newVal) continue;

    records.push({
      agentName: currentAgent,
      tripRecordName: currentTrip,
      oldValue: oldVal,
      newValue: newVal,
      editedBy: safeStr(row, editedByCol),
      editDate: safeStr(row, editDateCol),
    });
  }

  return records;
}
