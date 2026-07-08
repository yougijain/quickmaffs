/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      spacing: {
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-l': 'env(safe-area-inset-left)',
        'safe-r': 'env(safe-area-inset-right)',
      },
      colors: {
        // Neutral, faintly-green near-blacks (Offsuit-inspired — not blue).
        ink: {
          950: '#080A09',
          900: '#0E1211',
          800: '#161B19',
          700: '#212824',
        },
        // Text ramp (warm off-white → muted).
        fg: '#E9ECEA',
        muted: '#8C948F',
        faint: '#5B635E',
        line: '#232A26',
        // Single restrained accent.
        brand: {
          DEFAULT: '#3ddc97',
          soft: '#6fe8b4',
          dim: '#1f8f63',
        },
        gold: '#e5b567',
      },
      borderRadius: {
        card: '1.25rem',
      },
      boxShadow: {
        glow: '0 0 40px -12px rgba(61, 220, 151, 0.35)',
        card: '0 1px 0 0 rgba(255,255,255,0.02) inset, 0 8px 24px -16px rgba(0,0,0,0.8)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Inter',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
