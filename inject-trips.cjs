#!/usr/bin/env node
/**
 * inject-trips.cjs
 *
 * Parses the trimmed GTT Trips Excel export and writes it to Firestore
 * so the deployed app can load it. Run from the gtt-firebase-integration directory:
 *
 *   node inject-trips.cjs "/path/to/GTT Trips - This Month.xlsx"
 *
 * If no path given, looks in ~/clawd/ for the most recent trips export.
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT_ID = 'global-travel-hub-9feaf';
const COLLECTION = 'gtt_raw_data';
const BATCH_SIZE = 2000;
const REST_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}`;

function findTripsFile() {
  const clawdDir = path.join(os.homedir(), 'clawd');
  if (!fs.existsSync(clawdDir)) return null;
  const files = fs.readdirSync(clawdDir)
    .filter(f => f.toLowerCase().includes('trips') && f.endsWith('.xlsx'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(clawdDir, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? path.join(clawdDir, files[0].name) : null;
}

function parseTripsExcel(filePath) {
  console.log(`Reading: ${filePath}`);
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find the header row. Must have MULTIPLE non-empty cells that look like
  // column headers (e.g. "GTT owner ↑", "Trip: Trip Name", etc.).
  // This avoids the Salesforce filter description row which has a single long
  // cell like "GTT owner equals rachael wood,peadar angelone,..."
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(30, raw.length); i++) {
    const row = raw[i];
    const nonEmptyCells = row.filter(v => String(v).trim().length > 0);
    // A real header row has 3+ non-empty cells that are short (<60 chars)
    const shortNonEmpty = nonEmptyCells.filter(v => String(v).trim().length < 60);
    if (shortNonEmpty.length >= 3) {
      const lower = row.map(v => String(v).toLowerCase());
      if (lower.some(v => v.includes('gtt owner') || v.includes('trip name') || v.includes('created date'))) {
        headerRowIdx = i;
        break;
      }
    }
  }

  if (headerRowIdx === -1) {
    throw new Error('Could not find header row in trips file. Expected a row with columns like "GTT owner", "Trip: Trip Name", "Trip: Created Date".');
  }

  const headers = raw[headerRowIdx].map(h => String(h).trim().toLowerCase());
  console.log(`Header row: ${headerRowIdx}, columns: ${headers.filter(Boolean).join(', ')}`);

  // Parse data rows
  const dataRows = [];
  for (let i = headerRowIdx + 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.every(v => !String(v).trim())) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      if (headers[c]) obj[headers[c]] = String(r[c] || '');
    }
    obj._source = 'trips';
    dataRows.push(obj);
  }

  // Count agents
  const gttCol = headers.find(h => h.includes('gtt owner'));
  const agents = {};
  for (const row of dataRows) {
    const v = (row[gttCol] || '').trim();
    if (v && v.length < 40 && !/unique|count|total|reached/i.test(v)) {
      agents[v] = (agents[v] || 0) + 1;
    }
  }

  console.log(`Parsed ${dataRows.length} data rows, ${Object.keys(agents).length} agents`);
  console.log('Agents:', Object.keys(agents).sort().join(', '));

  return dataRows;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Convert a JS value to Firestore REST API Value format.
 */
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
      console.log(`\n  Retry ${attempt}/${retries} for ${docId} after ${backoff}ms: ${err.message.substring(0, 80)}`);
      await sleep(backoff);
    }
  }
}

async function deleteDocREST(docId) {
  const url = `${REST_BASE}/${docId}`;
  const resp = await fetch(url, { method: 'DELETE' });
  return resp.ok;
}

async function docExistsREST(docId) {
  const url = `${REST_BASE}/${docId}`;
  const resp = await fetch(url, { method: 'GET' });
  return resp.ok;
}

async function writeToFirestore(rows) {
  const uploadedAt = new Date().toISOString();
  const batchCount = Math.ceil(rows.length / BATCH_SIZE);
  console.log(`\nWriting ${batchCount} batches (${rows.length} rows) to Firestore via REST API...`);

  for (let i = 0; i < batchCount; i++) {
    const batchRows = rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const docId = `trips_batch_${i}`;
    await writeDocREST(docId, {
      data: batchRows,
      dataType: 'trips',
      batchIndex: i,
      totalRows: rows.length,
      totalBatches: batchCount,
      uploadedAt,
    });
    process.stdout.write(`\r  Batch ${i + 1}/${batchCount} written`);
    // Small delay to be nice to Firestore
    if (i < batchCount - 1) await sleep(300);
  }
  console.log('');

  // Clean up old batches beyond current count
  for (let i = batchCount; i < 50; i++) {
    const docId = `trips_batch_${i}`;
    const exists = await docExistsREST(docId);
    if (exists) {
      await deleteDocREST(docId);
      console.log(`  Deleted old ${docId}`);
    } else {
      break;
    }
  }

  console.log('\nDone! Open the app in incognito or hard-refresh to load the new data.');
  process.exit(0);
}

async function main() {
  let filePath = process.argv[2];

  if (!filePath) {
    filePath = findTripsFile();
    if (!filePath) {
      console.error('Usage: node inject-trips.cjs "/path/to/GTT Trips - This Month.xlsx"');
      console.error('  Or place the file in ~/clawd/ and run without arguments.');
      process.exit(1);
    }
    console.log(`Auto-detected trips file: ${filePath}`);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const rows = parseTripsExcel(filePath);
  await writeToFirestore(rows);
}

main().catch(err => { console.error('Failed:', err.message); process.exit(1); });
