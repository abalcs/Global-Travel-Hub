import { motion } from 'framer-motion';
import { useState } from 'react';
import type { SlideColors } from '../../../utils/presentationGenerator';
import type { LayoutStyles } from '../webPresentationConfig';

// Mountain images for leaderboard background
const MOUNTAIN_IMAGES = [
  'https://images.pexels.com/photos/417173/pexels-photo-417173.jpeg?auto=compress&cs=tinysrgb&w=1600', // Swiss Alps
  'https://images.pexels.com/photos/1054218/pexels-photo-1054218.jpeg?auto=compress&cs=tinysrgb&w=1600', // Mountain range sunset
  'https://images.pexels.com/photos/2686558/pexels-photo-2686558.jpeg?auto=compress&cs=tinysrgb&w=1600', // Snowy peaks
];

interface LeaderboardEntry {
  agentName: string;
  value: number;
  isOnSelectedTeam: boolean;
  isSenior: boolean;
}

interface WebLeaderboardSlideProps {
  byPassthroughs: LeaderboardEntry[];
  byQuotes: LeaderboardEntry[];
  byBookings: LeaderboardEntry[];
  byHotPassRate: LeaderboardEntry[];
  byTPRate: LeaderboardEntry[];
  byPQRate: LeaderboardEntry[];
  byTQRate: LeaderboardEntry[];
  selectedTeamName: string;
  colors: SlideColors;
  layout?: LayoutStyles;
}

