import type { Config } from 'tailwindcss';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: 'var(--bg-main)',
          900: 'var(--bg-panel)',
          800: 'rgba(15,37,56,0.92)',
        },
        brand: {
          400: 'var(--primary-soft)',
          500: 'var(--primary)',
          600: 'var(--primary)',
          700: 'var(--primary)',
        },
        ink: {
          900: 'var(--text-main)',
          800: 'var(--text-soft)',
          700: 'var(--text-muted)',
          500: 'var(--text-muted)',
        },
        line: 'var(--border)',
        white: '#ffffff',
        background: 'var(--bg-main)',
        surface: 'var(--bg-panel)',
        card: 'var(--bg-card)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        card: 'var(--radius-card)',
        input: 'var(--radius-input)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        soft: 'var(--shadow-soft)',
      },
      backgroundImage: {
        'brand-gradient': 'none',
      },
    },
  },
  plugins: [],
} satisfies Config;
