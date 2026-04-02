import type { Metrics, Team } from '../../types';
import type { PresentationConfig } from '../../utils/presentationGenerator';
import { THEMES, formatDate, formatMonth, getWeekNumber } from '../../utils/presentationGenerator';

interface ExportData {
  config: PresentationConfig;
  metrics: Metrics[];
  seniors: string[];
  teams: Team[];
}

export const generateHtmlPresentation = (data: ExportData): string => {
  const { config, metrics, seniors, teams } = data;
  const colors = THEMES[config.theme];

  // Find selected team
  const selectedTeam = config.selectedTeamId
    ? teams.find(t => t.id === config.selectedTeamId)
    : teams.find(t => t.name.toLowerCase() === 'my team');
  const selectedTeamMembers = selectedTeam?.agentNames || [];
  const selectedTeamCount = selectedTeamMembers.length;
  const selectedTeamName = selectedTeam?.name || 'My Team';

  // Helper functions - trim and normalize names for comparison
  const isOnSelectedTeam = (agentName: string) =>
    selectedTeamMembers.some(m => m.trim().toLowerCase() === agentName.trim().toLowerCase());

  const isSenior = (name: string) =>
    seniors.some(s => s.trim().toLowerCase() === name.trim().toLowerCase());

  // Filter metrics
  const selectedTeamMetrics = metrics.filter(m => isOnSelectedTeam(m.agentName));

  // Calculate totals
  const totalPassthroughs = selectedTeamMetrics.reduce((sum, m) => sum + m.passthroughs, 0);
  const totalQuotes = selectedTeamMetrics.reduce((sum, m) => sum + m.quotes, 0);
  const totalTrips = selectedTeamMetrics.reduce((sum, m) => sum + m.trips, 0);
  const totalHotPasses = selectedTeamMetrics.reduce((sum, m) => sum + m.hotPasses, 0);
  const totalBookings = selectedTeamMetrics.reduce((sum, m) => sum + m.bookings, 0);

  // Goals are now team totals (monthly goals)
  const monthlyGoalPassthroughs = config.monthlyGoalPassthroughs;
  const monthlyGoalQuotes = config.monthlyGoalQuotes;

  // Calculate rates
  const avgHotPassRate = totalPassthroughs > 0 ? (totalHotPasses / totalPassthroughs) * 100 : 0;
  const avgTQRate = totalTrips > 0 ? (totalQuotes / totalTrips) * 100 : 0;
  const avgTPRate = totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0;

  // Sort for top performers
  const byPassthroughs = [...selectedTeamMetrics].sort((a, b) => b.passthroughs - a.passthroughs);
  const byQuotes = [...selectedTeamMetrics].sort((a, b) => b.quotes - a.quotes);
  const byHotPassRate = [...selectedTeamMetrics]
    .sort((a, b) => b.hotPassRate - a.hotPassRate);

  // All agents for leaderboard
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

  const seniorBadge = (name: string) => isSenior(name) ? ' <span class="senior">⚜</span>' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.teamName} - Team Huddle</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden; }
    .presentation { width: 100vw; height: 100vh; position: relative; }
    .slide { position: absolute; inset: 0; display: none; padding: 3rem; flex-direction: column; background: #${colors.background}; }
    .slide.active { display: flex; animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
    .controls { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 1rem; z-index: 100; background: rgba(0,0,0,0.3); padding: 0.75rem 1.5rem; border-radius: 999px; }
    .controls button { background: transparent; border: none; color: #${colors.text}; cursor: pointer; padding: 0.5rem; border-radius: 0.5rem; }
    .controls button:hover { background: rgba(255,255,255,0.1); }
    .controls button:disabled { opacity: 0.3; cursor: not-allowed; }
    .dots { display: flex; gap: 0.5rem; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #${colors.textLight}; cursor: pointer; transition: all 0.2s; }
    .dot.active { background: #${colors.primary}; transform: scale(1.3); }
    .counter { color: #${colors.textLight}; font-size: 0.875rem; margin-left: 1rem; }

    /* Slide specific styles */
    .title { color: #${colors.text}; font-size: 3.5rem; font-weight: bold; margin-bottom: 1rem; }
    .subtitle { color: #${colors.accent}; font-size: 1.75rem; font-weight: bold; margin-bottom: 2rem; }
    .meta { color: #${colors.textLight}; font-size: 1.125rem; margin-bottom: 0.5rem; }
    .section-title { color: #${colors.text}; font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem; }
    .section-line { height: 4px; width: 150px; background: #${colors.accent}; margin-bottom: 1rem; }
    .section-meta { color: #${colors.textLight}; margin-bottom: 1.5rem; }

    .cards { display: flex; gap: 1.5rem; flex: 1; align-items: center; }
    .card { flex: 1; background: #${colors.cardBg}; border-radius: 1rem; padding: 1.5rem; border: 2px solid; }
    .card-label { color: #${colors.textLight}; font-size: 0.875rem; font-weight: bold; letter-spacing: 0.05em; margin-bottom: 1rem; }
    .card-value { font-size: 3.5rem; font-weight: bold; margin-bottom: 1rem; }
    .card-goal { color: #${colors.accent}; font-size: 1.25rem; }
    .card-note { color: #${colors.textLight}; font-size: 0.75rem; margin-top: 0.5rem; }

    .progress { height: 8px; background: rgba(0,0,0,0.2); border-radius: 999px; overflow: hidden; margin-top: 0.75rem; }
    .progress-bar { height: 100%; border-radius: 999px; transition: width 1s ease-out; }

    .performers { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; flex: 1; }
    .performer-section h3 { color: #${colors.accent}; font-size: 1rem; font-weight: bold; margin-bottom: 1rem; }
    .performer-card { background: #${colors.cardBg}; border-radius: 0.75rem; padding: 1rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; }
    .performer-name { color: #${colors.text}; font-weight: bold; display: flex; align-items: center; gap: 0.5rem; }
    .performer-value { font-weight: bold; font-size: 1.25rem; }
    .medal { font-size: 1.5rem; }
    .senior { color: #f59e0b; }

    .hot-pass-content { display: flex; gap: 3rem; align-items: center; flex: 1; }
    .big-rate { font-size: 5rem; font-weight: bold; }
    .rate-label { color: #${colors.textLight}; font-size: 1rem; margin-top: 0.5rem; }
    .top-list { flex: 1; }
    .top-item { display: flex; justify-content: space-between; padding: 0.5rem 0; }
    .top-name { color: #${colors.text}; }
    .top-value { color: #${colors.success}; font-weight: bold; }

    .metrics-grid { display: flex; flex-direction: column; gap: 1rem; flex: 1; }
    .metrics-row { display: flex; gap: 1rem; justify-content: center; }
    .metric-card { width: 180px; background: #${colors.cardBg}; border-radius: 0.75rem; padding: 1.25rem; text-align: center; border: 2px solid; }
    .metric-label { color: #${colors.textLight}; font-size: 0.75rem; font-weight: bold; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
    .metric-value { font-size: 2.5rem; font-weight: bold; }
    .rates-bar { background: #${colors.cardBg}; padding: 1rem; border-radius: 0.75rem; text-align: center; color: #${colors.text}; margin-top: auto; }

    .leaderboard-header { display: flex; justify-content: space-between; align-items: center; }
    .legend { display: flex; align-items: center; gap: 0.5rem; color: #${colors.textLight}; font-size: 0.75rem; }
    .legend-box { width: 16px; height: 16px; background: #${colors.myTeamHighlight}; border-radius: 4px; }
    .leaderboard-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem; flex: 1; margin-top: 1rem; }
    .leaderboard-col h3 { color: #${colors.accent}; font-size: 0.875rem; font-weight: bold; margin-bottom: 1rem; }
    .leaderboard-item { display: flex; justify-content: space-between; padding: 0.375rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-bottom: 2px; }
    .leaderboard-item.highlight { background: #${colors.myTeamHighlight}; }
    .leaderboard-item .name { color: #${colors.textLight}; }
    .leaderboard-item.highlight .name { color: #${colors.text}; font-weight: 600; }

    .cascades-list { display: flex; flex-direction: column; gap: 0.75rem; flex: 1; justify-content: center; }
    .cascade-item { background: #${colors.cardBg}; border: 1px solid #334155; border-radius: 0.75rem; padding: 1rem; color: #${colors.text}; font-size: 1.125rem; }
    .cascade-arrow { color: #${colors.accent}; margin-right: 0.75rem; }
    .no-updates { color: #${colors.textLight}; text-align: center; font-size: 1.125rem; }

    .closing { align-items: center; justify-content: center; text-align: center; }
    .closing .main { font-size: 3.5rem; font-weight: bold; color: #${colors.text}; margin-bottom: 1rem; }
    .closing .sub { font-size: 1.5rem; color: #${colors.accent}; margin-bottom: 3rem; }
    .closing .team { color: #${colors.textLight}; position: absolute; bottom: 3rem; }

    /* Decorative elements */
    .decor { position: absolute; border-radius: 50%; opacity: 0.7; }
  </style>
</head>
<body>
  <div class="presentation">
    <!-- Slide 1: Title -->
    <div class="slide active" id="slide1">
      <div class="decor" style="width: 256px; height: 256px; top: -96px; right: -96px; background: #${colors.primary};"></div>
      <div class="decor" style="width: 192px; height: 192px; top: -64px; right: -64px; background: #${colors.secondary};"></div>
      <div class="decor" style="width: 160px; height: 160px; bottom: -64px; left: -64px; background: #${colors.secondary}; opacity: 0.6;"></div>
      <div style="position: relative; z-index: 1; display: flex; flex-direction: column; justify-content: center; height: 100%;">
        <h1 class="title">${config.teamName}</h1>
        <h2 class="subtitle">TEAM HUDDLE</h2>
        <p class="meta">${formatDate(config.meetingDate)}</p>
        <p class="meta">Week ${getWeekNumber(config.meetingDate)} of ${formatMonth(config.meetingDate)}</p>
      </div>
    </div>

    <!-- Slide 2: Progress -->
    <div class="slide" id="slide2">
      <div class="section-title">PROGRESS</div>
      <div class="section-line"></div>
      <div class="section-meta">${config.teamName} (${selectedTeamCount} members) - Monthly Goals</div>
      <div class="cards">
        <div class="card" style="border-color: #${colors.primary};">
          <div class="card-label">PASSTHROUGHS</div>
          <div class="card-value" style="color: ${totalPassthroughs >= monthlyGoalPassthroughs ? '#' + colors.success : '#' + colors.text};">${totalPassthroughs} / ${monthlyGoalPassthroughs}</div>
          <div class="card-goal">${Math.round((totalPassthroughs / monthlyGoalPassthroughs) * 100)}% of goal</div>
          <div class="progress"><div class="progress-bar" style="width: ${Math.min((totalPassthroughs / monthlyGoalPassthroughs) * 100, 100)}%; background: ${totalPassthroughs >= monthlyGoalPassthroughs ? '#' + colors.success : '#' + colors.primary};"></div></div>
        </div>
        <div class="card" style="border-color: #${colors.secondary};">
          <div class="card-label">QUOTES</div>
          <div class="card-value" style="color: ${totalQuotes >= monthlyGoalQuotes ? '#' + colors.success : '#' + colors.text};">${totalQuotes} / ${monthlyGoalQuotes}</div>
          <div class="card-goal">${Math.round((totalQuotes / monthlyGoalQuotes) * 100)}% of goal</div>
          <div class="progress"><div class="progress-bar" style="width: ${Math.min((totalQuotes / monthlyGoalQuotes) * 100, 100)}%; background: ${totalQuotes >= monthlyGoalQuotes ? '#' + colors.success : '#' + colors.secondary};"></div></div>
        </div>
      </div>
    </div>

    <!-- Slide 3: Top Performers -->
    <div class="slide" id="slide3">
      <div class="section-title">TOP PERFORMERS</div>
      <div class="section-line"></div>
      <div class="section-meta">${selectedTeamName}</div>
      <div class="performers">
        <div class="performer-section">
          <h3 style="color: #${colors.accent};">PASSTHROUGHS</h3>
          ${byPassthroughs.slice(0, 3).map((p, i) => `
            <div class="performer-card" style="border: 2px solid ${['#FFD700', '#C0C0C0', '#CD7F32'][i]};">
              <span class="performer-name"><span class="medal">${['🥇', '🥈', '🥉'][i]}</span> ${p.agentName}${seniorBadge(p.agentName)}</span>
              <span class="performer-value" style="color: #${colors.primary};">${p.passthroughs}</span>
            </div>
          `).join('')}
        </div>
        <div class="performer-section">
          <h3 style="color: #${colors.success};">QUOTES</h3>
          ${byQuotes.slice(0, 3).map((p, i) => `
            <div class="performer-card" style="border: 2px solid ${['#FFD700', '#C0C0C0', '#CD7F32'][i]};">
              <span class="performer-name"><span class="medal">${['🥇', '🥈', '🥉'][i]}</span> ${p.agentName}${seniorBadge(p.agentName)}</span>
              <span class="performer-value" style="color: #${colors.success};">${p.quotes}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Slide 4: Hot Pass Rate -->
    <div class="slide" id="slide4">
      <div class="section-title">HOT PASS RATE</div>
      <div class="section-line"></div>
      <div class="hot-pass-content">
        <div>
          <div class="big-rate" style="color: #${avgHotPassRate >= 60 ? colors.success : avgHotPassRate >= 50 ? colors.warning : colors.text};">${Math.round(avgHotPassRate)}%</div>
          <div class="rate-label">Team Average</div>
        </div>
        <div class="top-list">
          <h3 style="color: #${colors.accent}; font-weight: bold; margin-bottom: 1rem;">Top Performers</h3>
          ${byHotPassRate.slice(0, 5).map(p => `
            <div class="top-item">
              <span class="top-name">${p.agentName}${seniorBadge(p.agentName)}</span>
              <span class="top-value">${p.hotPassRate.toFixed(0)}%</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Slide 5: Key Metrics -->
    <div class="slide" id="slide5">
      <div class="section-title">KEY METRICS</div>
      <div class="section-line"></div>
      <div class="section-meta">${selectedTeamName}</div>
      <div class="metrics-grid">
        <div class="metrics-row">
          <div class="metric-card" style="border-color: #${colors.primary};"><div class="metric-label">TRIPS</div><div class="metric-value" style="color: #${colors.primary};">${totalTrips}</div></div>
          <div class="metric-card" style="border-color: #${colors.secondary};"><div class="metric-label">PASSTHROUGHS</div><div class="metric-value" style="color: #${colors.secondary};">${totalPassthroughs}</div></div>
          <div class="metric-card" style="border-color: #${colors.success};"><div class="metric-label">QUOTES</div><div class="metric-value" style="color: #${colors.success};">${totalQuotes}</div></div>
        </div>
        <div class="metrics-row">
          <div class="metric-card" style="border-color: #${colors.warning};"><div class="metric-label">HOT PASSES</div><div class="metric-value" style="color: #${colors.warning};">${totalHotPasses}</div></div>
          <div class="metric-card" style="border-color: #${colors.accent};"><div class="metric-label">BOOKINGS</div><div class="metric-value" style="color: #${colors.accent};">${totalBookings}</div></div>
        </div>
        <div class="rates-bar">T&gt;Q: ${avgTQRate.toFixed(1)}% &nbsp;&nbsp;|&nbsp;&nbsp; T&gt;P: ${avgTPRate.toFixed(1)}% &nbsp;&nbsp;|&nbsp;&nbsp; Hot Pass: ${avgHotPassRate.toFixed(1)}%</div>
      </div>
    </div>

    <!-- Slide 6: Leaderboard -->
    <div class="slide" id="slide6">
      <div class="leaderboard-header">
        <div>
          <div class="section-title">LEADERBOARD</div>
          <div class="section-line"></div>
          <div class="section-meta">Department Wide</div>
        </div>
        <div class="legend"><div class="legend-box"></div> = ${selectedTeamName}</div>
      </div>
      <div class="leaderboard-grid">
        <div class="leaderboard-col">
          <h3>Quotes</h3>
          ${allByQuotes.slice(0, 5).map((p, i) => `<div class="leaderboard-item ${isOnSelectedTeam(p.agentName) ? 'highlight' : ''}"><span class="name">${i + 1}. ${p.agentName}${seniorBadge(p.agentName)}</span><span>${p.quotes}</span></div>`).join('')}
        </div>
        <div class="leaderboard-col">
          <h3>Bookings</h3>
          ${allByBookings.slice(0, 5).map((p, i) => `<div class="leaderboard-item ${isOnSelectedTeam(p.agentName) ? 'highlight' : ''}"><span class="name">${i + 1}. ${p.agentName}${seniorBadge(p.agentName)}</span><span>${p.bookings}</span></div>`).join('')}
        </div>
        <div class="leaderboard-col">
          <h3>Hot Pass %</h3>
          ${allByHotPassRate.slice(0, 5).map((p, i) => `<div class="leaderboard-item ${isOnSelectedTeam(p.agentName) ? 'highlight' : ''}"><span class="name">${i + 1}. ${p.agentName}${seniorBadge(p.agentName)}</span><span>${p.hotPassRate.toFixed(0)}%</span></div>`).join('')}
        </div>
        <div class="leaderboard-col">
          <h3>T→P %</h3>
          ${allByTPRate.slice(0, 5).map((p, i) => `<div class="leaderboard-item ${isOnSelectedTeam(p.agentName) ? 'highlight' : ''}"><span class="name">${i + 1}. ${p.agentName}${seniorBadge(p.agentName)}</span><span>${p.tpRate.toFixed(0)}%</span></div>`).join('')}
        </div>
        <div class="leaderboard-col">
          <h3>P→Q %</h3>
          ${allByPQRate.slice(0, 5).map((p, i) => `<div class="leaderboard-item ${isOnSelectedTeam(p.agentName) ? 'highlight' : ''}"><span class="name">${i + 1}. ${p.agentName}${seniorBadge(p.agentName)}</span><span>${p.pqRate.toFixed(0)}%</span></div>`).join('')}
        </div>
        <div class="leaderboard-col">
          <h3>T→Q %</h3>
          ${allByTQRate.slice(0, 5).map((p, i) => `<div class="leaderboard-item ${isOnSelectedTeam(p.agentName) ? 'highlight' : ''}"><span class="name">${i + 1}. ${p.agentName}${seniorBadge(p.agentName)}</span><span>${p.tqRate.toFixed(0)}%</span></div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Slide 7: Cascades -->
    <div class="slide" id="slide7">
      <div class="section-title">CASCADES & UPDATES</div>
      <div class="section-line"></div>
      <div class="cascades-list">
        ${config.cascades.length > 0
          ? config.cascades.map(c => `<div class="cascade-item"><span class="cascade-arrow">→</span>${c}</div>`).join('')
          : '<p class="no-updates">No updates for this week</p>'}
      </div>
    </div>

    <!-- Slide 8: Closing -->
    <div class="slide closing" id="slide8">
      <div class="decor" style="width: 192px; height: 192px; top: -96px; left: -96px; background: #${colors.primary};"></div>
      <div class="decor" style="width: 192px; height: 192px; top: -96px; right: -96px; background: #${colors.primary};"></div>
      <div class="decor" style="width: 160px; height: 160px; bottom: -80px; left: -80px; background: #${colors.secondary};"></div>
      <div class="decor" style="width: 160px; height: 160px; bottom: -80px; right: -80px; background: #${colors.secondary};"></div>
      <div class="main">LET'S CRUSH IT!</div>
      <div class="sub">Questions? Discussion? Ideas?</div>
      <div class="team">${config.teamName}</div>
    </div>

    <!-- Controls -->
    <div class="controls">
      <button onclick="prevSlide()" id="prevBtn">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <div class="dots">
        ${Array.from({ length: 8 }, (_, i) => `<div class="dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>`).join('')}
      </div>
      <button onclick="nextSlide()" id="nextBtn">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      </button>
      <span class="counter"><span id="currentSlide">1</span> / 8</span>
    </div>
  </div>

  <script>
    let current = 0;
    const total = 8;

    function updateSlide() {
      document.querySelectorAll('.slide').forEach((s, i) => {
        s.classList.toggle('active', i === current);
      });
      document.querySelectorAll('.dot').forEach((d, i) => {
        d.classList.toggle('active', i === current);
      });
      document.getElementById('currentSlide').textContent = current + 1;
      document.getElementById('prevBtn').disabled = current === 0;
      document.getElementById('nextBtn').disabled = current === total - 1;
    }

    function nextSlide() {
      if (current < total - 1) { current++; updateSlide(); }
    }

    function prevSlide() {
      if (current > 0) { current--; updateSlide(); }
    }

    function goToSlide(n) {
      current = n;
      updateSlide();
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); nextSlide(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prevSlide(); }
      else if (e.key === 'Home') { e.preventDefault(); goToSlide(0); }
      else if (e.key === 'End') { e.preventDefault(); goToSlide(total - 1); }
      else if (e.key >= '1' && e.key <= '8') { e.preventDefault(); goToSlide(parseInt(e.key) - 1); }
    });
  </script>
</body>
</html>`;
};

export const downloadHtmlPresentation = (data: ExportData): void => {
  const html = generateHtmlPresentation(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.config.teamName.replace(/[^a-zA-Z0-9]/g, '_')}_Huddle_${data.config.meetingDate.toISOString().split('T')[0]}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
