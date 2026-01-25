import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import type { SlideColors, TopDestination } from '../../../utils/presentationGenerator';
import type { LayoutStyles } from '../webPresentationConfig';
import { findCuratedImage, getFallbackImage } from '../../../utils/destinationImages';

// Scenic travel images for hot pass rate background
const HOTPASS_IMAGES = [
  'https://images.pexels.com/photos/3155666/pexels-photo-3155666.jpeg?auto=compress&cs=tinysrgb&w=1600', // Safari sunset
  'https://images.pexels.com/photos/631317/pexels-photo-631317.jpeg?auto=compress&cs=tinysrgb&w=1600', // Desert dunes
  'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg?auto=compress&cs=tinysrgb&w=1600', // Aurora borealis
];

interface Performer {
  agentName: string;
  hotPassRate: number;
  isSenior: boolean;
}

interface WebHotPassRateSlideProps {
  avgHotPassRate: number;
  deptAvgHotPassRate?: number;
  topPerformers: Performer[];
  hotPassDestinations?: TopDestination[];
  colors: SlideColors;
  layout?: LayoutStyles;
}

const CountUpPercent: React.FC<{ end: number; delay?: number; color: string }> = ({
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

  return <span style={{ color }}>{displayValue}%</span>;
};

// Lightbox component for viewing larger images
const ImageLightbox: React.FC<{
  imageUrl: string;
  alt: string;
  onClose: () => void;
}> = ({ imageUrl, alt, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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

// Compact destination card with image for hot pass destinations
const HotPassDestinationCard: React.FC<{
  destination: string;
  count: number;
  rank: number;
  maxCount: number;
  colors: SlideColors;
  delay: number;
  onImageClick: (imageUrl: string, alt: string) => void;
}> = ({ destination, count, rank, maxCount, colors, delay, onImageClick }) => {
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
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      {/* Image - clickable */}
      <div
        className="w-16 h-14 flex-shrink-0 relative overflow-hidden cursor-pointer group"
        onClick={() => onImageClick(imageData.url.replace('w=1600', 'w=1920'), imageData.alt)}
      >
        <motion.img
          src={imageData.url}
          alt={imageData.alt}
          className="w-full h-full object-cover transition-transform group-hover:scale-110"
          style={{ opacity: imageLoaded ? 1 : 0 }}
          onLoad={() => setImageLoaded(true)}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6, delay: delay + 0.2 }}
        />
        {!imageLoaded && (
          <div
            className="absolute inset-0 animate-pulse"
            style={{ backgroundColor: `#${colors.warning}30` }}
          />
        )}
        {/* Rank badge */}
        <div className="absolute top-0.5 left-0.5 text-sm">
          {medals[rank]}
        </div>
        {/* Hover indicator */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <span className="text-white opacity-0 group-hover:opacity-100 text-xs">🔍</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 py-1.5 pr-2 flex flex-col justify-center">
        <div className="flex justify-between items-baseline mb-0.5">
          <span
            className="text-xs font-semibold truncate"
            style={{ color: `#${colors.text}` }}
          >
            {destination}
          </span>
          <span
            className="text-sm font-bold ml-2"
            style={{ color: `#${colors.warning}` }}
          >
            {count}
          </span>
        </div>
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: `#${colors.background}` }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: `#${colors.warning}` }}
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ duration: 0.8, delay: delay + 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  );
};

