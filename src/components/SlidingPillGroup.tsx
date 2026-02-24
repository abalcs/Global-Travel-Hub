import { useRef, useLayoutEffect, useState, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';

export interface PillOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SlidingPillGroupProps<T extends string = string> {
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Override the gradient used for the active pill */
  activeGradient?: { light: string; dark: string };
  /** Size variant */
  size?: 'sm' | 'md';
  /** Extra className on the outer container */
  className?: string;
}

/**
 * A row of option buttons with a smoothly-sliding highlight pill.
 * Single-selection only (radio-style).
 */
export function SlidingPillGroup<T extends string = string>({
  options,
  value,
  onChange,
  activeGradient,
  size = 'md',
  className = '',
}: SlidingPillGroupProps<T>) {
  const { isAudley } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const setButtonRef = useCallback((key: string, el: HTMLButtonElement | null) => {
    if (el) buttonRefs.current.set(key, el);
    else buttonRefs.current.delete(key);
  }, []);

  // Measure active button and position indicator
  useLayoutEffect(() => {
    const btn = buttonRefs.current.get(value);
    const container = containerRef.current;
    if (!btn || !container) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setIndicator({
      left: bRect.left - cRect.left,
      width: bRect.width,
      ready: true,
    });
  }, [value, options]);

  const defaultGradient = {
    light: 'linear-gradient(to right, #4d726d, #007bc7)',
    dark: 'linear-gradient(to right, #1a5c6e, #1a7fa8)',
  };
  const gradient = activeGradient || defaultGradient;

  const sizeClasses = size === 'sm'
    ? 'px-2 py-1 text-xs'
    : 'px-3 py-1.5 text-sm';

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-wrap gap-1 p-1 rounded-lg w-fit ${
        isAudley ? 'bg-[#eef5f4] border border-[#4d726d]/30 shadow-sm' : 'bg-slate-800/50'
      } ${className}`}
    >
      {/* Sliding highlight pill */}
      <div
        className={`absolute top-1 bottom-1 rounded-md shadow-sm ${
          indicator.ready ? 'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]' : ''
        }`}
        style={{
          left: indicator.left,
          width: indicator.width,
          background: isAudley ? gradient.light : gradient.dark,
          opacity: indicator.ready ? 1 : 0,
        }}
      />
      {options.map(({ value: optVal, label, disabled }) => (
        <button
          key={optVal}
          ref={(el) => setButtonRef(optVal, el)}
          onClick={() => {
            if (!disabled) {
              onChange(optVal);
              if (navigator.vibrate) navigator.vibrate(10);
            }
          }}
          disabled={disabled}
          className={`relative z-10 ${sizeClasses} rounded-md cursor-pointer font-medium whitespace-nowrap transition-colors duration-200 ${
            value === optVal
              ? 'text-white'
              : isAudley
                ? 'text-[#2a4a46] hover:text-[#007bc7] hover:bg-[#dcecea] disabled:opacity-50 disabled:cursor-not-allowed'
                : 'text-slate-300 hover:text-white hover:bg-slate-600/60 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
