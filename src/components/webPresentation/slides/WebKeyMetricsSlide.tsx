import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { SlideColors } from '../../../utils/presentationGenerator';
import type { LayoutStyles } from '../webPresentationConfig';

// Scenic travel images for key metrics background
const METRICS_IMAGES = [
  'https://images.pexels.com/photos/1285625/pexels-photo-1285625.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/1659437/pexels-photo-1659437.jpeg?auto=compress&cs=tinysrgb&w=1600',
];

export interface SegmentData {
  enquiries: number;
  passthroughs: number;
  quotes: number;
  bookings: number;
  epRate: number;
  eqRate: number;
  ebRate: number;
}

interface WebKeyMetricsSlideProps {
  teamName: string;
  prospectData: SegmentData;
  taData: SegmentData;
  repeatData: SegmentData;
  colors: SlideColors;
  layout?: LayoutStyles;
}

const CountUp: React.FC<{ end: number; delay?: number; color: string; suffix?: string }> = ({
  end,
  delay = 0,
  color,
  suffix = '',
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

  return <span style={{ color }}>{Math.round(displayValue)}{suffix}</span>;
};

const SegmentColumn: React.FC<{
  title: string;
  icon: string;
  data: SegmentData;
  accentColor: string;
  colors: SlideColors;
  delay: number;
}> = ({ title, icon, data, accentColor, colors, delay }) => {
  const volumeRows = [
    { label: 'Enquiries', value: data.enquiries },
    { label: 'Passthroughs', value: data.passthroughs },
    { label: 'Quotes', value: data.quotes },
    { label: 'Bookings', value: data.bookings },
  ];

  const rateRows = [
    { label: 'E>P', value: data.epRate },
    { label: 'E>Q', value: data.eqRate },
    { label: 'E>B', value: data.ebRate },
  ];

  return (
    <motion.div
      className="flex-1 rounded-xl border flex flex-col overflow-hidden"
      style={{
        backgroundColor: `#${colors.cardBg}`,
        borderColor: `${accentColor}60`,
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center gap-2"
        style={{ backgroundColor: `${accentColor}20` }}
      >
        <span className="text-lg">{icon}</span>
        <span
          className="text-sm font-bold tracking-wider"
          style={{ color: accentColor }}
        >
          {title}
        </span>
      </div>

      {/* Volume metrics */}
      <div className="px-4 py-2 flex-1">
        {volumeRows.map((row, i) => (
          <div
            key={row.label}
            className="flex justify-between items-center py-1.5 border-b last:border-b-0"
            style={{ borderColor: `#${colors.accent}15` }}
          >
            <span className="text-xs" style={{ color: `#${colors.textLight}` }}>
              {row.label}
            </span>
            <span className="text-sm font-bold tabular-nums">
              <CountUp
                end={row.value}
                delay={delay + 0.2 + i * 0.08}
                color={`#${colors.text}`}
              />
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="mx-4" style={{ borderTop: `1px solid ${accentColor}30` }} />

      {/* Conversion rates */}
      <div className="px-4 py-2">
        {rateRows.map((row, i) => (
          <div
            key={row.label}
            className="flex justify-between items-center py-1.5"
          >
            <span
              className="text-xs font-semibold"
              style={{ color: accentColor }}
            >
              {row.label}
            </span>
            <span className="text-base font-bold tabular-nums">
              <CountUp
                end={row.value}
                delay={delay + 0.5 + i * 0.1}
                color={accentColor}
                suffix="%"
              />
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export const WebKeyMetricsSlide: React.FC<WebKeyMetricsSlideProps> = ({
  teamName,
  prospectData,
  taData,
  repeatData,
  colors,
  layout,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const imageIndex = teamName.length % METRICS_IMAGES.length;
  const backgroundImage = METRICS_IMAGES[imageIndex];

  return (
    <div
      className="w-full h-full flex flex-col px-10 py-5 relative overflow-hidden"
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

      {/* Header */}
      <div className={`${layout?.headerMargin || 'mb-3'} relative z-10`}>
        <motion.h2
          className={`${layout?.titleSize || 'text-3xl'} font-bold`}
          style={{ color: `#${colors.text}` }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          KEY METRICS BY SEGMENT
        </motion.h2>
        <motion.div
          className="h-1 w-32 mt-1"
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
          {teamName} — Lead Source Breakdown
        </motion.p>
      </div>

      {/* Three segment columns */}
      <div className={`flex-1 flex ${layout?.spacing || 'gap-4'} relative z-10 min-h-0`}>
        <SegmentColumn
          title="PROSPECTS"
          icon="🆕"
          data={prospectData}
          accentColor={`#${colors.primary}`}
          colors={colors}
          delay={0.3}
        />
        <SegmentColumn
          title="TRAVEL AGENTS"
          icon="💼"
          data={taData}
          accentColor={`#${colors.secondary}`}
          colors={colors}
          delay={0.4}
        />
        <SegmentColumn
          title="REPEAT CLIENTS"
          icon="🔄"
          data={repeatData}
          accentColor={`#${colors.accent}`}
          colors={colors}
          delay={0.5}
        />
      </div>
    </div>
  );
};