export const WebHotPassRateSlide: React.FC<WebHotPassRateSlideProps> = ({
  avgHotPassRate,
  deptAvgHotPassRate = 0,
  topPerformers,
  hotPassDestinations = [],
  colors,
  layout,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt: string } | null>(null);

  const rateColor =
    avgHotPassRate >= 60
      ? colors.success
      : avgHotPassRate >= 50
      ? colors.warning
      : colors.text;

  const deptRateColor =
    deptAvgHotPassRate >= 60
      ? colors.success
      : deptAvgHotPassRate >= 50
      ? colors.warning
      : colors.text;

  // Determine column layout based on team size
  const allPerformers = topPerformers;
  const useThreeColumns = allPerformers.length > 15;
  const useTwoColumns = allPerformers.length > 8;

  // Pick consistent image based on rate
  const imageIndex = Math.floor(avgHotPassRate) % HOTPASS_IMAGES.length;
  const backgroundImage = HOTPASS_IMAGES[imageIndex];

  const hasDestinations = hotPassDestinations.length > 0;

  const handleImageClick = (url: string, alt: string) => {
    setLightboxImage({ url, alt });
  };

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

      {/* Header row with title and hero percentage */}
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
            HOT PASS RATE
          </motion.h2>
          <motion.div
            className="h-1 w-36 mt-2"
            style={{ backgroundColor: `#${colors.accent}` }}
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
        </div>

        {/* Hero percentages - Team and Department */}
        <div className="flex items-end gap-8">
          {/* Department Average */}
          <motion.div
            className="text-right"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, type: 'spring', stiffness: 100 }}
          >
            <div className="text-3xl font-bold leading-none">
              <CountUpPercent end={Math.round(deptAvgHotPassRate)} delay={0.4} color={`#${deptRateColor}`} />
            </div>
            <p className="text-xs mt-1" style={{ color: `#${colors.textLight}` }}>
              Dept Average
            </p>
          </motion.div>

          {/* Team Average */}
          <motion.div
            className="text-right"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3, type: 'spring', stiffness: 100 }}
          >
            <div className={`${layout?.valueSize || 'text-6xl'} font-bold leading-none`}>
              <CountUpPercent end={Math.round(avgHotPassRate)} delay={0.5} color={`#${rateColor}`} />
            </div>
            <p className="text-sm mt-1" style={{ color: `#${colors.textLight}` }}>
              Team Average
            </p>
          </motion.div>
        </div>
      </div>

      {/* Main content - two balanced sections */}
      <div className={`flex-1 flex ${layout?.spacing || 'gap-6'} relative z-10`}>
        {/* Team Members Card */}
        <motion.div
          className={`${hasDestinations ? 'flex-1' : 'w-full'} rounded-xl ${layout?.cardPadding || 'p-4'} border`}
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
              TEAM MEMBERS
            </h3>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `#${colors.accent}20`, color: `#${colors.accent}` }}
            >
              {allPerformers.length}
            </span>
          </div>

          <div
            className={`grid gap-x-4 gap-y-1 ${
              useThreeColumns
                ? 'grid-cols-3'
                : useTwoColumns
                ? 'grid-cols-2'
                : 'grid-cols-1'
            }`}
          >
            {allPerformers.map((performer, i) => (
              <motion.div
                key={performer.agentName}
                className="flex items-center justify-between py-1.5 px-2 rounded-md"
                style={{
                  backgroundColor: i % 2 === 0 ? 'transparent' : `#${colors.background}30`,
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: 0.5 + i * 0.02 }}
              >
                <span className="text-sm truncate" style={{ color: `#${colors.text}` }}>
                  {performer.agentName}
                  {performer.isSenior && (
                    <span className="ml-1 text-amber-400" title="Senior">⚜</span>
                  )}
                </span>
                <span
                  className="font-bold text-sm tabular-nums ml-2 flex-shrink-0"
                  style={{
                    color: performer.hotPassRate >= 60
                      ? `#${colors.success}`
                      : performer.hotPassRate >= 50
                      ? `#${colors.warning}`
                      : `#${colors.textLight}`,
                  }}
                >
                  {performer.hotPassRate.toFixed(0)}%
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Destinations Card */}
        {hasDestinations && (
          <motion.div
            className="w-72 rounded-xl p-4 border flex flex-col"
            style={{
              backgroundColor: `#${colors.cardBg}`,
              borderColor: `#${colors.warning}30`,
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🔥</span>
              <h3
                className="text-sm font-bold tracking-wider"
                style={{ color: `#${colors.warning}` }}
              >
                TOP DESTINATIONS
              </h3>
            </div>

            <div className="flex-1 flex flex-col gap-2">
              {hotPassDestinations.slice(0, 5).map((dest, i) => (
                <HotPassDestinationCard
                  key={dest.destination}
                  destination={dest.destination}
                  count={dest.count}
                  rank={i}
                  maxCount={hotPassDestinations[0]?.count || 1}
                  colors={colors}
                  delay={0.6 + i * 0.1}
                  onImageClick={handleImageClick}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

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
