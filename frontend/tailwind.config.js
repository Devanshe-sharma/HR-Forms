// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom brand colors
        'olive': {
          DEFAULT: '#7a8b2e',
          dark: '#4f5a22',
        },
        'bg-olive': '#f4f6f2',

        // If you want your own blue shade (otherwise just use blue-600 etc.)
        'brand-blue': '#3B82F6',

        // HR layout: top navbar dark theme
        'navy': {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
        },
      },

      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },

      // Optional: customize existing pulse if needed
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },

      // Optional: custom shadows, spacing, etc.
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'nav': '0 2px 10px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
}