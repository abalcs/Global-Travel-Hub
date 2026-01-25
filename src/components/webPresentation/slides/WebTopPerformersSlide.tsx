import { motion } from 'framer-motion';
import { useState } from 'react';
import type { SlideColors } from '../../../utils/presentationGenerator';
import type { RecentAchievement } from '../../PresentationGenerator';
import type { LayoutStyles } from '../webPresentationConfig';

// Achievement/celebration travel images
const PERFORMER_IMAGES = [
  'https://images.pexels.com/photos/2387418/pexels-photo-2387418.jpeg?auto=compress&cs=tinysrgb&w=1600', // Hiking summit
  'https://images.pexels.com/photos/1271619/pexels-photo-1271619.jpeg?auto=compress&cs=tinysrgb&w=1600', // Mountain climber
  'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg?auto=compress&cs=tinysrgb&w=1600', // Aurora borealis
];

interface Performer {
  agentName: string;
  value: number;
  isSenior: boolean;
}

interface WebTopPerformersSlideProps {
  topPassthroughs: Performer[];
  topQuotes: Performer[];
  teamName: string;
  recentAchievements?: RecentAchievement[];
  colors: SlideColors;
  layout?: LayoutStyles;
}

const medalEmojis = ['🥇', '🥈', '🥉'];
const medalColors = ['FFD700', 'C0C0C0', 'CD7F32'];

const PerformerCard: React.FC<{
  performer: Performer;
  index: number;
  valueColor: string;
  colors: SlideColors;
  delay: number;
}> = ({ performer, index, valueColor, colors, delay }) => {
  return (
    <motion.div
      className="rounded-xl p-4 border-2 flex items-center justify-between"
      style={{
        backgroundColor: `#${colors.cardBg}`,
        borderColor: `#${medalColors[index]}`,
      }}
      initial={{ opacity: 0, x: -30, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.4, delay }}
    >
      <div className="flex items-center gap-3">
        <motion.span
          className="text-2xl"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.5, delay: delay + 0.2, type: 'spring', stiffness: 300 }}
        >
          {medalEmojis[index]}
        </motion.span>
        <span className="text-lg font-bold" style={{ color: `#${colors.text}` }}>
          {performer.agentName}
          {performer.isSenior && (
            <span className="ml-1 text-amber-400" title="Senior">
              ⚜
            </span>
          )}
        </span>
      </div>
      <motion.span
        className="text-2xl font-bold"
        style={{ color: valueColor }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.3 }}
      >
        {performer.value}
      </motion.span>
    </motion.div>
  );
};

export const WebTopPerformersSlide: React.FC<WebTopPerformersSlideProps> = ({
  topPassthroughs,
  topQuotes,
  teamName,
  recentAchievements = [],
  colors,
  layout,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Show up to 4 recent achievements
  const displayAchievements = recentAchievements.slice(0, 4);
  const hasAchievements = displayAchievements.length > 0;

  // Pick consistent image based on data
  const imageIndex = topPassthroughs.length % PERFORMER_IMAGES.length;
  const backgroundImage = PERFORMER_IMAGES[imageIndex];

  return (
    <div
      className="w-full h-full flex flex-col px-12 py-6 relative overflow-hidden"
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
      <div className={`${layout?.headerMargin || 'mb-3'} relative z-10`}>
        <motion.h2
          className={`${layout?.titleSize || 'text-4xl'} font-bold`}
          style={{ color: `#${colors.text}` }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          TOP PERFORMERS
        </motion.h2>
        <motion.div
          className="h-1 w-44 mt-2"
          style={{ backgroundColor: `#${colors.accent}` }}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        />
        <motion.p
          className="mt-2"
          style={{ color: `#${colors.textLight}` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {teamName}
        </motion.p>
      </div>

      {/* Two columns for top performers */}
      <div className={`grid grid-cols-2 ${layout?.spacing || 'gap-6'} relative z-10 ${hasAchievements ? '' : 'flex-1'}`}>
        {/* Passthroughs */}
        <div>
          <motion.h3
            className="text-base font-bold mb-3"
            style={{ color: `#${colors.accent}` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            PASSTHROUGHS
          </motion.h3>
          <div className="space-y-2">
            {topPassthroughs.slice(0, 3).map((performer, i) => (
              <PerformerCard
                key={performer.agentName}
                performer={performer}
                index={i}
                valueColor={`#${colors.primary}`}
                colors={colors}
                delay={0.3 + i * 0.15}
              />
            ))}
          </div>
        </div>

        {/* Quotes */}
        <div>
          <motion.h3
            className="text-base font-bold mb-3"
            style={{ color: `#${colors.success}` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            QUOTES
          </motion.h3>
          <div className="space-y-2">
            {topQuotes.slice(0, 3).map((performer, i) => (
              <PerformerCard
                key={performer.agentName}
                performer={performer}
                index={i}
                valueColor={`#${colors.success}`}
                colors={colors}
                delay={0.4 + i * 0.15}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Recent Achievements / Personal Records section */}
      {hasAchievements && (
        <motion.div
          className="mt-8 relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🏆</span>
            <h3 className="text-base font-bold" style={{ color: `#${colors.warning}` }}>
              RECENT PERSONAL RECORDS
            </h3>
          </div>
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: `#${colors.cardBg}` }}
          >
            <div className="grid grid-cols-2 gap-3">
              {displayAchievements.map((achievement, i) => (
                <motion.div
                  key={`${achievement.agentName}-${achievement.metric}-${achievement.period}`}
                  className="flex items-center justify-between p-2 rounded-lg"
                  style={{ backgroundColor: `#${colors.background}` }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: `#${colors.text}` }}
                    >
                      {achievement.agentName}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: `#${colors.textLight}` }}
                    >
                      {achievement.formattedPeriod} {achievement.formattedMetric}
                    </p>
                  </div>
                  <div className="text-right ml-2">
                    <p
                      className="text-lg font-bold"
                      style={{ color: `#${colors.warning}` }}
                    >
                      {achievement.formattedValue}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: `#${colors.textLight}` }}
                    >
                      {achievement.dateRange}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
