import { motion } from 'framer-motion';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { SlideColors } from '../../../utils/presentationGenerator';
import { formatDate, formatMonth, getWeekNumber } from '../../../utils/presentationGenerator';
import type { LayoutStyles } from '../webPresentationConfig';

// Free stock travel videos from Pexels - verified working HD versions (no attribution required)
const BACKGROUND_VIDEOS = [
  // Mountain aerial with fog
  'https://videos.pexels.com/video-files/2169880/2169880-hd_1920_1080_30fps.mp4',
  // Beach waves crashing
  'https://videos.pexels.com/video-files/1093662/1093662-hd_1920_1080_30fps.mp4',
  // Tropical island aerial
  'https://videos.pexels.com/video-files/1739010/1739010-hd_1920_1080_30fps.mp4',
  // Forest aerial flyover
  'https://videos.pexels.com/video-files/3015510/3015510-hd_1920_1080_24fps.mp4',
  // Ocean waves aerial
  'https://videos.pexels.com/video-files/1409899/1409899-hd_1920_1080_25fps.mp4',
];

// Pick a consistent video based on the current day (so it doesn't change on re-renders)
const getVideoForToday = (): string => {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  return BACKGROUND_VIDEOS[dayOfYear % BACKGROUND_VIDEOS.length];
};

interface WebTitleSlideProps {
  teamName: string;
  meetingDate: Date;
  colors: SlideColors;
  backgroundVideoUrl?: string;
  showBackgroundVideo?: boolean;
  layout?: LayoutStyles;
}

export const WebTitleSlide: React.FC<WebTitleSlideProps> = ({
  teamName,
  meetingDate,
  colors,
  backgroundVideoUrl,
  showBackgroundVideo = true,
  layout,
}) => {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [allVideosFailed, setAllVideosFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Use provided URL or get the video for today
  const videoUrl = backgroundVideoUrl || getVideoForToday();

  // For fallback, use the full list
  const currentFallbackUrl = BACKGROUND_VIDEOS[currentVideoIndex];

  // Handle video error - try next video in the list
  const handleVideoError = useCallback(() => {
    if (backgroundVideoUrl) {
      // If custom URL fails, try the fallback list
      setCurrentVideoIndex(0);
    } else if (currentVideoIndex < BACKGROUND_VIDEOS.length - 1) {
      // Try next video in list
      setCurrentVideoIndex(prev => prev + 1);
    } else {
      // All videos failed
      setAllVideosFailed(true);
    }
  }, [backgroundVideoUrl, currentVideoIndex]);

  // Reset video state when URL changes
  useEffect(() => {
    setVideoLoaded(false);
  }, [videoUrl, currentFallbackUrl]);

  // Determine which URL to actually use
  const activeVideoUrl = backgroundVideoUrl
    ? (videoLoaded ? backgroundVideoUrl : currentFallbackUrl)
    : videoUrl;

  return (
    <div
      className="w-full h-full flex flex-col justify-center px-12 relative overflow-hidden"
      style={{ backgroundColor: `#${colors.background}` }}
    >
      {/* Background Video */}
      {showBackgroundVideo && !allVideosFailed && (
        <>
          <video
            ref={videoRef}
            key={activeVideoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: videoLoaded ? 1 : 0, transition: 'opacity 1s ease-in-out' }}
            autoPlay
            loop
            muted
            playsInline
            onCanPlay={() => setVideoLoaded(true)}
            onError={handleVideoError}
          >
            <source src={activeVideoUrl} type="video/mp4" />
          </video>
          {/* Dark overlay for text readability */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: videoLoaded ? 1 : 0 }}
            transition={{ duration: 1 }}
          />
        </>
      )}

      {/* Decorative elements - only show if no video or video failed, and layout allows decorations */}
      {layout?.showDecorations !== false && (!showBackgroundVideo || allVideosFailed || !videoLoaded) && (
        <>
          <motion.div
            className="absolute -top-24 -right-24 w-64 h-64 rounded-full"
            style={{ backgroundColor: `#${colors.primary}` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.8 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          />
          <motion.div
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full"
            style={{ backgroundColor: `#${colors.secondary}` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.9 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          />
          <motion.div
            className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full"
            style={{ backgroundColor: `#${colors.secondary}` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.7 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          />
          <motion.div
            className="absolute bottom-12 left-20 w-20 h-20 rounded-full"
            style={{ backgroundColor: `#${colors.accent}` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.8 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          />
          <motion.div
            className="absolute bottom-32 left-8 w-32 h-1"
            style={{ backgroundColor: `#${colors.accent}` }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          />
        </>
      )}

      {/* Subtle gradient overlay when video is playing */}
      {showBackgroundVideo && videoLoaded && !allVideosFailed && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, #${colors.primary}40 0%, transparent 50%, #${colors.secondary}30 100%)`
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10">
        <motion.h1
          className={`${layout?.valueSize === 'text-8xl' ? 'text-8xl' : layout?.valueSize === 'text-7xl' ? 'text-7xl' : layout?.valueSize === 'text-4xl' ? 'text-5xl' : 'text-6xl'} font-bold ${layout?.headerMargin || 'mb-4'} drop-shadow-lg`}
          style={{ color: `#${colors.text}` }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {teamName}
        </motion.h1>

        <motion.h2
          className={`${layout?.titleSize || 'text-3xl'} font-bold ${layout?.spacing === 'gap-10' ? 'mb-12' : layout?.spacing === 'gap-3' ? 'mb-4' : 'mb-8'} drop-shadow-md`}
          style={{ color: `#${colors.accent}` }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          TEAM HUDDLE
        </motion.h2>

        <motion.p
          className="text-xl mb-2 drop-shadow-md"
          style={{ color: `#${colors.textLight}` }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {formatDate(meetingDate)}
        </motion.p>

        <motion.p
          className="text-lg drop-shadow-md"
          style={{ color: `#${colors.textLight}` }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
        >
          Week {getWeekNumber(meetingDate)} of {formatMonth(meetingDate)}
        </motion.p>
      </div>
    </div>
  );
};
