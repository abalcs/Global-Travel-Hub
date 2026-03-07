#!/usr/bin/env node
/**
 * upload-data.cjs
 *
 * CLI tool to upload all GTT report data to Firestore at once.
 * Prompts for file paths for each data type, parses them, and uploads
 * via the Firestore REST API (no Firebase SDK needed).
 *
 * Usage:
 *   node scripts/upload-data.cjs
 *
 * Auto-detects files in ~/Downloads/ and ~/clawd/ by name keywords.
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const PROJECT_ID = 'global-travel-hub-9feaf';
const COLLECTION = 'gtt_raw_data';
const BATCH_SIZE = 2000;
const REST_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}`;

// ─── Data type definitions ───────────────────────────────────────────────────

const DATA_TYPES = [
  { key: 'trips',          label: 'Trips',           required: true,  patterns: ['trips'],        excludePatterns: [] },
  { key: 'quotes',         label: 'Quotes Sent',     required: true,  patterns: ['quotes sent', 'quotes'],  excludePatterns: ['started'] },
  { key: 'passthroughs',   label: 'Passthroughs',    required: true,  patterns: ['passthrough'],  excludePatterns: ['hot'] },
  { key: 'hotPass',        label: 'Hot Passes',      required: true,  patterns: ['hot'],          requirePatterns: ['passthrough'], excludePatterns: [] },
  { key: 'bookings',       label: 'Bookings',        required: true,  patterns: ['booking'],      excludePatterns: [] },
  { key: 'nonConverted',   label: 'Non-Converted',   required: true,  patterns: ['non-con', 'non converted', 'nonconverted'], excludePatterns: [] },
  { key: 'quotesStarted',  label: 'Quotes Started',  required: false, patterns: ['quotes started', 'quotesstarted'], excludePatterns: [] },
];

// ─── Auto-detection ──────────────────────────────────────────────────────────

const SEARCH_DIRS = [
  path.join(os.homedir(), 'Downloads'),
  path.join(os.homedir(), 'clawd'),
];

function findFile(dt) {
  const { patterns, excludePatterns, requirePatterns } = dt;

  for (const dir of SEARCH_DIRS) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.xlsx') || f.endsWith('.csv'))
      .filter(f => {
        const lower = f.toLowerCase();
        // Must match at least one pattern
        if (!patterns.some(p => lower.includes(p))) return false;
        // Must match ALL requirePatterns (if any)
        if (requirePatterns && !requirePatterns.every(p => lower.includes(p))) return false;
        // Must NOT match any excludePatterns
        if (excludePatterns && excludePatterns.length > 0) {
          if (excludePatterns.some(p => lower.includes(p))) return false;
        }
        return true;
      })
      .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 0) return path.join(dir, files[0].name);
  }

  return null;
}

// ─── Interactive prompts ─────────────────────────────────────────────────────

function createRL() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function promptForFiles() {
  const rl = createRL();
  const files = {};

  console.log('\nGTT Data Upload CLI');
  console.log('\u2550'.repeat(19));
  console.log('\nEnter file paths for each data type (drag & drop supported).');
  console.log('Press Enter to accept auto-detected files or skip optional ones.\n');

  for (const dt of DATA_TYPES) {
    const autoFile = findFile(dt);
    const reqLabel = dt.required ? '(required)' : '(optional)';

    let prompt;
    if (autoFile) {
      const shortPath = autoFile.replace(os.homedir(), '~');
      prompt = `  ${dt.label} ${reqLabel}: [auto: ${shortPath}] `;
    } else {
      prompt = `  ${dt.label} ${reqLabel}: `;
    }

    let answer = (await ask(rl, prompt)).trim();

    // Strip surrounding quotes (from drag & drop)
    if ((answer.startsWith('"') && answer.endsWith('"')) ||
        (answer.startsWith("'") && answer.endsWith("'"))) {
      answer = answer.slice(1, -1);
    }

    // Expand ~ to home dir
    if (answer.startsWith('~')) {
      answer = path.join(os.homedir(), answer.slice(1));
    }

    if (!answer && autoFile) {
      answer = autoFile;
      console.log(`    \u2192 Using: ${autoFile.replace(os.homedir(), '~')}`);
    }

    if (!answer) {
      if (dt.required) {
        console.error(`\n  Error: ${dt.label} is required. Please provide a file path.`);
        rl.close();
        process.exit(1);
      }
      continue;
    }

    if (!fs.existsSync(answer)) {
      console.error(`\n  Error: File not found: ${answer}`);
      rl.close();
      process.exit(1);
    }

    files[dt.key] = answer;
  }

  rl.close();
  return files;
}

// ─── Excel parsing (ported from fileProcessor.worker.ts) ─────────────────────

function parseExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawData = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  if (rawData.length === 0) return [];

  // Find header row
  let headerRowIndex = -1;
  let headers = [];

  const headerPatterns = [
    'owner name', 'last gtt action by', 'trip name', 'account name',
    'created date', 'quote first sent', 'passthrough',
  ];

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
        const val = String(cell != null ? cell : `column_${idx}`).toLowerCase().trim();
        return val || `column_${idx}`;
      });
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    headers = (rawData[0] || []).map((cell, idx) =>
      String(cell != null ? cell : `column_${idx}`).toLowerCase().trim() || `column_${idx}`
    );
  }

  // Find owner key
  const ownerKey =
    headers.find(h => h.includes('gtt owner')) ||
    headers.find(h => h.includes('last gtt action by')) ||
    headers.find(h => h.includes('owner name')) ||
    headers.find(h => h.includes('agent')) ||
    undefined;

  const rows = [];
  const headerLen = headers.length;

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row) continue;

    let hasData = false;
    for (let j = 0; j < row.length; j++) {
      if (row[j] !== null && row[j] !== '') {
        hasData = true;
        break;
      }
    }
    if (!hasData) continue;

    const rowObj = {};
    for (let j = 0; j < headerLen; j++) {
      rowObj[headers[j]] = String(row[j] != null ? row[j] : '').trim();
    }

    // Skip summary / totals rows
    const firstValue = (rowObj[headers[0]] || '').toLowerCase();
    if (firstValue === 'total' || firstValue === 'subtotal' ||
        firstValue.includes('grand total')) {
      continue;
    }
    if (ownerKey) {
      const ownerVal = (rowObj[ownerKey] || '').toLowerCase();
      if (ownerVal === 'total' || ownerVal === 'subtotal' ||
          ownerVal.includes('grand total')) {
        continue;
      }
    }

    rows.push(rowObj);
  }

  return rows;
}

function parseNonConvertedFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  const counts = {};
  const rows = [];

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
    const headers = rawData[headerRowIdx].map((cell, idx) =>
      String(cell != null ? cell : `column_${idx}`).toLowerCase().trim()
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

      const rowObj = {};
      for (let j = 0; j < headers.length; j++) {
        rowObj[headers[j]] = String(row[j] != null ? row[j] : '').trim();
      }
      if (!rowObj['lead owner'] && currentAgent) {
        rowObj['lead owner'] = currentAgent;
      }
      rows.push(rowObj);
    }
  }

  return { rows, counts };
}

// ─── Firestore REST helpers (from inject-trips.cjs) ──────────────────────────

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

async function writeDocREST(docId, data, retries = 3) {
  const url = `${REST_BASE}/${docId}`;
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
  }
  const body = JSON.stringify({ fields });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text.substring(0, 200)}`);
      }
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      const backoff = attempt * 2000;
      await sleep(backoff);
    }
  }
}

async function deleteDocREST(docId) {
  const url = `${REST_BASE}/${docId}`;
  try {
    await fetch(url, { method: 'DELETE' });
  } catch { /* ignore delete failures */ }
}

