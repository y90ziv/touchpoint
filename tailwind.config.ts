import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--tp-bg)',
        sidebar: 'var(--tp-sidebar)',
        card: 'var(--tp-card)',
        'card-hover': 'var(--tp-card-hover)',
        border: 'var(--tp-border)',
        foreground: 'var(--tp-text)',
        muted: 'var(--tp-muted)',
        primary: 'var(--tp-primary)',
        'primary-fg': 'var(--tp-primary-fg)',
        overdue: 'var(--tp-overdue)',
        warning: 'var(--tp-warning)',
        success: 'var(--tp-success)',
      },
      fontFamily: {
        heading: ['var(--tp-font-heading)', 'sans-serif'],
        body: ['var(--tp-font-body)', 'sans-serif'],
        editorial: ['var(--font-libre-baskerville)', 'Georgia', 'serif'],
        sans: ['var(--font-geist-sans)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
