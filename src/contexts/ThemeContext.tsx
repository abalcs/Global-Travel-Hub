import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ThemeName = 'default' | 'audley';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
  isAudley: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'gtt-theme-preference';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return (saved === 'default' || saved === 'audley') ? saved : 'default';
  });

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    // Apply theme class to document root
    document.documentElement.classList.remove('theme-default', 'theme-audley');
    document.documentElement.classList.add(`theme-${theme}`);
  }, [theme]);

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prev => prev === 'default' ? 'audley' : 'default');
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      toggleTheme,
      isAudley: theme === 'audley'
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Theme color definitions for use in components
export const themeColors = {
  default: {
    // Current dark theme colors
    bg: {
      primary: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
      card: 'bg-slate-800/50',
      cardSolid: 'bg-slate-800',
      input: 'bg-slate-700/50',
    },
    text: {
      primary: 'text-white',
      secondary: 'text-slate-400',
      muted: 'text-slate-500',
    },
    border: {
      default: 'border-slate-700/50',
      solid: 'border-slate-700',
    },
    accent: {
      primary: 'text-teal-400',
      bg: 'bg-teal-600',
      hover: 'hover:bg-teal-700',
    },
  },
  audley: {
    // Audley Travel theme — Editorial Precision
    bg: {
      primary: 'bg-[#faf8f5]',
      card: 'bg-white',
      cardSolid: 'bg-white',
      input: 'bg-[#faf8f5]',
    },
    text: {
      primary: 'text-[#0a1628]',
      secondary: 'text-[#4a4a4a]',
      muted: 'text-[#7a7a7a]',
    },
    border: {
      default: 'border-[#ede8e0]',
      solid: 'border-[#ede8e0]',
    },
    accent: {
      primary: 'text-[#c4956a]',
      bg: 'bg-[#c4956a]',
      hover: 'hover:bg-[#b08055]',
    },
  },
};

// Helper hook to get current theme colors
export const useThemeColors = () => {
  const { theme } = useTheme();
  return themeColors[theme];
};
