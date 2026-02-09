import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WebPresentationViewer } from './WebPresentationViewer';
import type { Metrics, Team } from '../../types';
import type { PresentationConfig } from '../../utils/presentationGenerator';

const mockMetrics: Metrics[] = [
  {
    agentName: 'Agent 1',
    trips: 100,
    quotes: 50,
    passthroughs: 40,
    hotPasses: 20,
    bookings: 10,
    nonConvertedLeads: 5,
    totalLeads: 55,
    quotesFromTrips: 50,
    passthroughsFromTrips: 40,
    quotesFromPassthroughs: 25,
    hotPassRate: 50,
    nonConvertedRate: 5,
    repeatTrips: 10,
    repeatPassthroughs: 8,
    repeatTpRate: 80,
    b2bTrips: 5,
    b2bPassthroughs: 4,
    b2bTpRate: 80,
    quotesStarted: 15,
    potentialTQ: 65,
  },
  {
    agentName: 'Agent 2',
    trips: 80,
    quotes: 40,
    passthroughs: 35,
    hotPasses: 18,
    bookings: 8,
    nonConvertedLeads: 4,
    totalLeads: 44,
    quotesFromTrips: 40,
    passthroughsFromTrips: 35,
    quotesFromPassthroughs: 20,
    hotPassRate: 51,
    nonConvertedRate: 5,
    repeatTrips: 8,
    repeatPassthroughs: 7,
    repeatTpRate: 87.5,
    b2bTrips: 4,
    b2bPassthroughs: 3,
    b2bTpRate: 75,
    quotesStarted: 12,
    potentialTQ: 55,
  },
];

const mockTeams: Team[] = [
  {
    id: 'team-1',
    name: 'My Team',
    agentNames: ['Agent 1', 'Agent 2'],
  },
];

const mockSeniors: string[] = ['Agent 1'];

const mockConfig: PresentationConfig = {
  teamName: 'Test Team',
  selectedTeamId: 'team-1',
  monthlyGoalPassthroughs: 350,
  monthlyGoalQuotes: 220,
  cascades: ['First announcement', 'Second announcement'],
  meetingDate: new Date('2024-01-15'),
  theme: 'dark-modern',
};

describe('WebPresentationViewer', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the first slide (title slide) by default', () => {
    render(
      <WebPresentationViewer
        metrics={mockMetrics}
        seniors={mockSeniors}
        teams={mockTeams}
        config={mockConfig}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Test Team')).toBeInTheDocument();
    expect(screen.getByText('TEAM HUDDLE')).toBeInTheDocument();
  });

  it('displays slide counter showing 1 / 10', () => {
    render(
      <WebPresentationViewer
        metrics={mockMetrics}
        seniors={mockSeniors}
        teams={mockTeams}
        config={mockConfig}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('1 / 10')).toBeInTheDocument();
  });

  it('navigates to next slide when next button is clicked', async () => {
    render(
      <WebPresentationViewer
        metrics={mockMetrics}
        seniors={mockSeniors}
        teams={mockTeams}
        config={mockConfig}
        onClose={mockOnClose}
      />
    );

    const nextButton = screen.getByTitle('Next (Right Arrow)');
    fireEvent.click(nextButton);

    expect(screen.getByText('2 / 10')).toBeInTheDocument();
    // Check for TEAM PROGRESS text with waitFor since it may be animated
    await waitFor(() => {
      expect(screen.getByText('TEAM PROGRESS')).toBeInTheDocument();
    });
  });

  it('navigates using keyboard arrow keys', () => {
    render(
      <WebPresentationViewer
        metrics={mockMetrics}
        seniors={mockSeniors}
        teams={mockTeams}
        config={mockConfig}
        onClose={mockOnClose}
      />
    );

    // Go to next slide with right arrow
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 10')).toBeInTheDocument();

    // Go back with left arrow
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('1 / 10')).toBeInTheDocument();
  });

  it('navigates to specific slide using number keys', async () => {
    render(
      <WebPresentationViewer
        metrics={mockMetrics}
        seniors={mockSeniors}
        teams={mockTeams}
        config={mockConfig}
        onClose={mockOnClose}
      />
    );

    // Press '3' to go to slide 3
    fireEvent.keyDown(window, { key: '3' });
    expect(screen.getByText('3 / 10')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('KEY METRICS')).toBeInTheDocument();
    });
  });

  it('calls onClose when Escape key is pressed', () => {
    render(
      <WebPresentationViewer
        metrics={mockMetrics}
        seniors={mockSeniors}
        teams={mockTeams}
        config={mockConfig}
        onClose={mockOnClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when exit button is clicked', () => {
    render(
      <WebPresentationViewer
        metrics={mockMetrics}
        seniors={mockSeniors}
        teams={mockTeams}
        config={mockConfig}
        onClose={mockOnClose}
      />
    );

    const exitButton = screen.getByTitle('Exit (Esc)');
    fireEvent.click(exitButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders 10 progress dots', () => {
    render(
      <WebPresentationViewer
        metrics={mockMetrics}
        seniors={mockSeniors}
        teams={mockTeams}
        config={mockConfig}
        onClose={mockOnClose}
      />
    );

    // Each dot has a title like "Slide X"
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByTitle(`Slide ${i}`)).toBeInTheDocument();
    }
  });

  it('clicking a progress dot navigates to that slide', async () => {
    render(
      <WebPresentationViewer
        metrics={mockMetrics}
        seniors={mockSeniors}
        teams={mockTeams}
        config={mockConfig}
        onClose={mockOnClose}
      />
    );

    const dot5 = screen.getByTitle('Slide 5');
    fireEvent.click(dot5);

    expect(screen.getByText('5 / 10')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('TOP PERFORMERS')).toBeInTheDocument();
    });
  });

  it('renders all themes correctly', () => {
    const themes = ['dark-modern', 'light-clean', 'vibrant-energy', 'corporate-blue', 'warm-sunset'] as const;

    themes.forEach((theme) => {
      const { unmount } = render(
        <WebPresentationViewer
          metrics={mockMetrics}
          seniors={mockSeniors}
          teams={mockTeams}
          config={{ ...mockConfig, theme }}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Test Team')).toBeInTheDocument();
      unmount();
    });
  });

  it('disables previous button on first slide', () => {
    render(
      <WebPresentationViewer
        metrics={mockMetrics}
        seniors={mockSeniors}
        teams={mockTeams}
        config={mockConfig}
        onClose={mockOnClose}
      />
    );

    const prevButton = screen.getByTitle('Previous (Left Arrow)');
    expect(prevButton).toBeDisabled();
  });

  it('disables next button on last slide', () => {
    render(
      <WebPresentationViewer
        metrics={mockMetrics}
        seniors={mockSeniors}
        teams={mockTeams}
        config={mockConfig}
        onClose={mockOnClose}
      />
    );

    // Navigate to last slide using End key
    fireEvent.keyDown(window, { key: 'End' });

    const nextButton = screen.getByTitle('Next (Right Arrow)');
    expect(nextButton).toBeDisabled();
  });
});
