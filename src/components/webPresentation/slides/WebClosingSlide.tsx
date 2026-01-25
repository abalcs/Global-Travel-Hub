import { motion } from 'framer-motion';
import { useState } from 'react';
import type { SlideColors } from '../../../utils/presentationGenerator';
import type { LayoutStyles } from '../webPresentationConfig';

// Motivational travel/adventure images
const CLOSING_IMAGES = [
  'https://images.pexels.com/photos/2356045/pexels-photo-2356045.jpeg?auto=compress&cs=tinysrgb&w=1600', // Machu Picchu
  'https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg?auto=compress&cs=tinysrgb&w=1600',  // Mountain peak
  'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=1600', // Lake mountain
  'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=1600', // Thailand sunset
];

interface WebClosingSlideProps {
  teamName: string;
  colors: SlideColors;
  layout?: LayoutStyles;
}

export const WebClosingSlide: React.FC<WebClosingSlideProps> = ({
  teamName,
  colors,
  layout,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Pick consistent image based on team name
  const imageIndex = teamName.length % CLOSING_IMAGES.length;
  const backgroundImage = CLOSING_IMAGES[imageIndex];

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center px-12 relative overflow-hidden"
      style={{ backgroundColor: `#${colors.background}` }}
    >
      {/* Background Image */}
      <img
        src={backgroundImage}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.8s ease-in-out' }}
        onLoad={() => setImageLoaded(true)}
      />

      {/* Dark overlay */}
      <motion.div
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: imageLoaded ? 1 : 0 }}
        transition={{ duration: 0.8 }}
      />

      {/* Gradient overlay for theme colors */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 0%, #${colors.background}80 100%)`
        }}
      />

      {/* Content */}
      <motion.h1
        className={`${layout?.valueSize === 'text-8xl' ? 'text-8xl' : layout?.valueSize === 'text-7xl' ? 'text-8xl' : layout?.valueSize === 'text-4xl' ? 'text-5xl' : 'text-7xl'} font-bold text-center ${layout?.headerMargin || 'mb-6'} drop-shadow-2xl relative z-10`}
        style={{ color: `#${colors.text}` }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: 0.7,
          delay: 0.3,
          type: 'spring',
          stiffness: 200,
          damping: 15,
        }}
      >
        Great Work Team!
      </motion.h1>

      <motion.p
        className={`${layout?.titleSize || 'text-2xl'} text-center drop-shadow-lg relative z-10`}
        style={{ color: `#${colors.accent}` }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        Questions? Discussion? Ideas?
      </motion.p>

      <motion.p
        className="absolute bottom-12 text-lg drop-shadow-md relative z-10"
        style={{ color: `#${colors.textLight}` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        {teamName}
      </motion.p>
    </div>
  );
};
