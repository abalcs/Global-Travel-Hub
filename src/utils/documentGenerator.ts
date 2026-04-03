import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import pptxgen from 'pptxgenjs';
import { saveAs } from 'file-saver';
import type { MeetingAgendaData, DestinationOpportunity, TopHotPassDestination, DepartmentSubRegionBreakdown, ProgramTrends } from './insightsAnalytics';

// Re-export training generator functions
export { generateDestinationTraining } from './trainingGenerator';

// Audley Travel brand colors
const COLORS = {
  primary: '#4d726d',      // Audley Teal
  primaryDark: '#3d5c58',  // Darker Teal
  secondary: '#007bc7',    // Audley Blue
  secondaryDark: '#005a94',// Darker Blue
  success: '#4d726d',      // Teal (for positive metrics)
  successLight: '#e8f0ef', // Light teal
  warning: '#d97706',      // Warm amber
  warningLight: '#fef3c7', // Light amber
  danger: '#dc2626',       // Red
  dangerLight: '#fee2e2',  // Light red
  dark: '#313131',         // Audley Charcoal
  medium: '#64748b',       // Slate 500
  light: '#f0f7fc',        // Audley light blue tint
  white: '#FFFFFF',
  slate: '#313131',        // Charcoal for PPT backgrounds
  slateLight: '#3d5c58',   // Teal dark for PPT cards
};

// Audley fonts (Georgia as web-safe serif fallback for Merriweather)
const FONTS = {
  heading: 'Georgia',
  body: 'Calibri',
};

// Audley logo as base64 PNG (re-encoded as RGBA for jsPDF compatibility)
const AUDLEY_LOGO_BASE64 = 'data:image/png;base64,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';

// ============ PDF Document Generation ============

