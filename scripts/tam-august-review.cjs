#!/usr/bin/env node
/**
 * tam-august-review.cjs — TAM Team August 2026 Monthly Review (PPTX)
 *
 * Downloads CRM data from Firestore, computes July vs August analytics,
 * and generates a polished PPTX slide deck.
 *
 * Usage:
 *   node scripts/tam-august-review.cjs
 *
 * Output:
 *   reports/TAM_August_2026_Review.pptx
 */

const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

// ─── Firestore config ────────────────────────────────────────────────────────

const PROJECT_ID = 'global-travel-hub-9feaf';
const CRM_COLLECTION = 'gtt_crm_data';
const CONFIG_COLLECTION = 'gtt_app_config';
const REST_BASE_CRM = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${CRM_COLLECTION}`;
const REST_BASE_CONFIG = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${CONFIG_COLLECTION}`;

// ─── Firestore REST helpers ──────────────────────────────────────────────────

async function getDocREST(base, docId) {
  const url = `${base}/${docId}`;
  const resp = await fetch(url, { method: 'GET' });
  if (!resp.ok) return null;
  return resp.json();
}

function fromFirestoreValue(val) {
  if (val === undefined || val === null) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in val) {
    const result = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) result[k] = fromFirestoreValue(v);
    return result;
  }
  return null;
}

function parseDoc(doc) {
  if (!doc || !doc.fields) return null;
  const result = {};
  for (const [k, v] of Object.entries(doc.fields)) result[k] = fromFirestoreValue(v);
  return result;
}

// ─── Download CRM data ──────────────────────────────────────────────────────

async function downloadCrmData() {
  console.log('Downloading CRM data from Firestore...');
  const dataTypes = ['enquiries', 'passthroughs', 'quotes', 'bookings'];
  const allData = {};

  for (const dt of dataTypes) {
    allData[dt] = [];
    const firstDoc = await getDocREST(REST_BASE_CRM, `${dt}_batch_0`);
    const parsed = parseDoc(firstDoc);
    if (!parsed || !parsed.data) { console.log(`  ${dt}: 0 rows (no data)`); continue; }
    allData[dt] = allData[dt].concat(parsed.data);
    const totalBatches = parsed.totalBatches || 1;
    for (let i = 1; i < totalBatches; i++) {
      const batchDoc = await getDocREST(REST_BASE_CRM, `${dt}_batch_${i}`);
      const batchParsed = parseDoc(batchDoc);
      if (batchParsed && batchParsed.data) allData[dt] = allData[dt].concat(batchParsed.data);
    }
    console.log(`  ${dt}: ${allData[dt].length.toLocaleString()} rows`);
  }
  return allData;
}

async function downloadTamNames() {
  console.log('Downloading TAM config...');
  const doc = await getDocREST(REST_BASE_CONFIG, 'settings');
  const parsed = parseDoc(doc);
  if (parsed && parsed.tams && Array.isArray(parsed.tams)) {
    console.log(`  TAMs: ${parsed.tams.join(', ')}`);
    return parsed.tams;
  }
  console.warn('  No TAM names found in config');
  return [];
}

// ─── Date helpers ────────────────────────────────────────────────────────────

const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30));

