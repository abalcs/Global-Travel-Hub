import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TamView } from './TamView';
import type { CrmParsedData } from '../utils/indexedDB';
import type { CrmRow } from '../utils/excelParser';
import type { Metrics } from '../types';
import { ThemeProvider } from '../contexts/ThemeContext';

// Mock Recharts to avoid rendering issues in test environment
vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <div />,
}));

function makeCrmRow(overrides: Partial<CrmRow> = {}): CrmRow {
  return {
    agentName: 'Test Agent',
    quoteName: '',
    tripRef: '',
    destination: 'Italy',
    interest: '',
    channel: 'Partner B2B',
    media: '',
    clientType: '',
    enquiryDate: '',
    passthroughDate: '',
    quoteCreatedDate: '',
    bookingCreatedDate: '',
    depositAcquiredDate: '',
    timeTaken: 0,
    owner: '',
    stage: '',
    orderStatus: '',
    totalAmountBCY: 0,
    dropoutReason: '',
    dropoutStage: '',
    dropoutNotes: '',
    ...overrides,
  };
}

const emptyCrmData: CrmParsedData = {
  enquiries: [],
  passthroughs: [],
  quotes: [],
  bookings: [],
};

const sampleCrmData: CrmParsedData = {
  enquiries: [
    makeCrmRow({ agentName: 'Alice', destination: 'Italy' }),
    makeCrmRow({ agentName: 'Alice', destination: 'France' }),
    makeCrmRow({ agentName: 'Bob', destination: 'Italy' }),
  ],
  passthroughs: [
    makeCrmRow({ agentName: 'Alice', destination: 'Italy' }),
    makeCrmRow({ agentName: 'Bob', destination: 'Italy' }),
  ],
  quotes: [
    makeCrmRow({ agentName: 'Alice', destination: 'Italy' }),
  ],
  bookings: [
    makeCrmRow({ agentName: 'Alice', destination: 'Italy', totalAmountBCY: 5000, timeTaken: 14 }),
  ],
};

const mockMetrics: Metrics[] = [];

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

describe('TamView', () => {
  it('renders empty state when no TAMs configured', () => {
    renderWithTheme(<TamView crmData={sampleCrmData} tams={[]} metrics={mockMetrics} />);
    expect(screen.getByText('No TAM agents configured')).toBeTruthy();
  });

  it('renders empty state when no B2B data', () => {
    renderWithTheme(<TamView crmData={emptyCrmData} tams={['Alice']} metrics={mockMetrics} />);
    expect(screen.getByText('No B2B data found')).toBeTruthy();
  });

  it('renders scorecard when B2B data and TAMs exist', () => {
    renderWithTheme(<TamView crmData={sampleCrmData} tams={['Alice', 'Bob']} metrics={mockMetrics} />);
    expect(screen.getByText('B2B Scorecard')).toBeTruthy();
    expect(screen.getByText('TAM Analytics')).toBeTruthy();
  });

  it('renders all 6 sections with data', () => {
    renderWithTheme(<TamView crmData={sampleCrmData} tams={['Alice', 'Bob']} metrics={mockMetrics} />);
    expect(screen.getByText('B2B Scorecard')).toBeTruthy();
    expect(screen.getByText('B2B Revenue')).toBeTruthy();
    expect(screen.getByText('B2B Conversion Funnel')).toBeTruthy();
    expect(screen.getByText('Destination Performance')).toBeTruthy();
    expect(screen.getByText('TAM Agent Leaderboard')).toBeTruthy();
    expect(screen.getByText('Deal Velocity')).toBeTruthy();
  });

  it('renders with Audley theme', () => {
    // Set theme to audley via localStorage
    localStorage.setItem('gtt-theme-preference', 'audley');
    renderWithTheme(<TamView crmData={sampleCrmData} tams={['Alice', 'Bob']} metrics={mockMetrics} />);
    expect(screen.getByText('TAM Analytics')).toBeTruthy();
    localStorage.removeItem('gtt-theme-preference');
  });

  it('renders with default (dark) theme', () => {
    localStorage.setItem('gtt-theme-preference', 'default');
    renderWithTheme(<TamView crmData={sampleCrmData} tams={['Alice', 'Bob']} metrics={mockMetrics} />);
    expect(screen.getByText('TAM Analytics')).toBeTruthy();
    localStorage.removeItem('gtt-theme-preference');
  });
});
