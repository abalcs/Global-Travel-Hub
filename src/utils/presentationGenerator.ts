import PptxGenJS from 'pptxgenjs';
import type { Metrics, Team } from '../types';

export type ThemeStyle = 'audley-brand' | 'dark-modern' | 'light-clean' | 'vibrant-energy' | 'corporate-blue' | 'warm-sunset';

export interface TopDestination {
  destination: string;
  count: number;
}

export interface AgentTopDestination {
  agentName: string;
  destination: string;
  count: number;
}

export interface PresentationConfig {
  teamName: string;
  selectedTeamId: string | null;
  monthlyGoalPassthroughs: number;
  monthlyGoalQuotes: number;
  cascades: string[];
  meetingDate: Date;
  theme: ThemeStyle;
  topDestinations?: TopDestination[];
  agentTopDestinations?: AgentTopDestination[];
}

export interface SlideColors {
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
  'audley-brand': {
    name: 'Audley',
    description: 'Official Audley brand colors - teal and blue',
    preview: ['FFFFFF', '4D726D', '007BC7'],
  },
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

export const THEMES: Record<ThemeStyle, SlideColors> = {
  'audley-brand': {
    primary: '4D726D',      // Audley Teal
    secondary: '007BC7',    // Audley Blue
    accent: '5D8A84',       // Lighter teal
    background: 'FFFFFF',   // Clean white
    cardBg: 'F8FAFB',       // Very light gray
    text: '1E293B',         // Slate 800
    textLight: '64748B',    // Slate 500
    success: '059669',      // Emerald 600
    warning: 'D97706',      // Amber 600
    myTeamHighlight: 'E0F2F1', // Light teal highlight
  },
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

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

export const formatMonth = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'long' });
};