async function getDocREST(docId) {
  const url = `${REST_BASE}/${docId}`;
  const resp = await fetch(url, { method: 'GET' });
  if (!resp.ok) return null;
  return resp.json();
}

// ─── Upload logic (parallel strategy from firestoreSync.ts) ──────────────────

async function uploadAllData(parsedData) {
  const uploadedAt = new Date().toISOString();
  const dataTypes = ['trips', 'quotes', 'passthroughs', 'hotPass', 'bookings', 'nonConverted', 'quotesStarted'];

  // Step 1: Read old batch counts in parallel
  process.stdout.write('\nReading existing data...');
  const oldCounts = {};
  await Promise.all(
    dataTypes.map(async (dt) => {
      const doc = await getDocREST(`${dt}_batch_0`);
      if (doc && doc.fields && doc.fields.totalBatches) {
        oldCounts[dt] = parseInt(doc.fields.totalBatches.integerValue || '1', 10);
      } else {
        oldCounts[dt] = 0;
      }
    })
  );
  console.log(' done');

  // Step 2: Build all operations
  const allOps = [];
  let totalBatches = 0;

  for (const dt of dataTypes) {
    const rows = parsedData[dt] || [];
    if (rows.length === 0) continue;
    totalBatches += Math.ceil(rows.length / BATCH_SIZE);
  }

  let completedBatches = 0;

  function updateProgress() {
    completedBatches++;
    const pct = Math.round((completedBatches / totalBatches) * 100);
    const barLen = 30;
    const filled = Math.round((pct / 100) * barLen);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled);
    process.stdout.write(`\r  ${bar} ${pct}% (${completedBatches}/${totalBatches} batches)`);
  }

  console.log(`\nUploading to Firestore (${totalBatches} batches)...`);

  for (const dt of dataTypes) {
    const rows = parsedData[dt] || [];
    if (rows.length === 0) continue;

    const newBatchCount = Math.ceil(rows.length / BATCH_SIZE);
    const oldCount = oldCounts[dt] || 0;

    // Queue writes
    for (let i = 0; i < newBatchCount; i++) {
      const batchRows = rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      const docId = `${dt}_batch_${i}`;
      allOps.push(
        writeDocREST(docId, {
          data: batchRows,
          dataType: dt,
          batchIndex: i,
          totalRows: rows.length,
          totalBatches: newBatchCount,
          uploadedAt,
        }).then(updateProgress)
      );
    }

    // Queue deletes for excess old batches
    for (let i = newBatchCount; i < oldCount; i++) {
      allOps.push(deleteDocREST(`${dt}_batch_${i}`));
    }

    // Clean up legacy single-doc format
    allOps.push(deleteDocREST(dt));
  }

  // Step 3: Execute all in parallel
  await Promise.all(allOps);
  console.log('');
}

