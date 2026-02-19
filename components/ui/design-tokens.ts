// Consolidated design tokens extracted from the codebase

export const Colors = {
  // Brand / Semantic
  primary: '#3b82f6', // blue-500
  secondary: '#64748b', // slate-500
  success: '#22c55e', // green-500
  warning: '#eab308', // yellow-500
  busy: '#f97316', // orange-500
  error: '#ef4444', // red-500
  info: '#3b82f6', // blue-500

  status: {
    healthy: '#22c55e',
    moderate: '#eab308',
    busy: '#f97316',
    overloaded: '#ef4444',
  },

  // Neutrals / Surface
  background: '#0f172a', // slate-900 (inferred)
  surface: '#1e293b', // slate-800
  surfaceHighlight: '#334155', // slate-700

  // Text
  text: {
    primary: '#f8fafc', // slate-50
    secondary: '#cbd5e1', // slate-300
    tertiary: '#94a3b8', // slate-400
  },

  // Specifics
  loader: {
      cyan: '#06b6d4',
      pink: '#ec4899',
      amber: '#f59e0b',
  },

  debug: 'rgba(220, 38, 38, 0.6)',
  transparent: 'transparent',
  white: '#ffffff',
  black: '#000000',
  border: '#334155', // slate-700 (often used as border)
};

export const Gradients = {
    appBackground: ['#0f172a', '#1e1b4b', '#312e81'],
    loader: ['#06b6d4', '#ec4899', '#f59e0b'],
};

// Extracted from ColorPicker.tsx
export const Palette = [
    '#ef4444', // red-500
    '#f43f5e', // rose-500
    '#ec4899', // pink-500
    '#d946ef', // fuchsia-500

    '#f97316', // orange-500
    '#f59e0b', // amber-500
    '#eab308', // yellow-500
    '#84cc16', // lime-500

    '#22c55e', // green-500
    '#10b981', // emerald-500
    '#14b8a6', // teal-500
    '#06b6d4', // cyan-500

    '#0ea5e9', // sky-500
    '#3b82f6', // blue-500
    '#6366f1', // indigo-500
    '#8b5cf6', // violet-500

    '#a855f7', // purple-500
    '#78716c', // stone-500
    '#64748b', // slate-500
    '#71717a', // zinc-500
];

export const Spacing = {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,

    // Semantic
    screenPadding: 15,
};

export const Shadows = {
    default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
};

export const Typography = {
    sizes: {
        xxs: 8,
        xs: 10,
        sm: 13,
        base: 15,
        lg: 18,
        xl: 20,
        xxl: 24,
    },
    weights: {
        medium: '500',
        bold: 'bold',
    }
};

export const Sizes = {
    dateRulerItemWidth: 56,
    loader: {
        small: 24,
        medium: 48,
        large: 96,
    },
    loaderBorder: {
        small: 2,
        medium: 3,
        large: 4,
    }
};
