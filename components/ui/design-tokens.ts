// Consolidated design tokens extracted from the codebase

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------

const PrimitiveColors = {
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',

    slate: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a',
        950: '#020617',
    },

    // Brand Blue/Indigo
    brand: {
        DEFAULT: '#9f6efa', // Custom brand color (was #9f6efaff)
        subtle: 'rgba(159, 110, 250, 0.2)', // 20% opacity
        light: '#c4b5fd', // violet-300 approx
    },

    red: {
        500: '#ef4444',
    },
    green: {
        500: '#22c55e',
    },
    yellow: {
        500: '#eab308',
    },
    orange: {
        500: '#f97316',
    },
    blue: {
        500: '#3b82f6',
    },
    cyan: {
        500: '#06b6d4',
    },
    pink: {
        500: '#ec4899',
    },
    amber: {
        500: '#f59e0b',
    },
};

// -----------------------------------------------------------------------------
// Semantics
// -----------------------------------------------------------------------------

export const Colors = {
    // Brand / Semantic
    primary: PrimitiveColors.brand.DEFAULT,
    primarySubtle: PrimitiveColors.brand.subtle, // New
    secondary: PrimitiveColors.slate[500],
    success: PrimitiveColors.green[500],
    warning: PrimitiveColors.yellow[500],
    busy: PrimitiveColors.orange[500],
    error: PrimitiveColors.red[500],
    info: PrimitiveColors.blue[500],

    status: {
        healthy: PrimitiveColors.green[500],
        moderate: PrimitiveColors.yellow[500],
        busy: PrimitiveColors.orange[500],
        overloaded: PrimitiveColors.red[500],
    },

    // Neutrals / Surface
    background: PrimitiveColors.slate[900],
    surface: PrimitiveColors.slate[800],
    surfaceHighlight: PrimitiveColors.slate[700],
    surfaceHighlightSubtle: 'rgba(51, 65, 85, 0.5)', // New

    // Text
    text: {
        primary: PrimitiveColors.slate[50],
        secondary: PrimitiveColors.slate[300],
        tertiary: PrimitiveColors.slate[400],
        inverse: PrimitiveColors.slate[900], // New
    },

    // Specifics
    loader: {
        cyan: PrimitiveColors.cyan[500],
        pink: PrimitiveColors.pink[500],
        amber: PrimitiveColors.amber[500],
    },

    debug: 'rgba(220, 38, 38, 0.6)',
    transparent: PrimitiveColors.transparent,
    white: PrimitiveColors.white,
    black: PrimitiveColors.black,
    border: PrimitiveColors.slate[700],
};

// -----------------------------------------------------------------------------
// Others
// -----------------------------------------------------------------------------

export const Gradients = {
    appBackground: ['#0f172a', '#1e1b4b', '#312e81'] as readonly string[],
    loader: ['#06b6d4', '#ec4899', '#f59e0b'] as readonly string[],
};

// Legacy Palette export for backward compatibility
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

export const Radii = {
    xs: 2,
    sm: 4,
    md: 6,
    lg: 8,
    xl: 12,
    xxl: 16,
    full: 9999,
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

export const IconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
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
