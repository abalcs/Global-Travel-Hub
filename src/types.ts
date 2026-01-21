export interface Agent {
  name: string;
  trips: number;
  quotes: number;
  passthroughs: number;
}

export interface Team {
  id: string;
  name: string;
  agentNames: string[];
}

export interface ParsedData {
  agents: Map<string, Agent>;
}

export interface Metrics {
  agentName: string;
  trips: number;
  quotes: number;
  passthroughs: number;
  hotPasses: number;
  bookings: number;
  nonConvertedLeads: number;
  totalLeads: number;
  quotesFromTrips: number;
  passthroughsFromTrips: number;
  quotesFromPassthroughs: number;
  hotPassRate: number;
  nonConvertedRate: number;
}

export interface FileUploadState {
  passthroughs: File | null;
  trips: File | null;
  quotes: File | null;
  hotPass: File | null;
  bookings: File | null;
  nonConverted: File | null;
}

export interface SeniorDesignation {
  agentNames: string[];
}

// Time-series types for trends visualization
export interface DailyAgentMetrics {
  date: string; // YYYY-MM-DD
  trips: number;
  quotes: number;
  passthroughs: number;
  hotPasses: number;
  bookings: number;
  nonConverted: number;
}

export interface AgentTimeSeries {
  agentName: string;
  dailyMetrics: DailyAgentMetrics[];
}

export interface DailyRatioPoint {
  date: string;
  // Percentage metrics
  tq: number;  // T>Q %
  tp: number;  // T>P %
  pq: number;  // P>Q %
  hp: number;  // Hot Pass % (hot passes / passthroughs)
  nc: number;  // Non-Converted % (non-converted / trips)
  // Raw count metrics
  trips: number;
  quotes: number;
  passthroughs: number;
  bookings: number;
}

// Percentage-based metrics
export type PercentMetricKey = 'tq' | 'tp' | 'pq' | 'hp' | 'nc';
// Raw count metrics
export type CountMetricKey = 'trips' | 'quotes' | 'passthroughs' | 'bookings';
// All metrics
export type MetricKey = PercentMetricKey | CountMetricKey;

export interface TimeSeriesData {
  dateRange: { start: string; end: string };
  agents: AgentTimeSeries[];
  departmentDaily: DailyRatioPoint[];
  seniorDaily: DailyRatioPoint[];
  nonSeniorDaily: DailyRatioPoint[];
}

export interface ChartConfig {
  selectedAgents: string[];
  selectedMetrics: MetricKey[];
  showDeptAvg: boolean;
  showSeniorAvg: boolean;
  showNonSeniorAvg: boolean;
  dateRangeStart: number; // Index into date array
  dateRangeEnd: number;
}

export interface AgentAnalysis {
  agentName: string;
  analysis: string;
  generatedAt: Date;
}

export interface DepartmentAverages {
  avgTrips: number;
  avgQuotes: number;
  avgPassthroughs: number;
  avgHotPasses: number;
  avgBookings: number;
  avgNonConverted: number;
  avgTQ: number;       // T>Q %
  avgTP: number;       // T>P %
  avgPQ: number;       // P>Q %
  avgHotPassRate: number;
  avgNonConvertedRate: number;
}
