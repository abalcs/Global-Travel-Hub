import { useState, useEffect, useCallback, useMemo, Component, type ReactNode, type ErrorInfo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Metrics, Team } from '../../types';
import type { PresentationConfig, TopDestination } from '../../utils/presentationGenerator';
import type { RecentAchievement, DestinationStats, ForecastDestinations } from '../PresentationGenerator';
import { useSlideNavigation } from './hooks/useSlideNavigation';
import { WebPresentationControls } from './WebPresentationControls';
import { downloadHtmlPresentation } from './exportHtml';
import {
  ALL_THEMES,
  getSlideTransition,
  getLayoutStyles,
  type WebPresentationStyle,
} from './webPresentationConfig';

// Error boundary to catch slide rendering errors without breaking navigation
class SlideErrorBoundary extends Component<
  { children: ReactNode; slideName: string; colors: { text: string; background: string; accent: string } },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; slideName: string; colors: { text: string; background: string; accent: string } }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Slides] Error in ${this.props.slideName}:`, error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `#${this.props.colors.background}` }}>
          <div className="text-center p-8">
            <p className="text-2xl font-bold mb-2" style={{ color: `#${this.props.colors.text}` }}>Slide Error</p>
            <p className="text-sm" style={{ color: `#${this.props.colors.accent}` }}>
              {this.props.slideName}: {this.state.error?.message || 'Unknown error'}
            </p>
            <p className="text-xs mt-2 opacity-60" style={{ color: `#${this.props.colors.text}` }}>
              Use arrow keys or click the navigation buttons to continue
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import { WebTitleSlide } from './slides/WebTitleSlide';
import { WebProgressSlide } from './slides/WebProgressSlide';
import { WebTopPerformersSlide } from './slides/WebTopPerformersSlide';
import { WebHotPassRateSlide } from './slides/WebHotPassRateSlide';
import { WebKeyMetricsSlide } from './slides/WebKeyMetricsSlide';
import { WebTopDestinationsSlide } from './slides/WebTopDestinationsSlide';
import { WebLeaderboardSlide } from './slides/WebLeaderboardSlide';
import { WebCascadesSlide } from './slides/WebCascadesSlide';
import { WebForecastDestinationsSlide } from './slides/WebForecastDestinationsSlide';
import { WebClosingSlide } from './slides/WebClosingSlide';

const emptyDestinationStats: DestinationStats = { destinations: [], totalTrips: 0, totalPassthroughs: 0, tpRate: 0 };

interface WebPresentationViewerProps {
  metrics: Metrics[];
  seniors: string[];
  teams: Team[];
  config: PresentationConfig;
  webStyle?: WebPresentationStyle;
  recentAchievements?: RecentAchievement[];
  hotPassDestinations?: TopDestination[];
  repeatStats?: DestinationStats;
  b2bStats?: DestinationStats;
  forecastDestinations?: ForecastDestinations | null;
  onClose: () => void;
}

