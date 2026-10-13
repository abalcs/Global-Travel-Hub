import { useState, useEffect, useCallback, useMemo, Component, type ReactNode, type ErrorInfo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Metrics, Team } from '../../types';
import type { PresentationConfig, TopDestination } from '../../utils/presentationGenerator';
import type { DestinationStats } from '../PresentationGenerator';
import { useSlideNavigation } from './hooks/useSlideNavigation';
import { WebPresentationControls } from './WebPresentationControls';
import { downloadHtmlPresentation } from './exportHtml';
import {
  ALL_THEMES,
  getSlideTransition,
  getLayoutStyles,
  type WebPresentationStyle,
} from './webPresentationConfig';
import type { SegmentData } from './slides/WebKeyMetricsSlide';

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
import { WebHotPassRateSlide } from './slides/WebHotPassRateSlide';
import { WebKeyMetricsSlide } from './slides/WebKeyMetricsSlide';
import { WebTopDestinationsSlide } from './slides/WebTopDestinationsSlide';
import { WebLeaderboardSlide } from './slides/WebLeaderboardSlide';
import { WebCascadesSlide } from './slides/WebCascadesSlide';
import { WebClosingSlide } from './slides/WebClosingSlide';

const emptyDestinationStats: DestinationStats = { destinations: [], totalTrips: 0, totalPassthroughs: 0, tpRate: 0 };

interface WebPresentationViewerProps {
  metrics: Metrics[];
  seniors: string[];
  teams: Team[];
  config: PresentationConfig;
  webStyle?: WebPresentationStyle;
  recentAchievements?: never[];
  hotPassDestinations?: TopDestination[];
  repeatStats?: DestinationStats;
  b2bStats?: DestinationStats;
  onClose: () => void;
}

