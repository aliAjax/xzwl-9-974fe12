/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        incense: {
          50: '#FAF7F2',
          100: '#F5F0E6',
          200: '#E8DCC8',
          300: '#D4C19C',
          400: '#B8956A',
          500: '#8D6E63',
          600: '#6D4C41',
          700: '#5D4037',
          800: '#4E342E',
          900: '#3E2723',
        },
        sandal: {
          50: '#FFF8E7',
          100: '#FFEFC4',
          200: '#FFE082',
          300: '#FFD54F',
          400: '#FFCA28',
          500: '#FF8F00',
        },
        warning: {
          critical: '#C62828',
          warning: '#EF6C00',
          info: '#1565C0',
        },
        ink: {
          50: '#ECEFF1',
          100: '#CFD8DC',
          200: '#B0BEC5',
          300: '#90A4AE',
          400: '#78909C',
          500: '#607D8B',
          600: '#546E7A',
          700: '#455A64',
          800: '#37474F',
          900: '#263238',
        },
        bamboo: {
          50: '#F1F8E9',
          100: '#DCEDC8',
          200: '#C5E1A5',
          300: '#AED581',
          400: '#9CCC65',
          500: '#558B2F',
        },
      },
      fontFamily: {
        song: ['"Source Han Serif SC"', '"Noto Serif SC"', 'serif'],
        hei: ['"Source Han Sans SC"', '"Noto Sans SC"', 'sans-serif'],
      },
      backgroundImage: {
        'paper-texture': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
        'wood-grain': "linear-gradient(90deg, rgba(93,64,55,0.05) 0%, rgba(141,110,99,0.08) 50%, rgba(93,64,55,0.05) 100%)",
      },
      boxShadow: {
        'incense': '0 4px 20px rgba(93, 64, 55, 0.15)',
        'incense-lg': '0 8px 30px rgba(93, 64, 55, 0.2)',
        'card': '0 2px 8px rgba(93, 64, 55, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};
