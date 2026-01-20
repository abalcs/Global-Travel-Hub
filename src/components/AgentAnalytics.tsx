import { useState, useEffect, useCallback } from 'react';
import type { Metrics } from '../types';
import { analyzeAgent } from '../utils/agentAnalytics';
import {
  loadAnthropicApiKey,
  saveAnthropicApiKey,
  loadAgentAnalysis,
  saveAgentAnalysis,
} from '../utils/storage';

interface AgentAnalyticsProps {
  metrics: Metrics[];
  seniors: string[];
}

export const AgentAnalytics: React.FC<AgentAnalyticsProps> = ({
  metrics,
  seniors,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  useEffect(() => {
    const storedKey = loadAnthropicApiKey();
    if (storedKey) {
      setApiKey(storedKey);
      setApiKeySaved(true);
    }
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      const cached = loadAgentAnalysis(selectedAgent);
      if (cached) {
        setAnalysis(cached.analysis);
        setGeneratedAt(cached.generatedAt);
      } else {
        setAnalysis(null);
        setGeneratedAt(null);
      }
    }
  }, [selectedAgent]);

  const handleSaveApiKey = useCallback(() => {
    if (apiKey) {
      saveAnthropicApiKey(apiKey);
      setApiKeySaved(true);
    }
  }, [apiKey]);

  const handleGenerateAnalysis = useCallback(async () => {
    if (!selectedAgent) {
      setError('Please select an agent');
      return;
    }
    if (!apiKey) {
      setError('Please enter your Anthropic API key');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await analyzeAgent(selectedAgent, metrics, seniors, apiKey);
      const now = new Date();
      setAnalysis(result);
      setGeneratedAt(now);
      saveAgentAnalysis({
        agentName: selectedAgent,
        analysis: result,
        generatedAt: now,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to generate analysis';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAgent, apiKey, metrics, seniors]);

  const sortedAgents = [...metrics]
    .sort((a, b) => a.agentName.localeCompare(b.agentName))
    .map((m) => m.agentName);

  const renderAnalysis = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <h4 key={index} className="font-bold text-white mt-4 mb-2">
            {line.replace(/\*\*/g, '')}
          </h4>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <li key={index} className="ml-4 text-slate-300 mb-1">
            {line.substring(2)}
          </li>
        );
      }
      if (line.trim()) {
        return (
          <p key={index} className="text-slate-300 mb-2">
            {line}
          </p>
        );
      }
      return null;
    });
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
        <svg
          className="w-6 h-6 text-purple-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        AI Agent Analytics
      </h2>

      <div className="space-y-4">
        {/* Agent Selector */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Select Agent
          </label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">-- Select an agent --</option>
            {sortedAgents.map((agent) => (
              <option key={agent} value={agent}>
                {agent}
              </option>
            ))}
          </select>
        </div>

        {/* API Key Input - only show if not saved */}
        {!apiKeySaved && (
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Anthropic API Key
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showApiKey ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              <button
                onClick={handleSaveApiKey}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Your API key is stored locally and never sent to our servers
            </p>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerateAnalysis}
          disabled={isLoading || !selectedAgent || !apiKey}
          className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Generating Analysis...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Generate Analysis
            </>
          )}
        </button>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Analysis Results */}
        {analysis && selectedAgent && (
          <div className="mt-6 p-6 bg-slate-700/30 rounded-xl border border-slate-600/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Analysis for: {selectedAgent}
              </h3>
              {generatedAt && (
                <span className="text-xs text-slate-500">
                  Generated: {generatedAt.toLocaleString()}
                </span>
              )}
            </div>
            <div className="prose prose-invert prose-sm max-w-none">
              <ul className="list-none p-0 m-0">{renderAnalysis(analysis)}</ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