function formatDateString(value) {
  if (!value) return '';
  const str = String(value).trim();
  if (!str) return '';

  // ISO
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // US format: M/D/YYYY (possibly with time after comma)
  const us = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${String(us[1]).padStart(2, '0')}-${String(us[2]).padStart(2, '0')}`;
  // Excel serial number (only if purely numeric)
  if (/^\d+(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num > 1 && num < 200000) {
      const d = new Date(EXCEL_EPOCH.getTime() + num * 86400000);
      if (!isNaN(d.getTime())) {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      }
    }
  }
  return '';
}

// ─── Data filtering ─────────────────────────────────────────────────────────

const DATE_FIELD_MAP = {
  enquiries: 'enquiryDate',
  passthroughs: 'passthroughDate',
  quotes: 'quoteCreatedDate',
  bookings: 'bookingCreatedDate',
};

function filterByDate(data, start, end) {
  const result = {};
  for (const [key, rows] of Object.entries(data)) {
    const dateField = DATE_FIELD_MAP[key];
    if (!dateField) { result[key] = rows; continue; }
    result[key] = rows.filter(row => {
      const d = formatDateString(row[dateField]);
      if (!d) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }
  return result;
}

function filterB2B(rows, tams) {
  return rows.filter(r => {
    const ch = (r.channel || '').toLowerCase();
    return ch.endsWith('b2b') && tams.includes(r.agentName);
  });
}

// ─── Analytics ──────────────────────────────────────────────────────────────

function computeScorecard(data, tams) {
  const e = filterB2B(data.enquiries, tams);
  const p = filterB2B(data.passthroughs, tams);
  const q = filterB2B(data.quotes, tams);
  const b = filterB2B(data.bookings, tams);
  const enq = e.length, pt = p.length, qt = q.length, bk = b.length;
  return {
    enquiries: enq, passthroughs: pt, quotes: qt, bookings: bk,
    epRate: enq ? (pt / enq) * 100 : 0,
    pqRate: pt ? (qt / pt) * 100 : 0,
    eqRate: enq ? (qt / enq) * 100 : 0,
    ebRate: enq ? (bk / enq) * 100 : 0,
  };
}

function computeRevenue(data, tams) {
  const bookings = filterB2B(data.bookings, tams);
  let total = 0, count = 0;
  for (const b of bookings) {
    const amt = parseFloat(b.totalAmountBCY) || 0;
    if (amt > 0) { total += amt; count++; }
  }
  return { totalRevenue: total, avgDealValue: count ? total / count : 0, totalDeals: count };
}

function computeLeaderboard(data, tams) {
  const agents = {};
  for (const name of tams) {
    agents[name] = { agentName: name, enquiries: 0, passthroughs: 0, quotes: 0, bookings: 0, revenue: 0 };
  }
  for (const r of filterB2B(data.enquiries, tams)) agents[r.agentName] && agents[r.agentName].enquiries++;
  for (const r of filterB2B(data.passthroughs, tams)) agents[r.agentName] && agents[r.agentName].passthroughs++;
  for (const r of filterB2B(data.quotes, tams)) agents[r.agentName] && agents[r.agentName].quotes++;
  for (const r of filterB2B(data.bookings, tams)) {
    if (!agents[r.agentName]) continue;
    agents[r.agentName].bookings++;
    agents[r.agentName].revenue += parseFloat(r.totalAmountBCY) || 0;
  }
  return Object.values(agents)
    .map(a => ({ ...a, ebRate: a.enquiries ? (a.bookings / a.enquiries) * 100 : 0 }))
    .sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue);
}

function computePartnerStats(data, tams) {
  const partners = {};
  for (const r of filterB2B(data.enquiries, tams)) {
    const name = r.travelAgentName || 'Unknown';
    if (!partners[name]) partners[name] = { partnerName: name, tam: r.agentName, enquiries: 0, passthroughs: 0, quotes: 0, bookings: 0, revenue: 0, destinations: new Set() };
    partners[name].enquiries++;
    if (r.destination) partners[name].destinations.add(r.destination);
  }
  for (const r of filterB2B(data.passthroughs, tams)) { const n = r.travelAgentName || 'Unknown'; if (partners[n]) partners[n].passthroughs++; }
  for (const r of filterB2B(data.quotes, tams)) { const n = r.travelAgentName || 'Unknown'; if (partners[n]) partners[n].quotes++; }
  for (const r of filterB2B(data.bookings, tams)) {
    const n = r.travelAgentName || 'Unknown';
    if (partners[n]) { partners[n].bookings++; partners[n].revenue += parseFloat(r.totalAmountBCY) || 0; }
  }
  const list = Object.values(partners).map(p => ({
    ...p,
    destinations: Array.from(p.destinations).slice(0, 3),
    status: p.bookings > 0 ? 'Booked' : p.quotes > 0 ? 'Quoting' : p.passthroughs > 0 ? 'Progressing' : 'Stalled',
  }));
  return {
    total: list.length,
    active: list.filter(p => p.passthroughs > 0).length,
    booked: list.filter(p => p.bookings > 0).length,
    stalled: list.filter(p => p.status === 'Stalled').length,
    quoting: list.filter(p => p.status === 'Quoting').length,
    partners: list.sort((a, b) => b.enquiries - a.enquiries),
    stalledList: list.filter(p => p.status === 'Stalled').sort((a, b) => b.enquiries - a.enquiries),
  };
}

function computeDestinations(data, tams) {
  const dests = {};
  for (const r of filterB2B(data.enquiries, tams)) {
    const d = r.destination || 'Unknown';
    if (!dests[d]) dests[d] = { destination: d, enquiries: 0, passthroughs: 0, quotes: 0, bookings: 0, revenue: 0 };
    dests[d].enquiries++;
  }
  for (const r of filterB2B(data.passthroughs, tams)) { const d = r.destination || 'Unknown'; if (dests[d]) dests[d].passthroughs++; }
  for (const r of filterB2B(data.quotes, tams)) { const d = r.destination || 'Unknown'; if (dests[d]) dests[d].quotes++; }
  for (const r of filterB2B(data.bookings, tams)) {
    const d = r.destination || 'Unknown';
    if (dests[d]) { dests[d].bookings++; dests[d].revenue += parseFloat(r.totalAmountBCY) || 0; }
  }
  return Object.values(dests)
    .map(d => ({ ...d, ebRate: d.enquiries ? (d.bookings / d.enquiries) * 100 : 0 }))
    .sort((a, b) => b.enquiries - a.enquiries);
}

function computeVelocity(data, tams) {
  const bookings = filterB2B(data.bookings, tams);
  const times = bookings.map(b => parseFloat(b.timeTaken)).filter(t => !isNaN(t) && t > 0);
  const avg = times.length ? times.reduce((s, v) => s + v, 0) / times.length : 0;
  // By agent
  const byAgent = {};
  for (const b of bookings) {
    const t = parseFloat(b.timeTaken);
    if (isNaN(t) || t <= 0) continue;
    if (!byAgent[b.agentName]) byAgent[b.agentName] = { agentName: b.agentName, times: [] };
    byAgent[b.agentName].times.push(t);
  }
  const agentVelocity = Object.values(byAgent)
    .map(a => ({ agentName: a.agentName, avgCycleTime: a.times.reduce((s, v) => s + v, 0) / a.times.length, dealCount: a.times.length }))
    .sort((a, b) => a.avgCycleTime - b.avgCycleTime);
  return { avgCycleTime: avg, totalDeals: times.length, byAgent: agentVelocity };
}

// ─── Currency ───────────────────────────────────────────────────────────────

const FALLBACK_RATE = 1.27;

async function getGbpToUsd() {
  try {
    const resp = await fetch('https://api.frankfurter.app/latest?from=GBP&to=USD');
    const data = await resp.json();
    if (data.rates?.USD) { console.log(`  GBP→USD: ${data.rates.USD} (live)`); return data.rates.USD; }
  } catch {}
  console.log(`  GBP→USD: ${FALLBACK_RATE} (fallback)`);
  return FALLBACK_RATE;
}

function fmtUsd(gbp, rate) {
  const usd = gbp * rate;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}k`;
  return `$${Math.round(usd)}`;
}

// ─── Delta formatting ───────────────────────────────────────────────────────