const LeaderboardColumn: React.FC<{
  title: string;
  entries: LeaderboardEntry[];
  isRate?: boolean;
  colors: SlideColors;
  columnDelay: number;
  compact?: boolean;
  revealedPositions: Set<number>;
  onReveal: (position: number) => void;
}> = ({ title, entries, isRate, colors, columnDelay, compact, revealedPositions, onReveal }) => {
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="flex flex-col h-full min-w-0">
      <motion.h3
        className={`${compact ? 'text-xs mb-2 pb-1.5' : 'text-xs mb-2 pb-1.5'} font-bold border-b`}
        style={{ color: `#${colors.accent}`, borderColor: `#${colors.accent}40` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: columnDelay }}
      >
        {title}
      </motion.h3>
      <div className="flex-1 flex flex-col justify-start gap-0.5">
        {entries.slice(0, 5).map((entry, i) => {
          const isTop3 = i < 3;
          const isRevealed = revealedPositions.has(i);
          const shouldHide = isTop3 && entry.isOnSelectedTeam && !isRevealed;

          // Hidden state - only for team members in top 3
          if (shouldHide) {
            return (
              <motion.div
                key={`hidden-${i}`}
                className="flex items-center justify-between py-1 px-2 rounded cursor-pointer group"
                style={{
                  backgroundColor: `#${colors.myTeamHighlight}`,
                  border: `1px dashed #${colors.accent}60`,
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: columnDelay + 0.1 + i * 0.04 }}
                onClick={() => onReveal(i)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span
                  className="text-xs flex items-center gap-1"
                  style={{ color: `#${colors.text}` }}
                >
                  <span className="text-sm">{medals[i]}</span>
                  <span className="italic opacity-70">Click to reveal!</span>
                </span>
                <span
                  className="text-sm group-hover:animate-pulse"
                  style={{ color: `#${colors.accent}` }}
                >
                  ?
                </span>
              </motion.div>
            );
          }

          // Normal display state
          const wasJustRevealed = isTop3 && entry.isOnSelectedTeam && isRevealed;

          return (
            <motion.div
              key={entry.agentName}
              className="flex items-center justify-between py-1 px-2 rounded"
              style={{
                backgroundColor: entry.isOnSelectedTeam
                  ? `#${colors.myTeamHighlight}`
                  : 'transparent',
              }}
              initial={wasJustRevealed ? { opacity: 0, scale: 0.8, rotateX: -90 } : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0, scale: 1, rotateX: 0 }}
              transition={wasJustRevealed
                ? { duration: 0.5, type: 'spring', stiffness: 200, damping: 15 }
                : { duration: 0.3, delay: columnDelay + 0.1 + i * 0.04 }
              }
            >
              <span
                className="text-xs truncate flex-1 flex items-center gap-0.5"
                style={{
                  color: entry.isOnSelectedTeam ? `#${colors.text}` : `#${colors.textLight}`,
                  fontWeight: entry.isOnSelectedTeam ? 600 : 400,
                }}
              >
                {isTop3 && <span className="text-sm mr-0.5">{medals[i]}</span>}
                {!isTop3 && `${i + 1}. `}
                {entry.agentName}
                {entry.isSenior && (
                  <span className="ml-0.5 text-amber-400" title="Senior">
                    ⚜
                  </span>
                )}
              </span>
              <span
                className="text-xs font-semibold ml-2 tabular-nums whitespace-nowrap"
                style={{
                  color: entry.isOnSelectedTeam ? `#${colors.text}` : `#${colors.textLight}`,
                }}
              >
                {isRate ? `${entry.value.toFixed(0)}%` : entry.value}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export const WebLeaderboardSlide: React.FC<WebLeaderboardSlideProps> = ({
  byPassthroughs,
  byQuotes,
  byBookings,
  byHotPassRate,
  byTPRate,
  byPQRate,
  byTQRate,
  selectedTeamName,
  colors,
  layout,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Track revealed positions for each column (top 3 are hidden by default)
  const [revealedByColumn, setRevealedByColumn] = useState<Record<string, Set<number>>>({
    passthroughs: new Set(),
    quotes: new Set(),
    bookings: new Set(),
    hotPassRate: new Set(),
    tpRate: new Set(),
    pqRate: new Set(),
    tqRate: new Set(),
  });

  const handleReveal = (column: string, position: number) => {
    setRevealedByColumn(prev => ({
      ...prev,
      [column]: new Set([...prev[column], position]),
    }));
  };

  // Pick consistent image based on data
  const imageIndex = byQuotes.length % MOUNTAIN_IMAGES.length;
  const backgroundImage = MOUNTAIN_IMAGES[imageIndex];

  return (
    <div
      className="w-full h-full flex flex-col px-6 py-4 relative overflow-hidden"
      style={{ backgroundColor: `#${colors.background}` }}
    >
      {/* Background Image */}
      <img
        src={backgroundImage}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: imageLoaded ? 0.4 : 0, transition: 'opacity 0.8s ease-in-out' }}
        onLoad={() => setImageLoaded(true)}
      />

      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `#${colors.background}`, opacity: 0.75 }}
      />

      {/* Left accent bar */}
      <motion.div
        className="absolute left-0 top-0 w-2 h-full z-10"
        style={{ backgroundColor: `#${colors.primary}` }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Decorative circle */}
      {layout?.showDecorations !== false && (
        <motion.div
          className="absolute -bottom-12 -right-12 w-24 h-24 rounded-full z-10"
          style={{ backgroundColor: `#${colors.secondary}`, opacity: 0.5 }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        />
      )}

      {/* Header */}
      <div className="mb-3 flex items-center justify-between relative z-10">
        <div>
          <motion.h2
            className={`${layout?.titleSize || 'text-2xl'} font-bold`}
            style={{ color: `#${colors.text}` }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            DEPARTMENT LEADERBOARD
          </motion.h2>
          <motion.div
            className="h-1 w-32 mt-1"
            style={{ backgroundColor: `#${colors.accent}` }}
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
          <motion.p
            className="mt-0.5 text-xs"
            style={{ color: `#${colors.textLight}` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Department Wide — Top 5
          </motion.p>
        </div>

        {/* Legend */}
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div
            className="w-3.5 h-3.5 rounded"
            style={{ backgroundColor: `#${colors.myTeamHighlight}` }}
          />
          <span className="text-xs" style={{ color: `#${colors.textLight}` }}>
            = {selectedTeamName}
          </span>
        </motion.div>
      </div>

      {/* Two-row layout */}
      <div className="flex-1 flex flex-col gap-2 relative z-10 min-h-0">
        {/* Top row: Volume metrics (4 columns) */}
        <div className="flex-1 grid grid-cols-4 gap-3 min-h-0">
          <LeaderboardColumn
            title="Passthroughs"
            entries={byPassthroughs}
            colors={colors}
            columnDelay={0.3}
            revealedPositions={revealedByColumn.passthroughs}
            onReveal={(pos) => handleReveal('passthroughs', pos)}
          />
          <LeaderboardColumn
            title="Quotes"
            entries={byQuotes}
            colors={colors}
            columnDelay={0.35}
            revealedPositions={revealedByColumn.quotes}
            onReveal={(pos) => handleReveal('quotes', pos)}
          />
          <LeaderboardColumn
            title="Bookings"
            entries={byBookings}
            colors={colors}
            columnDelay={0.4}
            revealedPositions={revealedByColumn.bookings}
            onReveal={(pos) => handleReveal('bookings', pos)}
          />
          <LeaderboardColumn
            title="Hot Pass %"
            entries={byHotPassRate}
            isRate
            colors={colors}
            columnDelay={0.45}
            revealedPositions={revealedByColumn.hotPassRate}
            onReveal={(pos) => handleReveal('hotPassRate', pos)}
          />
        </div>

        {/* Divider */}
        <motion.div
          className="h-px w-full"
          style={{ backgroundColor: `#${colors.accent}30` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        />

        {/* Bottom row: Rate metrics (3 columns, centered) */}
        <div className="flex-1 grid grid-cols-3 gap-3 min-h-0 px-8">
          <LeaderboardColumn
            title="T→P %"
            entries={byTPRate}
            isRate
            compact
            colors={colors}
            columnDelay={0.5}
            revealedPositions={revealedByColumn.tpRate}
            onReveal={(pos) => handleReveal('tpRate', pos)}
          />
          <LeaderboardColumn
            title="P→Q %"
            entries={byPQRate}
            isRate
            compact
            colors={colors}
            columnDelay={0.55}
            revealedPositions={revealedByColumn.pqRate}
            onReveal={(pos) => handleReveal('pqRate', pos)}
          />
          <LeaderboardColumn
            title="T→Q %"
            entries={byTQRate}
            isRate
            compact
            colors={colors}
            columnDelay={0.6}
            revealedPositions={revealedByColumn.tqRate}
            onReveal={(pos) => handleReveal('tqRate', pos)}
          />
        </div>
      </div>
    </div>
  );
};
