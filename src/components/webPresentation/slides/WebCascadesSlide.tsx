import { motion } from 'framer-motion';
import { useState } from 'react';
import type { SlideColors } from '../../../utils/presentationGenerator';
import type { LayoutStyles } from '../webPresentationConfig';

// Thailand beach/island images (Phi Phi, Krabi, Railay)
const CASCADE_IMAGES = [
  'https://images.pexels.com/photos/1007657/pexels-photo-1007657.jpeg?auto=compress&cs=tinysrgb&w=1600', // Phi Phi Islands
  'https://images.pexels.com/photos/1450340/pexels-photo-1450340.jpeg?auto=compress&cs=tinysrgb&w=1600', // Railay Beach limestone cliffs
  'https://images.pexels.com/photos/2070485/pexels-photo-2070485.jpeg?auto=compress&cs=tinysrgb&w=1600', // Thai longtail boats
];

interface WebCascadesSlideProps {
  cascades: string[];
  colors: SlideColors;
  layout?: LayoutStyles;
}

export const WebCascadesSlide: React.FC<WebCascadesSlideProps> = ({
  cascades,
  colors,
  layout,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Pick consistent image based on cascade count
  const imageIndex = cascades.length % CASCADE_IMAGES.length;
  const backgroundImage = CASCADE_IMAGES[imageIndex];

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
      <div className={`${layout?.headerMargin || 'mb-6'} relative z-10`}>
        <motion.h2
          className={`${layout?.titleSize || 'text-4xl'} font-bold`}
          style={{ color: `#${colors.text}` }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          CASCADES & UPDATES
        </motion.h2>
        <motion.div
          className="h-1 w-56 mt-2"
          style={{ backgroundColor: `#${colors.accent}` }}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        />
      </div>

      {/* Cascades list */}
      <div className="flex-1 flex flex-col justify-center relative z-10">
        {cascades.length > 0 ? (
          <div className={`${layout?.spacing === 'gap-10' ? 'space-y-5' : layout?.spacing === 'gap-3' ? 'space-y-2' : 'space-y-3'}`}>
            {cascades.map((cascade, i) => (
              <motion.div
                key={i}
                className={`rounded-xl ${layout?.cardPadding || 'p-4'} border`}
                style={{
                  backgroundColor: `#${colors.cardBg}`,
                  borderColor: '#334155',
                }}
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
              >
                <span
                  className="text-lg flex items-start gap-3"
                  style={{ color: `#${colors.text}` }}
                >
                  <span style={{ color: `#${colors.accent}` }}>→</span>
                  {cascade}
                </span>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.p
            className="text-center text-lg"
            style={{ color: `#${colors.textLight}` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            No updates for this week
          </motion.p>
        )}
      </div>
    </div>
  );
};
