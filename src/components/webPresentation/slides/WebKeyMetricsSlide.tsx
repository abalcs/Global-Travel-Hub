import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import type { SlideColors } from '../../../utils/presentationGenerator';
import type { LayoutStyles } from '../webPresentationConfig';
import type { DestinationStats } from '../../PresentationGenerator';
import { findCuratedImage, getFallbackImage } from '../../../utils/destinationImages';

// Scenic travel images for key metrics background
const METRICS_IMAGES = [
  'https://images.pexels.com/photos/1285625/pexels-photo-1285625.jpeg?auto=compress&cs=tinysrgb&w=1600', // Santorini
  'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=1600', // Beach aerial
  'https://images.pexels.com/photos/1659437/pexels-photo-1659437.jpeg?auto=compress&cs=tinysrgb&w=1600', // New Zealand
];

const emptyStats: DestinationStats = { destinations: [], totalTrips: 0, totalPassthroughs: 0, tpRate: 0 };

interface WebKeyMetricsSlideProps {
  teamName: string;
  totalTrips: number;
  totalPassthroughs: number;
  totalQuotes: number;
  totalHotPasses: number;
  totalBookings: number;
  avgTQRate: number;
  avgTPRate: number;
  repeatStats?: DestinationStats;
  b2bStats?: DestinationStats;
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

// Destination card with image
const DestinationCard: React.FC<{
  destination: string;
  count: number;
  rank: number;
  maxCount: number;
  colors: SlideColors;
  accentColor: string;
  delay: number;
  onImageClick: (imageUrl: string, alt: string) => void;
}> = ({ destination, count, rank, maxCount, colors, accentColor, delay, onImageClick }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const imageData = useMemo(() => {
    return findCuratedImage(destination) || getFallbackImage(rank);
  }, [destination, rank]);

  const barWidth = (count / maxCount) * 100;
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  return (
    <motion.div
      className="flex items-stretch gap-2 rounded-lg overflow-hidden"
      style={{ backgroundColor: `#${colors.cardBg}` }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      {/* Image - clickable */}
      <div
        className="w-14 h-12 flex-shrink-0 relative overflow-hidden cursor-pointer group"
        onClick={() => onImageClick(imageData.url.replace('w=1600', 'w=1920'), imageData.alt)}
      >
        <motion.img
          src={imageData.url}
          alt={imageData.alt}
          className="w-full h-full object-cover transition-transform group-hover:scale-110"
          style={{ opacity: imageLoaded ? 1 : 0 }}
          onLoad={() => setImageLoaded(true)}
        />
        {!imageLoaded && (
          <div
            className="absolute inset-0 animate-pulse"
            style={{ backgroundColor: `${accentColor}30` }}
          />
        )}
        {/* Rank badge */}
        <div className="absolute top-0 left-0 text-xs">
          {medals[rank]}
        </div>
        {/* Hover indicator */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <span className="text-white opacity-0 group-hover:opacity-100 text-xs">🔍</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 py-1 pr-2 flex flex-col justify-center min-w-0">
        <div className="flex justify-between items-baseline gap-1">
          <span
            className="text-xs font-medium truncate"
            style={{ color: `#${colors.text}` }}
          >
            {destination}
          </span>
          <span
            className="text-xs font-bold flex-shrink-0"
            style={{ color: accentColor }}
          >
            {count}
          </span>
        </div>
        <div
          className="h-1 rounded-full overflow-hidden mt-0.5"
          style={{ backgroundColor: `#${colors.background}` }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: accentColor }}
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ duration: 0.6, delay: delay + 0.2 }}
          />
        </div>
      </div>
    </motion.div>
  );
};

// Lightbox component for viewing larger images
const ImageLightbox: React.FC<{
  imageUrl: string;
  alt: string;
  onClose: () => void;
}> = ({ imageUrl, alt, onClose }) => {
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 cursor-pointer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative max-w-[90vw] max-h-[90vh]"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
        />
        <p className="text-white text-center mt-3 text-lg font-medium">{alt}</p>
        <button
          className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-800 hover:bg-gray-200 transition-colors shadow-lg"
          onClick={onClose}
        >
          ✕
        </button>
      </motion.div>
    </motion.div>
  );
};