// ─── Auto mode (no prompts) ──────────────────────────────────────────────────

function autoDetectAll() {
  const files = {};
  const missing = [];

  console.log('\nGTT Data Upload CLI');
  console.log('\u2550'.repeat(19));
  console.log('\nAuto-detecting files...\n');

  for (const dt of DATA_TYPES) {
    const found = findFile(dt);
    if (found) {
      files[dt.key] = found;
      console.log(`  \u2713 ${dt.label}: ${path.basename(found)}`);
    } else if (dt.required) {
      missing.push(dt.label);
      console.log(`  \u2717 ${dt.label}: not found`);
    } else {
      console.log(`  - ${dt.label}: skipped (optional)`);
    }
  }

  if (missing.length > 0) {
    console.error(`\nCould not find required files: ${missing.join(', ')}`);
    console.error('Place the .xlsx files in ~/Downloads/ and try again.');
    process.exit(1);
  }

  return files;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const filePaths = autoDetectAll();

  // Parse all files
  const typeCount = Object.keys(filePaths).length;
  console.log(`\nParsing ${typeCount} file${typeCount === 1 ? '' : 's'}...`);

  const parsedData = {};
  let totalRows = 0;

  for (const dt of DATA_TYPES) {
    if (!filePaths[dt.key]) continue;

    try {
      if (dt.key === 'nonConverted') {
        const { rows, counts } = parseNonConvertedFile(filePaths[dt.key]);
        parsedData.nonConverted = rows;
        parsedData.nonConvertedCounts = counts;
        console.log(`  \u2713 ${dt.label}: ${rows.length.toLocaleString()} rows, ${Object.keys(counts).length} agents counted`);
        totalRows += rows.length;
      } else {
        const rows = parseExcelFile(filePaths[dt.key]);
        parsedData[dt.key] = rows;
        console.log(`  \u2713 ${dt.label}: ${rows.length.toLocaleString()} rows`);
        totalRows += rows.length;
      }
    } catch (err) {
      console.error(`  \u2717 ${dt.label}: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\nTotal: ${totalRows.toLocaleString()} rows across ${typeCount} files`);

  // Upload to Firestore
  await uploadAllData(parsedData);

  console.log('\nDone! Reload the app to see the new data.');
}

main().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
