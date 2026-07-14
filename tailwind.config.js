/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // GO Mobility brand — gold accents on warm cream base
        brand: {
          50:  '#fffdf8',
          100: '#fffaf1',
          200: '#fff5dc',
          300: '#f8f3e8',
          400: '#f0d799',
          500: '#e2bd70',
          600: '#c79a3b',
          700: '#a97c2f',
          800: '#8a6427',
          900: '#5f4519',
        },
        surface: {
          DEFAULT: '#ffffff',
          soft:    '#fffdf8',
          muted:   '#fffaf1',
          alt:     '#f8f3e8',
        },
        ink: {
          DEFAULT: '#0b0b0b',
          soft:    '#171717',
          muted:   '#645f57',
          faint:   '#8a8176',
          cool:    '#8a8d99',
        },
        line: {
          DEFAULT: '#eae2d1',
          soft:    '#f0e9d9',
          strong:  '#d9c8a1',
        },
        accent: {
          navy:    '#062154',
          navyMid: '#1e3a8a',
          saffron: '#FF9933',
          green:   '#138808',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(11, 11, 11, 0.04), 0 1px 3px 0 rgba(11, 11, 11, 0.06)',
        pop:  '0 8px 24px -8px rgba(11, 11, 11, 0.15), 0 4px 8px -4px rgba(169, 124, 47, 0.08)',
      },
    },
  },
  plugins: [],
};