function delta(curr, prev) {
  if (prev === 0 && curr === 0) return '—';
  const pct = prev === 0 ? 100 : ((curr - prev) / prev) * 100;
  const arrow = pct > 0.5 ? '\u2191' : pct < -0.5 ? '\u2193' : '~';
  return `${arrow} ${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;
}

function deltaRate(curr, prev) {
  const diff = curr - prev;
  if (Math.abs(diff) < 0.1) return '~';
  const arrow = diff > 0 ? '\u2191' : '\u2193';
  return `${arrow} ${diff > 0 ? '+' : ''}${diff.toFixed(1)}pp`;
}

// ─── PPTX colors ────────────────────────────────────────────────────────────

const C = {
  teal: '4D726D',
  tealDark: '3D5C58',
  tealLight: '5D8A84',
  blue: '007BC7',
  bg: 'F5F2ED',
  cardBg: 'FFFFFF',
  text: '0A1628',
  textLight: '7A7A7A',
  border: 'EDE8E0',
  green: '059669',
  greenLight: 'ECFDF5',
  red: 'DC2626',
  redLight: 'FEF2F2',
  amber: 'D97706',
  amberLight: 'FFFBEB',
  blueLight: 'EFF6FF',
  blueMid: '2563EB',
};

// ─── PPTX Generation ────────────────────────────────────────────────────────

async function generate() {
  const [rawData, tams, gbpRate] = await Promise.all([
    downloadCrmData(),
    downloadTamNames(),
    getGbpToUsd(),
  ]);

  if (tams.length === 0) { console.error('No TAM names configured. Exiting.'); process.exit(1); }

  const julData = filterByDate(rawData, '2026-07-01', '2026-07-31');
  const augData = filterByDate(rawData, '2026-08-01', '2026-08-31');

  const julScore = computeScorecard(julData, tams);
  const augScore = computeScorecard(augData, tams);
  const julRev = computeRevenue(julData, tams);
  const augRev = computeRevenue(augData, tams);
  const augLb = computeLeaderboard(augData, tams);
  const julPartners = computePartnerStats(julData, tams);
  const augPartners = computePartnerStats(augData, tams);
  const augDests = computeDestinations(augData, tams);
  const augVelocity = computeVelocity(augData, tams);

  console.log('\nGenerating PPTX...');

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Global Travel Hub';
  pptx.subject = 'TAM Team August 2026 Monthly Review';

  const masterOpts = { background: { color: C.bg } };

  // ────────── SLIDE 1: Title ──────────────────────────────────────────────

  const s1 = pptx.addSlide(masterOpts);
  // Teal accent bar at top
  s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: C.teal } });
  s1.addText('TAM TEAM', {
    x: 0.8, y: 1.8, w: 8.4, h: 0.5,
    fontSize: 14, fontFace: 'Arial', color: C.teal, bold: true, letterSpacing: 8,
  });
  s1.addText('August 2026', {
    x: 0.8, y: 2.3, w: 8.4, h: 1.2,
    fontSize: 44, fontFace: 'Arial', color: C.text, bold: true,
  });
  s1.addText('Monthly Performance Review', {
    x: 0.8, y: 3.4, w: 8.4, h: 0.5,
    fontSize: 18, fontFace: 'Arial', color: C.textLight,
  });
  s1.addText(`${tams.length} TAMs  |  vs July 2026`, {
    x: 0.8, y: 4.2, w: 8.4, h: 0.4,
    fontSize: 12, fontFace: 'Arial', color: C.teal,
  });
  // Decorative teal block
  s1.addShape(pptx.ShapeType.rect, { x: 8.5, y: 1.5, w: 1.2, h: 3.5, fill: { color: C.teal }, rectRadius: 0.1 });

  // ────────── SLIDE 2: August Scorecard ─────────────────────────────────

  const s2 = pptx.addSlide(masterOpts);
  s2.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: C.teal } });
  s2.addText('August Scorecard', { x: 0.5, y: 0.25, w: 9, h: 0.5, fontSize: 22, fontFace: 'Arial', color: C.text, bold: true });
  s2.addText('Key volume metrics vs July', { x: 0.5, y: 0.7, w: 9, h: 0.3, fontSize: 11, fontFace: 'Arial', color: C.textLight });

  // Volume metric cards
  const volMetrics = [
    { label: 'Enquiries', aug: augScore.enquiries, jul: julScore.enquiries },
    { label: 'Passthroughs', aug: augScore.passthroughs, jul: julScore.passthroughs },
    { label: 'Quotes', aug: augScore.quotes, jul: julScore.quotes },
    { label: 'Bookings', aug: augScore.bookings, jul: julScore.bookings },
  ];
  volMetrics.forEach((m, i) => {
    const x = 0.5 + i * 2.3;
    s2.addShape(pptx.ShapeType.rect, { x, y: 1.2, w: 2.1, h: 1.5, fill: { color: C.cardBg }, shadow: { type: 'outer', blur: 4, offset: 2, color: '00000015' }, rectRadius: 0.1 });
    s2.addText(String(m.aug), { x, y: 1.35, w: 2.1, h: 0.6, fontSize: 28, fontFace: 'Arial', color: C.text, bold: true, align: 'center' });
    s2.addText(m.label, { x, y: 1.9, w: 2.1, h: 0.3, fontSize: 10, fontFace: 'Arial', color: C.textLight, align: 'center' });
    s2.addText(`Jul: ${m.jul}  ${delta(m.aug, m.jul)}`, { x, y: 2.2, w: 2.1, h: 0.3, fontSize: 9, fontFace: 'Arial', color: m.aug >= m.jul ? C.green : C.red, align: 'center' });
  });

  // Conversion rate cards
  const rateMetrics = [
    { label: 'E\u2192P Rate', aug: augScore.epRate, jul: julScore.epRate },
    { label: 'P\u2192Q Rate', aug: augScore.pqRate, jul: julScore.pqRate },
    { label: 'E\u2192B Rate', aug: augScore.ebRate, jul: julScore.ebRate },
  ];
  rateMetrics.forEach((m, i) => {
    const x = 0.5 + i * 3.1;
    s2.addShape(pptx.ShapeType.rect, { x, y: 3.0, w: 2.9, h: 1.2, fill: { color: C.cardBg }, shadow: { type: 'outer', blur: 4, offset: 2, color: '00000015' }, rectRadius: 0.1 });
    s2.addText(`${m.aug.toFixed(1)}%`, { x, y: 3.1, w: 2.9, h: 0.5, fontSize: 24, fontFace: 'Arial', color: C.text, bold: true, align: 'center' });
    s2.addText(m.label, { x, y: 3.55, w: 2.9, h: 0.25, fontSize: 10, fontFace: 'Arial', color: C.textLight, align: 'center' });
    s2.addText(`Jul: ${m.jul.toFixed(1)}%  ${deltaRate(m.aug, m.jul)}`, { x, y: 3.8, w: 2.9, h: 0.25, fontSize: 9, fontFace: 'Arial', color: m.aug >= m.jul ? C.green : C.red, align: 'center' });
  });

  // Revenue bar
  s2.addShape(pptx.ShapeType.rect, { x: 0.5, y: 4.5, w: 9, h: 0.8, fill: { color: C.cardBg }, shadow: { type: 'outer', blur: 4, offset: 2, color: '00000015' }, rectRadius: 0.1 });
  s2.addText([
    { text: 'Total Revenue  ', options: { fontSize: 10, color: C.textLight } },
    { text: fmtUsd(augRev.totalRevenue, gbpRate), options: { fontSize: 20, color: C.text, bold: true } },
    { text: `   Jul: ${fmtUsd(julRev.totalRevenue, gbpRate)}  ${delta(augRev.totalRevenue, julRev.totalRevenue)}`, options: { fontSize: 10, color: augRev.totalRevenue >= julRev.totalRevenue ? C.green : C.red } },
  ], { x: 0.8, y: 4.55, w: 8.5, h: 0.7, valign: 'middle' });

  // ────────── SLIDE 3: Conversion Funnel ────────────────────────────────

  const s3 = pptx.addSlide(masterOpts);
  s3.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: C.teal } });
  s3.addText('Conversion Funnel', { x: 0.5, y: 0.25, w: 9, h: 0.5, fontSize: 22, fontFace: 'Arial', color: C.text, bold: true });
  s3.addText('Stage-by-stage pipeline analysis', { x: 0.5, y: 0.7, w: 9, h: 0.3, fontSize: 11, fontFace: 'Arial', color: C.textLight });

  const funnelStages = [
    { label: 'Enquiries', aug: augScore.enquiries, jul: julScore.enquiries, color: C.teal },
    { label: 'Passthroughs', aug: augScore.passthroughs, jul: julScore.passthroughs, color: C.tealLight },
    { label: 'Quotes', aug: augScore.quotes, jul: julScore.quotes, color: C.blue },
    { label: 'Bookings', aug: augScore.bookings, jul: julScore.bookings, color: C.green },
  ];
  const maxFunnel = Math.max(...funnelStages.map(s => s.aug), 1);
  funnelStages.forEach((stage, i) => {
    const y = 1.2 + i * 1.0;
    const barW = Math.max((stage.aug / maxFunnel) * 7.5, 0.3);
    // Label
    s3.addText(stage.label, { x: 0.5, y, w: 2, h: 0.35, fontSize: 12, fontFace: 'Arial', color: C.text, bold: true });
    // Value + delta
    s3.addText(`${stage.aug}  ${delta(stage.aug, stage.jul)}`, { x: 7, y, w: 2.8, h: 0.35, fontSize: 12, fontFace: 'Arial', color: stage.aug >= stage.jul ? C.green : C.red, align: 'right' });
    // Bar bg
    s3.addShape(pptx.ShapeType.rect, { x: 0.5, y: y + 0.38, w: 8.8, h: 0.35, fill: { color: C.border }, rectRadius: 0.08 });
    // Bar fill
    s3.addShape(pptx.ShapeType.rect, { x: 0.5, y: y + 0.38, w: barW, h: 0.35, fill: { color: stage.color }, rectRadius: 0.08 });
    // Conversion from previous
    if (i > 0) {
      const conv = funnelStages[i - 1].aug > 0 ? (stage.aug / funnelStages[i - 1].aug * 100).toFixed(0) : 0;
      s3.addText(`${conv}%`, { x: 0.5 + barW + 0.15, y: y + 0.38, w: 0.8, h: 0.35, fontSize: 9, fontFace: 'Arial', color: C.textLight });
    }
  });

  // Deal value card
  s3.addShape(pptx.ShapeType.rect, { x: 0.5, y: 4.5, w: 4.2, h: 0.8, fill: { color: C.cardBg }, shadow: { type: 'outer', blur: 4, offset: 2, color: '00000015' }, rectRadius: 0.1 });
  s3.addText([
    { text: 'Avg Deal Value  ', options: { fontSize: 10, color: C.textLight } },
    { text: fmtUsd(augRev.avgDealValue, gbpRate), options: { fontSize: 18, color: C.text, bold: true } },
    { text: `  Jul: ${fmtUsd(julRev.avgDealValue, gbpRate)}`, options: { fontSize: 9, color: C.textLight } },
  ], { x: 0.7, y: 4.55, w: 3.8, h: 0.7, valign: 'middle' });

  // Total deals card
  s3.addShape(pptx.ShapeType.rect, { x: 5.1, y: 4.5, w: 4.2, h: 0.8, fill: { color: C.cardBg }, shadow: { type: 'outer', blur: 4, offset: 2, color: '00000015' }, rectRadius: 0.1 });
  s3.addText([
    { text: 'Total Deals  ', options: { fontSize: 10, color: C.textLight } },
    { text: String(augRev.totalDeals), options: { fontSize: 18, color: C.text, bold: true } },
    { text: `  Jul: ${julRev.totalDeals}`, options: { fontSize: 9, color: C.textLight } },
  ], { x: 5.3, y: 4.55, w: 3.8, h: 0.7, valign: 'middle' });

  // ────────── SLIDE 4: Notable Wins ─────────────────────────────────────

  const s4 = pptx.addSlide(masterOpts);
  s4.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: C.teal } });
  s4.addText('Notable Wins & Highlights', { x: 0.5, y: 0.25, w: 9, h: 0.5, fontSize: 22, fontFace: 'Arial', color: C.text, bold: true });
  s4.addText('August achievements and month-over-month improvements', { x: 0.5, y: 0.7, w: 9, h: 0.3, fontSize: 11, fontFace: 'Arial', color: C.textLight });

  const wins = [];
  const challenges = [];

  if (augScore.bookings > julScore.bookings) wins.push({ title: 'Booking Growth', detail: `${augScore.bookings} bookings vs ${julScore.bookings} in July (${delta(augScore.bookings, julScore.bookings)})` });
  if (augScore.ebRate > julScore.ebRate) wins.push({ title: 'Improved E\u2192B Conversion', detail: `Rate improved from ${julScore.ebRate.toFixed(1)}% to ${augScore.ebRate.toFixed(1)}%` });
  if (augScore.pqRate > julScore.pqRate) wins.push({ title: 'Better Quote Conversion', detail: `P\u2192Q rate improved from ${julScore.pqRate.toFixed(1)}% to ${augScore.pqRate.toFixed(1)}%` });
  if (augRev.totalRevenue > julRev.totalRevenue) wins.push({ title: 'Revenue Growth', detail: `Revenue grew from ${fmtUsd(julRev.totalRevenue, gbpRate)} to ${fmtUsd(augRev.totalRevenue, gbpRate)}` });
  if (augPartners.booked > julPartners.booked) wins.push({ title: 'More Partners Booking', detail: `${augPartners.booked} partners with bookings (up from ${julPartners.booked} in July)` });
  if (augRev.avgDealValue > julRev.avgDealValue) wins.push({ title: 'Higher Deal Values', detail: `Avg deal value rose from ${fmtUsd(julRev.avgDealValue, gbpRate)} to ${fmtUsd(augRev.avgDealValue, gbpRate)}` });

  // Individual highlights
  const topBooker = augLb[0];
  if (topBooker && topBooker.bookings > 0) wins.push({ title: `${topBooker.agentName} Led the Team`, detail: `${topBooker.bookings} bookings and ${fmtUsd(topBooker.revenue, gbpRate)} in revenue` });
  const fastest = augVelocity.byAgent.filter(a => a.dealCount >= 2)[0];
  if (fastest) wins.push({ title: `Fastest Closer: ${fastest.agentName}`, detail: `${fastest.avgCycleTime.toFixed(1)} day avg cycle time across ${fastest.dealCount} deals` });

  if (augScore.bookings < julScore.bookings) challenges.push({ title: 'Booking Volume Down', detail: `${augScore.bookings} vs ${julScore.bookings} in July` });
  if (augScore.ebRate < julScore.ebRate) challenges.push({ title: 'E\u2192B Rate Declined', detail: `Dropped from ${julScore.ebRate.toFixed(1)}% to ${augScore.ebRate.toFixed(1)}%` });
  if (augPartners.stalled > julPartners.stalled) challenges.push({ title: 'More Stalled Partners', detail: `${augPartners.stalled} stalled (up from ${julPartners.stalled} in July)` });

  let winY = 1.15;
  if (wins.length > 0) {
    wins.slice(0, 6).forEach((w, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.5 + col * 4.7;
      const y = winY + row * 0.85;
      s4.addShape(pptx.ShapeType.rect, { x, y, w: 4.5, h: 0.75, fill: { color: C.greenLight }, rectRadius: 0.08 });
      s4.addText(w.title, { x: x + 0.15, y: y + 0.05, w: 4.2, h: 0.3, fontSize: 11, fontFace: 'Arial', color: C.green, bold: true });
      s4.addText(w.detail, { x: x + 0.15, y: y + 0.35, w: 4.2, h: 0.3, fontSize: 9, fontFace: 'Arial', color: C.textLight });
    });
    winY += Math.ceil(Math.min(wins.length, 6) / 2) * 0.85 + 0.2;
  }

  if (challenges.length > 0) {
    s4.addText('AREAS TO WATCH', { x: 0.5, y: winY, w: 9, h: 0.3, fontSize: 10, fontFace: 'Arial', color: C.red, bold: true, letterSpacing: 2 });
    winY += 0.35;
    challenges.slice(0, 4).forEach((c, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.5 + col * 4.7;
      const y = winY + row * 0.75;
      s4.addShape(pptx.ShapeType.rect, { x, y, w: 4.5, h: 0.65, fill: { color: C.redLight }, rectRadius: 0.08 });
      s4.addText(c.title, { x: x + 0.15, y: y + 0.05, w: 4.2, h: 0.25, fontSize: 11, fontFace: 'Arial', color: C.red, bold: true });
      s4.addText(c.detail, { x: x + 0.15, y: y + 0.3, w: 4.2, h: 0.25, fontSize: 9, fontFace: 'Arial', color: C.textLight });
    });
  }

  // ────────── SLIDE 5: Individual Accomplishments ───────────────────────

  const s5 = pptx.addSlide(masterOpts);
  s5.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: C.teal } });
  s5.addText('Individual Accomplishments', { x: 0.5, y: 0.25, w: 9, h: 0.5, fontSize: 22, fontFace: 'Arial', color: C.text, bold: true });
  s5.addText('TAM leaderboard for August', { x: 0.5, y: 0.7, w: 9, h: 0.3, fontSize: 11, fontFace: 'Arial', color: C.textLight });

  // Highlight cards
  const topRev = [...augLb].sort((a, b) => b.revenue - a.revenue)[0];
  const topConv = [...augLb].filter(a => a.enquiries >= 3).sort((a, b) => b.ebRate - a.ebRate)[0];
  const highlights = [];
  if (topBooker && topBooker.bookings > 0) highlights.push({ emoji: '\ud83c\udfc6', label: 'Most Bookings', name: topBooker.agentName, val: `${topBooker.bookings} bookings`, bg: C.greenLight, fg: C.green });
  if (topRev && topRev.revenue > 0) highlights.push({ emoji: '\ud83d\udcb0', label: 'Top Revenue', name: topRev.agentName, val: fmtUsd(topRev.revenue, gbpRate), bg: C.amberLight, fg: C.amber });
  if (topConv && topConv.ebRate > 0) highlights.push({ emoji: '\ud83c\udfaf', label: 'Best E\u2192B', name: topConv.agentName, val: `${topConv.ebRate.toFixed(1)}%`, bg: C.blueLight, fg: C.blueMid });
  highlights.forEach((h, i) => {
    const x = 0.5 + i * 3.2;
    s5.addShape(pptx.ShapeType.rect, { x, y: 1.15, w: 3.0, h: 1.0, fill: { color: h.bg }, rectRadius: 0.1 });
    s5.addText(h.label, { x: x + 0.15, y: 1.2, w: 2.7, h: 0.25, fontSize: 9, fontFace: 'Arial', color: h.fg });
    s5.addText(h.name, { x: x + 0.15, y: 1.45, w: 2.7, h: 0.35, fontSize: 14, fontFace: 'Arial', color: C.text, bold: true });
    s5.addText(h.val, { x: x + 0.15, y: 1.78, w: 2.7, h: 0.3, fontSize: 11, fontFace: 'Arial', color: h.fg });
  });

  // Leaderboard table
  const tblRows = [
    [
      { text: 'TAM', options: { bold: true, fontSize: 9, color: C.textLight, fill: { color: 'F0EDE7' } } },
      { text: 'Enq', options: { bold: true, fontSize: 9, color: C.textLight, fill: { color: 'F0EDE7' }, align: 'right' } },
      { text: 'PT', options: { bold: true, fontSize: 9, color: C.textLight, fill: { color: 'F0EDE7' }, align: 'right' } },
      { text: 'Qt', options: { bold: true, fontSize: 9, color: C.textLight, fill: { color: 'F0EDE7' }, align: 'right' } },
      { text: 'Bk', options: { bold: true, fontSize: 9, color: C.textLight, fill: { color: 'F0EDE7' }, align: 'right' } },
      { text: 'Revenue', options: { bold: true, fontSize: 9, color: C.textLight, fill: { color: 'F0EDE7' }, align: 'right' } },
      { text: 'E\u2192B', options: { bold: true, fontSize: 9, color: C.textLight, fill: { color: 'F0EDE7' }, align: 'right' } },
    ],
    ...augLb.map((a, i) => [
      { text: `${i < 3 ? ['🥇','🥈','🥉'][i] + ' ' : ''}${a.agentName}`, options: { fontSize: 10, color: C.text, bold: i < 3 } },
      { text: String(a.enquiries), options: { fontSize: 10, color: C.text, align: 'right' } },
      { text: String(a.passthroughs), options: { fontSize: 10, color: C.text, align: 'right' } },
      { text: String(a.quotes), options: { fontSize: 10, color: C.text, align: 'right' } },
      { text: String(a.bookings), options: { fontSize: 10, color: C.text, bold: true, align: 'right' } },
      { text: fmtUsd(a.revenue, gbpRate), options: { fontSize: 10, color: C.text, align: 'right' } },
      { text: `${a.ebRate.toFixed(1)}%`, options: { fontSize: 10, color: C.text, align: 'right' } },
    ]),
  ];
  s5.addTable(tblRows, {
    x: 0.5, y: 2.35, w: 9, colW: [2.5, 0.8, 0.8, 0.8, 0.8, 1.5, 0.9],
    border: { type: 'solid', pt: 0.5, color: C.border },
    rowH: 0.35,
    autoPage: false,
  });

  // ────────── SLIDE 6: Partner Intelligence ─────────────────────────────

  const s6 = pptx.addSlide(masterOpts);
  s6.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: C.teal } });
  s6.addText('Partner Intelligence', { x: 0.5, y: 0.25, w: 9, h: 0.5, fontSize: 22, fontFace: 'Arial', color: C.text, bold: true });
  s6.addText('Partner health and engagement breakdown', { x: 0.5, y: 0.7, w: 9, h: 0.3, fontSize: 11, fontFace: 'Arial', color: C.textLight });

  // Summary cards
  const partnerCards = [
    { label: 'Total Partners', aug: augPartners.total, jul: julPartners.total },
    { label: 'Active', aug: augPartners.active, jul: julPartners.active },
    { label: 'With Bookings', aug: augPartners.booked, jul: julPartners.booked },
    { label: 'Stalled', aug: augPartners.stalled, jul: julPartners.stalled },
  ];
  partnerCards.forEach((m, i) => {
    const x = 0.5 + i * 2.3;
    s6.addShape(pptx.ShapeType.rect, { x, y: 1.15, w: 2.1, h: 1.0, fill: { color: C.cardBg }, shadow: { type: 'outer', blur: 4, offset: 2, color: '00000015' }, rectRadius: 0.1 });
    s6.addText(String(m.aug), { x, y: 1.2, w: 2.1, h: 0.45, fontSize: 22, fontFace: 'Arial', color: C.text, bold: true, align: 'center' });
    s6.addText(m.label, { x, y: 1.6, w: 2.1, h: 0.2, fontSize: 9, fontFace: 'Arial', color: C.textLight, align: 'center' });
    const invertDelta = m.label === 'Stalled';
    const improved = invertDelta ? m.aug <= m.jul : m.aug >= m.jul;
    s6.addText(`Jul: ${m.jul}  ${delta(m.aug, m.jul)}`, { x, y: 1.82, w: 2.1, h: 0.2, fontSize: 8, fontFace: 'Arial', color: improved ? C.green : C.red, align: 'center' });
  });

  // Status distribution bar
  const statusBreakdown = [
    { label: 'Booked', count: augPartners.booked, color: C.green },
    { label: 'Quoting', count: augPartners.quoting, color: C.blueMid },
    { label: 'Progressing', count: augPartners.active - augPartners.booked - augPartners.quoting, color: C.amber },
    { label: 'Stalled', count: augPartners.stalled, color: C.red },
  ];
  const totalP = augPartners.total || 1;
  let barX = 0.5;
  statusBreakdown.forEach(s => {
    const w = Math.max((s.count / totalP) * 9, 0);
    if (w > 0) {
      s6.addShape(pptx.ShapeType.rect, { x: barX, y: 2.4, w, h: 0.3, fill: { color: s.color } });
      barX += w;
    }
  });
  // Legend
  statusBreakdown.forEach((s, i) => {
    const x = 0.5 + i * 2.3;
    s6.addShape(pptx.ShapeType.rect, { x, y: 2.85, w: 0.2, h: 0.2, fill: { color: s.color }, rectRadius: 0.03 });
    s6.addText(`${s.label}: ${s.count}`, { x: x + 0.3, y: 2.85, w: 1.8, h: 0.2, fontSize: 9, fontFace: 'Arial', color: C.textLight });
  });

  // Top booking partners
  const topBkPartners = augPartners.partners.filter(p => p.bookings > 0).sort((a, b) => b.bookings - a.bookings).slice(0, 5);
  if (topBkPartners.length > 0) {
    s6.addText('TOP BOOKING PARTNERS', { x: 0.5, y: 3.3, w: 9, h: 0.3, fontSize: 10, fontFace: 'Arial', color: C.teal, bold: true, letterSpacing: 2 });
    topBkPartners.forEach((p, i) => {
      const y = 3.65 + i * 0.35;
      s6.addText(`${i + 1}. ${p.partnerName}`, { x: 0.5, y, w: 4, h: 0.3, fontSize: 10, fontFace: 'Arial', color: C.text });
      s6.addText(`${p.bookings} bk  |  ${fmtUsd(p.revenue, gbpRate)}  |  ${p.tam}`, { x: 4.5, y, w: 5, h: 0.3, fontSize: 10, fontFace: 'Arial', color: C.textLight, align: 'right' });
    });
  }

  // ────────── SLIDE 7: Top Destinations ─────────────────────────────────

  const s7 = pptx.addSlide(masterOpts);
  s7.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: C.teal } });
  s7.addText('Top Destinations', { x: 0.5, y: 0.25, w: 9, h: 0.5, fontSize: 22, fontFace: 'Arial', color: C.text, bold: true });
  s7.addText('August destination performance by enquiry volume', { x: 0.5, y: 0.7, w: 9, h: 0.3, fontSize: 11, fontFace: 'Arial', color: C.textLight });

  const topDests = augDests.slice(0, 10);
  const maxDestEnq = Math.max(...topDests.map(d => d.enquiries), 1);
  const destTblRows = [
    [
      { text: '#', options: { bold: true, fontSize: 9, color: C.textLight, fill: { color: 'F0EDE7' }, align: 'center' } },
      { text: 'Destination', options: { bold: true, fontSize: 9, color: C.textLight, fill: { color: 'F0EDE7' } } },
      { text: 'Enq', options: { bold: true, fontSize: 9, color: C.textLight, fill: { color: 'F0EDE7' }, align: 'right' } },
      { text: 'PT', options: { bold: true, fontSize: 9, color: C.textLight, fill: { color: 'F0EDE7' }, align: 'right' } },
      { text: 'Qt', options: { bold: true, fontSize: 9, color: C.textLight, fill: { color: 'F0EDE7' }, align: 'right' } },
      { text: 'Bk', options: { bold: true, fontSize: 9, color: C.textLight, fill: { color: 'F0EDE7' }, align: 'right' } },
      { text: 'Revenue', options: { bold: true, fontSize: 9, color: C.textLight, fill: { color: 'F0EDE7' }, align: 'right' } },
      { text: 'E\u2192B', options: { bold: true, fontSize: 9, color: C.textLight, fill: { color: 'F0EDE7' }, align: 'right' } },
    ],
    ...topDests.map((d, i) => [
      { text: String(i + 1), options: { fontSize: 10, color: C.teal, bold: true, align: 'center' } },
      { text: d.destination, options: { fontSize: 10, color: C.text, bold: i < 3 } },
      { text: String(d.enquiries), options: { fontSize: 10, color: C.text, align: 'right' } },
      { text: String(d.passthroughs), options: { fontSize: 10, color: C.text, align: 'right' } },
      { text: String(d.quotes), options: { fontSize: 10, color: C.text, align: 'right' } },
      { text: String(d.bookings), options: { fontSize: 10, color: C.text, bold: true, align: 'right' } },
      { text: fmtUsd(d.revenue, gbpRate), options: { fontSize: 10, color: C.text, align: 'right' } },
      { text: d.ebRate > 0 ? `${d.ebRate.toFixed(0)}%` : '—', options: { fontSize: 10, color: d.ebRate > 0 ? C.green : C.textLight, align: 'right' } },
    ]),
  ];
  s7.addTable(destTblRows, {
    x: 0.5, y: 1.15, w: 9, colW: [0.4, 2.4, 0.8, 0.8, 0.8, 0.8, 1.2, 0.8],
    border: { type: 'solid', pt: 0.5, color: C.border },
    rowH: 0.35,
    autoPage: false,
  });

  // ────────── SLIDE 8: September Opportunities ──────────────────────────

  const s8 = pptx.addSlide(masterOpts);
  s8.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: C.teal } });
  s8.addText('September Opportunities', { x: 0.5, y: 0.25, w: 9, h: 0.5, fontSize: 22, fontFace: 'Arial', color: C.text, bold: true });
  s8.addText('Action items and pipeline focus areas', { x: 0.5, y: 0.7, w: 9, h: 0.3, fontSize: 11, fontFace: 'Arial', color: C.textLight });

  // Quoting pipeline card
  const quotingPartners = augPartners.partners.filter(p => p.status === 'Quoting');
  const pipelineRev = quotingPartners.reduce((s, p) => s + p.revenue, 0);
  s8.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.15, w: 4.2, h: 2.0, fill: { color: C.cardBg }, shadow: { type: 'outer', blur: 4, offset: 2, color: '00000015' }, rectRadius: 0.1 });
  s8.addText('QUOTING PIPELINE', { x: 0.7, y: 1.25, w: 3.8, h: 0.25, fontSize: 10, fontFace: 'Arial', color: C.teal, bold: true, letterSpacing: 2 });
  s8.addText(`${quotingPartners.length} partners`, { x: 0.7, y: 1.55, w: 3.8, h: 0.45, fontSize: 22, fontFace: 'Arial', color: C.text, bold: true });
  s8.addText(`${fmtUsd(pipelineRev, gbpRate)} potential revenue`, { x: 0.7, y: 1.95, w: 3.8, h: 0.25, fontSize: 11, fontFace: 'Arial', color: C.textLight });
  quotingPartners.slice(0, 3).forEach((p, i) => {
    s8.addText(`\u2022 ${p.partnerName} \u2014 ${p.quotes} quotes (${p.tam})`, { x: 0.7, y: 2.25 + i * 0.25, w: 3.8, h: 0.25, fontSize: 9, fontFace: 'Arial', color: C.text });
  });

  // Velocity card
  s8.addShape(pptx.ShapeType.rect, { x: 5.1, y: 1.15, w: 4.2, h: 2.0, fill: { color: C.cardBg }, shadow: { type: 'outer', blur: 4, offset: 2, color: '00000015' }, rectRadius: 0.1 });
  s8.addText('DEAL VELOCITY', { x: 5.3, y: 1.25, w: 3.8, h: 0.25, fontSize: 10, fontFace: 'Arial', color: C.teal, bold: true, letterSpacing: 2 });
  s8.addText(augVelocity.avgCycleTime > 0 ? `${augVelocity.avgCycleTime.toFixed(1)} days` : '\u2014', { x: 5.3, y: 1.55, w: 3.8, h: 0.45, fontSize: 22, fontFace: 'Arial', color: C.text, bold: true });
  s8.addText(`avg cycle time (${augVelocity.totalDeals} deals)`, { x: 5.3, y: 1.95, w: 3.8, h: 0.25, fontSize: 11, fontFace: 'Arial', color: C.textLight });
  const fastAgents = augVelocity.byAgent.filter(a => a.dealCount >= 2).slice(0, 3);
  if (fastAgents.length > 0) {
    s8.addText('Fastest closers:', { x: 5.3, y: 2.25, w: 3.8, h: 0.2, fontSize: 9, fontFace: 'Arial', color: C.textLight });
    fastAgents.forEach((a, i) => {
      s8.addText(`\u2022 ${a.agentName} (${a.avgCycleTime.toFixed(0)}d, ${a.dealCount} deals)`, { x: 5.3, y: 2.45 + i * 0.25, w: 3.8, h: 0.25, fontSize: 9, fontFace: 'Arial', color: C.text });
    });
  }

  // Stalled partners
  if (augPartners.stalledList.length > 0) {
    s8.addShape(pptx.ShapeType.rect, { x: 0.5, y: 3.4, w: 9, h: Math.min(augPartners.stalledList.length, 6) * 0.32 + 0.6, fill: { color: C.redLight }, rectRadius: 0.1 });
    s8.addText(`RE-ENGAGE: ${augPartners.stalled} STALLED PARTNERS`, { x: 0.7, y: 3.5, w: 8.6, h: 0.3, fontSize: 10, fontFace: 'Arial', color: C.red, bold: true, letterSpacing: 2 });
    augPartners.stalledList.slice(0, 6).forEach((p, i) => {
      const y = 3.85 + i * 0.32;
      s8.addText(`${p.partnerName}  \u2014  ${p.tam}  \u2022  ${p.destinations.join(', ') || 'No destination'}  \u2022  ${p.enquiries} enq`, {
        x: 0.7, y, w: 8.6, h: 0.28, fontSize: 9, fontFace: 'Arial', color: C.text,
      });
    });
  }

  // ────────── SLIDE 9: Closing ──────────────────────────────────────────

  const s9 = pptx.addSlide(masterOpts);
  s9.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: C.teal } });
  // Decorative block
  s9.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.5, w: 0.15, h: 3.0, fill: { color: C.teal }, rectRadius: 0.05 });

  s9.addText('September Game Plan', { x: 1.0, y: 1.8, w: 8.5, h: 0.7, fontSize: 32, fontFace: 'Arial', color: C.text, bold: true });

  const actions = [];
  if (augPartners.stalled > 0) actions.push(`Re-engage ${augPartners.stalled} stalled partners`);
  if (quotingPartners.length > 0) actions.push(`Convert ${quotingPartners.length} quoting partners to bookings`);
  if (augVelocity.avgCycleTime > 0) actions.push(`Target <${Math.max(1, augVelocity.avgCycleTime - 1).toFixed(0)}d avg cycle time`);
  if (augScore.ebRate > 0) actions.push(`Push E\u2192B rate above ${(augScore.ebRate + 1).toFixed(0)}%`);

  actions.forEach((a, i) => {
    s9.addText(`\u25b8  ${a}`, { x: 1.0, y: 2.7 + i * 0.45, w: 8, h: 0.4, fontSize: 14, fontFace: 'Arial', color: C.tealDark });
  });

  s9.addText('Questions?  Discussion?  Ideas?', { x: 1.0, y: 4.5, w: 8, h: 0.4, fontSize: 13, fontFace: 'Arial', color: C.textLight, italic: true });

  // ────────── Save ──────────────────────────────────────────────────────

  const outDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'TAM_August_2026_Review.pptx');
  await pptx.writeFile({ fileName: outPath });
  console.log(`\n✓ Saved to ${outPath}`);
}

generate().catch(err => { console.error('Failed:', err); process.exit(1); });
