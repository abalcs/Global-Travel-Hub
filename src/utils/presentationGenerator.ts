import PptxGenJS from 'pptxgenjs';
import type { Metrics, Team } from '../types';

export type ThemeStyle = 'dark-modern' | 'light-clean' | 'vibrant-energy' | 'corporate-blue' | 'warm-sunset';

export interface PresentationConfig {
  teamName: string;
  weeklyGoalPassthroughsPerPerson: number;
  weeklyGoalQuotesPerPerson: number;
  cascades: string[];
  meetingDate: Date;
  theme: ThemeStyle;
}

interface SlideColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  cardBg: string;
  text: string;
  textLight: string;
  success: string;
  warning: string;
  myTeamHighlight: string;
}

export const THEME_INFO: Record<ThemeStyle, { name: string; description: string; preview: string[] }> = {
  'dark-modern': {
    name: 'Dark & Modern',
    description: 'Sleek dark theme with indigo and violet accents',
    preview: ['0F172A', '4F46E5', '7C3AED'],
  },
  'light-clean': {
    name: 'Light & Clean',
    description: 'Bright, professional with blue accents',
    preview: ['F8FAFC', '3B82F6', '0EA5E9'],
  },
  'vibrant-energy': {
    name: 'Vibrant Energy',
    description: 'Bold colors that pop - pink, purple, and teal',
    preview: ['18181B', 'EC4899', '8B5CF6'],
  },
  'corporate-blue': {
    name: 'Corporate Blue',
    description: 'Classic professional navy and gold',
    preview: ['1E3A5F', '3B82F6', 'F59E0B'],
  },
  'warm-sunset': {
    name: 'Warm Sunset',
    description: 'Friendly orange and coral tones',
    preview: ['1C1917', 'F97316', 'FB7185'],
  },
};

const THEMES: Record<ThemeStyle, SlideColors> = {
  'dark-modern': {
    primary: '4F46E5',      // Indigo
    secondary: '7C3AED',    // Violet
    accent: '06B6D4',       // Cyan
    background: '0F172A',   // Slate 900
    cardBg: '1E293B',       // Slate 800
    text: 'F8FAFC',         // Slate 50
    textLight: '94A3B8',    // Slate 400
    success: '10B981',      // Emerald
    warning: 'F59E0B',      // Amber
    myTeamHighlight: '3B82F6',
  },
  'light-clean': {
    primary: '3B82F6',      // Blue
    secondary: '0EA5E9',    // Sky
    accent: '6366F1',       // Indigo
    background: 'F8FAFC',   // Slate 50
    cardBg: 'E2E8F0',       // Slate 200
    text: '0F172A',         // Slate 900
    textLight: '64748B',    // Slate 500
    success: '10B981',
    warning: 'F59E0B',
    myTeamHighlight: 'BFDBFE',
  },
  'vibrant-energy': {
    primary: 'EC4899',      // Pink
    secondary: '8B5CF6',    // Violet
    accent: '14B8A6',       // Teal
    background: '18181B',   // Zinc 900
    cardBg: '27272A',       // Zinc 800
    text: 'FAFAFA',         // Zinc 50
    textLight: 'A1A1AA',    // Zinc 400
    success: '22C55E',      // Green
    warning: 'FBBF24',      // Yellow
    myTeamHighlight: 'A855F7',
  },
  'corporate-blue': {
    primary: '3B82F6',      // Blue
    secondary: '1D4ED8',    // Blue 700
    accent: 'F59E0B',       // Amber
    background: '1E3A5F',   // Navy
    cardBg: '2D4A6F',       // Navy lighter
    text: 'F8FAFC',
    textLight: 'CBD5E1',    // Slate 300
    success: '22C55E',
    warning: 'F59E0B',
    myTeamHighlight: '60A5FA',
  },
  'warm-sunset': {
    primary: 'F97316',      // Orange
    secondary: 'FB7185',    // Rose
    accent: 'FBBF24',       // Yellow
    background: '1C1917',   // Stone 900
    cardBg: '292524',       // Stone 800
    text: 'FAFAF9',         // Stone 50
    textLight: 'A8A29E',    // Stone 400
    success: '4ADE80',      // Green
    warning: 'FBBF24',
    myTeamHighlight: 'FB923C',
  },
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatMonth = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'long' });
};

