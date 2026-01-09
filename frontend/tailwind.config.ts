import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],

  theme: {
    extend: {
      /* ======================================================
         COLORS — MAPEADOS DIRETAMENTE DO theme.css
      ====================================================== */
      colors: {
        /* Background hierarchy */
        background: 'var(--bg-main)',
        surface: 'var(--bg-panel)',
        card: 'var(--bg-card)',

        /* Navy alias (legacy + semântico) */
        navy: {
          950: 'var(--bg-main)',
          900: 'var(--bg-panel)',
          800: 'var(--bg-card)',
        },

        /* Brand */
        brand: {
          DEFAULT: 'var(--primary)',
          soft: 'var(--primary-soft)',
          500: 'var(--primary)',
          600: 'var(--primary-600)',
          700: 'var(--primary-700)',
        },

        /* Text / Ink */
        ink: {
          DEFAULT: 'var(--text-main)',
          900: 'var(--text-main)',
          800: 'var(--text-soft)',
          700: 'var(--text-muted)',
          500: 'var(--text-muted)',
        },

        /* UI */
        line: 'var(--border)',

        /* Status */
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
      },

      /* ======================================================
         TYPOGRAPHY
      ====================================================== */
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },

      /* ======================================================
         RADIUS
      ====================================================== */
      borderRadius: {
        card: 'var(--radius-card)',
        input: 'var(--radius-input)',
        pill: 'var(--radius-pill)',
      },

      /* ======================================================
         SHADOWS
      ====================================================== */
      boxShadow: {
        card: 'var(--shadow-card)',
        soft: 'var(--shadow-soft)',
      },

      /* ======================================================
         BACKGROUND / EFFECTS
      ====================================================== */
      backgroundImage: {
        none: 'none',
      },
    },
  },

  plugins: [],
};

export default config;