export const WebPresentationViewer: React.FC<WebPresentationViewerProps> = ({
  metrics,
  seniors,
  teams,
  config,
  webStyle,
  hotPassDestinations = [],
  repeatStats: _repeatStats = emptyDestinationStats,
  b2bStats: _b2bStats = emptyDestinationStats,
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

  const TOTAL_SLIDES = 8;

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

    // Calculate rates
    const avgHotPassRate = totalPassthroughs > 0 ? (totalHotPasses / totalPassthroughs) * 100 : 0;

    // Calculate department-wide hot pass rate (all agents)
    const deptTotalPassthroughs = metrics.reduce((sum, m) => sum + m.passthroughs, 0);
    const deptTotalHotPasses = metrics.reduce((sum, m) => sum + m.hotPasses, 0);
    const deptAvgHotPassRate = deptTotalPassthroughs > 0 ? (deptTotalHotPasses / deptTotalPassthroughs) * 100 : 0;

    // Sort for hot pass rate (team only)
    const byHotPassRate = [...selectedTeamMetrics]
      .sort((a, b) => b.hotPassRate - a.hotPassRate)
      .map(m => ({
        agentName: m.agentName,
        hotPassRate: m.hotPassRate,
        isSenior: isSenior(m.agentName),
      }));

    // Leaderboard (all agents, top 5 per category)
    const allByPassthroughs = [...metrics]
      .sort((a, b) => b.passthroughs - a.passthroughs)
      .map(m => ({
        agentName: m.agentName,
        value: m.passthroughs,
        isOnSelectedTeam: isOnSelectedTeam(m.agentName),
        isSenior: isSenior(m.agentName),
      }));

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

    // T>Q rate — prospect+repeat only (labeled E>B in the UI)
    const allByTQRate = [...metrics]
      .filter(m => (m.prospectTrips + m.repeatTrips) >= 5)
      .map(m => {
        const trips = m.prospectTrips + m.repeatTrips;
        const bookings = m.prospectBookings + m.repeatBookings;
        return {
          agentName: m.agentName,
          value: trips > 0 ? (bookings / trips) * 100 : 0,
          isOnSelectedTeam: isOnSelectedTeam(m.agentName),
          isSenior: isSenior(m.agentName),
        };
      })
      .sort((a, b) => b.value - a.value);

    // T>P rate — prospect+repeat only (labeled E>P in the UI)
    const allByTPRate = [...metrics]
      .filter(m => (m.prospectTrips + m.repeatTrips) >= 5)
      .map(m => {
        const trips = m.prospectTrips + m.repeatTrips;
        const pts = m.prospectPassthroughs + m.repeatPassthroughs;
        return {
          agentName: m.agentName,
          value: trips > 0 ? (pts / trips) * 100 : 0,
          isOnSelectedTeam: isOnSelectedTeam(m.agentName),
          isSenior: isSenior(m.agentName),
        };
      })
      .sort((a, b) => b.value - a.value);

    // P>Q rate — prospect+repeat only (labeled E>Q in the UI)
    const allByPQRate = [...metrics]
      .filter(m => (m.prospectPassthroughs + m.repeatPassthroughs) >= 5)
      .map(m => {
        const pts = m.prospectPassthroughs + m.repeatPassthroughs;
        const quotes = m.prospectQuotes + m.repeatQuotes;
        return {
          agentName: m.agentName,
          value: pts > 0 ? (quotes / pts) * 100 : 0,
          isOnSelectedTeam: isOnSelectedTeam(m.agentName),
          isSenior: isSenior(m.agentName),
        };
      })
      .sort((a, b) => b.value - a.value);

    // Compute segment data for Key Metrics slide
    const computeSegment = (
      getEnquiries: (m: Metrics) => number,
      getPTs: (m: Metrics) => number,
      getQuotes: (m: Metrics) => number,
      getBookings: (m: Metrics) => number,
    ): SegmentData => {
      const enquiries = selectedTeamMetrics.reduce((s, m) => s + getEnquiries(m), 0);
      const passthroughs = selectedTeamMetrics.reduce((s, m) => s + getPTs(m), 0);
      const quotes = selectedTeamMetrics.reduce((s, m) => s + getQuotes(m), 0);
      const bookings = selectedTeamMetrics.reduce((s, m) => s + getBookings(m), 0);
      return {
        enquiries,
        passthroughs,
        quotes,
        bookings,
        epRate: enquiries > 0 ? (passthroughs / enquiries) * 100 : 0,
        eqRate: enquiries > 0 ? (quotes / enquiries) * 100 : 0,
        ebRate: enquiries > 0 ? (bookings / enquiries) * 100 : 0,
      };
    };

    const prospectData = computeSegment(
      m => m.prospectTrips,
      m => m.prospectPassthroughs,
      m => m.prospectQuotes,
      m => m.prospectBookings,
    );

    const taData = computeSegment(
      m => m.b2bTrips,
      m => m.b2bPassthroughs,
      m => m.b2bQuotes,
      m => m.b2bBookings,
    );

    const repeatSegmentData = computeSegment(
      m => m.repeatTrips,
      m => m.repeatPassthroughs,
      m => m.repeatQuotes,
      m => m.repeatBookings,
    );

    // Dept-wide segment averages (all agents, not just selected team)
    const computeDeptSegment = (
      getEnquiries: (m: Metrics) => number,
      getPTs: (m: Metrics) => number,
      getQuotes: (m: Metrics) => number,
      getBookings: (m: Metrics) => number,
    ): SegmentData => {
      const enquiries = metrics.reduce((s, m) => s + getEnquiries(m), 0);
      const passthroughs = metrics.reduce((s, m) => s + getPTs(m), 0);
      const quotes = metrics.reduce((s, m) => s + getQuotes(m), 0);
      const bookings = metrics.reduce((s, m) => s + getBookings(m), 0);
      return {
        enquiries,
        passthroughs,
        quotes,
        bookings,
        epRate: enquiries > 0 ? (passthroughs / enquiries) * 100 : 0,
        eqRate: enquiries > 0 ? (quotes / enquiries) * 100 : 0,
        ebRate: enquiries > 0 ? (bookings / enquiries) * 100 : 0,
      };
    };

    const deptProspectData = computeDeptSegment(
      m => m.prospectTrips,
      m => m.prospectPassthroughs,
      m => m.prospectQuotes,
      m => m.prospectBookings,
    );

    const deptTaData = computeDeptSegment(
      m => m.b2bTrips,
      m => m.b2bPassthroughs,
      m => m.b2bQuotes,
      m => m.b2bBookings,
    );

    const deptRepeatData = computeDeptSegment(
      m => m.repeatTrips,
      m => m.repeatPassthroughs,
      m => m.repeatQuotes,
      m => m.repeatBookings,
    );

    return {
      selectedTeamName,
      selectedTeamCount,
      totalPassthroughs,
      totalQuotes,
      totalTrips,
      totalHotPasses,
      totalBookings,
      avgHotPassRate,
      deptAvgHotPassRate,
      byHotPassRate,
      allByPassthroughs,
      allByQuotes,
      allByBookings,
      allByHotPassRate,
      allByTQRate,
      allByTPRate,
      allByPQRate,
      prospectData,
      taData,
      repeatSegmentData,
      deptProspectData,
      deptTaData,
      deptRepeatData,
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
    const slideNames = ['Title', 'Team Comparison', 'Key Metrics', 'Hot Pass Rate',
      'Top Destinations', 'Leaderboard', 'Cascades', 'Closing'];
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
            teams={teams}
            metrics={metrics}
            seniors={seniors}
            teamName={config.teamName}
            colors={colors}
            layout={layout}
            prospectData={slideData.prospectData}
            taData={slideData.taData}
            repeatData={slideData.repeatSegmentData}
            deptProspectData={slideData.deptProspectData}
            deptTaData={slideData.deptTaData}
            deptRepeatData={slideData.deptRepeatData}
          />
        );
        break;
      case 2:
        slideContent = (
          <WebKeyMetricsSlide
            teamName={slideData.selectedTeamName}
            prospectData={slideData.prospectData}
            taData={slideData.taData}
            repeatData={slideData.repeatSegmentData}
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
          <WebTopDestinationsSlide
            destinations={config.topDestinations || []}
            agentDestinations={config.agentTopDestinations}
            colors={colors}
            layout={layout}
          />
        );
        break;
      case 5:
        slideContent = (
          <WebLeaderboardSlide
            byPassthroughs={slideData.allByPassthroughs}
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
      case 6:
        slideContent = (
          <WebCascadesSlide
            cascades={config.cascades}
            colors={colors}
            layout={layout}
          />
        );
        break;
      case 7:
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
