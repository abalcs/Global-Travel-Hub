import { useTheme } from '../contexts/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { toggleTheme, isAudley } = useTheme();

  return (
    <div className="flex items-center gap-2">
      {/* Left label — "Light" visible in dark mode, invisible placeholder in light mode */}
      <span className={`text-xs font-medium transition-opacity duration-300 w-7 text-right ${
        !isAudley ? 'opacity-100 text-slate-300' : 'opacity-0'
      }`}>
        Light
      </span>

      <button
        onClick={() => {
          toggleTheme();
          if (navigator.vibrate) navigator.vibrate(10);
        }}
        className={`relative w-12 h-6 rounded-full transition-colors duration-300 cursor-pointer flex-shrink-0 ${
          isAudley
            ? 'bg-[#4d726d]'
            : 'bg-slate-600'
        }`}
        title={`Switch to ${isAudley ? 'dark' : 'light'} theme`}
        aria-label={`Current theme: ${isAudley ? 'Light' : 'Dark'}. Click to switch.`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
            isAudley ? 'left-1' : 'translate-x-6 left-1'
          }`}
        />
      </button>

      {/* Right label — "Dark" visible in light mode, invisible placeholder in dark mode */}
      <span className={`text-xs font-medium transition-opacity duration-300 w-7 ${
        isAudley ? 'opacity-100 text-[#4d726d]' : 'opacity-0'
      }`}>
        Dark
      </span>
    </div>
  );
};