export const WebPresentationViewer: React.FC<WebPresentationViewerProps> = ({
  metrics,
  seniors,
  teams,
  config,
  webStyle,
  recentAchievements = [],
  hotPassDestinations = [],
  repeatStats = emptyDestinationStats,
  b2bStats = emptyDestinationStats,
  forecastDestinations = null,
  onClose,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('right');

  // Use webStyle theme if provided, otherwise fall back to config theme
  const activeTheme = webStyle?.theme || config.theme;
  const colors = ALL_THEMES[activeTheme];
  const animationStyle = webStyle?.animation || 'slide';
  const layoutStyle = webStyle?.layout || 'default';
  const layout = getLayoutStyles(layoutStyle);

  const TOTAL_SLIDES = 10;

  const {
    currentSlide,
    goToSlide,
    nextSlide,
    prevSlide,
  } = useSlideNavigation({
    totalSlides: TOTAL_SLIDES,
    onExit: onClose,
  });

  // Track direction for slide transitions
  const handleGoToSlide = useCallback((index: number) => {
    setDirection(index > currentSlide ? 'right' : 'left');
    goToSlide(index);
  }, [currentSlide, goToSlide]);

  const handleNext = useCallback(() => {
    setDirection('right');
    nextSlide();
  }, [nextSlide]);

  const handlePrev = useCallback(() => {
    setDirection('left');
    prevSlide();
  }, [prevSlide]);

  // Calculate all the data needed for slides
  const slideData = useMemo(() => {
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

    // Goals are now team totals, not per-person (monthly goals)
    const monthlyGoalPassthroughs = config.monthlyGoalPassthroughs;
    const monthlyGoalQuotes = config.monthlyGoalQuotes;

    // Calculate rates
    const avgHotPassRate = totalPassthroughs > 0 ? (totalHotPasses / totalPassthroughs) * 100 : 0;
    const avgTQRate = totalTrips > 0 ? (totalQuotes / totalTrips) * 100 : 0;
    const avgTPRate = totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0;

    // Calculate department-wide hot pass rate (all agents)
    const deptTotalPassthroughs = metrics.reduce((sum, m) => sum + m.passthroughs, 0);
    const deptTotalHotPasses = metrics.reduce((sum, m) => sum + m.hotPasses, 0);
    const deptAvgHotPassRate = deptTotalPassthroughs > 0 ? (deptTotalHotPasses / deptTotalPassthroughs) * 100 : 0;

    // Sort for top performers (team only)
    const byPassthroughs = [...selectedTeamMetrics]
      .sort((a, b) => b.passthroughs - a.passthroughs)
      .map(m => ({
        agentName: m.agentName,
        value: m.passthroughs,
        isSenior: isSenior(m.agentName),
      }));

    const byQuotes = [...selectedTeamMetrics]
      .sort((a, b) => b.quotes - a.quotes)
      .map(m => ({
        agentName: m.agentName,
        value: m.quotes,
        isSenior: isSenior(m.agentName),
      }));

    const byHotPassRate = [...selectedTeamMetrics]
      .sort((a, b) => b.hotPassRate - a.hotPassRate)
      .map(m => ({
        agentName: m.agentName,
        hotPassRate: m.hotPassRate,
        isSenior: isSenior(m.agentName),
      }));

    // Leaderboard (all agents, top 5 per category)
    const allByQuotes = [...metrics]
      .sort((a, b) => b.quotes - a.quotes)
      .map(m => ({
        agentName: m.agentName,
        value: m.quotes,
        isOnSelectedTeam: isOnSelectedTeam(m.agentName),
        isSenior: isSenior(m.agentName),
      }));

    const allByBookings = [...metrics]
      .sort((a, b) => b.bookings - a.bookings)
      .map(m => ({
        agentName: m.agentName,
        value: m.bookings,
        isOnSelectedTeam: isOnSelectedTeam(m.agentName),
        isSenior: isSenior(m.agentName),
      }));

    const allByHotPassRate = [...metrics]
      .filter(m => m.passthroughs >= 5)
      .sort((a, b) => b.hotPassRate - a.hotPassRate)
      .map(m => ({
        agentName: m.agentName,
        value: m.hotPassRate,
        isOnSelectedTeam: isOnSelectedTeam(m.agentName),
        isSenior: isSenior(m.agentName),
      }));

    // T>Q rate (Trips to Quotes)
    const allByTQRate = [...metrics]
      .filter(m => m.trips >= 5)
      .map(m => ({
        agentName: m.agentName,
        value: m.trips > 0 ? (m.quotes / m.trips) * 100 : 0,
        isOnSelectedTeam: isOnSelectedTeam(m.agentName),
        isSenior: isSenior(m.agentName),
      }))
      .sort((a, b) => b.value - a.value);

    // T>P rate (Trips to Passthroughs)
    const allByTPRate = [...metrics]
      .filter(m => m.trips >= 5)
      .map(m => ({
        agentName: m.agentName,
        value: m.trips > 0 ? (m.passthroughs / m.trips) * 100 : 0,
        isOnSelectedTeam: isOnSelectedTeam(m.agentName),
        isSenior: isSenior(m.agentName),
      }))
      .sort((a, b) => b.value - a.value);

    // P>Q rate (Passthroughs to Quotes)
    const allByPQRate = [...metrics]
      .filter(m => m.passthroughs >= 5)
      .map(m => ({
        agentName: m.agentName,
        value: m.passthroughs > 0 ? (m.quotes / m.passthroughs) * 100 : 0,
        isOnSelectedTeam: isOnSelectedTeam(m.agentName),
        isSenior: isSenior(m.agentName),
      }))
      .sort((a, b) => b.value - a.value);

    return {
      selectedTeamName,
      selectedTeamCount,
      totalPassthroughs,
      totalQuotes,
      totalTrips,
      totalHotPasses,
      totalBookings,
      monthlyGoalPassthroughs,
      monthlyGoalQuotes,
      avgHotPassRate,
      deptAvgHotPassRate,
      avgTQRate,
      avgTPRate,
      byPassthroughs,
      byQuotes,
      byHotPassRate,
      allByQuotes,
      allByBookings,
      allByHotPassRate,
      allByTQRate,
      allByTPRate,
      allByPQRate,
    };
  }, [metrics, seniors, teams, config]);

  // HTML export
  const handleExportHtml = useCallback(() => {
    downloadHtmlPresentation({
      config,
      metrics,
      seniors,
      teams,
    });
  }, [config, metrics, seniors, teams]);

  // Fullscreen handling
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Add F key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen]);

  // Render current slide with error boundary
  const renderSlide = () => {
    const slideNames = ['Title', 'Progress', 'Key Metrics', 'Hot Pass Rate', 'Top Performers',
      'Top Destinations', 'Leaderboard', 'Cascades', 'Forecast', 'Closing'];
    const slideName = slideNames[currentSlide] || `Slide ${currentSlide}`;

    let slideContent: ReactNode;

    switch (currentSlide) {
      case 0:
        slideContent = (
          <WebTitleSlide
            teamName={config.teamName}
            meetingDate={config.meetingDate}
            colors={colors}
            layout={layout}
          />
        );
        break;
      case 1:
        slideContent = (
          <WebProgressSlide
            totalPassthroughs={slideData.totalPassthroughs}
            totalQuotes={slideData.totalQuotes}
            monthlyGoalPassthroughs={slideData.monthlyGoalPassthroughs}
            monthlyGoalQuotes={slideData.monthlyGoalQuotes}
            teamCount={slideData.selectedTeamCount}
            teamName={config.teamName}
            colors={colors}
            layout={layout}
          />
        );
        break;
      case 2:
        slideContent = (
          <WebKeyMetricsSlide
            teamName={slideData.selectedTeamName}
            totalTrips={slideData.totalTrips}
            totalPassthroughs={slideData.totalPassthroughs}
            totalQuotes={slideData.totalQuotes}
            totalHotPasses={slideData.totalHotPasses}
            totalBookings={slideData.totalBookings}
            avgTQRate={slideData.avgTQRate}
            avgTPRate={slideData.avgTPRate}
            repeatStats={repeatStats}
            b2bStats={b2bStats}
            colors={colors}
            layout={layout}
          />
        );
        break;
      case 3:
        slideContent = (
          <WebHotPassRateSlide
            avgHotPassRate={slideData.avgHotPassRate}
            deptAvgHotPassRate={slideData.deptAvgHotPassRate}
            topPerformers={slideData.byHotPassRate}
            hotPassDestinations={hotPassDestinations}
            colors={colors}
            layout={layout}
          />
        );
        break;
      case 4:
        slideContent = (
          <WebTopPerformersSlide
            topPassthroughs={slideData.byPassthroughs}
            topQuotes={slideData.byQuotes}
            teamName={slideData.selectedTeamName}
            recentAchievements={recentAchievements}
            colors={colors}
            layout={layout}
          />
        );
        break;
      case 5:
        slideContent = (
          <WebTopDestinationsSlide
            destinations={config.topDestinations || []}
            agentDestinations={config.agentTopDestinations}
            colors={colors}
            layout={layout}
          />
        );
        break;
      case 6:
        slideContent = (
          <WebLeaderboardSlide
            byQuotes={slideData.allByQuotes}
            byBookings={slideData.allByBookings}
            byHotPassRate={slideData.allByHotPassRate}
            byTPRate={slideData.allByTPRate}
            byPQRate={slideData.allByPQRate}
            byTQRate={slideData.allByTQRate}
            selectedTeamName={slideData.selectedTeamName}
            colors={colors}
            layout={layout}
          />
        );
        break;
      case 7:
        slideContent = (
          <WebCascadesSlide
            cascades={config.cascades}
            colors={colors}
            layout={layout}
          />
        );
        break;
      case 8:
        slideContent = (
          <WebForecastDestinationsSlide
            destinations={forecastDestinations?.destinations || []}
            periodLabel={forecastDestinations?.periodLabel || 'Previous year data unavailable'}
            teamPeriodLabel={forecastDestinations?.teamPeriodLabel}
            colors={colors}
            layout={layout}
          />
        );
        break;
      case 9:
        slideContent = (
          <WebClosingSlide
            teamName={config.teamName}
            colors={colors}
            layout={layout}
          />
        );
        break;
      default:
        slideContent = null;
    }

    return (
      <SlideErrorBoundary key={currentSlide} slideName={slideName} colors={colors}>
        {slideContent}
      </SlideErrorBoundary>
    );
  };

  return (
    <div
      className="flex flex-col"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: `#${colors.background}`,
      }}
    >
      {/* Slide container */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            {...getSlideTransition(animationStyle, direction)}
            className="absolute inset-0"
            style={{ perspective: animationStyle === 'flip' ? 1000 : undefined }}
          >
            {renderSlide()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <WebPresentationControls
        currentSlide={currentSlide}
        totalSlides={TOTAL_SLIDES}
        onNext={handleNext}
        onPrev={handlePrev}
        onGoToSlide={handleGoToSlide}
        onExit={onClose}
        onToggleFullscreen={toggleFullscreen}
        onExportHtml={handleExportHtml}
        isFullscreen={isFullscreen}
        colors={colors}
      />
    </div>
  );
};
