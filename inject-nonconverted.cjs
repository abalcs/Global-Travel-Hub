#!/usr/bin/env node
/**
 * inject-nonconverted.cjs
 * Reads the canonical non_converted.xlsx and writes it to Firestore.
 * Run from gtt-firebase-integration/:  node inject-nonconverted.cjs
 */
const XLSX = require('xlsx');
const path = require('path');

const PROJECT_ID = 'global-travel-hub-9feaf';
const COLLECTION = 'gtt_raw_data';
const BATCH_SIZE = 2000;
const REST_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}`;
// MUST match the camelCase key the app uses in firestoreSync.ts: 'nonConverted'
const DATA_TYPE = 'nonConverted';
const OLD_DATA_TYPE = 'non_converted'; // wrong snake_case docs to clean up

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
      const resp = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text.substring(0, 200)}`);
      }
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(attempt * 2000);
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

async function main() {
  const filePath = path.join(__dirname, 'non_converted.xlsx');
  console.log(`Reading: ${filePath}`);
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  // Add _source tag
  for (const row of rows) {
    row._source = DATA_TYPE;
  }

  console.log(`Parsed ${rows.length} rows`);

  // Count agents
  const agents = {};
  for (const row of rows) {
    const a = (row['lead owner'] || '').trim();
    if (a) agents[a] = (agents[a] || 0) + 1;
  }
  console.log(`Agents: ${Object.keys(agents).length}`, Object.keys(agents).sort().join(', '));

  // Write batches
  const uploadedAt = new Date().toISOString();
  const batchCount = Math.ceil(rows.length / BATCH_SIZE);
  console.log(`\nWriting ${batchCount} batches (${rows.length} rows) to Firestore...`);

  for (let i = 0; i < batchCount; i++) {
    const batchRows = rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const docId = `${DATA_TYPE}_batch_${i}`;
    await writeDocREST(docId, {
      data: batchRows,
      dataType: DATA_TYPE,
      batchIndex: i,
      totalRows: rows.length,
      totalBatches: batchCount,
      uploadedAt,
    });
    process.stdout.write(`\r  Batch ${i + 1}/${batchCount} written`);
    if (i < batchCount - 1) await sleep(300);
  }
  console.log('');

  // Clean up old batches beyond current count
  for (let i = batchCount; i < 20; i++) {
    const docId = `${DATA_TYPE}_batch_${i}`;
    if (await docExistsREST(docId)) {
      await deleteDocREST(docId);
      console.log(`  Deleted stale ${docId}`);
    } else {
      break;
    }
  }

  // Also clean up the wrong snake_case docs from the previous run
  console.log('Cleaning up old snake_case docs...');
  for (let i = 0; i < 20; i++) {
    const oldDocId = `${OLD_DATA_TYPE}_batch_${i}`;
    if (await docExistsREST(oldDocId)) {
      await deleteDocREST(oldDocId);
      console.log(`  Deleted ${oldDocId}`);
    } else {
      break;
    }
  }

  console.log(`\n✅ Done! ${rows.length} nonConverted rows in ${batchCount} batches.`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
