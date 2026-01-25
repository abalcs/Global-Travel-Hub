import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { SlideColors } from '../../../utils/presentationGenerator';
import type { LayoutStyles } from '../webPresentationConfig';

// Scenic travel images for progress background
const PROGRESS_IMAGES = [
  'https://images.pexels.com/photos/1271619/pexels-photo-1271619.jpeg?auto=compress&cs=tinysrgb&w=1600', // Mountain climber
  'https://images.pexels.com/photos/2387418/pexels-photo-2387418.jpeg?auto=compress&cs=tinysrgb&w=1600', // Hiking trail
  'https://images.pexels.com/photos/1658967/pexels-photo-1658967.jpeg?auto=compress&cs=tinysrgb&w=1600', // Road through mountains
];

interface WebProgressSlideProps {
  totalPassthroughs: number;
  totalQuotes: number;
  monthlyGoalPassthroughs: number;
  monthlyGoalQuotes: number;
  teamCount: number;
  teamName: string;
  colors: SlideColors;
  layout?: LayoutStyles;
}

const CountUp: React.FC<{ end: number; delay?: number; color: string }> = ({
  end,
  delay = 0,
  color,
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v));

  useEffect(() => {
    const unsubscribe = rounded.on('change', (v) => setDisplayValue(v));
    const controls = animate(motionValue, end, {
      duration: 1.5,
      delay,
      ease: 'easeOut',
    });
    return () => {
      unsubscribe();
      controls.stop();
    };
  }, [end, delay, motionValue, rounded]);

  return <span style={{ color }}>{displayValue}</span>;
};

const ProgressBar: React.FC<{
  current: number;
  goal: number;
  color: string;
  delay?: number;
}> = ({ current, goal, color, delay = 0 }) => {
  const percentage = Math.min((current / goal) * 100, 100);

  return (
    <div className="h-3 bg-black/20 rounded-full overflow-hidden mt-3">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 1, delay: delay + 0.5, ease: 'easeOut' }}
      />
    </div>
  );
};

export const WebProgressSlide: React.FC<WebProgressSlideProps> = ({
  totalPassthroughs,
  totalQuotes,
  monthlyGoalPassthroughs,
  monthlyGoalQuotes,
  teamCount,
  teamName,
  colors,
  layout,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const passthroughsMet = totalPassthroughs >= monthlyGoalPassthroughs;
  const quotesMet = totalQuotes >= monthlyGoalQuotes;
  const passthroughsPercent = Math.round((totalPassthroughs / monthlyGoalPassthroughs) * 100);
  const quotesPercent = Math.round((totalQuotes / monthlyGoalQuotes) * 100);

  // Pick consistent image based on progress
  const imageIndex = (passthroughsPercent + quotesPercent) % PROGRESS_IMAGES.length;
  const backgroundImage = PROGRESS_IMAGES[imageIndex];

  return (
    <div
      className="w-full h-full flex flex-col px-12 py-8 relative overflow-hidden"
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

      {/* Bottom right decorative circle */}
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
      <div className={`${layout?.headerMargin || 'mb-4'} relative z-10`}>
        <motion.h2
          className={`${layout?.titleSize || 'text-4xl'} font-bold`}
          style={{ color: `#${colors.text}` }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          TEAM PROGRESS
        </motion.h2>
        <motion.div
          className="h-1 w-40 mt-2"
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
          {teamName} ({teamCount} members) - Monthly Goals
        </motion.p>
      </div>

      {/* Cards */}
      <div className={`flex-1 flex ${layout?.spacing || 'gap-6'} items-center mt-4 relative z-10`}>
        {/* Passthroughs Card */}
        <motion.div
          className={`flex-1 rounded-2xl ${layout?.cardPadding || 'p-6'} border-2`}
          style={{
            backgroundColor: `#${colors.cardBg}`,
            borderColor: `#${colors.primary}`,
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <p
            className="text-sm font-bold tracking-wide mb-4"
            style={{ color: `#${colors.textLight}` }}
          >
            PASSTHROUGHS
          </p>
          <div className="flex items-baseline gap-4 mb-2">
            <p className={`${layout?.valueSize || 'text-6xl'} font-bold`}>
              <CountUp
                end={totalPassthroughs}
                delay={0.5}
                color={passthroughsMet ? `#${colors.success}` : `#${colors.text}`}
              />
            </p>
            <p className="text-2xl" style={{ color: `#${colors.textLight}` }}>
              / {monthlyGoalPassthroughs}
            </p>
          </div>
          <p className="text-xl font-semibold" style={{ color: passthroughsMet ? `#${colors.success}` : `#${colors.accent}` }}>
            {passthroughsPercent}% of goal
          </p>
          <ProgressBar
            current={totalPassthroughs}
            goal={monthlyGoalPassthroughs}
            color={passthroughsMet ? `#${colors.success}` : `#${colors.primary}`}
            delay={0.3}
          />
        </motion.div>

        {/* Quotes Card */}
        <motion.div
          className={`flex-1 rounded-2xl ${layout?.cardPadding || 'p-6'} border-2`}
          style={{
            backgroundColor: `#${colors.cardBg}`,
            borderColor: `#${colors.secondary}`,
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          <p
            className="text-sm font-bold tracking-wide mb-4"
            style={{ color: `#${colors.textLight}` }}
          >
            QUOTES
          </p>
          <div className="flex items-baseline gap-4 mb-2">
            <p className={`${layout?.valueSize || 'text-6xl'} font-bold`}>
              <CountUp
                end={totalQuotes}
                delay={0.65}
                color={quotesMet ? `#${colors.success}` : `#${colors.text}`}
              />
            </p>
            <p className="text-2xl" style={{ color: `#${colors.textLight}` }}>
              / {monthlyGoalQuotes}
            </p>
          </div>
          <p className="text-xl font-semibold" style={{ color: quotesMet ? `#${colors.success}` : `#${colors.accent}` }}>
            {quotesPercent}% of goal
          </p>
          <ProgressBar
            current={totalQuotes}
            goal={monthlyGoalQuotes}
            color={quotesMet ? `#${colors.success}` : `#${colors.secondary}`}
            delay={0.45}
          />
        </motion.div>
      </div>
    </div>
  );
};
