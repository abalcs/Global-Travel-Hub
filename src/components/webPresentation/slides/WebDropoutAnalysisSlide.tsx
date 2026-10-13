import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { SlideColors } from '../../../utils/presentationGenerator';
import type { LayoutStyles } from '../webPresentationConfig';
import type { DropoutData } from '../../PresentationGenerator';

// Scenic travel images for dropout analysis background
const DROPOUT_IMAGES = [
  'https://images.pexels.com/photos/1271619/pexels-photo-1271619.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/2387418/pexels-photo-2387418.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/1658967/pexels-photo-1658967.jpeg?auto=compress&cs=tinysrgb&w=1600',
];

interface WebDropoutAnalysisSlideProps {
  dropoutData?: DropoutData;
  teamName: string;
  colors: SlideColors;
  layout?: LayoutStyles;
}

const CountUpPercent: React.FC<{ end: number; delay?: number; color: string; decimals?: number }> = ({
  end,
  delay = 0,
  color,
  decimals = 1,
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v * 10) / 10);

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

  return <span style={{ color }}>{displayValue.toFixed(decimals)}%</span>;
};

export const WebDropoutAnalysisSlide: React.FC<WebDropoutAnalysisSlideProps> = ({
  dropoutData,
  teamName,
  colors,
  layout,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const imageIndex = teamName.length % DROPOUT_IMAGES.length;
  const backgroundImage = DROPOUT_IMAGES[imageIndex];

  const hasData = dropoutData && (dropoutData.teamDropouts.length > 0 || dropoutData.deptDropouts.length > 0);

  const teamDropoutRate = dropoutData && dropoutData.teamEnquiries > 0
    ? (dropoutData.teamTotal / dropoutData.teamEnquiries) * 100
    : 0;
  const deptDropoutRate = dropoutData && dropoutData.deptEnquiries > 0
    ? (dropoutData.deptTotal / dropoutData.deptEnquiries) * 100
    : 0;

  // Build comparison: for each team dropout reason, compare with dept rate
  const comparisons = dropoutData ? dropoutData.teamDropouts.slice(0, 8).map(item => {
    const deptItem = dropoutData.deptDropouts.find(d => d.reason === item.reason);
    const teamPct = dropoutData.teamTotal > 0 ? (item.count / dropoutData.teamTotal) * 100 : 0;
    const deptPct = deptItem && dropoutData.deptTotal > 0
      ? (deptItem.count / dropoutData.deptTotal) * 100
      : 0;
    return {
      reason: item.reason,
      teamCount: item.count,
      teamPct,
      deptPct,
      better: teamPct <= deptPct,
    };
  }) : [];

  const maxTeamCount = dropoutData?.teamDropouts[0]?.count || 1;

  return (
    <div
      className="w-full h-full flex flex-col px-10 py-6 relative overflow-hidden"
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

      {/* Header row with title and hero percentages */}
      <div className={`flex items-start justify-between ${layout?.headerMargin || 'mb-6'} relative z-10`}>
        {/* Title */}
        <div>
          <motion.h2
            className={`${layout?.titleSize || 'text-3xl'} font-bold`}
            style={{ color: `#${colors.text}` }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            DROPOUT ANALYSIS
          </motion.h2>
          <motion.div
            className="h-1 w-36 mt-2"
            style={{ backgroundColor: `#${colors.accent}` }}
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
          <motion.p
            className="mt-1 text-sm"
            style={{ color: `#${colors.textLight}` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {teamName} — Non-Converted Lead Reasons
          </motion.p>
        </div>

        {/* Hero percentages */}
        <div className="flex items-end gap-8">
          {/* Department Rate */}
          <motion.div
            className="text-right"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, type: 'spring', stiffness: 100 }}
          >
            <div className="text-3xl font-bold leading-none">
              <CountUpPercent end={deptDropoutRate} delay={0.4} color={`#${colors.textLight}`} />
            </div>
            <p className="text-xs mt-1" style={{ color: `#${colors.textLight}` }}>
              Dept Dropout Rate
            </p>
          </motion.div>

          {/* Team Rate */}
          <motion.div
            className="text-right"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3, type: 'spring', stiffness: 100 }}
          >
            <div className={`${layout?.valueSize || 'text-6xl'} font-bold leading-none`}>
              <CountUpPercent
                end={teamDropoutRate}
                delay={0.5}
                color={teamDropoutRate <= deptDropoutRate ? `#${colors.success}` : `#${colors.warning}`}
              />
            </div>
            <p className="text-sm mt-1" style={{ color: `#${colors.textLight}` }}>
              Team Dropout Rate
            </p>
          </motion.div>
        </div>
      </div>

      {/* Main content */}
      <div className={`flex-1 flex ${layout?.spacing || 'gap-6'} relative z-10 min-h-0`}>
        {!hasData ? (
          <motion.div
            className="flex-1 flex items-center justify-center rounded-xl border"
            style={{
              backgroundColor: `#${colors.cardBg}`,
              borderColor: `#${colors.accent}30`,
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <p className="text-lg" style={{ color: `#${colors.textLight}` }}>
              No dropout data available for the selected period
            </p>
          </motion.div>
        ) : (
          <>
            {/* Left card: Top Dropout Reasons */}
            <motion.div
              className={`flex-1 rounded-xl ${layout?.cardPadding || 'p-4'} border flex flex-col`}
              style={{
                backgroundColor: `#${colors.cardBg}`,
                borderColor: `#${colors.accent}30`,
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3
                  className="text-sm font-bold tracking-wider"
                  style={{ color: `#${colors.accent}` }}
                >
                  TOP DROPOUT REASONS
                </h3>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `#${colors.accent}20`, color: `#${colors.accent}` }}
                >
                  {dropoutData.teamTotal} total
                </span>
              </div>

              <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                {dropoutData.teamDropouts.slice(0, 8).map((item, i) => (
                  <motion.div
                    key={item.reason}
                    className="flex items-center gap-3"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
                  >
                    <span
                      className="text-xs w-5 text-right font-bold tabular-nums"
                      style={{ color: `#${colors.textLight}` }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span
                          className="text-xs font-medium truncate"
                          style={{ color: `#${colors.text}` }}
                        >
                          {item.reason}
                        </span>
                        <span
                          className="text-sm font-bold tabular-nums ml-2 flex-shrink-0"
                          style={{ color: `#${colors.warning}` }}
                        >
                          {item.count}
                        </span>
                      </div>
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: `#${colors.background}` }}
                      >
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: `#${colors.warning}` }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(item.count / maxTeamCount) * 100}%` }}
                          transition={{ duration: 0.8, delay: 0.6 + i * 0.05 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right card: Team vs Dept Comparison */}
            <motion.div
              className={`flex-1 rounded-xl ${layout?.cardPadding || 'p-4'} border flex flex-col`}
              style={{
                backgroundColor: `#${colors.cardBg}`,
                borderColor: `#${colors.accent}30`,
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3
                  className="text-sm font-bold tracking-wider"
                  style={{ color: `#${colors.accent}` }}
                >
                  TEAM VS DEPARTMENT
                </h3>
                <div className="flex items-center gap-3 text-xs" style={{ color: `#${colors.textLight}` }}>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: `#${colors.success}` }} />
                    Better
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: `#${colors.warning}` }} />
                    Worse
                  </span>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                {comparisons.map((item, i) => (
                  <motion.div
                    key={item.reason}
                    className="flex items-center gap-3 py-1.5 px-2 rounded-md"
                    style={{
                      backgroundColor: i % 2 === 0 ? 'transparent' : `#${colors.background}30`,
                    }}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.6 + i * 0.05 }}
                  >
                    <span
                      className="text-xs font-medium truncate flex-1 min-w-0"
                      style={{ color: `#${colors.text}` }}
                    >
                      {item.reason}
                    </span>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right w-16">
                        <span
                          className="text-sm font-bold tabular-nums"
                          style={{ color: item.better ? `#${colors.success}` : `#${colors.warning}` }}
                        >
                          {item.teamPct.toFixed(1)}%
                        </span>
                        <span className="text-xs ml-1" style={{ color: `#${colors.textLight}` }}>
                          team
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: `#${colors.textLight}` }}>vs</span>
                      <div className="text-right w-16">
                        <span
                          className="text-sm font-bold tabular-nums"
                          style={{ color: `#${colors.textLight}` }}
                        >
                          {item.deptPct.toFixed(1)}%
                        </span>
                        <span className="text-xs ml-1" style={{ color: `#${colors.textLight}` }}>
                          dept
                        </span>
                      </div>
                      <span className="text-base">
                        {item.better ? '✅' : '⚠️'}
                      </span>
                    </div>
                  </motion.div>
                ))}
                {comparisons.length === 0 && (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm" style={{ color: `#${colors.textLight}` }}>
                      No comparison data available
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};