export const getWeekNumber = (date: Date): number => {
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

  // Find selected team (by ID or fall back to "My Team" for backwards compatibility)
  const selectedTeam = config.selectedTeamId
    ? teams.find(t => t.id === config.selectedTeamId)
    : teams.find(t => t.name.toLowerCase() === 'my team');
  const selectedTeamMembers = selectedTeam?.agentNames || [];
  const selectedTeamName = selectedTeam?.name || 'My Team';

  // Helper to check if agent is on the selected team - trim and normalize names
  const isOnSelectedTeam = (agentName: string) =>
    selectedTeamMembers.some(m => m.trim().toLowerCase() === agentName.trim().toLowerCase());

  // Helper to check if agent is a senior - trim and normalize names
  const isSenior = (name: string) =>
    seniors.some(s => s.trim().toLowerCase() === name.trim().toLowerCase());

  // Filter metrics to selected team only
  const selectedTeamMetrics = metrics.filter(m => isOnSelectedTeam(m.agentName));

  // Calculate metrics for My Team only
  const totalPassthroughs = selectedTeamMetrics.reduce((sum, m) => sum + m.passthroughs, 0);
  const totalQuotes = selectedTeamMetrics.reduce((sum, m) => sum + m.quotes, 0);
  const totalTrips = selectedTeamMetrics.reduce((sum, m) => sum + m.trips, 0);
  const totalHotPasses = selectedTeamMetrics.reduce((sum, m) => sum + m.hotPasses, 0);
  const totalBookings = selectedTeamMetrics.reduce((sum, m) => sum + m.bookings, 0);

  // Monthly goals from config
  const monthlyGoalPassthroughs = config.monthlyGoalPassthroughs;
  const monthlyGoalQuotes = config.monthlyGoalQuotes;

  const avgHotPassRate = totalPassthroughs > 0
    ? (totalHotPasses / totalPassthroughs) * 100
    : 0;
  const avgTQRate = totalTrips > 0 ? (totalQuotes / totalTrips) * 100 : 0;
  const avgTPRate = totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0;

  // Sort My Team metrics for top performers
  const byPassthroughs = [...selectedTeamMetrics].sort((a, b) => b.passthroughs - a.passthroughs);
  const byQuotes = [...selectedTeamMetrics].sort((a, b) => b.quotes - a.quotes);
  const byHotPassRate = [...selectedTeamMetrics]
    .sort((a, b) => b.hotPassRate - a.hotPassRate);

  // For leaderboard - use ALL metrics but highlight My Team
  const allByPassthroughs = [...metrics].sort((a, b) => b.passthroughs - a.passthroughs);
  const allByQuotes = [...metrics].sort((a, b) => b.quotes - a.quotes);
  const allByBookings = [...metrics].sort((a, b) => b.bookings - a.bookings);
  const allByHotPassRate = [...metrics]
    .filter(m => m.passthroughs >= 5)
    .sort((a, b) => b.hotPassRate - a.hotPassRate);
  const allByTPRate = [...metrics]
    .filter(m => m.trips >= 5)
    .map(m => ({ ...m, tpRate: m.trips > 0 ? (m.passthroughs / m.trips) * 100 : 0 }))
    .sort((a, b) => b.tpRate - a.tpRate);
  const allByPQRate = [...metrics]
    .filter(m => m.passthroughs >= 5)
    .map(m => ({ ...m, pqRate: m.passthroughs > 0 ? (m.quotes / m.passthroughs) * 100 : 0 }))
    .sort((a, b) => b.pqRate - a.pqRate);
  const allByTQRate = [...metrics]
    .filter(m => m.trips >= 5)
    .map(m => ({ ...m, tqRate: m.trips > 0 ? (m.quotes / m.trips) * 100 : 0 }))
    .sort((a, b) => b.tqRate - a.tqRate);

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

  // ===== SLIDE 2: Progress =====
  const slide2 = pptx.addSlide();
  addSlideBackground(slide2, COLORS);
  addDecorativeElements(slide2, COLORS, 'content');

  slide2.addText('PROGRESS', {
    x: 0.5, y: 0.3, w: 9, h: 0.6,
    fontSize: 32,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.text,
  });
  addHeaderAccent(slide2, COLORS, 0.5, 0.82, 2);

  slide2.addText(config.teamName, {
    x: 0.5, y: 0.85, w: 9, h: 0.3,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.textLight,
  });

  // Calculate progress percentages
  const passthroughsProgress = Math.min((totalPassthroughs / monthlyGoalPassthroughs) * 100, 100);
  const quotesProgress = Math.min((totalQuotes / monthlyGoalQuotes) * 100, 100);

  // Passthroughs card
  slide2.addShape('roundRect', {
    x: 0.5, y: 1.3, w: 4.3, h: 3.2,
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
    x: 0.7, y: 1.9, w: 3.9, h: 0.9,
    fontSize: 52,
    fontFace: 'Arial',
    color: totalPassthroughs >= monthlyGoalPassthroughs ? COLORS.success : COLORS.text,
    bold: true,
  });

  slide2.addText(`Monthly Goal: ${monthlyGoalPassthroughs}`, {
    x: 0.7, y: 2.85, w: 3.9, h: 0.4,
    fontSize: 16,
    fontFace: 'Arial',
    color: COLORS.accent,
  });

  // Progress bar background
  slide2.addShape('roundRect', {
    x: 0.7, y: 3.35, w: 3.9, h: 0.25,
    fill: { type: 'solid', color: '334155' },
    line: { width: 0 },
    rectRadius: 0.1,
  });

  // Progress bar fill
  slide2.addShape('roundRect', {
    x: 0.7, y: 3.35, w: 3.9 * (passthroughsProgress / 100), h: 0.25,
    fill: { type: 'solid', color: totalPassthroughs >= monthlyGoalPassthroughs ? COLORS.success : COLORS.primary },
    line: { width: 0 },
    rectRadius: 0.1,
  });

  slide2.addText(`${passthroughsProgress.toFixed(0)}%`, {
    x: 0.7, y: 3.7, w: 3.9, h: 0.3,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.textLight,
    align: 'center',
  });

  // Quotes card
  slide2.addShape('roundRect', {
    x: 5.2, y: 1.3, w: 4.3, h: 3.2,
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
    x: 5.4, y: 1.9, w: 3.9, h: 0.9,
    fontSize: 52,
    fontFace: 'Arial',
    color: totalQuotes >= monthlyGoalQuotes ? COLORS.success : COLORS.text,
    bold: true,
  });

  slide2.addText(`Monthly Goal: ${monthlyGoalQuotes}`, {
    x: 5.4, y: 2.85, w: 3.9, h: 0.4,
    fontSize: 16,
    fontFace: 'Arial',
    color: COLORS.accent,
  });

  // Progress bar background
  slide2.addShape('roundRect', {
    x: 5.4, y: 3.35, w: 3.9, h: 0.25,
    fill: { type: 'solid', color: '334155' },
    line: { width: 0 },
    rectRadius: 0.1,
  });

  // Progress bar fill
  slide2.addShape('roundRect', {
    x: 5.4, y: 3.35, w: 3.9 * (quotesProgress / 100), h: 0.25,
    fill: { type: 'solid', color: totalQuotes >= monthlyGoalQuotes ? COLORS.success : COLORS.secondary },
    line: { width: 0 },
    rectRadius: 0.1,
  });

  slide2.addText(`${quotesProgress.toFixed(0)}%`, {
    x: 5.4, y: 3.7, w: 3.9, h: 0.3,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.textLight,
    align: 'center',
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

  slide3.addText(selectedTeamName, {
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

  slide5.addText(selectedTeamName, {
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

  // ===== SLIDE 6: Top Destinations =====
  const slide6 = pptx.addSlide();
  addSlideBackground(slide6, COLORS);
  addDecorativeElements(slide6, COLORS, 'content');

  slide6.addText('TOP DESTINATIONS', {
    x: 0.5, y: 0.25, w: 9, h: 0.5,
    fontSize: 32,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.text,
  });
  addHeaderAccent(slide6, COLORS, 0.5, 0.72, 2.8);

  slide6.addText('By Passthroughs', {
    x: 0.5, y: 0.75, w: 4, h: 0.3,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.textLight,
  });

  const destinations = config.topDestinations || [];
  const maxDestCount = destinations.length > 0 ? destinations[0].count : 1;

  if (destinations.length > 0) {
    destinations.slice(0, 5).forEach((dest, i) => {
      const barWidth = (dest.count / maxDestCount) * 7;
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      const yPos = 1.2 + (i * 0.8);

      // Background bar
      slide6.addShape('roundRect', {
        x: 1.5, y: yPos, w: 7.5, h: 0.65,
        fill: { type: 'solid', color: COLORS.cardBg },
        line: { width: 0 },
        rectRadius: 0.1,
      });

      // Fill bar
      slide6.addShape('roundRect', {
        x: 1.5, y: yPos, w: barWidth, h: 0.65,
        fill: { type: 'solid', color: i === 0 ? COLORS.primary : i === 1 ? COLORS.secondary : COLORS.accent },
        line: { width: 0 },
        rectRadius: 0.1,
      });

      // Medal
      slide6.addText(medals[i], {
        x: 0.5, y: yPos + 0.05, w: 0.8, h: 0.5,
        fontSize: 20,
        fontFace: 'Arial',
      });

      // Destination name
      slide6.addText(dest.destination, {
        x: 1.7, y: yPos + 0.1, w: 5, h: 0.45,
        fontSize: 14,
        fontFace: 'Arial',
        color: COLORS.text,
        bold: true,
      });

      // Count
      slide6.addText(`${dest.count}`, {
        x: 7.5, y: yPos + 0.1, w: 1.3, h: 0.45,
        fontSize: 16,
        fontFace: 'Arial',
        color: COLORS.primary,
        bold: true,
        align: 'right',
      });
    });
  } else {
    slide6.addText('No destination data available', {
      x: 0.5, y: 2.5, w: 9, h: 0.5,
      fontSize: 16,
      fontFace: 'Arial',
      color: COLORS.textLight,
      align: 'center',
    });
  }

  // ===== SLIDE 7: Leaderboard (All agents, My Team highlighted) =====
  const slide7 = pptx.addSlide();
  addSlideBackground(slide7, COLORS);
  addDecorativeElements(slide7, COLORS, 'content');

  slide7.addText('LEADERBOARD', {
    x: 0.5, y: 0.25, w: 9, h: 0.5,
    fontSize: 32,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.text,
  });
  addHeaderAccent(slide7, COLORS, 0.5, 0.72, 2.4);

  slide7.addText('Department Wide', {
    x: 0.5, y: 0.75, w: 4, h: 0.3,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.textLight,
  });

  // Legend for My Team highlight
  slide7.addShape('rect', {
    x: 7.5, y: 0.7, w: 0.3, h: 0.3,
    fill: { type: 'solid', color: COLORS.myTeamHighlight },
    line: { width: 0 },
  });
  slide7.addText(`= ${selectedTeamName}`, {
    x: 7.85, y: 0.7, w: 1.5, h: 0.3,
    fontSize: 11,
    fontFace: 'Arial',
    color: COLORS.textLight,
  });

  // Two-row leaderboard layout — top 5 per column
  type LeaderboardCol = { label: string; data: { agentName: string }[]; getValue: (m: Record<string, unknown>) => string; x: number };

  // Row 1: Volume metrics (4 columns)
  const row1Cols: LeaderboardCol[] = [
    { label: 'Passthroughs', data: allByPassthroughs, getValue: (m) => `${m.passthroughs}`, x: 0.3 },
    { label: 'Quotes', data: allByQuotes, getValue: (m) => `${m.quotes}`, x: 2.65 },
    { label: 'Bookings', data: allByBookings, getValue: (m) => `${m.bookings}`, x: 5.0 },
    { label: 'Hot Pass %', data: allByHotPassRate, getValue: (m) => `${(m.hotPassRate as number).toFixed(0)}%`, x: 7.35 },
  ];

  // Row 2: Rate metrics (3 columns, offset for centering)
  const row2Cols: LeaderboardCol[] = [
    { label: 'T→P %', data: allByTPRate, getValue: (m) => `${(m.tpRate as number).toFixed(0)}%`, x: 1.0 },
    { label: 'P→Q %', data: allByPQRate, getValue: (m) => `${(m.pqRate as number).toFixed(0)}%`, x: 3.85 },
    { label: 'T→Q %', data: allByTQRate, getValue: (m) => `${(m.tqRate as number).toFixed(0)}%`, x: 6.7 },
  ];

  const renderPptxLeaderboardRow = (cols: LeaderboardCol[], yStart: number) => {
    cols.forEach(col => {
      slide7.addText(col.label, {
        x: col.x, y: yStart, w: 2.1, h: 0.3,
        fontSize: 11,
        fontFace: 'Arial',
        color: COLORS.accent,
        bold: true,
      });

      col.data.slice(0, 5).forEach((agent, i) => {
        const seniorBadge = getSeniorBadge(isSenior(agent.agentName));
        const isOnMyTeam = isOnSelectedTeam(agent.agentName);
        const value = col.getValue(agent);
        const yPos = yStart + 0.35 + (i * 0.35);

        if (isOnMyTeam) {
          slide7.addShape('roundRect', {
            x: col.x - 0.05, y: yPos - 0.03, w: 2.2, h: 0.33,
            fill: { type: 'solid', color: COLORS.myTeamHighlight },
            line: { width: 0 },
            rectRadius: 0.05,
          });
        }

        slide7.addText(`${i + 1}. ${agent.agentName}${seniorBadge}`, {
          x: col.x, y: yPos, w: 1.6, h: 0.3,
          fontSize: 9,
          fontFace: 'Arial',
          color: isOnMyTeam ? COLORS.text : COLORS.textLight,
          bold: isOnMyTeam,
        });

        slide7.addText(`${value}`, {
          x: col.x + 1.6, y: yPos, w: 0.5, h: 0.3,
          fontSize: 9,
          fontFace: 'Arial',
          color: isOnMyTeam ? COLORS.text : COLORS.textLight,
          bold: isOnMyTeam,
          align: 'right',
        });
      });
    });
  };

  renderPptxLeaderboardRow(row1Cols, 1.1);
  renderPptxLeaderboardRow(row2Cols, 3.35);

  // ===== SLIDE 8: Cascades =====
  const slide8 = pptx.addSlide();
  addSlideBackground(slide8, COLORS);
  addDecorativeElements(slide8, COLORS, 'content');

  slide8.addText('CASCADES & UPDATES', {
    x: 0.5, y: 0.3, w: 9, h: 0.5,
    fontSize: 32,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.text,
  });
  addHeaderAccent(slide8, COLORS, 0.5, 0.78, 3.5);

  if (config.cascades.length > 0) {
    config.cascades.forEach((cascade, i) => {
      slide8.addShape('roundRect', {
        x: 0.5, y: 1 + (i * 0.7), w: 9, h: 0.6,
        fill: { type: 'solid', color: COLORS.cardBg },
        line: { color: '334155', width: 1 },
        rectRadius: 0.1,
      });

      slide8.addText(`→  ${cascade}`, {
        x: 0.7, y: 1.1 + (i * 0.7), w: 8.6, h: 0.4,
        fontSize: 14,
        fontFace: 'Arial',
        color: COLORS.text,
      });
    });
  } else {
    slide8.addText('No updates for this week', {
      x: 0.5, y: 2, w: 9, h: 0.5,
      fontSize: 16,
      fontFace: 'Arial',
      color: COLORS.textLight,
      align: 'center',
    });
  }

  // ===== SLIDE 9: Closing =====
  const slide9 = pptx.addSlide();
  addSlideBackground(slide9, COLORS);
  addDecorativeElements(slide9, COLORS, 'closing');

  slide9.addText("LET'S CRUSH IT!", {
    x: 0.5, y: 1.8, w: 9, h: 1,
    fontSize: 48,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.text,
    align: 'center',
  });

  slide9.addText('Questions? Discussion? Ideas?', {
    x: 0.5, y: 3, w: 9, h: 0.5,
    fontSize: 20,
    fontFace: 'Arial',
    color: COLORS.accent,
    align: 'center',
  });

  slide9.addText(config.teamName, {
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
  selectedTeamId: null,
  monthlyGoalPassthroughs: 350,
  monthlyGoalQuotes: 220,
  cascades: [],
  meetingDate: new Date(),
  theme: 'dark-modern',
  topDestinations: [],
  agentTopDestinations: [],
});
