/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ogbu: {
          50: '#eff6ff',
          100: '#dbeafe',
          600: '#7a0019',
          700: '#5c0013',
        },
      },
    },
  },
  plugins: [],
};
