import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useEffect } from 'react';
import type { SlideColors } from '../../../utils/presentationGenerator';
import type { ForecastDestination } from '../../PresentationGenerator';
import type { LayoutStyles } from '../webPresentationConfig';
import { findCuratedImage, getFallbackImage } from '../../../utils/destinationImages';

// Crystal ball / future-looking travel images for forecast background
const FORECAST_IMAGES = [
  'https://images.pexels.com/photos/2325446/pexels-photo-2325446.jpeg?auto=compress&cs=tinysrgb&w=1600', // Road stretching ahead
  'https://images.pexels.com/photos/1252500/pexels-photo-1252500.jpeg?auto=compress&cs=tinysrgb&w=1600', // Sunrise over mountains
  'https://images.pexels.com/photos/2387793/pexels-photo-2387793.jpeg?auto=compress&cs=tinysrgb&w=1600', // Hot air balloons
];

interface WebForecastDestinationsSlideProps {
  destinations: ForecastDestination[];
  periodLabel: string;
  teamPeriodLabel?: string;
  colors: SlideColors;
  layout?: LayoutStyles;
}

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

// Image component with loading state and T>P rate display
const ForecastDestinationCard: React.FC<{
  destination: string;
  historicalCount: number;
  teamTrips: number;
  teamPassthroughs: number;
  teamTpRate: number;
  rank: number;
  maxCount: number;
  colors: SlideColors;
  delay: number;
  onImageClick: (imageUrl: string, alt: string) => void;
}> = ({ destination, historicalCount, teamTrips, teamPassthroughs, teamTpRate, rank, maxCount, colors, delay, onImageClick }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Get image URL synchronously (curated images don't need async)
  const imageData = useMemo(() => {
    return findCuratedImage(destination) || getFallbackImage(rank);
  }, [destination, rank]);

  const barWidth = (historicalCount / maxCount) * 100;
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  return (
    <motion.div
      className="flex items-stretch gap-4 rounded-xl overflow-hidden"
      style={{ backgroundColor: `#${colors.cardBg}` }}
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      {/* Image - clickable */}
      <div
        className="w-28 h-20 flex-shrink-0 relative overflow-hidden cursor-pointer group"
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
            style={{ backgroundColor: `#${colors.secondary}30` }}
          />
        )}
        {/* Rank badge */}
        <div className="absolute top-1 left-1 text-lg">
          {medals[rank]}
        </div>
        {/* Hover indicator */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <span className="text-white opacity-0 group-hover:opacity-100 text-sm">🔍</span>
        </div>
      </div>

      {/* Content - destination name, historical count, and progress bar */}
      <div className="flex-1 py-2 pr-3 flex flex-col justify-center">
        <div className="flex justify-between items-baseline mb-1">
          <span
            className="text-base font-semibold truncate"
            style={{ color: `#${colors.text}` }}
          >
            {destination}
          </span>
          <span
            className="text-xl font-bold ml-2"
            style={{ color: `#${colors.secondary}` }}
            title="Historical passthroughs"
          >
            {historicalCount}
          </span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: `#${colors.background}` }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              backgroundColor: rank === 0
                ? `#${colors.primary}`
                : rank === 1
                  ? `#${colors.secondary}`
                  : `#${colors.accent}`
            }}
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ duration: 0.8, delay: delay + 0.3 }}
          />
        </div>
      </div>

      {/* Team T>P stats column */}
      <div
        className="w-32 flex-shrink-0 py-2 px-3 flex flex-col justify-center border-l"
        style={{ borderColor: `#${colors.background}` }}
      >
        <div className="text-xs mb-1" style={{ color: `#${colors.textLight}` }}>
          Your Team T&gt;P
        </div>
        {teamTrips > 0 ? (
          <>
            <div className="flex items-baseline gap-1">
              <motion.span
                className="text-xl font-bold"
                style={{ color: `#${colors.primary}` }}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: delay + 0.4, type: 'spring', stiffness: 200 }}
              >
                {teamTpRate.toFixed(0)}%
              </motion.span>
            </div>
            <div className="text-xs" style={{ color: `#${colors.textLight}`, opacity: 0.8 }}>
              {teamPassthroughs}/{teamTrips} trips
            </div>
          </>
        ) : (
          <div className="text-sm" style={{ color: `#${colors.textLight}`, opacity: 0.6 }}>
            No data
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const WebForecastDestinationsSlide: React.FC<WebForecastDestinationsSlideProps> = ({
  destinations,
  periodLabel,
  teamPeriodLabel,
  colors,
  layout,
}) => {
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt: string } | null>(null);
  const [bgImageLoaded, setBgImageLoaded] = useState(false);
  const maxCount = destinations.length > 0 ? destinations[0].historicalCount : 1;

  // Pick consistent image based on data
  const imageIndex = destinations.length % FORECAST_IMAGES.length;
  const backgroundImage = FORECAST_IMAGES[imageIndex];

  const handleImageClick = (url: string, alt: string) => {
    setLightboxImage({ url, alt });
  };

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
        style={{ opacity: bgImageLoaded ? 0.4 : 0, transition: 'opacity 0.8s ease-in-out' }}
        onLoad={() => setBgImageLoaded(true)}
      />

      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `#${colors.background}`, opacity: 0.75 }}
      />

      {/* Left accent bar */}
      <motion.div
        className="absolute left-0 top-0 w-2 h-full z-10"
        style={{ backgroundColor: `#${colors.secondary}` }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Bottom right decorative circle */}
      {layout?.showDecorations !== false && (
        <motion.div
          className="absolute -bottom-12 -right-12 w-24 h-24 rounded-full z-10"
          style={{ backgroundColor: `#${colors.primary}`, opacity: 0.5 }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        />
      )}

      {/* Header */}
      <div className={`${layout?.headerMargin || 'mb-6'} relative z-10`}>
        <div className="flex items-center gap-3 mb-2">
          <motion.span
            className="text-4xl"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            🔮
          </motion.span>
          <motion.h2
            className={`${layout?.titleSize || 'text-4xl'} font-bold`}
            style={{ color: `#${colors.text}` }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            FORECAST: TRENDING DESTINATIONS
          </motion.h2>
        </div>
        <motion.div
          className="h-1 w-64 mt-2"
          style={{ backgroundColor: `#${colors.secondary}` }}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        />
        <motion.p
          className="mt-3 text-base"
          style={{ color: `#${colors.textLight}` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Department passthroughs from <span style={{ color: `#${colors.secondary}` }} className="font-semibold">{periodLabel}</span>
          {teamPeriodLabel && (
            <> | Your team's T&gt;P from <span style={{ color: `#${colors.primary}` }} className="font-semibold">{teamPeriodLabel}</span></>
          )}
        </motion.p>
        <motion.p
          className="mt-1 text-sm"
          style={{ color: `#${colors.textLight}`, opacity: 0.8 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          What destinations were hot this time last year? See how your team is converting trips in these areas.
        </motion.p>
      </div>

      {/* Destinations list */}
      <div className={`flex-1 flex flex-col ${layout?.spacing || 'gap-4'} relative z-10`}>
        {destinations.length > 0 ? (
          destinations.map((dest, index) => (
            <ForecastDestinationCard
              key={dest.destination}
              destination={dest.destination}
              historicalCount={dest.historicalCount}
              teamTrips={dest.teamTrips}
              teamPassthroughs={dest.teamPassthroughs}
              teamTpRate={dest.teamTpRate}
              rank={index}
              maxCount={maxCount}
              colors={colors}
              delay={0.3 + index * 0.1}
              onImageClick={handleImageClick}
            />
          ))
        ) : (
          <motion.div
            className="flex-1 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="text-6xl mb-4">📊</span>
            <p
              className="text-center text-xl"
              style={{ color: `#${colors.textLight}` }}
            >
              No historical data available for this period
            </p>
            <p
              className="text-center text-sm mt-2"
              style={{ color: `#${colors.textLight}`, opacity: 0.7 }}
            >
              Upload data that includes last year's passthroughs to see forecasting insights
            </p>
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