export const WebKeyMetricsSlide: React.FC<WebKeyMetricsSlideProps> = ({
  teamName,
  totalTrips,
  totalPassthroughs,
  totalQuotes,
  totalHotPasses,
  totalBookings,
  avgTQRate,
  avgTPRate,
  repeatStats = emptyStats,
  b2bStats = emptyStats,
  colors,
  layout,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt: string } | null>(null);

  // Pick consistent image based on team name
  const imageIndex = teamName.length % METRICS_IMAGES.length;
  const backgroundImage = METRICS_IMAGES[imageIndex];

  // Calculate P>Q rate
  const avgPQRate = totalPassthroughs > 0 ? (totalQuotes / totalPassthroughs) * 100 : 0;

  const rawMetrics = [
    { label: 'Trips', value: totalTrips, color: colors.primary },
    { label: 'Passthroughs', value: totalPassthroughs, color: colors.secondary },
    { label: 'Quotes', value: totalQuotes, color: colors.success },
    { label: 'Hot Passes', value: totalHotPasses, color: colors.warning },
    { label: 'Bookings', value: totalBookings, color: colors.accent },
  ];

  const conversionRates = [
    { label: 'T→P', description: 'Trips to Passthroughs', value: avgTPRate, color: colors.primary },
    { label: 'P→Q', description: 'Passthroughs to Quotes', value: avgPQRate, color: colors.secondary },
    { label: 'T→Q', description: 'Trips to Quotes', value: avgTQRate, color: colors.success },
  ];

  const hasRepeat = repeatStats.destinations.length > 0;
  const hasB2b = b2bStats.destinations.length > 0;

  const handleImageClick = (url: string, alt: string) => {
    setLightboxImage({ url, alt });
  };

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
      <div className={`${layout?.headerMargin || 'mb-2'} relative z-10`}>
        <motion.h2
          className={`${layout?.titleSize || 'text-3xl'} font-bold`}
          style={{ color: `#${colors.text}` }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          KEY METRICS
        </motion.h2>
        <motion.div
          className="h-1 w-32 mt-1"
          style={{ backgroundColor: `#${colors.accent}` }}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        />
      </div>

      {/* Conversion Rates - Compact */}
      <motion.div
        className={`${layout?.spacing === 'gap-10' ? 'mb-6' : layout?.spacing === 'gap-3' ? 'mb-2' : 'mb-3'} relative z-10`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className={`flex ${layout?.spacing || 'gap-3'}`}>
          {conversionRates.map((rate, i) => (
            <motion.div
              key={rate.label}
              className={`flex-1 rounded-lg ${layout?.cardPadding || 'p-2.5'} border text-center`}
              style={{
                backgroundColor: `#${colors.cardBg}`,
                borderColor: `#${rate.color}`,
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
            >
              <p className="text-lg font-bold mb-0.5" style={{ color: `#${colors.accent}` }}>
                {rate.label}
              </p>
              <p className={`${layout?.valueSize === 'text-8xl' ? 'text-5xl' : layout?.valueSize === 'text-7xl' ? 'text-4xl' : layout?.valueSize === 'text-4xl' ? 'text-2xl' : 'text-3xl'} font-bold`}>
                <CountUp
                  end={Math.round(rate.value * 10) / 10}
                  delay={0.5 + i * 0.1}
                  color={`#${rate.color}`}
                />
                <span style={{ color: `#${rate.color}` }}>%</span>
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: `#${colors.textLight}` }}>
                {rate.description}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Raw Metrics - Compact */}
      <div className={`relative z-10 ${layout?.spacing === 'gap-10' ? 'mb-6' : layout?.spacing === 'gap-3' ? 'mb-2' : 'mb-3'}`}>
        <div className={`flex ${layout?.spacing === 'gap-10' ? 'gap-4' : layout?.spacing === 'gap-3' ? 'gap-1' : 'gap-2'}`}>
          {rawMetrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              className="flex-1 rounded-lg p-2 border text-center"
              style={{
                backgroundColor: `#${colors.cardBg}`,
                borderColor: `#${metric.color}40`,
              }}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.06 }}
            >
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ color: `#${colors.textLight}` }}
              >
                {metric.label.toUpperCase()}
              </p>
              <p className="text-xl font-bold">
                <CountUp
                  end={metric.value}
                  delay={0.7 + i * 0.06}
                  color={`#${metric.color}`}
                />
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Repeat and B2B Destinations with Images */}
      {(hasRepeat || hasB2b) && (
        <div className={`flex-1 flex ${layout?.spacing || 'gap-4'} relative z-10`}>
          {/* Repeat T>P Section */}
          {hasRepeat && (
            <motion.div
              className="flex-1 rounded-xl p-3 border flex flex-col"
              style={{
                backgroundColor: `#${colors.cardBg}`,
                borderColor: `#${colors.secondary}40`,
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              {/* Header with stats */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔄</span>
                  <span
                    className="text-sm font-bold tracking-wider"
                    style={{ color: `#${colors.secondary}` }}
                  >
                    REPEAT T→P
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div
                    className="px-3 py-1 rounded-lg text-center"
                    style={{ backgroundColor: `#${colors.secondary}20` }}
                  >
                    <span className="text-xl font-bold" style={{ color: `#${colors.secondary}` }}>
                      {repeatStats.tpRate.toFixed(0)}%
                    </span>
                    <span className="text-xs ml-1" style={{ color: `#${colors.textLight}` }}>T→P</span>
                  </div>
                  <div
                    className="px-3 py-1 rounded-lg text-center"
                    style={{ backgroundColor: `#${colors.text}10` }}
                  >
                    <span className="text-xl font-bold" style={{ color: `#${colors.text}` }}>
                      {repeatStats.totalTrips}
                    </span>
                    <span className="text-xs ml-1" style={{ color: `#${colors.textLight}` }}>trips</span>
                  </div>
                </div>
              </div>

              {/* Destination cards */}
              <div className="flex-1 flex flex-col gap-1.5">
                {repeatStats.destinations.slice(0, 5).map((dest, i) => (
                  <DestinationCard
                    key={dest.destination}
                    destination={dest.destination}
                    count={dest.count}
                    rank={i}
                    maxCount={repeatStats.destinations[0]?.count || 1}
                    colors={colors}
                    accentColor={`#${colors.secondary}`}
                    delay={0.8 + i * 0.08}
                    onImageClick={handleImageClick}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* B2B T>P Section */}
          {hasB2b && (
            <motion.div
              className="flex-1 rounded-xl p-3 border flex flex-col"
              style={{
                backgroundColor: `#${colors.cardBg}`,
                borderColor: `#${colors.accent}40`,
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
            >
              {/* Header with stats */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💼</span>
                  <span
                    className="text-sm font-bold tracking-wider"
                    style={{ color: `#${colors.accent}` }}
                  >
                    B2B T→P
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div
                    className="px-3 py-1 rounded-lg text-center"
                    style={{ backgroundColor: `#${colors.accent}20` }}
                  >
                    <span className="text-xl font-bold" style={{ color: `#${colors.accent}` }}>
                      {b2bStats.tpRate.toFixed(0)}%
                    </span>
                    <span className="text-xs ml-1" style={{ color: `#${colors.textLight}` }}>T→P</span>
                  </div>
                  <div
                    className="px-3 py-1 rounded-lg text-center"
                    style={{ backgroundColor: `#${colors.text}10` }}
                  >
                    <span className="text-xl font-bold" style={{ color: `#${colors.text}` }}>
                      {b2bStats.totalTrips}
                    </span>
                    <span className="text-xs ml-1" style={{ color: `#${colors.textLight}` }}>trips</span>
                  </div>
                </div>
              </div>

              {/* Destination cards */}
              <div className="flex-1 flex flex-col gap-1.5">
                {b2bStats.destinations.slice(0, 5).map((dest, i) => (
                  <DestinationCard
                    key={dest.destination}
                    destination={dest.destination}
                    count={dest.count}
                    rank={i}
                    maxCount={b2bStats.destinations[0]?.count || 1}
                    colors={colors}
                    accentColor={`#${colors.accent}`}
                    delay={0.85 + i * 0.08}
                    onImageClick={handleImageClick}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Image Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <ImageLightbox
            imageUrl={lightboxImage.url}
            alt={lightboxImage.alt}
            onClose={() => setLightboxImage(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
