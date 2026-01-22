import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import pptxgen from 'pptxgenjs';
import { saveAs } from 'file-saver';
import type { MeetingAgendaData } from './insightsAnalytics';

// Re-export training generator functions
export { generateDestinationTraining } from './trainingGenerator';

// Modern color palette
const COLORS = {
  primary: '#4F46E5',      // Indigo
  primaryDark: '#3730A3',  // Darker indigo
  secondary: '#7C3AED',    // Purple
  success: '#10B981',      // Emerald
  successLight: '#D1FAE5', // Light emerald
  warning: '#F59E0B',      // Amber
  warningLight: '#FEF3C7', // Light amber
  danger: '#EF4444',       // Red
  dangerLight: '#FEE2E2',  // Light red
  dark: '#1F2937',         // Gray 800
  medium: '#6B7280',       // Gray 500
  light: '#F3F4F6',        // Gray 100
  white: '#FFFFFF',
  slate: '#0F172A',        // Slate 900 for PPT
  slateLight: '#1E293B',   // Slate 800
};

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
  // Header background
  doc.setFillColor(79, 70, 229); // Primary indigo
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('DEPARTMENT CHAMPS', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Regional Performance Meeting', pageWidth / 2, 28, { align: 'center' });

  // Program name badge
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(data.program, pageWidth / 2, 38, { align: 'center' });

  yPos = 55;

  // ===== MEETING DETAILS BAR =====
  doc.setFillColor(243, 244, 246); // Light gray
  doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'F');

  doc.setTextColor(107, 114, 128); // Medium gray
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${data.date}`, margin + 5, yPos + 7.5);
  doc.text('Duration: 30 minutes', pageWidth / 2, yPos + 7.5, { align: 'center' });
  doc.text(`Destinations: ${data.overallStats.destinationsTracked}`, pageWidth - margin - 5, yPos + 7.5, { align: 'right' });

  yPos += 20;

  // ===== KEY METRICS =====
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
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

    // Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, yPos, metricBoxWidth, 18, 2, 2, 'F');

    // Value
    const rgb = hexToRgb(metric.color);
    doc.setTextColor(rgb.r, rgb.g, rgb.b);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(metric.value, x + metricBoxWidth / 2, yPos + 8, { align: 'center' });

    // Label
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(metric.label, x + metricBoxWidth / 2, yPos + 14, { align: 'center' });
  });

  yPos += 28;

  // ===== SECTION 1: T>P OPPORTUNITIES =====
  doc.setFillColor(16, 185, 129); // Success green
  doc.rect(margin, yPos, 4, 10, 'F');
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. T>P Improvement Opportunities', margin + 8, yPos + 7);
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('(10 min)', pageWidth - margin, yPos + 7, { align: 'right' });
  yPos += 14;

  // Top T>P Destinations
  if (data.topTpDestinations.length > 0) {
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Top Performing Destinations (T>P)', margin, yPos);
    yPos += 6;

    const topTpData = data.topTpDestinations.map((dest, i) => [
      `${i + 1}`,
      dest.region,
      `${dest.tpRate.toFixed(1)}%`,
      `${dest.trips}`,
      `${dest.passthroughs}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Destination', 'T>P Rate', 'Trips', 'PTs']],
      body: topTpData,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 9,
        cellPadding: 2,
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { fontStyle: 'bold' },
        2: { halign: 'center', textColor: [16, 185, 129], fontStyle: 'bold' },
        3: { halign: 'center' },
        4: { halign: 'center' },
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Underperforming T>P Destinations
  if (data.tpRecommendations.length > 0) {
    doc.setTextColor(239, 68, 68);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Focus Areas - Below Average', margin, yPos);
    yPos += 6;

    const tpTableData = data.tpRecommendations.map((rec, i) => [
      `${i + 1}`,
      rec.region,
      `${rec.tpRate.toFixed(1)}%`,
      `${rec.departmentAvgRate.toFixed(1)}%`,
      `${Math.abs(rec.deviation).toFixed(1)}pp`,
      `${rec.trips}`,
      `+${Math.round(rec.potentialGain)}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Destination', 'Current', 'Avg', 'Gap', 'Volume', 'Potential']],
      body: tpTableData,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 9,
        cellPadding: 2,
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [239, 68, 68],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { fontStyle: 'bold' },
        2: { halign: 'center', textColor: [239, 68, 68] },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center', textColor: [16, 185, 129], fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  } else if (data.topTpDestinations.length === 0) {
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No significant T>P improvement opportunities identified.', margin, yPos);
    yPos += 10;
  } else {
    yPos += 4;
  }

  // ===== SECTION 2: P>Q OPPORTUNITIES =====
  checkPageBreak(50);
  doc.setFillColor(124, 58, 237); // Purple
  doc.rect(margin, yPos, 4, 10, 'F');
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. P>Q Improvement Opportunities', margin + 8, yPos + 7);
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('(5 min)', pageWidth - margin, yPos + 7, { align: 'right' });
  yPos += 14;

  // Top P>Q Destinations
  if (data.topPqDestinations.length > 0) {
    doc.setTextColor(124, 58, 237);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Top Performing Destinations (P>Q)', margin, yPos);
    yPos += 6;

    const topPqData = data.topPqDestinations.map((dest, i) => [
      `${i + 1}`,
      dest.region,
      `${dest.pqRate.toFixed(1)}%`,
      `${dest.passthroughs}`,
      `${dest.quotes}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Destination', 'P>Q Rate', 'PTs', 'Quotes']],
      body: topPqData,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 9,
        cellPadding: 2,
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [124, 58, 237],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { fontStyle: 'bold' },
        2: { halign: 'center', textColor: [124, 58, 237], fontStyle: 'bold' },
        3: { halign: 'center' },
        4: { halign: 'center' },
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Underperforming P>Q Destinations
  if (data.pqRecommendations.length > 0) {
    doc.setTextColor(239, 68, 68);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Focus Areas - Below Average', margin, yPos);
    yPos += 6;

    const pqTableData = data.pqRecommendations.map((rec, i) => [
      `${i + 1}`,
      rec.region,
      `${rec.tpRate.toFixed(1)}%`,
      `${rec.departmentAvgRate.toFixed(1)}%`,
      `${Math.abs(rec.deviation).toFixed(1)}pp`,
      `${rec.trips}`,
      `+${Math.round(rec.potentialGain)}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Destination', 'Current', 'Avg', 'Gap', 'PTs', 'Potential']],
      body: pqTableData,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 9,
        cellPadding: 2,
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [239, 68, 68],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { fontStyle: 'bold' },
        2: { halign: 'center', textColor: [239, 68, 68] },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center', textColor: [124, 58, 237], fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  } else if (data.topPqDestinations.length === 0) {
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No significant P>Q improvement opportunities identified.', margin, yPos);
    yPos += 10;
  } else {
    yPos += 4;
  }

  // ===== SECTION 3: TOP PERFORMERS (T>P) =====
  checkPageBreak(50);
  doc.setFillColor(16, 185, 129); // Green
  doc.rect(margin, yPos, 4, 10, 'F');
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Top Performers (T>P)', margin + 8, yPos + 7);
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('(5 min)', pageWidth - margin, yPos + 7, { align: 'right' });
  yPos += 14;

  if (data.topAgents.length > 0) {
    data.topAgents.forEach((agent, i) => {
      checkPageBreak(12);
      const medal = i === 0 ? '1st' : i === 1 ? '2nd' : '3rd';
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(margin, yPos, contentWidth / 2 - 3, 10, 1, 1, 'F');

      doc.setTextColor(16, 185, 129);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(medal, margin + 3, yPos + 6);

      doc.setTextColor(31, 41, 55);
      doc.text(agent.name, margin + 15, yPos + 6);

      doc.setTextColor(16, 185, 129);
      doc.text(`${agent.tpRate.toFixed(1)}%`, margin + contentWidth / 2 - 20, yPos + 6);

      yPos += 11;
    });
  } else {
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('No top performer data available.', margin + 4, yPos + 4);
    yPos += 10;
  }

  yPos += 8;

  // ===== SECTION 4: CAPACITY CONSTRAINTS =====
  checkPageBreak(50);
  doc.setFillColor(245, 158, 11); // Amber
  doc.rect(margin, yPos, 4, 10, 'F');
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Availability & Capacity Constraints', margin + 8, yPos + 7);
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

  // ===== SECTION 5: ACTIONS =====
  checkPageBreak(50);
  doc.setFillColor(79, 70, 229); // Primary
  doc.rect(margin, yPos, 4, 10, 'F');
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('5. Actions & Next Steps', margin + 8, yPos + 7);
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('(5 min)', pageWidth - margin, yPos + 7, { align: 'right' });
  yPos += 14;

  const actions = [
    'Review training materials for focus destinations',
    'Share best practices from top performers',
    'Address any capacity constraints identified',
    'Update destination knowledge resources',
    'Set improvement targets for next review',
  ];

  actions.forEach((action) => {
    checkPageBreak(10);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, 'F');

    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.3);
    doc.rect(margin + 3, yPos + 2.5, 3, 3);

    doc.setTextColor(31, 41, 55);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(action, margin + 10, yPos + 5.5);

    yPos += 10;
  });

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
  slide1.background = { color: '0F172A' };

  // Gradient accent bar at top
  slide1.addShape('rect', {
    x: 0, y: 0, w: '100%', h: 0.15,
    fill: { color: '4F46E5' },
  });

  // Main title
  slide1.addText('DEPARTMENT CHAMPS', {
    x: 0.5, y: 1.8, w: 9, h: 0.9,
    fontSize: 48, bold: true, color: 'FFFFFF',
    align: 'center', fontFace: 'Arial',
  });

  // Subtitle
  slide1.addText('Regional Performance', {
    x: 0.5, y: 2.7, w: 9, h: 0.6,
    fontSize: 28, color: '94A3B8',
    align: 'center', fontFace: 'Arial',
  });

  // Divider line
  slide1.addShape('rect', {
    x: 3.5, y: 3.4, w: 3, h: 0.03,
    fill: { color: '4F46E5' },
  });

  // Program name
  slide1.addText(data.program, {
    x: 0.5, y: 3.6, w: 9, h: 0.5,
    fontSize: 24, bold: true, color: 'F59E0B',
    align: 'center', fontFace: 'Arial',
  });

  // Date
  slide1.addText(data.date, {
    x: 0.5, y: 4.3, w: 9, h: 0.4,
    fontSize: 16, color: '64748B',
    align: 'center', fontFace: 'Arial',
  });

  // ===== SLIDE 2: AGENDA =====
  const slide2 = pptx.addSlide();
  slide2.background = { color: '0F172A' };

  addSlideHeader(slide2, 'Meeting Agenda', '30 Minutes');

  const agendaItems = [
    { num: '01', title: 'T>P Improvement Opportunities', time: '10 min', color: '10B981' },
    { num: '02', title: 'P>Q Improvement Opportunities', time: '5 min', color: '7C3AED' },
    { num: '03', title: 'Top Performers (T>P)', time: '5 min', color: '10B981' },
    { num: '04', title: 'Availability & Capacity Constraints', time: '5 min', color: 'F59E0B' },
    { num: '05', title: 'Actions & Next Steps', time: '5 min', color: '4F46E5' },
  ];

  agendaItems.forEach((item, i) => {
    const y = 1.4 + i * 1.0;

    // Card background
    slide2.addShape('rect', {
      x: 0.8, y, w: 8.4, h: 0.85,
      fill: { color: '1E293B' },
      line: { color: item.color, width: 1.5, dashType: 'solid' },
    });

    // Number
    slide2.addText(item.num, {
      x: 1.0, y: y + 0.15, w: 0.6, h: 0.55,
      fontSize: 22, bold: true, color: item.color,
      align: 'center', valign: 'middle', fontFace: 'Arial',
    });

    // Title
    slide2.addText(item.title, {
      x: 1.8, y: y + 0.2, w: 5.5, h: 0.45,
      fontSize: 18, color: 'FFFFFF',
      fontFace: 'Arial',
    });

    // Duration
    slide2.addText(item.time, {
      x: 7.8, y: y + 0.25, w: 1.2, h: 0.35,
      fontSize: 12, color: '64748B',
      align: 'right', fontFace: 'Arial',
    });
  });

  // ===== SLIDE 3: DEPARTMENT OVERVIEW =====
  const slide3 = pptx.addSlide();
  slide3.background = { color: '0F172A' };

  addSlideHeader(slide3, 'Department Overview', data.program);

  const metrics = [
    { label: 'Total Trips', value: data.overallStats.totalTrips.toLocaleString(), color: 'FFFFFF' },
    { label: 'Passthroughs', value: data.overallStats.totalPassthroughs.toLocaleString(), color: 'FFFFFF' },
    { label: 'T>P Rate', value: `${data.overallStats.tpRate.toFixed(1)}%`, color: '10B981' },
    { label: 'Hot Pass Rate', value: `${data.overallStats.hotPassRate.toFixed(1)}%`, color: 'F59E0B' },
    { label: 'P>Q Rate', value: `${data.overallStats.pqRate.toFixed(1)}%`, color: '7C3AED' },
    { label: 'Destinations', value: data.overallStats.destinationsTracked.toString(), color: 'FFFFFF' },
  ];

  metrics.forEach((stat, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.8 + col * 2.9;
    const y = 1.5 + row * 1.8;

    // Card
    slide3.addShape('rect', {
      x, y, w: 2.7, h: 1.5,
      fill: { color: '1E293B' },
      line: { color: '334155', width: 0.5 },
    });

    // Value
    slide3.addText(stat.value, {
      x, y: y + 0.3, w: 2.7, h: 0.7,
      fontSize: 32, bold: true, color: stat.color,
      align: 'center', fontFace: 'Arial',
    });

    // Label
    slide3.addText(stat.label, {
      x, y: y + 1.0, w: 2.7, h: 0.35,
      fontSize: 12, color: '94A3B8',
      align: 'center', fontFace: 'Arial',
    });
  });

  // ===== SLIDE 4: T>P OPPORTUNITIES =====
  const slide4 = pptx.addSlide();
  slide4.background = { color: '0F172A' };

  addSlideHeader(slide4, 'T>P Performance', 'Top & Focus Destinations');

  // Top Performers Section
  if (data.topTpDestinations.length > 0) {
    slide4.addText('Top Performing', { x: 0.5, y: 1.2, w: 4.3, h: 0.3, fontSize: 12, color: '10B981', bold: true, fontFace: 'Arial' });

    // Top T>P header
    slide4.addShape('rect', {
      x: 0.5, y: 1.5, w: 4.3, h: 0.35,
      fill: { color: '10B981' },
    });
    slide4.addText('Destination', { x: 0.6, y: 1.52, w: 2.2, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, fontFace: 'Arial' });
    slide4.addText('Rate', { x: 2.8, y: 1.52, w: 0.9, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', fontFace: 'Arial' });
    slide4.addText('Trips', { x: 3.7, y: 1.52, w: 1, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', fontFace: 'Arial' });

    data.topTpDestinations.slice(0, 5).forEach((dest, i) => {
      const y = 1.88 + i * 0.48;
      const bgColor = i % 2 === 0 ? '1E293B' : '273449';
      slide4.addShape('rect', { x: 0.5, y, w: 4.3, h: 0.45, fill: { color: bgColor } });
      slide4.addText(`${i + 1}. ${dest.region}`, { x: 0.6, y: y + 0.08, w: 2.2, h: 0.3, fontSize: 11, color: 'FFFFFF', fontFace: 'Arial' });
      slide4.addText(`${dest.tpRate.toFixed(1)}%`, { x: 2.8, y: y + 0.08, w: 0.9, h: 0.3, fontSize: 11, color: '10B981', bold: true, align: 'center', fontFace: 'Arial' });
      slide4.addText(`${dest.trips}`, { x: 3.7, y: y + 0.08, w: 1, h: 0.3, fontSize: 11, color: '94A3B8', align: 'center', fontFace: 'Arial' });
    });
  }

  // Focus Areas Section
  if (data.tpRecommendations.length > 0) {
    slide4.addText('Focus Areas', { x: 5.2, y: 1.2, w: 4.3, h: 0.3, fontSize: 12, color: 'EF4444', bold: true, fontFace: 'Arial' });

    // Focus areas header
    slide4.addShape('rect', {
      x: 5.2, y: 1.5, w: 4.3, h: 0.35,
      fill: { color: 'EF4444' },
    });
    slide4.addText('Destination', { x: 5.3, y: 1.52, w: 2, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, fontFace: 'Arial' });
    slide4.addText('Current', { x: 7.3, y: 1.52, w: 0.7, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', fontFace: 'Arial' });
    slide4.addText('Gap', { x: 8.0, y: 1.52, w: 0.6, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', fontFace: 'Arial' });
    slide4.addText('+PTs', { x: 8.6, y: 1.52, w: 0.8, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', fontFace: 'Arial' });

    data.tpRecommendations.slice(0, 5).forEach((rec, i) => {
      const y = 1.88 + i * 0.48;
      const bgColor = i % 2 === 0 ? '1E293B' : '273449';
      slide4.addShape('rect', { x: 5.2, y, w: 4.3, h: 0.45, fill: { color: bgColor } });
      slide4.addText(`${i + 1}. ${rec.region}`, { x: 5.3, y: y + 0.08, w: 2, h: 0.3, fontSize: 11, color: 'FFFFFF', fontFace: 'Arial' });
      slide4.addText(`${rec.tpRate.toFixed(1)}%`, { x: 7.3, y: y + 0.08, w: 0.7, h: 0.3, fontSize: 11, color: 'EF4444', align: 'center', fontFace: 'Arial' });
      slide4.addText(`${Math.abs(rec.deviation).toFixed(1)}pp`, { x: 8.0, y: y + 0.08, w: 0.6, h: 0.3, fontSize: 11, color: '94A3B8', align: 'center', fontFace: 'Arial' });
      slide4.addText(`+${Math.round(rec.potentialGain)}`, { x: 8.6, y: y + 0.08, w: 0.8, h: 0.3, fontSize: 11, color: '10B981', bold: true, align: 'center', fontFace: 'Arial' });
    });
  } else if (data.topTpDestinations.length === 0) {
    addEmptyStateMessage(slide4, 'No T>P destination data available.');
  }

  // ===== SLIDE 5: P>Q OPPORTUNITIES =====
  const slide5 = pptx.addSlide();
  slide5.background = { color: '0F172A' };

  addSlideHeader(slide5, 'P>Q Performance', 'Top & Focus Destinations');

  // Top Performers Section
  if (data.topPqDestinations.length > 0) {
    slide5.addText('Top Performing', { x: 0.5, y: 1.2, w: 4.3, h: 0.3, fontSize: 12, color: '7C3AED', bold: true, fontFace: 'Arial' });

    // Top P>Q header
    slide5.addShape('rect', {
      x: 0.5, y: 1.5, w: 4.3, h: 0.35,
      fill: { color: '7C3AED' },
    });
    slide5.addText('Destination', { x: 0.6, y: 1.52, w: 2.2, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, fontFace: 'Arial' });
    slide5.addText('Rate', { x: 2.8, y: 1.52, w: 0.9, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', fontFace: 'Arial' });
    slide5.addText('Quotes', { x: 3.7, y: 1.52, w: 1, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', fontFace: 'Arial' });

    data.topPqDestinations.slice(0, 5).forEach((dest, i) => {
      const y = 1.88 + i * 0.48;
      const bgColor = i % 2 === 0 ? '1E293B' : '273449';
      slide5.addShape('rect', { x: 0.5, y, w: 4.3, h: 0.45, fill: { color: bgColor } });
      slide5.addText(`${i + 1}. ${dest.region}`, { x: 0.6, y: y + 0.08, w: 2.2, h: 0.3, fontSize: 11, color: 'FFFFFF', fontFace: 'Arial' });
      slide5.addText(`${dest.pqRate.toFixed(1)}%`, { x: 2.8, y: y + 0.08, w: 0.9, h: 0.3, fontSize: 11, color: '7C3AED', bold: true, align: 'center', fontFace: 'Arial' });
      slide5.addText(`${dest.quotes}`, { x: 3.7, y: y + 0.08, w: 1, h: 0.3, fontSize: 11, color: '94A3B8', align: 'center', fontFace: 'Arial' });
    });
  }

  // Focus Areas Section
  if (data.pqRecommendations.length > 0) {
    slide5.addText('Focus Areas', { x: 5.2, y: 1.2, w: 4.3, h: 0.3, fontSize: 12, color: 'EF4444', bold: true, fontFace: 'Arial' });

    // Focus areas header
    slide5.addShape('rect', {
      x: 5.2, y: 1.5, w: 4.3, h: 0.35,
      fill: { color: 'EF4444' },
    });
    slide5.addText('Destination', { x: 5.3, y: 1.52, w: 2, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, fontFace: 'Arial' });
    slide5.addText('Current', { x: 7.3, y: 1.52, w: 0.7, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', fontFace: 'Arial' });
    slide5.addText('Gap', { x: 8.0, y: 1.52, w: 0.6, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', fontFace: 'Arial' });
    slide5.addText('+Qs', { x: 8.6, y: 1.52, w: 0.8, h: 0.3, fontSize: 10, color: 'FFFFFF', bold: true, align: 'center', fontFace: 'Arial' });

    data.pqRecommendations.slice(0, 5).forEach((rec, i) => {
      const y = 1.88 + i * 0.48;
      const bgColor = i % 2 === 0 ? '1E293B' : '273449';
      slide5.addShape('rect', { x: 5.2, y, w: 4.3, h: 0.45, fill: { color: bgColor } });
      slide5.addText(`${i + 1}. ${rec.region}`, { x: 5.3, y: y + 0.08, w: 2, h: 0.3, fontSize: 11, color: 'FFFFFF', fontFace: 'Arial' });
      slide5.addText(`${rec.tpRate.toFixed(1)}%`, { x: 7.3, y: y + 0.08, w: 0.7, h: 0.3, fontSize: 11, color: 'EF4444', align: 'center', fontFace: 'Arial' });
      slide5.addText(`${Math.abs(rec.deviation).toFixed(1)}pp`, { x: 8.0, y: y + 0.08, w: 0.6, h: 0.3, fontSize: 11, color: '94A3B8', align: 'center', fontFace: 'Arial' });
      slide5.addText(`+${Math.round(rec.potentialGain)}`, { x: 8.6, y: y + 0.08, w: 0.8, h: 0.3, fontSize: 11, color: '7C3AED', bold: true, align: 'center', fontFace: 'Arial' });
    });
  } else if (data.topPqDestinations.length === 0) {
    addEmptyStateMessage(slide5, 'No P>Q destination data available.');
  }

  // ===== SLIDE 6: TOP PERFORMERS (T>P) =====
  const slide6 = pptx.addSlide();
  slide6.background = { color: '0F172A' };

  addSlideHeader(slide6, 'Top Performers (T>P)', 'Leading Regional Conversion');

  if (data.topAgents.length > 0) {
    data.topAgents.slice(0, 3).forEach((agent, i) => {
      const y = 1.5 + i * 1.3;
      const medals = ['1st', '2nd', '3rd'];
      const medalColors = ['FFD700', 'C0C0C0', 'CD7F32'];

      // Card
      slide6.addShape('rect', {
        x: 1, y, w: 8, h: 1.1,
        fill: { color: '1E293B' },
        line: { color: '10B981', width: 1 },
      });

      // Medal
      slide6.addShape('rect', {
        x: 1.2, y: y + 0.3, w: 0.6, h: 0.5,
        fill: { color: medalColors[i] },
      });
      slide6.addText(medals[i], {
        x: 1.2, y: y + 0.35, w: 0.6, h: 0.4,
        fontSize: 10, bold: true, color: '1E293B',
        align: 'center', fontFace: 'Arial',
      });

      // Name
      slide6.addText(agent.name, {
        x: 2.0, y: y + 0.2, w: 4, h: 0.4,
        fontSize: 20, bold: true, color: 'FFFFFF',
        fontFace: 'Arial',
      });

      // Rate
      slide6.addText(`${agent.tpRate.toFixed(1)}%`, {
        x: 7.0, y: y + 0.15, w: 1.8, h: 0.5,
        fontSize: 28, bold: true, color: '10B981',
        align: 'right', fontFace: 'Arial',
      });

      // Trips
      slide6.addText(`${agent.trips} trips`, {
        x: 7.0, y: y + 0.65, w: 1.8, h: 0.3,
        fontSize: 12, color: '64748B',
        align: 'right', fontFace: 'Arial',
      });

      // Regions
      if (agent.regions.length > 0) {
        slide6.addText(`Strong: ${agent.regions.slice(0, 3).join(', ')}`, {
          x: 2.0, y: y + 0.65, w: 4.5, h: 0.3,
          fontSize: 11, color: '94A3B8',
          fontFace: 'Arial',
        });
      }
    });
  } else {
    addEmptyStateMessage(slide6, 'No top performer data available.');
  }

  // ===== SLIDE 7: CAPACITY CONSTRAINTS =====
  const slide7 = pptx.addSlide();
  slide7.background = { color: '0F172A' };

  addSlideHeader(slide7, 'Availability & Capacity Constraints', 'Discussion Topics');

  const capacityTopics = [
    { icon: '1', text: 'Any destinations with limited CS availability?' },
    { icon: '2', text: 'Upcoming blackout dates or seasonal constraints?' },
    { icon: '3', text: 'High-demand periods requiring extra support?' },
    { icon: '4', text: 'Supplier capacity issues to be aware of?' },
  ];

  capacityTopics.forEach((topic, i) => {
    const y = 1.4 + i * 0.9;

    // Card
    slide7.addShape('rect', {
      x: 0.8, y, w: 8.4, h: 0.75,
      fill: { color: '1E293B' },
      line: { color: 'F59E0B', width: 1 },
    });

    // Number
    slide7.addText(topic.icon, {
      x: 1.0, y: y + 0.18, w: 0.5, h: 0.4,
      fontSize: 16, bold: true, color: 'F59E0B',
      align: 'center', fontFace: 'Arial',
    });

    // Text
    slide7.addText(topic.text, {
      x: 1.7, y: y + 0.2, w: 7, h: 0.4,
      fontSize: 16, color: 'FFFFFF',
      fontFace: 'Arial',
    });
  });

  // Notes prompt
  slide7.addShape('rect', {
    x: 0.8, y: 5.0, w: 8.4, h: 0.5,
    fill: { color: '0F172A' },
    line: { color: '475569', width: 0.5, dashType: 'dash' },
  });

  slide7.addText('Notes & action items from discussion...', {
    x: 1.0, y: 5.1, w: 8, h: 0.3,
    fontSize: 12, color: '64748B', italic: true,
    fontFace: 'Arial',
  });

  // ===== SLIDE 8: ACTIONS =====
  const slide8 = pptx.addSlide();
  slide8.background = { color: '0F172A' };

  addSlideHeader(slide8, 'Actions & Next Steps', 'Follow-up Items');

  const actions = [
    { icon: '1', text: 'Review training materials for focus destinations' },
    { icon: '2', text: 'Share best practices from top performers' },
    { icon: '3', text: 'Address any capacity constraints identified' },
    { icon: '4', text: 'Update destination knowledge resources' },
    { icon: '5', text: 'Set improvement targets for next review' },
  ];

  actions.forEach((action, i) => {
    const y = 1.4 + i * 0.75;

    // Checkbox
    slide8.addShape('rect', {
      x: 1.0, y: y + 0.1, w: 0.35, h: 0.35,
      line: { color: '4F46E5', width: 1.5 },
      fill: { color: '1E293B' },
    });

    // Number
    slide8.addText(action.icon, {
      x: 1.0, y: y + 0.12, w: 0.35, h: 0.35,
      fontSize: 10, color: '4F46E5',
      align: 'center', valign: 'middle', fontFace: 'Arial',
    });

    // Text
    slide8.addText(action.text, {
      x: 1.6, y: y + 0.08, w: 7.5, h: 0.4,
      fontSize: 16, color: 'FFFFFF',
      fontFace: 'Arial',
    });
  });

  // ===== SLIDE 9: THANK YOU =====
  const slide9 = pptx.addSlide();
  slide9.background = { color: '0F172A' };

  // Accent bar
  slide9.addShape('rect', {
    x: 0, y: 5.45, w: '100%', h: 0.15,
    fill: { color: '4F46E5' },
  });

  slide9.addText('Thank You', {
    x: 0.5, y: 2.0, w: 9, h: 0.8,
    fontSize: 52, bold: true, color: 'FFFFFF',
    align: 'center', fontFace: 'Arial',
  });

  slide9.addText("Let's make it a great month!", {
    x: 0.5, y: 3.0, w: 9, h: 0.5,
    fontSize: 22, color: '4F46E5',
    align: 'center', fontFace: 'Arial',
  });

  slide9.addText('Questions?', {
    x: 0.5, y: 3.7, w: 9, h: 0.4,
    fontSize: 16, color: '64748B',
    align: 'center', fontFace: 'Arial',
  });

  slide9.addText('Generated by GTT KPI Report', {
    x: 0.5, y: 4.8, w: 9, h: 0.3,
    fontSize: 10, color: '475569', italic: true,
    align: 'center', fontFace: 'Arial',
  });

  // Save the file using blob for better browser compatibility
  const fileName = `Department_Champs_${data.program.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pptx`;
  const pptxBlob = await pptx.write({ outputType: 'blob' }) as Blob;
  saveAs(pptxBlob, fileName);
};

// Helper functions

function addSlideHeader(slide: pptxgen.Slide, title: string, subtitle?: string): void {
  // Accent bar
  slide.addShape('rect', {
    x: 0, y: 0, w: '100%', h: 0.08,
    fill: { color: '4F46E5' },
  });

  // Title
  slide.addText(title, {
    x: 0.5, y: 0.3, w: 7, h: 0.6,
    fontSize: 28, bold: true, color: 'FFFFFF',
    fontFace: 'Arial',
  });

  // Subtitle
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5, y: 0.85, w: 7, h: 0.35,
      fontSize: 14, color: '64748B',
      fontFace: 'Arial',
    });
  }
}

function addEmptyStateMessage(slide: pptxgen.Slide, message: string): void {
  slide.addText(message, {
    x: 0.5, y: 2.5, w: 9, h: 0.5,
    fontSize: 16, color: '64748B', italic: true,
    align: 'center', fontFace: 'Arial',
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
