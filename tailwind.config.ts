import type { Config } from 'tailwindcss';

const config: Config = {
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--tp-bg)',
        ground: 'var(--tp-ground, var(--tp-bg))',
        well: 'var(--tp-well)',
        sidebar: 'var(--tp-sidebar)',
        card: 'var(--tp-card)',
        'surface-card': 'var(--tp-surface-card, var(--tp-card))',
        'card-hover': 'var(--tp-card-hover)',
        border: 'var(--tp-border)',
        foreground: 'var(--tp-text)',
        muted: 'var(--tp-muted)',
        primary: {
          DEFAULT: 'var(--tp-primary)',
          fg: 'var(--tp-primary-fg)',
        },
        'primary-fg': 'var(--tp-primary-fg)',
        overdue: 'var(--tp-overdue)',
        warning: 'var(--tp-warning)',
        success: 'var(--tp-success)',
        info: 'var(--tp-info)',
      },
      fontFamily: {
        heading: ['var(--tp-font-heading)', 'sans-serif'],
        body: ['var(--tp-font-body)', 'sans-serif'],
        editorial: ['var(--font-libre-baskerville)', 'Georgia', 'serif'],
        sans: ['var(--font-geist-sans)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      transitionTimingFunction: {
        'snappy-out': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'snappy-in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      transitionDuration: {
        160: '160ms',
        220: '220ms',
      },
      scale: {
        97: '0.97',
        95: '0.95',
      },
    },
  },
  plugins: [],
};

export default config;