const getWeekNumber = (date: Date): number => {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  const dayOfWeek = startOfMonth.getDay();
  return Math.ceil((dayOfMonth + dayOfWeek) / 7);
};

// Helper to add gradient background to slide
const addSlideBackground = (slide: PptxGenJS.Slide, colors: SlideColors) => {
  slide.background = { color: colors.background };
};

// Helper to add decorative elements - enhanced for modern look
const addDecorativeElements = (slide: PptxGenJS.Slide, colors: SlideColors, variant: 'title' | 'content' | 'closing' = 'title') => {
  if (variant === 'title') {
    // Large gradient-like overlapping circles (top right)
    slide.addShape('ellipse', {
      x: 7.5, y: -1.5, w: 4, h: 4,
      fill: { type: 'solid', color: colors.primary },
      line: { width: 0 },
    });
    slide.addShape('ellipse', {
      x: 8.2, y: -0.8, w: 3, h: 3,
      fill: { type: 'solid', color: colors.secondary },
      line: { width: 0 },
    });
    // Bottom left accent cluster
    slide.addShape('ellipse', {
      x: -1, y: 4, w: 2.5, h: 2.5,
      fill: { type: 'solid', color: colors.secondary },
      line: { width: 0 },
    });
    slide.addShape('ellipse', {
      x: 0.3, y: 4.8, w: 1.2, h: 1.2,
      fill: { type: 'solid', color: colors.accent },
      line: { width: 0 },
    });
    // Accent line
    slide.addShape('rect', {
      x: 0.5, y: 4.5, w: 2, h: 0.06,
      fill: { type: 'solid', color: colors.accent },
      line: { width: 0 },
    });
  } else if (variant === 'closing') {
    // Symmetrical design for closing
    slide.addShape('ellipse', {
      x: -1, y: -1, w: 3, h: 3,
      fill: { type: 'solid', color: colors.primary },
      line: { width: 0 },
    });
    slide.addShape('ellipse', {
      x: 8, y: -1, w: 3, h: 3,
      fill: { type: 'solid', color: colors.primary },
      line: { width: 0 },
    });
    slide.addShape('ellipse', {
      x: -1, y: 4, w: 2.5, h: 2.5,
      fill: { type: 'solid', color: colors.secondary },
      line: { width: 0 },
    });
    slide.addShape('ellipse', {
      x: 8.5, y: 4, w: 2.5, h: 2.5,
      fill: { type: 'solid', color: colors.secondary },
      line: { width: 0 },
    });
    // Center accent dots
    slide.addShape('ellipse', {
      x: 4.7, y: 4.8, w: 0.3, h: 0.3,
      fill: { type: 'solid', color: colors.accent },
      line: { width: 0 },
    });
    slide.addShape('ellipse', {
      x: 5.1, y: 4.8, w: 0.2, h: 0.2,
      fill: { type: 'solid', color: colors.textLight },
      line: { width: 0 },
    });
  } else {
    // Content slides - subtle accent
    slide.addShape('rect', {
      x: 0, y: 0, w: 0.08, h: 5.625,
      fill: { type: 'solid', color: colors.primary },
      line: { width: 0 },
    });
    slide.addShape('ellipse', {
      x: 9, y: 4.5, w: 1.5, h: 1.5,
      fill: { type: 'solid', color: colors.secondary },
      line: { width: 0 },
    });
  }
};

// Add header accent line under titles
const addHeaderAccent = (slide: PptxGenJS.Slide, colors: SlideColors, x: number, y: number, width: number) => {
  slide.addShape('rect', {
    x, y, w: width, h: 0.05,
    fill: { type: 'solid', color: colors.accent },
    line: { width: 0 },
  });
};

// Senior badge - using a shield/crest symbol for nobility
const getSeniorBadge = (isSenior: boolean): string => {
  return isSenior ? ' \u269C' : ''; // Fleur-de-lis - noble, distinguished
};

