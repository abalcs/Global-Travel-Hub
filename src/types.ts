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
  quotesFromTrips: number;
  passthroughsFromTrips: number;
  quotesFromPassthroughs: number;
}

export interface FileUploadState {
  passthroughs: File | null;
  trips: File | null;
  quotes: File | null;
}
