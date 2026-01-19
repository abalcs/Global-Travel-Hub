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
