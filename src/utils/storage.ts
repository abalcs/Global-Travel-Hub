import type { Team, Metrics, TimeSeriesData, ChartConfig, AgentAnalysis } from '../types';

const TEAMS_STORAGE_KEY = 'kpi-report-teams';
const SENIORS_STORAGE_KEY = 'kpi-report-seniors';
const METRICS_STORAGE_KEY = 'kpi-report-metrics';
const TIMESERIES_STORAGE_KEY = 'kpi-report-timeseries';
const CHART_CONFIG_STORAGE_KEY = 'kpi-report-chart-config';
const ANTHROPIC_API_KEY_STORAGE_KEY = 'kpi-report-anthropic-api-key';
const AGENT_ANALYSIS_STORAGE_KEY = 'kpi-report-agent-analysis';

export const loadTeams = (): Team[] => {
  try {
    const stored = localStorage.getItem(TEAMS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load teams from storage:', error);
  }
  return [];
};

export const saveTeams = (teams: Team[]): void => {
  try {
    localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teams));
  } catch (error) {
    console.error('Failed to save teams to storage:', error);
  }
};

export const loadSeniors = (): string[] => {
  try {
    const stored = localStorage.getItem(SENIORS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load seniors from storage:', error);
  }
  return [];
};

export const saveSeniors = (seniors: string[]): void => {
  try {
    localStorage.setItem(SENIORS_STORAGE_KEY, JSON.stringify(seniors));
  } catch (error) {
    console.error('Failed to save seniors to storage:', error);
  }
};

export const loadMetrics = (): Metrics[] => {
  try {
    const stored = localStorage.getItem(METRICS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load metrics from storage:', error);
  }
  return [];
};

export const saveMetrics = (metrics: Metrics[]): void => {
  try {
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(metrics));
  } catch (error) {
    console.error('Failed to save metrics to storage:', error);
  }
};

export const clearMetrics = (): void => {
  try {
    localStorage.removeItem(METRICS_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear metrics from storage:', error);
  }
};

export const loadTimeSeriesData = (): TimeSeriesData | null => {
  try {
    const stored = localStorage.getItem(TIMESERIES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load time series data from storage:', error);
  }
  return null;
};

export const saveTimeSeriesData = (data: TimeSeriesData): void => {
  try {
    localStorage.setItem(TIMESERIES_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save time series data to storage:', error);
  }
};

export const clearTimeSeriesData = (): void => {
  try {
    localStorage.removeItem(TIMESERIES_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear time series data from storage:', error);
  }
};

export const loadChartConfig = (): ChartConfig | null => {
  try {
    const stored = localStorage.getItem(CHART_CONFIG_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load chart config from storage:', error);
  }
  return null;
};

export const saveChartConfig = (config: ChartConfig): void => {
  try {
    localStorage.setItem(CHART_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save chart config to storage:', error);
  }
};

export const loadAnthropicApiKey = (): string => {
  try {
    const stored = localStorage.getItem(ANTHROPIC_API_KEY_STORAGE_KEY);
    if (stored) {
      return stored;
    }
  } catch (error) {
    console.error('Failed to load Anthropic API key from storage:', error);
  }
  return '';
};

export const saveAnthropicApiKey = (apiKey: string): void => {
  try {
    localStorage.setItem(ANTHROPIC_API_KEY_STORAGE_KEY, apiKey);
  } catch (error) {
    console.error('Failed to save Anthropic API key to storage:', error);
  }
};

export const loadAgentAnalysis = (agentName: string): AgentAnalysis | null => {
  try {
    const stored = localStorage.getItem(AGENT_ANALYSIS_STORAGE_KEY);
    if (stored) {
      const analyses: Record<string, AgentAnalysis> = JSON.parse(stored);
      const analysis = analyses[agentName.toLowerCase()];
      if (analysis) {
        return {
          ...analysis,
          generatedAt: new Date(analysis.generatedAt),
        };
      }
    }
  } catch (error) {
    console.error('Failed to load agent analysis from storage:', error);
  }
  return null;
};

export const saveAgentAnalysis = (analysis: AgentAnalysis): void => {
  try {
    const stored = localStorage.getItem(AGENT_ANALYSIS_STORAGE_KEY);
    const analyses: Record<string, AgentAnalysis> = stored ? JSON.parse(stored) : {};
    analyses[analysis.agentName.toLowerCase()] = analysis;
    localStorage.setItem(AGENT_ANALYSIS_STORAGE_KEY, JSON.stringify(analyses));
  } catch (error) {
    console.error('Failed to save agent analysis to storage:', error);
  }
};

export const clearAgentAnalyses = (): void => {
  try {
    localStorage.removeItem(AGENT_ANALYSIS_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear agent analyses from storage:', error);
  }
};
