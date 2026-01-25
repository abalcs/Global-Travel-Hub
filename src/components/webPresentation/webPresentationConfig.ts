import type { SlideColors, ThemeStyle } from '../../utils/presentationGenerator';
import { THEMES as BASE_THEMES } from '../../utils/presentationGenerator';

// Extended themes for web presentation (audley-brand is now in base ThemeStyle)
export type WebThemeStyle = ThemeStyle | 'midnight-purple' | 'ocean-breeze' | 'forest-green' | 'rose-gold' | 'neon-nights' | 'minimalist-gray';

export type AnimationStyle = 'slide' | 'fade' | 'zoom' | 'flip' | 'none';

export type LayoutStyle = 'default' | 'minimalist' | 'data-focused' | 'visual-impact';

export interface LayoutStyles {
  showDecorations: boolean;
  titleSize: string;
  valueSize: string;
  cardPadding: string;
  spacing: string;
  headerMargin: string;
}

export interface WebPresentationStyle {
  theme: WebThemeStyle;
  animation: AnimationStyle;
  layout: LayoutStyle;
}

// Additional web-only themes
const WEB_THEMES: Record<Exclude<WebThemeStyle, ThemeStyle>, SlideColors> = {
  'midnight-purple': {
    primary: '9333EA',      // Purple 600
    secondary: 'A855F7',    // Purple 500
    accent: 'E879F9',       // Fuchsia 400
    background: '0C0A1D',   // Deep purple-black
    cardBg: '1A1730',       // Dark purple
    text: 'F5F3FF',         // Purple 50
    textLight: 'C4B5FD',    // Purple 300
    success: '34D399',      // Emerald 400
    warning: 'FBBF24',      // Amber 400
    myTeamHighlight: '7C3AED',
  },
  'ocean-breeze': {
    primary: '0891B2',      // Cyan 600
    secondary: '06B6D4',    // Cyan 500
    accent: '22D3EE',       // Cyan 400
    background: '042F2E',   // Dark teal
    cardBg: '0D3D3B',       // Darker teal
    text: 'ECFEFF',         // Cyan 50
    textLight: '67E8F9',    // Cyan 300
    success: '4ADE80',      // Green 400
    warning: 'FB923C',      // Orange 400
    myTeamHighlight: '14B8A6',
  },
  'forest-green': {
    primary: '16A34A',      // Green 600
    secondary: '22C55E',    // Green 500
    accent: '86EFAC',       // Green 300
    background: '052E16',   // Dark green
    cardBg: '0D3B1F',       // Forest green
    text: 'F0FDF4',         // Green 50
    textLight: '86EFAC',    // Green 300
    success: '4ADE80',
    warning: 'FCD34D',      // Amber 300
    myTeamHighlight: '15803D',
  },
  'rose-gold': {
    primary: 'F43F5E',      // Rose 500
    secondary: 'FB7185',    // Rose 400
    accent: 'FFC1CC',       // Light pink
    background: '1C1917',   // Stone 900
    cardBg: '292524',       // Stone 800
    text: 'FFF1F2',         // Rose 50
    textLight: 'FDA4AF',    // Rose 300
    success: '34D399',
    warning: 'FCD34D',
    myTeamHighlight: 'BE123C',
  },
  'neon-nights': {
    primary: '00FF87',      // Neon green
    secondary: 'FF00FF',    // Magenta
    accent: '00FFFF',       // Cyan
    background: '0A0A0A',   // Near black
    cardBg: '1A1A2E',       // Dark blue-black
    text: 'FFFFFF',
    textLight: 'B8B8B8',
    success: '00FF87',
    warning: 'FFD700',      // Gold
    myTeamHighlight: 'FF00FF',
  },
  'minimalist-gray': {
    primary: '525252',      // Neutral 600
    secondary: '737373',    // Neutral 500
    accent: 'A3A3A3',       // Neutral 400
    background: 'FAFAFA',   // Neutral 50
    cardBg: 'F5F5F5',       // Neutral 100
    text: '171717',         // Neutral 900
    textLight: '525252',    // Neutral 600
    success: '22C55E',
    warning: 'F59E0B',
    myTeamHighlight: 'E5E5E5',
  },
};

// Combine base themes with web themes
export const ALL_THEMES: Record<WebThemeStyle, SlideColors> = {
  ...BASE_THEMES,
  ...WEB_THEMES,
};

