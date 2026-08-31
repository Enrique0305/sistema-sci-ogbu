/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ogbu: {
          50: '#eff6ff',
          100: '#dbeafe',
          300: '#f0a6b4',
          500: '#a8324a',
          600: '#7a0019',
          700: '#5c0013',
        },
      },
    },
  },
  plugins: [],
};
