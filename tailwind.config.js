/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        theme: {
          bg: 'var(--theme-bg)',
          surface: 'var(--theme-surface)',
          'surface-hover': 'var(--theme-surface-hover)',
          'surface-elevated': 'var(--theme-surface-elevated)',
          border: 'var(--theme-border)',
          'border-strong': 'var(--theme-border-strong)',
          overlay: 'var(--theme-overlay)',
          'overlay-nav': 'var(--theme-overlay-nav)',
          'overlay-dropdown': 'var(--theme-overlay-dropdown)',
          'input-bg': 'var(--theme-input-bg)',
          'text-primary': 'var(--theme-text-primary)',
          'text-muted': 'var(--theme-text-muted)',
          'text-muted-2': 'var(--theme-text-muted-2)',
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
