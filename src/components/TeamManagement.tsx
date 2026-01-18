import React, { useState } from 'react';
import type { Team } from '../types';

interface TeamManagementProps {
  teams: Team[];
  onTeamsChange: (teams: Team[]) => void;
  availableAgents: string[];
}

export const TeamManagement: React.FC<TeamManagementProps> = ({
  teams,
  onTeamsChange,
  availableAgents,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const assignedAgents = teams.flatMap((t) => t.agentNames);
  const unassignedAgents = availableAgents.filter((a) => !assignedAgents.includes(a));

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
        t.id === teamId
          ? { ...t, agentNames: [...t.agentNames, agentName] }
          : t
      )
    );
  };

  const handleRemoveAgentFromTeam = (teamId: string, agentName: string) => {
    onTeamsChange(
      teams.map((t) =>
        t.id === teamId
          ? { ...t, agentNames: t.agentNames.filter((a) => a !== agentName) }
          : t
      )
    );
  };

  const handleRenameTeam = (teamId: string, newName: string) => {
    onTeamsChange(
      teams.map((t) => (t.id === teamId ? { ...t, name: newName } : t))
    );
    setEditingTeam(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 transition-all"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="font-bold text-lg">Team Management</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
            {teams.length} team{teams.length !== 1 ? 's' : ''}
          </span>
        </div>
        <svg
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="p-6 space-y-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
              placeholder="Enter team name..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
            />
            <button
              onClick={handleCreateTeam}
              disabled={!newTeamName.trim()}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Create Team
            </button>
          </div>

          {teams.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p>No teams created yet</p>
              <p className="text-sm">Create a team to group agents together</p>
            </div>
          ) : (
            <div className="space-y-4">
              {teams.map((team) => (
                <div key={team.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    {editingTeam?.id === team.id ? (
                      <input
                        type="text"
                        defaultValue={team.name}
                        autoFocus
                        onBlur={(e) => handleRenameTeam(team.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameTeam(team.id, e.currentTarget.value);
                          } else if (e.key === 'Escape') {
                            setEditingTeam(null);
                          }
                        }}
                        className="px-2 py-1 border rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    ) : (
                      <h3 className="font-semibold text-gray-800">{team.name}</h3>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingTeam(team)}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-all"
                        title="Rename team"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(team.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded transition-all"
                        title="Delete team"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    {team.agentNames.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {team.agentNames.map((agent) => (
                          <span
                            key={agent}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm"
                          >
                            {agent}
                            <button
                              onClick={() => handleRemoveAgentFromTeam(team.id, agent)}
                              className="hover:text-red-600 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 mb-3">No agents assigned</p>
                    )}

                    {unassignedAgents.length > 0 && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddAgentToTeam(team.id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          + Add agent to team...
                        </option>
                        {unassignedAgents.map((agent) => (
                          <option key={agent} value={agent}>
                            {agent}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {unassignedAgents.length > 0 && teams.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-2">
                Unassigned agents ({unassignedAgents.length}):
              </p>
              <div className="flex flex-wrap gap-2">
                {unassignedAgents.map((agent) => (
                  <span
                    key={agent}
                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm"
                  >
                    {agent}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