export const generatePDFDocument = async (data: MeetingAgendaData): Promise<void> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Helper to add new page if needed
  const checkPageBreak = (neededHeight: number) => {
    if (yPos + neededHeight > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // ===== HEADER =====
  // Header background — Audley teal (no blue strip)
  doc.setFillColor(77, 114, 109); // Audley Teal #4d726d
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Audley logo (top-right corner of header)
  try {
    doc.addImage(AUDLEY_LOGO_BASE64, 'PNG', pageWidth - 38, 5, 18, 18);
  } catch {
    // Logo embedding failed — continue without it
  }

  // Title — Times (serif, closest to Georgia/Merriweather in jsPDF)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('times', 'bold');
  doc.text('DEPARTMENT CHAMPS', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('times', 'normal');
  doc.text('Regional Performance Meeting', pageWidth / 2, 30, { align: 'center' });

  // Program name badge
  doc.setFontSize(12);
  doc.setFont('times', 'bold');
  doc.text(data.program, pageWidth / 2, 38, { align: 'center' });

  yPos = 55;

  // ===== MEETING DETAILS BAR =====
  doc.setFillColor(232, 240, 239); // Audley light teal #e8f0ef
  doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'F');

  doc.setTextColor(77, 114, 109); // Audley Teal
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${data.date}`, margin + 5, yPos + 7.5);
  doc.text('Duration: 30 minutes', pageWidth / 2, yPos + 7.5, { align: 'center' });
  doc.text(`${data.currentPeriodLabel} vs ${data.previousPeriodLabel}`, pageWidth - margin - 5, yPos + 7.5, { align: 'right' });

  yPos += 20;

  // ===== KEY METRICS =====
  doc.setTextColor(77, 114, 109); // Audley Teal
  doc.setFontSize(14);
  doc.setFont('times', 'bold');
  doc.text('Key Metrics', margin, yPos);
  yPos += 8;

  const metrics = [
    { label: 'Total Trips', value: data.overallStats.totalTrips.toLocaleString(), color: COLORS.primary },
    { label: 'Passthroughs', value: data.overallStats.totalPassthroughs.toLocaleString(), color: COLORS.primary },
    { label: 'T>P Rate', value: `${data.overallStats.tpRate.toFixed(1)}%`, color: COLORS.success },
    { label: 'Hot Pass Rate', value: `${data.overallStats.hotPassRate.toFixed(1)}%`, color: COLORS.warning },
    { label: 'P>Q Rate', value: `${data.overallStats.pqRate.toFixed(1)}%`, color: COLORS.secondary },
  ];

  const metricBoxWidth = contentWidth / metrics.length - 2;
  metrics.forEach((metric, i) => {
    const x = margin + i * (metricBoxWidth + 2.5);

    // Box — Audley light blue tint
    doc.setFillColor(240, 247, 252); // #f0f7fc
    doc.roundedRect(x, yPos, metricBoxWidth, 18, 2, 2, 'F');
    doc.setDrawColor(199, 226, 245); // #c7e2f5
    doc.setLineWidth(0.3);
    doc.roundedRect(x, yPos, metricBoxWidth, 18, 2, 2, 'S');

    // Value
    const rgb = hexToRgb(metric.color);
    doc.setTextColor(rgb.r, rgb.g, rgb.b);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(metric.value, x + metricBoxWidth / 2, yPos + 8, { align: 'center' });

    // Label
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(metric.label, x + metricBoxWidth / 2, yPos + 14, { align: 'center' });
  });

  yPos += 28;

  // Per-department breakdown (when multiple departments selected)
  if (data.programStats.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Department', 'Trips', 'PTs', 'T>P Rate', 'HP Rate', 'P>Q Rate']],
      body: data.programStats.map(ps => [
        ps.program, ps.totalTrips.toLocaleString(), ps.totalPassthroughs.toLocaleString(),
        `${ps.tpRate.toFixed(1)}%`, `${ps.hotPassRate.toFixed(1)}%`, `${ps.pqRate.toFixed(1)}%`,
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2, lineColor: [229, 231, 235], lineWidth: 0.1 },
      headStyles: { fillColor: [77, 114, 109], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });
    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Helper to render an opportunity section in PDF with best and needing improvement
  const renderOpportunitySection = (
    sectionNum: number,
    title: string,
    time: string,
    accentColor: [number, number, number],
    bestOpps: DestinationOpportunity[],
    needingOpps: DestinationOpportunity[],
  ) => {
    checkPageBreak(50);
    doc.setFillColor(...accentColor);
    doc.rect(margin, yPos, 4, 10, 'F');
    doc.setTextColor(49, 49, 49); // Audley Charcoal #313131
    doc.setFontSize(12);
    doc.setFont('times', 'bold');
    doc.text(`${sectionNum}. ${title}`, margin + 8, yPos + 7);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(time, pageWidth - margin, yPos + 7, { align: 'right' });
    yPos += 14;

    // Helper to render an opp table
    const renderOppTable = (
      label: string,
      labelColor: [number, number, number],
      headerBg: [number, number, number],
      opps: DestinationOpportunity[],
    ) => {
      if (opps.length === 0) return;
      doc.setTextColor(...labelColor);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, yPos);
      yPos += 6;

      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Destination', 'QTD', 'Prev Qtr', 'Gap', 'Volume', '+Gain']],
        body: opps.map((opp, i) => [
          `${i + 1}`, opp.region, `${opp.currentRate.toFixed(1)}%`, `${opp.historicalRate.toFixed(1)}%`,
          `${Math.abs(opp.deviation).toFixed(1)}pp`, `${opp.volume}`, `+${Math.round(opp.potentialGain)}`,
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 2, lineColor: [229, 231, 235], lineWidth: 0.1 },
        headStyles: { fillColor: headerBg, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { fontStyle: 'bold' },
          2: { halign: 'center', textColor: labelColor, fontStyle: 'bold' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
          6: { halign: 'center', textColor: accentColor, fontStyle: 'bold' },
        },
        alternateRowStyles: { fillColor: [249, 250, 251] },
      });
      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    };

    // Top performing (outperforming prev quarter)
    renderOppTable('Top Performing (vs Prev Quarter)', accentColor, accentColor, bestOpps);

    // Needing improvement (underperforming prev quarter)
    renderOppTable('Opportunity Areas (vs Prev Quarter)', [220, 38, 38], [220, 38, 38], needingOpps);

    if (bestOpps.length === 0 && needingOpps.length === 0) {
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(`No significant ${title.toLowerCase()} changes identified.`, margin, yPos);
      yPos += 10;
    }
  };


  // ===== PER-DEPT SECTIONS WITH SUB-REGION BREAKDOWNS =====
  const periodComparison = `(${data.currentPeriodLabel} vs ${data.previousPeriodLabel})`;
  let sectionNum = 0;

  // Helper to find sub-region breakdown for a program
  const findSubRegionBreakdown = (programName: string): DepartmentSubRegionBreakdown | undefined =>
    data.departmentSubRegions.find(d => d.program === programName);

  // Helper to find trends data for a program
  const findProgramTrends = (programName: string): ProgramTrends | undefined =>
    data.perProgramTrends.find(t => t.program === programName);

  // Helper to render a trends mini-table
  const renderTrendsTable = (
    label: string,
    labelColor: [number, number, number],
    headerBg: [number, number, number],
    opps: DestinationOpportunity[],
    changePrefix: string,
  ) => {
    doc.setTextColor(...labelColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPos);
    yPos += 6;

    if (opps.length === 0) {
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text('No significant changes', margin + 4, yPos);
      yPos += 8;
      return;
    }

    autoTable(doc, {
      startY: yPos,
      head: [['Destination', 'Current', 'Prev', 'Change']],
      body: opps.map(opp => [
        opp.region,
        `${opp.currentRate.toFixed(1)}%`,
        `${opp.historicalRate.toFixed(1)}%`,
        `${changePrefix}${Math.abs(opp.deviation).toFixed(1)}pp`,
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2, lineColor: [229, 231, 235], lineWidth: 0.1 },
      headStyles: { fillColor: headerBg, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center', textColor: labelColor, fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });
    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  };

  for (let i = 0; i < data.perProgramOpportunities.length; i++) {
    const po = data.perProgramOpportunities[i];

    // Force page break before second+ department
    if (i > 0) {
      doc.addPage();
      yPos = margin;
    }

    // ---- Department Header Bar ----
    checkPageBreak(60);
    doc.setFillColor(77, 114, 109); // Audley Teal
    doc.roundedRect(margin, yPos, contentWidth, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('times', 'bold');
    doc.text(po.program, margin + 5, yPos + 7);
    yPos += 16;

    // ---- Sub-Region Breakdown Table ----
    const breakdown = findSubRegionBreakdown(po.program);
    if (breakdown && breakdown.subRegions.length > 0) {
      doc.setTextColor(77, 114, 109);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Sub-Region Breakdown', margin, yPos);
      yPos += 5;

      autoTable(doc, {
        startY: yPos,
        head: [['Sub-Region', 'Trips', 'PTs', 'T>P Rate', 'HP Rate', 'P>Q Rate']],
        body: breakdown.subRegions.map(sr => [
          sr.subRegion,
          sr.trips.toLocaleString(),
          sr.passthroughs.toLocaleString(),
          `${sr.tpRate.toFixed(1)}%`,
          `${sr.hotPassRate.toFixed(1)}%`,
          `${sr.pqRate.toFixed(1)}%`,
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 2, lineColor: [229, 231, 235], lineWidth: 0.1 },
        headStyles: { fillColor: [77, 114, 109], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
        },
        alternateRowStyles: { fillColor: [249, 250, 251] },
      });
      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // ---- T>P Performance ----
    sectionNum++;
    renderOpportunitySection(
      sectionNum, `T>P Performance — ${po.program}`, periodComparison,
      [77, 114, 109], // Audley Teal
      po.topBestTp, po.tpNeeding,
    );

    // ---- P>Q Performance ----
    sectionNum++;
    renderOpportunitySection(
      sectionNum, `P>Q Performance — ${po.program}`, periodComparison,
      [0, 123, 199], // Audley Blue
      po.topBestPq, po.pqNeeding,
    );

    // ---- Hot Pass Performance ----
    sectionNum++;
    renderOpportunitySection(
      sectionNum, `Hot Pass Performance — ${po.program}`, periodComparison,
      [217, 119, 6], // Amber
      po.topBestHp, po.hpNeeding,
    );

    // ---- Trends Section ----
    const trends = findProgramTrends(po.program);
    if (trends) {
      sectionNum++;
      checkPageBreak(50);

      // Section header bar — purple/indigo accent
      doc.setFillColor(99, 102, 241); // indigo-500
      doc.rect(margin, yPos, 4, 10, 'F');
      doc.setTextColor(49, 49, 49); // Audley Charcoal
      doc.setFontSize(12);
      doc.setFont('times', 'bold');
      doc.text(`${sectionNum}. T>Q Trends — ${po.program}`, margin + 8, yPos + 7);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(periodComparison, pageWidth - margin, yPos + 7, { align: 'right' });
      yPos += 14;

      // T>Q Trends (quotes / trips)
      renderTrendsTable('T>Q Improving', [22, 163, 74], [22, 163, 74], trends.tqImproved, '+');
      renderTrendsTable('T>Q Declining', [220, 38, 38], [220, 38, 38], trends.tqDeclined, '-');
    }
  }

  // ===== CAPACITY CONSTRAINTS =====
  checkPageBreak(50);
  doc.setFillColor(217, 119, 6); // Amber
  doc.rect(margin, yPos, 4, 10, 'F');
  doc.setTextColor(49, 49, 49); // Audley Charcoal
  doc.setFontSize(12);
  doc.setFont('times', 'bold');
  sectionNum++;
  doc.text(`${sectionNum}. Availability & Capacity Constraints`, margin + 8, yPos + 7);
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('(5 min)', pageWidth - margin, yPos + 7, { align: 'right' });
  yPos += 14;

  // Discussion prompts
  const capacityPrompts = [
    'Any destinations with limited CS availability?',
    'Upcoming blackout dates or seasonal constraints?',
    'High-demand periods requiring extra support?',
    'Supplier capacity issues to be aware of?',
  ];

  capacityPrompts.forEach((prompt) => {
    checkPageBreak(10);
    doc.setFillColor(254, 243, 199); // Light amber
    doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, 'F');

    doc.setTextColor(180, 83, 9);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`• ${prompt}`, margin + 4, yPos + 5.5);

    yPos += 10;
  });

  // Notes area
  yPos += 4;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, yPos, contentWidth, 20, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, yPos, contentWidth, 20, 2, 2, 'S');
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Notes:', margin + 3, yPos + 5);

  yPos += 28;

  // ===== FOOTER =====
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setTextColor(156, 163, 175);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Generated by GTT KPI Report', pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Save using file-saver for better browser compatibility
  const fileName = `Department_Champs_${data.program.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  const pdfBlob = doc.output('blob');
  saveAs(pdfBlob, fileName);
};

// ============ PowerPoint Generation ============

export const generatePowerPoint = async (data: MeetingAgendaData): Promise<void> => {
  const pptx = new pptxgen();

  // Set presentation properties
  pptx.author = 'GTT KPI Report';
  pptx.title = `Department Champs - ${data.program}`;
  pptx.subject = 'Regional Performance Meeting';
  pptx.layout = 'LAYOUT_16x9';

  // ===== SLIDE 1: TITLE =====
  const slide1 = pptx.addSlide();
  slide1.background = { color: 'FFFFFF' };

  // Audley blue accent bar at top
  slide1.addShape('rect', {
    x: 0, y: 0, w: '100%', h: 0.15,
    fill: { color: '007BC7' },
  });

  // Audley logo (top-right)
  slide1.addImage({
    data: AUDLEY_LOGO_BASE64,
    x: 7.8, y: 0.4, w: 1.6, h: 1.6,
  });

  // Main title — Georgia heading in Audley teal
  slide1.addText('DEPARTMENT CHAMPS', {
    x: 0.5, y: 1.8, w: 9, h: 0.9,
    fontSize: 48, bold: true, color: '4D726D',
    align: 'center', fontFace: FONTS.heading,
  });

  // Subtitle
  slide1.addText('Regional Performance', {
    x: 0.5, y: 2.7, w: 9, h: 0.6,
    fontSize: 28, color: '64748B',
    align: 'center', fontFace: FONTS.body,
  });

  // Divider line — Audley blue
  slide1.addShape('rect', {
    x: 3.5, y: 3.4, w: 3, h: 0.03,
    fill: { color: '007BC7' },
  });

  // Program name — Audley blue
  slide1.addText(data.program, {
    x: 0.5, y: 3.6, w: 9, h: 0.5,
    fontSize: 24, bold: true, color: '007BC7',
    align: 'center', fontFace: FONTS.body,
  });

  // Date
  slide1.addText(data.date, {
    x: 0.5, y: 4.3, w: 9, h: 0.4,
    fontSize: 16, color: '64748B',
    align: 'center', fontFace: FONTS.body,
  });

  // ===== SLIDE 2: AGENDA =====
  const slide2 = pptx.addSlide();
  slide2.background = { color: 'FFFFFF' };

  addSlideHeader(slide2, 'Meeting Agenda', '30 Minutes');

  // Build dynamic agenda based on selected programs
  const agendaItems: Array<{ num: string; title: string; time: string; color: string }> = [];
  let itemNum = 1;
  for (const po of data.perProgramOpportunities) {
    agendaItems.push({ num: String(itemNum).padStart(2, '0'), title: `T>P Performance — ${po.program}`, time: '5 min', color: '4D726D' });
    itemNum++;
    agendaItems.push({ num: String(itemNum).padStart(2, '0'), title: `P>Q Performance — ${po.program}`, time: '5 min', color: '007BC7' });
    itemNum++;
  }
  agendaItems.push({ num: String(itemNum).padStart(2, '0'), title: 'Hot Pass Performance', time: '5 min', color: 'D97706' });
  itemNum++;
  agendaItems.push({ num: String(itemNum).padStart(2, '0'), title: 'Availability & Capacity Constraints', time: '5 min', color: 'D97706' });

  // Adjust spacing based on item count
  const agendaSpacing = agendaItems.length <= 4 ? 1.0 : agendaItems.length <= 6 ? 0.75 : 0.6;
  agendaItems.forEach((item, i) => {
    const y = 1.4 + i * agendaSpacing;

    // Card background — light Audley teal tint
    slide2.addShape('rect', {
      x: 0.8, y, w: 8.4, h: 0.85,
      fill: { color: 'F0F7FC' },
      line: { color: item.color, width: 1.5, dashType: 'solid' },
    });

    // Number
    slide2.addText(item.num, {
      x: 1.0, y: y + 0.15, w: 0.6, h: 0.55,
      fontSize: 22, bold: true, color: item.color,
      align: 'center', valign: 'middle', fontFace: FONTS.body,
    });

    // Title
    slide2.addText(item.title, {
      x: 1.8, y: y + 0.2, w: 5.5, h: 0.45,
      fontSize: 18, color: '313131',
      fontFace: FONTS.body,
    });

    // Duration
    slide2.addText(item.time, {
      x: 7.8, y: y + 0.25, w: 1.2, h: 0.35,
      fontSize: 12, color: '64748B',
      align: 'right', fontFace: FONTS.body,
    });
  });

  // ===== SLIDE 3: DEPARTMENT OVERVIEW =====
  const slide3 = pptx.addSlide();
  slide3.background = { color: 'FFFFFF' };

  addSlideHeader(slide3, 'Department Overview', data.program);

  const overviewMetrics = [
    { label: 'Total Trips', value: data.overallStats.totalTrips.toLocaleString(), color: '4D726D' },
    { label: 'Passthroughs', value: data.overallStats.totalPassthroughs.toLocaleString(), color: '4D726D' },
    { label: 'T>P Rate', value: `${data.overallStats.tpRate.toFixed(1)}%`, color: '4D726D' },
    { label: 'Hot Pass Rate', value: `${data.overallStats.hotPassRate.toFixed(1)}%`, color: 'D97706' },
    { label: 'P>Q Rate', value: `${data.overallStats.pqRate.toFixed(1)}%`, color: '007BC7' },
  ];

  // Layout: 5 metrics in a single row across the top
  const metricCardW = 1.72;
  const metricGap = 0.1;
  const metricStartX = 0.5;

  overviewMetrics.forEach((stat, i) => {
    const x = metricStartX + i * (metricCardW + metricGap);
    const y = 1.5;

    // Card — light teal background with subtle border
    slide3.addShape('rect', {
      x, y, w: metricCardW, h: 1.3,
      fill: { color: 'F0F7FC' },
      line: { color: 'C7E2F5', width: 0.5 },
    });

    // Value
    slide3.addText(stat.value, {
      x, y: y + 0.2, w: metricCardW, h: 0.6,
      fontSize: 26, bold: true, color: stat.color,
      align: 'center', fontFace: FONTS.body,
    });

    // Label
    slide3.addText(stat.label, {
      x, y: y + 0.85, w: metricCardW, h: 0.3,
      fontSize: 10, color: '64748B',
      align: 'center', fontFace: FONTS.body,
    });
  });

  // Per-department breakdown table (when multiple departments selected)
  if (data.programStats.length > 0) {
    const tableY = 3.1;
    const tableX = 0.5;
    const tableW = 9.0;
    const colWidths = [1.5, 1.5, 1.5, 1.5, 1.5, 1.5];
    const rowH = 0.4;

    // Table header — Audley teal
    slide3.addShape('rect', { x: tableX, y: tableY, w: tableW, h: rowH, fill: { color: '4D726D' } });
    const headers = ['Department', 'Trips', 'PTs', 'T>P Rate', 'HP Rate', 'P>Q Rate'];
    headers.forEach((h, i) => {
      slide3.addText(h, {
        x: tableX + colWidths.slice(0, i).reduce((a, b) => a + b, 0),
        y: tableY + 0.05, w: colWidths[i], h: 0.3,
        fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', fontFace: FONTS.body,
      });
    });

    // Table rows
    data.programStats.forEach((ps, ri) => {
      const rowY = tableY + rowH + ri * rowH;
      const bgColor = ri % 2 === 0 ? 'F0F7FC' : 'FFFFFF';
      slide3.addShape('rect', { x: tableX, y: rowY, w: tableW, h: rowH, fill: { color: bgColor } });
      const vals = [ps.program, ps.totalTrips.toLocaleString(), ps.totalPassthroughs.toLocaleString(),
        `${ps.tpRate.toFixed(1)}%`, `${ps.hotPassRate.toFixed(1)}%`, `${ps.pqRate.toFixed(1)}%`];
      vals.forEach((v, ci) => {
        slide3.addText(v, {
          x: tableX + colWidths.slice(0, ci).reduce((a, b) => a + b, 0),
          y: rowY + 0.05, w: colWidths[ci], h: 0.3,
          fontSize: 11, color: ci === 0 ? '313131' : '4D726D', bold: ci === 0,
          align: 'center', fontFace: FONTS.body,
        });
      });
    });
  }

  // Helper to render a half-section (best or needing improvement) on a slide
  const renderOppHalf = (
    slide: pptxgen.Slide,
    xStart: number,
    sectionTitle: string,
    titleColor: string,
    headerBgColor: string,
    opps: DestinationOpportunity[],
    rateColor: string,
    gainLabel: string,
  ) => {
    const halfW = 4.3;
    slide.addText(sectionTitle, { x: xStart, y: 1.2, w: halfW, h: 0.3, fontSize: 12, color: titleColor, bold: true, fontFace: FONTS.body });
    slide.addShape('rect', { x: xStart, y: 1.5, w: halfW, h: 0.35, fill: { color: headerBgColor } });
    slide.addText('Destination', { x: xStart + 0.1, y: 1.52, w: 1.3, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, fontFace: FONTS.body });
    slide.addText('QTD', { x: xStart + 1.4, y: 1.52, w: 0.65, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', fontFace: FONTS.body });
    slide.addText('Prev Qtr', { x: xStart + 2.05, y: 1.52, w: 0.75, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', fontFace: FONTS.body });
    slide.addText('Vol', { x: xStart + 2.8, y: 1.52, w: 0.6, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', fontFace: FONTS.body });
    slide.addText(gainLabel, { x: xStart + 3.4, y: 1.52, w: 0.8, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', fontFace: FONTS.body });

    if (opps.length > 0) {
      opps.forEach((opp, i) => {
        const y = 1.88 + i * 0.48;
        const bgColor = i % 2 === 0 ? 'F0F7FC' : 'FFFFFF';
        slide.addShape('rect', { x: xStart, y, w: halfW, h: 0.45, fill: { color: bgColor } });
        slide.addText(`${i + 1}. ${opp.region}`, { x: xStart + 0.1, y: y + 0.08, w: 1.3, h: 0.3, fontSize: 11, color: '313131', fontFace: FONTS.body });
        slide.addText(`${opp.currentRate.toFixed(1)}%`, { x: xStart + 1.4, y: y + 0.08, w: 0.65, h: 0.3, fontSize: 11, color: rateColor, bold: true, align: 'center', fontFace: FONTS.body });
        slide.addText(`${opp.historicalRate.toFixed(1)}%`, { x: xStart + 2.05, y: y + 0.08, w: 0.75, h: 0.3, fontSize: 11, color: '64748B', align: 'center', fontFace: FONTS.body });
        slide.addText(`${opp.volume}`, { x: xStart + 2.8, y: y + 0.08, w: 0.6, h: 0.3, fontSize: 11, color: '64748B', align: 'center', fontFace: FONTS.body });
        slide.addText(`+${Math.round(opp.potentialGain)}`, { x: xStart + 3.4, y: y + 0.08, w: 0.8, h: 0.3, fontSize: 11, color: rateColor, bold: true, align: 'center', fontFace: FONTS.body });
      });
    } else {
      slide.addShape('rect', { x: xStart, y: 1.88, w: halfW, h: 0.45, fill: { color: 'F0F7FC' } });
      slide.addText('No significant changes', { x: xStart + 0.1, y: 1.96, w: halfW - 0.2, h: 0.3, fontSize: 11, color: '64748B', italic: true, fontFace: FONTS.body });
    }
  };

  // Helper to build an opportunity slide with top 2 best and top 2 needing improvement
  const addOpportunitySlide = (
    title: string,
    subtitle: string,
    accentColor: string,
    bestOpps: DestinationOpportunity[],
    needingOpps: DestinationOpportunity[],
    gainLabel: string = '+Gain',
  ) => {
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    addSlideHeader(slide, title, subtitle);

    // Left half: Top 2 Best (outperforming prev quarter)
    renderOppHalf(slide, 0.5, 'Top Performing (vs Prev Qtr)', accentColor, accentColor, bestOpps, accentColor, '+Surplus');

    // Right half: Top 2 Opportunity Areas (underperforming prev quarter)
    renderOppHalf(slide, 5.2, 'Opportunity Areas (vs Prev Qtr)', 'DC2626', 'DC2626', needingOpps, 'DC2626', gainLabel);

    if (bestOpps.length === 0 && needingOpps.length === 0) {
      addEmptyStateMessage(slide, `No ${title.toLowerCase()} comparison data available.`);
    }
  };

  // Helper to render a simple top hot pass destinations slide (fallback when no significant changes)
  const addTopHotPassSlide = (destinations: TopHotPassDestination[]) => {
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    addSlideHeader(slide, 'Top Hot Pass Destinations', 'Quarter to Date');

    if (destinations.length === 0) {
      addEmptyStateMessage(slide, 'No hot pass data available.');
      return;
    }

    const showProgram = destinations.some(d => d.program);
    const tableX = 1.5;
    const tableW = 7.0;
    const rowH = 0.5;

    // Column widths
    const colWidths = showProgram
      ? [0.5, 2.5, 1.5, 1.25, 1.25]   // #, Dest, Dept, HP Rate, Vol
      : [0.5, 3.0, 1.75, 1.75];         // #, Dest, HP Rate, Vol

    // Header
    const headerY = 1.5;
    slide.addShape('rect', { x: tableX, y: headerY, w: tableW, h: rowH, fill: { color: 'D97706' } });
    const headers = showProgram
      ? ['#', 'Destination', 'Dept', 'HP Rate', 'Volume']
      : ['#', 'Destination', 'HP Rate', 'Volume'];
    headers.forEach((h, i) => {
      slide.addText(h, {
        x: tableX + colWidths.slice(0, i).reduce((a, b) => a + b, 0),
        y: headerY + 0.08, w: colWidths[i], h: 0.35,
        fontSize: 12, color: 'FFFFFF', bold: true, align: 'center', fontFace: FONTS.body,
      });
    });

    // Rows
    destinations.forEach((dest, ri) => {
      const rowY = headerY + rowH + ri * rowH;
      const bgColor = ri % 2 === 0 ? 'F0F7FC' : 'FFFFFF';
      slide.addShape('rect', { x: tableX, y: rowY, w: tableW, h: rowH, fill: { color: bgColor } });

      const vals = showProgram
        ? [`${ri + 1}`, dest.region, dest.program || '', `${dest.hotPassRate.toFixed(1)}%`, `${dest.volume}`]
        : [`${ri + 1}`, dest.region, `${dest.hotPassRate.toFixed(1)}%`, `${dest.volume}`];

      vals.forEach((v, ci) => {
        const isRateCol = showProgram ? ci === 3 : ci === 2;
        slide.addText(v, {
          x: tableX + colWidths.slice(0, ci).reduce((a, b) => a + b, 0),
          y: rowY + 0.08, w: colWidths[ci], h: 0.35,
          fontSize: 13, color: isRateCol ? 'D97706' : '313131',
          bold: ci === 1 || isRateCol,
          align: ci === 1 ? 'left' : 'center', fontFace: FONTS.body,
        });
      });
    });
  };

  // ===== PER-DEPARTMENT T>P AND P>Q SLIDES =====
  for (const po of data.perProgramOpportunities) {
    // T>P slide for this department — Audley teal
    addOpportunitySlide(
      `T>P Performance — ${po.program}`, 'QTD vs Previous Quarter', '4D726D',
      po.topBestTp, po.tpNeeding, '+PTs',
    );

    // P>Q slide for this department — Audley blue
    addOpportunitySlide(
      `P>Q Performance — ${po.program}`, 'QTD vs Previous Quarter', '007BC7',
      po.topBestPq, po.pqNeeding, '+Quotes',
    );
  }

  // ===== HOT PASS SLIDE (combined) =====
  if (data.hotPassOpportunities.length > 0) {
    addOpportunitySlide(
      'Hot Pass Performance', 'QTD vs Previous Quarter', 'D97706',
      [], data.hotPassOpportunities, '+HPs',
    );
  } else {
    // Fallback: show top 4 hot pass destinations by rate in a simple list
    addTopHotPassSlide(data.topHotPassDestinations);
  }

  // ===== SLIDE 7: CAPACITY CONSTRAINTS =====
  const slide7 = pptx.addSlide();
  slide7.background = { color: 'FFFFFF' };

  addSlideHeader(slide7, 'Availability & Capacity Constraints', 'Discussion Topics');

  const capacityTopics = [
    { icon: '1', text: 'Any destinations with limited CS availability?' },
    { icon: '2', text: 'Upcoming blackout dates or seasonal constraints?' },
    { icon: '3', text: 'High-demand periods requiring extra support?' },
    { icon: '4', text: 'Supplier capacity issues to be aware of?' },
  ];

  capacityTopics.forEach((topic, i) => {
    const y = 1.4 + i * 0.9;

    // Card — light background with amber accent border
    slide7.addShape('rect', {
      x: 0.8, y, w: 8.4, h: 0.75,
      fill: { color: 'FEF3C7' },
      line: { color: 'D97706', width: 1 },
    });

    // Number
    slide7.addText(topic.icon, {
      x: 1.0, y: y + 0.18, w: 0.5, h: 0.4,
      fontSize: 16, bold: true, color: 'D97706',
      align: 'center', fontFace: FONTS.body,
    });

    // Text
    slide7.addText(topic.text, {
      x: 1.7, y: y + 0.2, w: 7, h: 0.4,
      fontSize: 16, color: '313131',
      fontFace: FONTS.body,
    });
  });

  // Notes prompt
  slide7.addShape('rect', {
    x: 0.8, y: 5.0, w: 8.4, h: 0.5,
    fill: { color: 'FFFFFF' },
    line: { color: 'C7E2F5', width: 0.5, dashType: 'dash' },
  });

  slide7.addText('Notes & action items from discussion...', {
    x: 1.0, y: 5.1, w: 8, h: 0.3,
    fontSize: 12, color: '64748B', italic: true,
    fontFace: FONTS.body,
  });

  // ===== SLIDE 8: THANK YOU =====
  const slide9 = pptx.addSlide();
  slide9.background = { color: 'FFFFFF' };

  // Accent bar — Audley blue
  slide9.addShape('rect', {
    x: 0, y: 5.45, w: '100%', h: 0.15,
    fill: { color: '007BC7' },
  });

  // Audley logo (centered above title)
  slide9.addImage({
    data: AUDLEY_LOGO_BASE64,
    x: 4.2, y: 0.8, w: 1.6, h: 1.6,
  });

  slide9.addText('Thank You', {
    x: 0.5, y: 2.5, w: 9, h: 0.8,
    fontSize: 52, bold: true, color: '4D726D',
    align: 'center', fontFace: FONTS.heading,
  });

  slide9.addText("Let's make it a great month!", {
    x: 0.5, y: 3.5, w: 9, h: 0.5,
    fontSize: 22, color: '007BC7',
    align: 'center', fontFace: FONTS.body,
  });

  slide9.addText('Questions?', {
    x: 0.5, y: 4.2, w: 9, h: 0.4,
    fontSize: 16, color: '64748B',
    align: 'center', fontFace: FONTS.body,
  });

  slide9.addText('Generated by GTT KPI Report', {
    x: 0.5, y: 4.8, w: 9, h: 0.3,
    fontSize: 10, color: '64748B', italic: true,
    align: 'center', fontFace: FONTS.body,
  });

  // Save the file using blob for better browser compatibility
  const fileName = `Department_Champs_${data.program.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pptx`;
  const pptxBlob = await pptx.write({ outputType: 'blob' }) as Blob;
  saveAs(pptxBlob, fileName);
};

// Helper functions

function addSlideHeader(slide: pptxgen.Slide, title: string, subtitle?: string): void {
  // Audley teal-to-blue gradient accent bar at top
  slide.addShape('rect', {
    x: 0, y: 0, w: '100%', h: 0.08,
    fill: { color: '007BC7' },
  });

  // Title — Georgia heading in Audley teal
  slide.addText(title, {
    x: 0.5, y: 0.3, w: 7, h: 0.6,
    fontSize: 28, bold: true, color: '4D726D',
    fontFace: FONTS.heading,
  });

  // Subtitle
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5, y: 0.85, w: 7, h: 0.35,
      fontSize: 14, color: '64748B',
      fontFace: FONTS.body,
    });
  }
}

function addEmptyStateMessage(slide: pptxgen.Slide, message: string): void {
  slide.addText(message, {
    x: 0.5, y: 2.5, w: 9, h: 0.5,
    fontSize: 16, color: '64748B', italic: true,
    align: 'center', fontFace: FONTS.body,
  });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

// Legacy export for backwards compatibility
export const generateWordDocument = generatePDFDocument;
