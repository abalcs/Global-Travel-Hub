import { motion } from 'framer-motion';

interface WebPresentationControlsProps {
  currentSlide: number;
  totalSlides: number;
  onNext: () => void;
  onPrev: () => void;
  onGoToSlide: (index: number) => void;
  onExit: () => void;
  onToggleFullscreen: () => void;
  onExportHtml: () => void;
  isFullscreen: boolean;
  colors: {
    primary: string;
    text: string;
    textLight: string;
  };
}

export const WebPresentationControls: React.FC<WebPresentationControlsProps> = ({
  currentSlide,
  totalSlides,
  onNext,
  onPrev,
  onGoToSlide,
  onExit,
  onToggleFullscreen,
  onExportHtml,
  isFullscreen,
  colors,
}) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-t from-black/30 to-transparent z-50">
      {/* Left side - Exit button */}
      <button
        onClick={onExit}
        className="p-2 rounded-lg bg-black/30 hover:bg-black/50 transition-colors"
        style={{ color: `#${colors.text}` }}
        title="Exit (Esc)"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Center - Progress dots */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={currentSlide === 0}
          className="p-2 rounded-lg bg-black/30 hover:bg-black/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          style={{ color: `#${colors.text}` }}
          title="Previous (Left Arrow)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2 px-3">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              onClick={() => onGoToSlide(index)}
              className="relative"
              title={`Slide ${index + 1}`}
            >
              <motion.div
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  backgroundColor: index === currentSlide ? `#${colors.primary}` : `#${colors.textLight}`,
                }}
                whileHover={{ scale: 1.3 }}
                animate={{
                  scale: index === currentSlide ? 1.3 : 1,
                }}
              />
            </button>
          ))}
        </div>

        <button
          onClick={onNext}
          disabled={currentSlide === totalSlides - 1}
          className="p-2 rounded-lg bg-black/30 hover:bg-black/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          style={{ color: `#${colors.text}` }}
          title="Next (Right Arrow)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Right side - Export, Fullscreen & slide counter */}
      <div className="flex items-center gap-3">
        <span
          className="text-sm font-medium px-2"
          style={{ color: `#${colors.textLight}` }}
        >
          {currentSlide + 1} / {totalSlides}
        </span>
        <button
          onClick={onExportHtml}
          className="p-2 rounded-lg bg-black/30 hover:bg-black/50 transition-colors"
          style={{ color: `#${colors.text}` }}
          title="Export as HTML"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
        <button
          onClick={onToggleFullscreen}
          className="p-2 rounded-lg bg-black/30 hover:bg-black/50 transition-colors"
          style={{ color: `#${colors.text}` }}
          title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
        >
          {isFullscreen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};
