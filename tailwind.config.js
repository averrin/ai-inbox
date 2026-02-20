const { Colors } = require('./components/ui/design-tokens.ts');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: Colors.primary,
        secondary: Colors.secondary,
        success: Colors.success,
        warning: Colors.warning,
        busy: Colors.busy,
        error: Colors.error,
        info: Colors.info,
        background: Colors.background,
        surface: Colors.surface,
        'surface-highlight': Colors.surfaceHighlight,
        border: Colors.border,
        'text-primary': Colors.text.primary,
        'text-secondary': Colors.text.secondary,
        'text-tertiary': Colors.text.tertiary,
      },
    },
  },
  plugins: [],
}