export const THEME_OPTIONS: Record<WebThemeStyle, { name: string; description: string; preview: string[] }> = {
  'audley-brand': {
    name: 'Audley',
    description: 'Official Audley brand colors - teal and blue',
    preview: ['FFFFFF', '4D726D', '007BC7'],
  },
  'dark-modern': {
    name: 'Dark & Modern',
    description: 'Sleek dark theme with indigo and violet accents',
    preview: ['0F172A', '4F46E5', '7C3AED'],
  },
  'light-clean': {
    name: 'Light & Clean',
    description: 'Bright, professional with blue accents',
    preview: ['F8FAFC', '3B82F6', '0EA5E9'],
  },
  'vibrant-energy': {
    name: 'Vibrant Energy',
    description: 'Bold colors that pop - pink, purple, and teal',
    preview: ['18181B', 'EC4899', '8B5CF6'],
  },
  'corporate-blue': {
    name: 'Corporate Blue',
    description: 'Classic professional navy and gold',
    preview: ['1E3A5F', '3B82F6', 'F59E0B'],
  },
  'warm-sunset': {
    name: 'Warm Sunset',
    description: 'Friendly orange and coral tones',
    preview: ['1C1917', 'F97316', 'FB7185'],
  },
  'midnight-purple': {
    name: 'Midnight Purple',
    description: 'Deep purple with glowing accents',
    preview: ['0C0A1D', '9333EA', 'E879F9'],
  },
  'ocean-breeze': {
    name: 'Ocean Breeze',
    description: 'Cool cyan and teal tones',
    preview: ['042F2E', '0891B2', '22D3EE'],
  },
  'forest-green': {
    name: 'Forest Green',
    description: 'Natural green palette, calming',
    preview: ['052E16', '16A34A', '86EFAC'],
  },
  'rose-gold': {
    name: 'Rose Gold',
    description: 'Elegant rose and warm tones',
    preview: ['1C1917', 'F43F5E', 'FFC1CC'],
  },
  'neon-nights': {
    name: 'Neon Nights',
    description: 'Cyberpunk-inspired neon colors',
    preview: ['0A0A0A', '00FF87', 'FF00FF'],
  },
  'minimalist-gray': {
    name: 'Minimalist Gray',
    description: 'Clean, simple, light background',
    preview: ['FAFAFA', '525252', 'A3A3A3'],
  },
};

export const ANIMATION_OPTIONS: Record<AnimationStyle, { name: string; description: string }> = {
  'slide': {
    name: 'Slide',
    description: 'Smooth horizontal slide transitions',
  },
  'fade': {
    name: 'Fade',
    description: 'Elegant fade in/out transitions',
  },
  'zoom': {
    name: 'Zoom',
    description: 'Dynamic zoom scaling effect',
  },
  'flip': {
    name: 'Flip',
    description: '3D flip rotation effect',
  },
  'none': {
    name: 'None',
    description: 'Instant transitions, no animation',
  },
};

export const LAYOUT_OPTIONS: Record<LayoutStyle, { name: string; description: string }> = {
  'default': {
    name: 'Default',
    description: 'Balanced layout with decorative elements',
  },
  'minimalist': {
    name: 'Minimalist',
    description: 'Clean, distraction-free, focus on content',
  },
  'data-focused': {
    name: 'Data Focused',
    description: 'Larger numbers, more metrics visible',
  },
  'visual-impact': {
    name: 'Visual Impact',
    description: 'Bold typography, dramatic spacing',
  },
};

// Animation variants for different styles
export const getSlideTransition = (style: AnimationStyle, direction: 'left' | 'right') => {
  switch (style) {
    case 'fade':
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.4 },
      };
    case 'zoom':
      return {
        initial: { opacity: 0, scale: 0.8 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 1.2 },
        transition: { duration: 0.4, type: 'spring' as const, stiffness: 200, damping: 25 },
      };
    case 'flip':
      return {
        initial: { opacity: 0, rotateY: direction === 'right' ? 90 : -90 },
        animate: { opacity: 1, rotateY: 0 },
        exit: { opacity: 0, rotateY: direction === 'right' ? -90 : 90 },
        transition: { duration: 0.5 },
      };
    case 'none':
      return {
        initial: {},
        animate: {},
        exit: {},
        transition: { duration: 0 },
      };
    case 'slide':
    default:
      return {
        initial: { x: direction === 'right' ? '100%' : '-100%', opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: direction === 'right' ? '-100%' : '100%', opacity: 0 },
        transition: {
          x: { type: 'spring' as const, stiffness: 300, damping: 30 },
          opacity: { duration: 0.2 },
        },
      };
  }
};

// Layout-specific styles
export const getLayoutStyles = (layout: LayoutStyle): LayoutStyles => {
  switch (layout) {
    case 'minimalist':
      return {
        showDecorations: false,
        titleSize: 'text-3xl',
        valueSize: 'text-4xl',
        cardPadding: 'p-3',
        spacing: 'gap-3',
        headerMargin: 'mb-2',
      };
    case 'data-focused':
      return {
        showDecorations: false,
        titleSize: 'text-2xl',
        valueSize: 'text-8xl',
        cardPadding: 'p-4',
        spacing: 'gap-4',
        headerMargin: 'mb-2',
      };
    case 'visual-impact':
      return {
        showDecorations: true,
        titleSize: 'text-6xl',
        valueSize: 'text-7xl',
        cardPadding: 'p-10',
        spacing: 'gap-10',
        headerMargin: 'mb-10',
      };
    case 'default':
    default:
      return {
        showDecorations: true,
        titleSize: 'text-4xl',
        valueSize: 'text-6xl',
        cardPadding: 'p-6',
        spacing: 'gap-6',
        headerMargin: 'mb-4',
      };
  }
};
