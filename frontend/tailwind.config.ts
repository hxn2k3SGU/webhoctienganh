import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Manrope', 'sans-serif'], mono: ['DM Mono', 'monospace'] },
      colors: { ink: 'rgb(var(--ink) / <alpha-value>)', paper: 'rgb(var(--paper) / <alpha-value>)', line: 'rgb(var(--line) / <alpha-value>)', brand: 'rgb(var(--brand) / <alpha-value>)', coral: 'rgb(var(--coral) / <alpha-value>)', muted: 'rgb(var(--muted) / <alpha-value>)' },
      boxShadow: { card: '0 20px 60px rgba(25, 42, 36, .08)' },
    },
  },
  plugins: [],
} satisfies Config;