export const generatePresentation = async (
  metrics: Metrics[],
  seniors: string[],
  teams: Team[],
  config: PresentationConfig
): Promise<void> => {
  const pptx = new PptxGenJS();
  const COLORS = THEMES[config.theme];

  // Set presentation properties
  pptx.author = 'Global Travel Hub';
  pptx.title = `${config.teamName} Team Huddle`;
  pptx.subject = 'Weekly Team Huddle';

  // Set default slide size (widescreen)
  pptx.defineLayout({ name: 'CUSTOM', width: 10, height: 5.625 });
  pptx.layout = 'CUSTOM';

  // Find "My Team"
  const myTeam = teams.find(t => t.name.toLowerCase() === 'my team');
  const myTeamMembers = myTeam?.agentNames || [];
  const myTeamCount = myTeamMembers.length;

  // Helper to check if agent is on My Team
  const isMyTeam = (agentName: string) =>
    myTeamMembers.some(m => m.toLowerCase() === agentName.toLowerCase());

  // Helper to check if agent is a senior
  const isSenior = (name: string) =>
    seniors.some(s => s.toLowerCase() === name.toLowerCase());

  // Filter metrics to My Team only
  const myTeamMetrics = metrics.filter(m => isMyTeam(m.agentName));

  // Calculate metrics for My Team only
  const totalPassthroughs = myTeamMetrics.reduce((sum, m) => sum + m.passthroughs, 0);
  const totalQuotes = myTeamMetrics.reduce((sum, m) => sum + m.quotes, 0);
  const totalTrips = myTeamMetrics.reduce((sum, m) => sum + m.trips, 0);
  const totalHotPasses = myTeamMetrics.reduce((sum, m) => sum + m.hotPasses, 0);
  const totalBookings = myTeamMetrics.reduce((sum, m) => sum + m.bookings, 0);

  // Calculate goals based on team size
  const weeklyGoalPassthroughs = config.weeklyGoalPassthroughsPerPerson * myTeamCount;
  const weeklyGoalQuotes = config.weeklyGoalQuotesPerPerson * myTeamCount;

  const avgHotPassRate = totalPassthroughs > 0
    ? (totalHotPasses / totalPassthroughs) * 100
    : 0;
  const avgTQRate = totalTrips > 0 ? (totalQuotes / totalTrips) * 100 : 0;
  const avgTPRate = totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0;

  // Sort My Team metrics for top performers
  const byPassthroughs = [...myTeamMetrics].sort((a, b) => b.passthroughs - a.passthroughs);
  const byQuotes = [...myTeamMetrics].sort((a, b) => b.quotes - a.quotes);
  const byHotPassRate = [...myTeamMetrics]
    .filter(m => m.passthroughs >= 5) // Minimum threshold
    .sort((a, b) => b.hotPassRate - a.hotPassRate);

  // For leaderboard - use ALL metrics but highlight My Team
  const allByQuotes = [...metrics].sort((a, b) => b.quotes - a.quotes);
  const allByBookings = [...metrics].sort((a, b) => b.bookings - a.bookings);
  const allByHotPassRate = [...metrics]
    .filter(m => m.passthroughs >= 5)
    .sort((a, b) => b.hotPassRate - a.hotPassRate);

  // ===== SLIDE 1: Title Slide =====
  const slide1 = pptx.addSlide();
  addSlideBackground(slide1, COLORS);
  addDecorativeElements(slide1, COLORS, 'title');

  slide1.addText(config.teamName, {
    x: 0.5, y: 1.5, w: 9, h: 1.2,
    fontSize: 54,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.text,
  });

  slide1.addText('TEAM HUDDLE', {
    x: 0.5, y: 2.6, w: 9, h: 0.6,
    fontSize: 28,
    fontFace: 'Arial',
    color: COLORS.accent,
    bold: true,
  });

  slide1.addText(formatDate(config.meetingDate), {
    x: 0.5, y: 3.4, w: 9, h: 0.4,
    fontSize: 18,
    fontFace: 'Arial',
    color: COLORS.textLight,
  });

  slide1.addText(`Week ${getWeekNumber(config.meetingDate)} of ${formatMonth(config.meetingDate)}`, {
    x: 0.5, y: 3.9, w: 9, h: 0.4,
    fontSize: 16,
    fontFace: 'Arial',
    color: COLORS.textLight,
  });

  // ===== SLIDE 2: Weekly Goals =====
  const slide2 = pptx.addSlide();
  addSlideBackground(slide2, COLORS);
  addDecorativeElements(slide2, COLORS, 'content');

  slide2.addText('WEEKLY GOALS', {
    x: 0.5, y: 0.3, w: 9, h: 0.6,
    fontSize: 32,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.text,
  });
  addHeaderAccent(slide2, COLORS, 0.5, 0.82, 2.5);

  slide2.addText(`Team of ${myTeamCount}`, {
    x: 0.5, y: 0.85, w: 9, h: 0.3,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.textLight,
  });

  // Passthroughs card
  slide2.addShape('roundRect', {
    x: 0.5, y: 1.3, w: 4.3, h: 3,
    fill: { type: 'solid', color: COLORS.cardBg },
    line: { color: COLORS.primary, width: 2 },
    rectRadius: 0.15,
  });

  slide2.addText('PASSTHROUGHS', {
    x: 0.7, y: 1.5, w: 3.9, h: 0.4,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.textLight,
    bold: true,
  });

  slide2.addText(`${totalPassthroughs}`, {
    x: 0.7, y: 2.1, w: 3.9, h: 1,
    fontSize: 56,
    fontFace: 'Arial',
    color: totalPassthroughs >= weeklyGoalPassthroughs ? COLORS.success : COLORS.text,
    bold: true,
  });

  slide2.addText(`Goal: ${weeklyGoalPassthroughs}`, {
    x: 0.7, y: 3.2, w: 3.9, h: 0.4,
    fontSize: 18,
    fontFace: 'Arial',
    color: COLORS.accent,
  });

  slide2.addText(`(${config.weeklyGoalPassthroughsPerPerson} per person)`, {
    x: 0.7, y: 3.6, w: 3.9, h: 0.3,
    fontSize: 12,
    fontFace: 'Arial',
    color: COLORS.textLight,
  });

  // Quotes card
  slide2.addShape('roundRect', {
    x: 5.2, y: 1.3, w: 4.3, h: 3,
    fill: { type: 'solid', color: COLORS.cardBg },
    line: { color: COLORS.secondary, width: 2 },
    rectRadius: 0.15,
  });

  slide2.addText('QUOTES', {
    x: 5.4, y: 1.5, w: 3.9, h: 0.4,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.textLight,
    bold: true,
  });

  slide2.addText(`${totalQuotes}`, {
    x: 5.4, y: 2.1, w: 3.9, h: 1,
    fontSize: 56,
    fontFace: 'Arial',
    color: totalQuotes >= weeklyGoalQuotes ? COLORS.success : COLORS.text,
    bold: true,
  });

  slide2.addText(`Goal: ${weeklyGoalQuotes}`, {
    x: 5.4, y: 3.2, w: 3.9, h: 0.4,
    fontSize: 18,
    fontFace: 'Arial',
    color: COLORS.accent,
  });

  slide2.addText(`(${config.weeklyGoalQuotesPerPerson} per person)`, {
    x: 5.4, y: 3.6, w: 3.9, h: 0.3,
    fontSize: 12,
    fontFace: 'Arial',
    color: COLORS.textLight,
  });

  // ===== SLIDE 3: Top Performers - My Team =====
  const slide3 = pptx.addSlide();
  addSlideBackground(slide3, COLORS);
  addDecorativeElements(slide3, COLORS, 'content');

  slide3.addText('TOP PERFORMERS', {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 32,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.text,
  });
  addHeaderAccent(slide3, COLORS, 0.5, 0.68, 2.8);

  slide3.addText('My Team', {
    x: 0.5, y: 0.7, w: 9, h: 0.3,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.textLight,
  });

  // Passthroughs section
  slide3.addText('PASSTHROUGHS', {
    x: 0.5, y: 1.1, w: 4.5, h: 0.4,
    fontSize: 16,
    fontFace: 'Arial',
    color: COLORS.accent,
    bold: true,
  });

  const top3PT = byPassthroughs.slice(0, 3);
  top3PT.forEach((agent, i) => {
    const seniorBadge = getSeniorBadge(isSenior(agent.agentName));
    const medals = ['🥇', '🥈', '🥉'];
    const yPos = 1.55 + (i * 0.9);

    slide3.addShape('roundRect', {
      x: 0.5, y: yPos, w: 4.3, h: 0.8,
      fill: { type: 'solid', color: COLORS.cardBg },
      line: { color: i === 0 ? 'FFD700' : i === 1 ? 'C0C0C0' : 'CD7F32', width: 2 },
      rectRadius: 0.1,
    });

    slide3.addText(`${medals[i]} ${agent.agentName}${seniorBadge}`, {
      x: 0.7, y: yPos + 0.15, w: 3, h: 0.5,
      fontSize: 16,
      fontFace: 'Arial',
      color: COLORS.text,
      bold: true,
    });

    slide3.addText(`${agent.passthroughs}`, {
      x: 3.7, y: yPos + 0.15, w: 1, h: 0.5,
      fontSize: 20,
      fontFace: 'Arial',
      color: COLORS.primary,
      bold: true,
      align: 'right',
    });
  });

  // Quotes section
  slide3.addText('QUOTES', {
    x: 5.2, y: 1.1, w: 4.5, h: 0.4,
    fontSize: 16,
    fontFace: 'Arial',
    color: COLORS.success,
    bold: true,
  });

  const top3Q = byQuotes.slice(0, 3);
  top3Q.forEach((agent, i) => {
    const seniorBadge = getSeniorBadge(isSenior(agent.agentName));
    const medals = ['🥇', '🥈', '🥉'];
    const yPos = 1.55 + (i * 0.9);

    slide3.addShape('roundRect', {
      x: 5.2, y: yPos, w: 4.3, h: 0.8,
      fill: { type: 'solid', color: COLORS.cardBg },
      line: { color: i === 0 ? 'FFD700' : i === 1 ? 'C0C0C0' : 'CD7F32', width: 2 },
      rectRadius: 0.1,
    });

    slide3.addText(`${medals[i]} ${agent.agentName}${seniorBadge}`, {
      x: 5.4, y: yPos + 0.15, w: 3, h: 0.5,
      fontSize: 16,
      fontFace: 'Arial',
      color: COLORS.text,
      bold: true,
    });

    slide3.addText(`${agent.quotes}`, {
      x: 8.4, y: yPos + 0.15, w: 1, h: 0.5,
      fontSize: 20,
      fontFace: 'Arial',
      color: COLORS.success,
      bold: true,
      align: 'right',
    });
  });

  // ===== SLIDE 4: Hot Pass Rate =====
  const slide4 = pptx.addSlide();
  addSlideBackground(slide4, COLORS);
  addDecorativeElements(slide4, COLORS, 'content');

  slide4.addText('HOT PASS RATE', {
    x: 0.5, y: 0.3, w: 9, h: 0.5,
    fontSize: 32,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.text,
  });
  addHeaderAccent(slide4, COLORS, 0.5, 0.78, 2.5);

  // Main rate display
  slide4.addText(`${avgHotPassRate.toFixed(0)}%`, {
    x: 0.5, y: 1.2, w: 4, h: 1.2,
    fontSize: 72,
    fontFace: 'Arial',
    color: avgHotPassRate >= 60 ? COLORS.success : avgHotPassRate >= 50 ? COLORS.warning : COLORS.text,
    bold: true,
  });

  slide4.addText('Team Average', {
    x: 0.5, y: 2.4, w: 4, h: 0.4,
    fontSize: 16,
    fontFace: 'Arial',
    color: COLORS.textLight,
  });

  // Top 5 Hot Pass performers (My Team)
  slide4.addText('Top Performers', {
    x: 5, y: 1.2, w: 4.5, h: 0.4,
    fontSize: 16,
    fontFace: 'Arial',
    color: COLORS.accent,
    bold: true,
  });

  byHotPassRate.slice(0, 5).forEach((agent, i) => {
    const seniorBadge = getSeniorBadge(isSenior(agent.agentName));
    slide4.addText(`${agent.agentName}${seniorBadge}`, {
      x: 5, y: 1.7 + (i * 0.45), w: 3, h: 0.4,
      fontSize: 14,
      fontFace: 'Arial',
      color: COLORS.text,
    });
    slide4.addText(`${agent.hotPassRate.toFixed(0)}%`, {
      x: 8, y: 1.7 + (i * 0.45), w: 1.5, h: 0.4,
      fontSize: 14,
      fontFace: 'Arial',
      color: COLORS.success,
      bold: true,
      align: 'right',
    });
  });

  // ===== SLIDE 5: Key Metrics Overview (My Team Only) =====
  const slide5 = pptx.addSlide();
  addSlideBackground(slide5, COLORS);
  addDecorativeElements(slide5, COLORS, 'content');

  slide5.addText('KEY METRICS', {
    x: 0.5, y: 0.25, w: 6, h: 0.5,
    fontSize: 32,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.text,
  });
  addHeaderAccent(slide5, COLORS, 0.5, 0.72, 2.2);

  slide5.addText('My Team', {
    x: 0.5, y: 0.75, w: 6, h: 0.3,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.textLight,
  });

  const metricsData = [
    { label: 'Trips', value: totalTrips, color: COLORS.primary },
    { label: 'Passthroughs', value: totalPassthroughs, color: COLORS.secondary },
    { label: 'Quotes', value: totalQuotes, color: COLORS.success },
    { label: 'Hot Passes', value: totalHotPasses, color: COLORS.warning },
    { label: 'Bookings', value: totalBookings, color: COLORS.accent },
  ];

  // 5 cards in a nice grid layout - 3 on top, 2 on bottom centered
  const cardWidth = 2.8;
  const cardHeight = 1.6;
  const topRowY = 1.15;
  const bottomRowY = 2.95;

  metricsData.forEach((metric, i) => {
    let x: number, y: number;
    if (i < 3) {
      // Top row - 3 cards
      x = 0.5 + (i * (cardWidth + 0.3));
      y = topRowY;
    } else {
      // Bottom row - 2 cards centered
      x = 0.5 + ((cardWidth + 0.3) * 0.5) + ((i - 3) * (cardWidth + 0.3));
      y = bottomRowY;
    }

    slide5.addShape('roundRect', {
      x, y, w: cardWidth, h: cardHeight,
      fill: { type: 'solid', color: COLORS.cardBg },
      line: { color: metric.color, width: 2 },
      rectRadius: 0.12,
    });

    slide5.addText(metric.label.toUpperCase(), {
      x, y: y + 0.2, w: cardWidth, h: 0.3,
      fontSize: 11,
      fontFace: 'Arial',
      color: COLORS.textLight,
      align: 'center',
      bold: true,
    });

    slide5.addText(`${metric.value}`, {
      x, y: y + 0.55, w: cardWidth, h: 0.8,
      fontSize: 40,
      fontFace: 'Arial',
      color: metric.color,
      bold: true,
      align: 'center',
    });
  });

  // Rates at the bottom
  slide5.addShape('roundRect', {
    x: 0.5, y: 4.75, w: 9, h: 0.6,
    fill: { type: 'solid', color: COLORS.cardBg },
    rectRadius: 0.1,
  });

  slide5.addText(`T>Q: ${avgTQRate.toFixed(1)}%     |     T>P: ${avgTPRate.toFixed(1)}%     |     Hot Pass: ${avgHotPassRate.toFixed(1)}%`, {
    x: 0.5, y: 4.85, w: 9, h: 0.4,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.text,
    align: 'center',
  });

  // ===== SLIDE 6: Leaderboard (All agents, My Team highlighted) =====
  const slide6 = pptx.addSlide();
  addSlideBackground(slide6, COLORS);
  addDecorativeElements(slide6, COLORS, 'content');

  slide6.addText('LEADERBOARD', {
    x: 0.5, y: 0.25, w: 9, h: 0.5,
    fontSize: 32,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.text,
  });
  addHeaderAccent(slide6, COLORS, 0.5, 0.72, 2.4);

  slide6.addText('Department Wide', {
    x: 0.5, y: 0.75, w: 4, h: 0.3,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.textLight,
  });

  // Legend for My Team highlight
  slide6.addShape('rect', {
    x: 7.5, y: 0.7, w: 0.3, h: 0.3,
    fill: { type: 'solid', color: COLORS.myTeamHighlight },
    line: { width: 0 },
  });
  slide6.addText('= My Team', {
    x: 7.85, y: 0.7, w: 1.5, h: 0.3,
    fontSize: 11,
    fontFace: 'Arial',
    color: COLORS.textLight,
  });

  // Column headers
  const columns = [
    { label: 'Quotes', data: allByQuotes, x: 0.5, valueKey: 'quotes' as const },
    { label: 'Bookings', data: allByBookings, x: 3.5, valueKey: 'bookings' as const },
    { label: 'Hot Pass %', data: allByHotPassRate, x: 6.5, valueKey: 'hotPassRate' as const, isRate: true },
  ];

  columns.forEach(col => {
    slide6.addText(col.label, {
      x: col.x, y: 1.1, w: 2.8, h: 0.4,
      fontSize: 14,
      fontFace: 'Arial',
      color: COLORS.accent,
      bold: true,
    });

    col.data.slice(0, 8).forEach((agent, i) => {
      const seniorBadge = getSeniorBadge(isSenior(agent.agentName));
      const isOnMyTeam = isMyTeam(agent.agentName);
      const value = col.isRate
        ? `${agent.hotPassRate.toFixed(0)}%`
        : agent[col.valueKey];

      const yPos = 1.55 + (i * 0.45);

      // Highlight background for My Team members
      if (isOnMyTeam) {
        slide6.addShape('roundRect', {
          x: col.x - 0.05, y: yPos - 0.05, w: 2.9, h: 0.4,
          fill: { type: 'solid', color: COLORS.myTeamHighlight },
          line: { width: 0 },
          rectRadius: 0.05,
        });
      }

      slide6.addText(`${i + 1}. ${agent.agentName}${seniorBadge}`, {
        x: col.x, y: yPos, w: 2.2, h: 0.35,
        fontSize: 11,
        fontFace: 'Arial',
        color: isOnMyTeam ? COLORS.text : COLORS.textLight,
        bold: isOnMyTeam,
      });

      slide6.addText(`${value}`, {
        x: col.x + 2.2, y: yPos, w: 0.6, h: 0.35,
        fontSize: 11,
        fontFace: 'Arial',
        color: isOnMyTeam ? COLORS.text : COLORS.textLight,
        bold: isOnMyTeam,
        align: 'right',
      });
    });
  });

  // ===== SLIDE 7: Cascades =====
  const slide7 = pptx.addSlide();
  addSlideBackground(slide7, COLORS);
  addDecorativeElements(slide7, COLORS, 'content');

  slide7.addText('CASCADES & UPDATES', {
    x: 0.5, y: 0.3, w: 9, h: 0.5,
    fontSize: 32,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.text,
  });
  addHeaderAccent(slide7, COLORS, 0.5, 0.78, 3.5);

  if (config.cascades.length > 0) {
    config.cascades.forEach((cascade, i) => {
      slide7.addShape('roundRect', {
        x: 0.5, y: 1 + (i * 0.7), w: 9, h: 0.6,
        fill: { type: 'solid', color: COLORS.cardBg },
        line: { color: '334155', width: 1 },
        rectRadius: 0.1,
      });

      slide7.addText(`→  ${cascade}`, {
        x: 0.7, y: 1.1 + (i * 0.7), w: 8.6, h: 0.4,
        fontSize: 14,
        fontFace: 'Arial',
        color: COLORS.text,
      });
    });
  } else {
    slide7.addText('No updates for this week', {
      x: 0.5, y: 2, w: 9, h: 0.5,
      fontSize: 16,
      fontFace: 'Arial',
      color: COLORS.textLight,
      align: 'center',
    });
  }

  // ===== SLIDE 8: Closing =====
  const slide8 = pptx.addSlide();
  addSlideBackground(slide8, COLORS);
  addDecorativeElements(slide8, COLORS, 'closing');

  slide8.addText("LET'S CRUSH IT!", {
    x: 0.5, y: 1.8, w: 9, h: 1,
    fontSize: 48,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.text,
    align: 'center',
  });

  slide8.addText('Questions? Discussion? Ideas?', {
    x: 0.5, y: 3, w: 9, h: 0.5,
    fontSize: 20,
    fontFace: 'Arial',
    color: COLORS.accent,
    align: 'center',
  });

  slide8.addText(config.teamName, {
    x: 0.5, y: 4.5, w: 9, h: 0.4,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.textLight,
    align: 'center',
  });

  // Generate and download
  const fileName = `${config.teamName.replace(/[^a-zA-Z0-9]/g, '_')}_Huddle_${config.meetingDate.toISOString().split('T')[0]}.pptx`;
  await pptx.writeFile({ fileName });
};

export const getDefaultConfig = (): PresentationConfig => ({
  teamName: 'Team GTT',
  weeklyGoalPassthroughsPerPerson: 11,  // 88 / 8 people
  weeklyGoalQuotesPerPerson: 7,          // 56 / 8 people
  cascades: [],
  meetingDate: new Date(),
  theme: 'dark-modern',
});
