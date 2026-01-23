import React, { useState } from 'react';
import type { Team } from '../types';

interface ConfigPanelProps {
  teams: Team[];
  onTeamsChange: (teams: Team[]) => void;
  seniors: string[];
  onSeniorsChange: (seniors: string[]) => void;
  newHires: string[];
  onNewHiresChange: (newHires: string[]) => void;
  availableAgents: string[];
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  teams,
  onTeamsChange,
  seniors,
  onSeniorsChange,
  newHires,
  onNewHiresChange,
  availableAgents,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'teams' | 'seniors' | 'newHires'>('teams');
  const [newTeamName, setNewTeamName] = useState('');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const assignedAgents = teams.flatMap((t) => t.agentNames);
  const unassignedAgents = availableAgents.filter((a) => !assignedAgents.includes(a));
  const seniorAgents = availableAgents.filter(a => seniors.includes(a));
  const nonSeniorAgents = availableAgents.filter(a => !seniors.includes(a));
  const newHireAgents = availableAgents.filter(a => newHires.includes(a));
  const nonNewHireAgents = availableAgents.filter(a => !newHires.includes(a));

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) return;
    const newTeam: Team = {
      id: Date.now().toString(),
      name: newTeamName.trim(),
      agentNames: [],
    };
    onTeamsChange([...teams, newTeam]);
    setNewTeamName('');
  };

  const handleDeleteTeam = (teamId: string) => {
    onTeamsChange(teams.filter((t) => t.id !== teamId));
  };

  const handleAddAgentToTeam = (teamId: string, agentName: string) => {
    onTeamsChange(
      teams.map((t) =>
        t.id === teamId ? { ...t, agentNames: [...t.agentNames, agentName] } : t
      )
    );
  };

  const handleRemoveAgentFromTeam = (teamId: string, agentName: string) => {
    onTeamsChange(
      teams.map((t) =>
        t.id === teamId ? { ...t, agentNames: t.agentNames.filter((a) => a !== agentName) } : t
      )
    );
  };

  const handleRenameTeam = (teamId: string, newName: string) => {
    onTeamsChange(teams.map((t) => (t.id === teamId ? { ...t, name: newName } : t)));
    setEditingTeamId(null);
  };

  const toggleSenior = (agentName: string) => {
    if (seniors.includes(agentName)) {
      onSeniorsChange(seniors.filter(s => s !== agentName));
    } else {
      onSeniorsChange([...seniors, agentName]);
    }
  };

  const toggleNewHire = (agentName: string) => {
    if (newHires.includes(agentName)) {
      onNewHiresChange(newHires.filter(n => n !== agentName));
    } else {
      onNewHiresChange([...newHires, agentName]);
    }
  };

  if (availableAgents.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-medium text-white">Configuration</span>
          <div className="flex gap-2">
            <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-xs">
              {teams.length} teams
            </span>
            <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-xs">
              {seniors.length} seniors
            </span>
            <span className="bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded text-xs">
              {newHires.length} new hires
            </span>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-slate-700/50">
          {/* Tabs */}
          <div className="flex border-b border-slate-700/50">
            <button
              onClick={() => setActiveTab('teams')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-all cursor-pointer active:scale-95 ${
                activeTab === 'teams'
                  ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
              }`}
            >
              Teams
            </button>
            <button
              onClick={() => setActiveTab('seniors')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-all cursor-pointer active:scale-95 ${
                activeTab === 'seniors'
                  ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
              }`}
            >
              Seniors
            </button>
            <button
              onClick={() => setActiveTab('newHires')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-all cursor-pointer active:scale-95 ${
                activeTab === 'newHires'
                  ? 'text-sky-400 border-b-2 border-sky-400 bg-sky-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
              }`}
            >
              New Hires
            </button>
          </div>

          <div className="p-4">
            {/* Teams Tab */}
            {activeTab === 'teams' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
                    placeholder="New team name..."
                    className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                  <button
                    onClick={handleCreateTeam}
                    disabled={!newTeamName.trim()}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Add
                  </button>
                </div>

                {teams.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No teams created. Create a team to group agents.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {teams.map((team) => (
                      <div key={team.id} className="bg-slate-900/30 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          {editingTeamId === team.id ? (
                            <input
                              type="text"
                              defaultValue={team.name}
                              autoFocus
                              onBlur={(e) => handleRenameTeam(team.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameTeam(team.id, e.currentTarget.value);
                                if (e.key === 'Escape') setEditingTeamId(null);
                              }}
                              className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                            />
                          ) : (
                            <span className="font-medium text-white text-sm">{team.name}</span>
                          )}
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingTeamId(team.id)}
                              className="p-1 text-slate-400 hover:text-white transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteTeam(team.id)}
                              className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {team.agentNames.map((agent) => (
                            <span
                              key={agent}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs"
                            >
                              {agent}
                              <button
                                onClick={() => handleRemoveAgentFromTeam(team.id, agent)}
                                className="hover:text-red-400"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          ))}
                          {team.agentNames.length === 0 && (
                            <span className="text-xs text-slate-500">No agents</span>
                          )}
                        </div>

                        {unassignedAgents.length > 0 && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAddAgentToTeam(team.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300"
                            defaultValue=""
                          >
                            <option value="" disabled>+ Add agent...</option>
                            {unassignedAgents.map((agent) => (
                              <option key={agent} value={agent}>{agent}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {unassignedAgents.length > 0 && teams.length > 0 && (
                  <div className="pt-3 border-t border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-2">
                      Unassigned: {unassignedAgents.slice(0, 5).join(', ')}
                      {unassignedAgents.length > 5 && ` +${unassignedAgents.length - 5} more`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Seniors Tab */}
            {activeTab === 'seniors' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  Click agents to toggle senior designation. Seniors are tracked separately in comparisons.
                </p>

                {seniorAgents.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                      Seniors ({seniorAgents.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {seniorAgents.map(agent => (
                        <button
                          key={agent}
                          onClick={() => toggleSenior(agent)}
                          className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs hover:bg-amber-500/30 transition-colors"
                        >
                          {agent} ×
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-medium text-slate-400 mb-2">
                    Non-Seniors ({nonSeniorAgents.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {nonSeniorAgents.map(agent => (
                      <button
                        key={agent}
                        onClick={() => toggleSenior(agent)}
                        className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded text-xs hover:bg-amber-500/20 hover:text-amber-400 transition-colors"
                      >
                        {agent}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* New Hires Tab */}
            {activeTab === 'newHires' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  Click agents to toggle new hire designation. New hires can be filtered separately in results.
                </p>

                {newHireAgents.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-sky-400 mb-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                      New Hires ({newHireAgents.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {newHireAgents.map(agent => (
                        <button
                          key={agent}
                          onClick={() => toggleNewHire(agent)}
                          className="px-2 py-1 bg-sky-500/20 text-sky-400 rounded text-xs hover:bg-sky-500/30 transition-colors"
                        >
                          {agent} ×
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-medium text-slate-400 mb-2">
                    Other Agents ({nonNewHireAgents.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {nonNewHireAgents.map(agent => (
                      <button
                        key={agent}
                        onClick={() => toggleNewHire(agent)}
                        className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded text-xs hover:bg-sky-500/20 hover:text-sky-400 transition-colors"
                      >
                        {agent}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};
