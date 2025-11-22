/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Colores principales del brand
        primary: {
          DEFAULT: '#8B5CF6', // violet-500
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
        secondary: {
          DEFAULT: '#EC4899', // pink-500
          50: '#FDF2F8',
          100: '#FCE7F3',
          200: '#FBCFE8',
          300: '#F9A8D4',
          400: '#F472B6',
          500: '#EC4899',
          600: '#DB2777',
          700: '#BE185D',
          800: '#9D174D',
          900: '#831843',
        },
        accent: {
          DEFAULT: '#F59E0B', // amber-500
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Poppins', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'violet': '0 10px 25px -5px rgba(139, 92, 246, 0.3)',
        'pink': '0 10px 25px -5px rgba(236, 72, 153, 0.3)',
        'gradient':
          '0 10px 25px -5px rgba(139, 92, 246, 0.2), 0 10px 25px -5px rgba(236, 72, 153, 0.2)',
        'soft': '0 2px 8px rgba(0, 0, 0, 0.05)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
        'gradient-secondary': 'linear-gradient(135deg, #EC4899 0%, #F59E0B 100%)',
        'gradient-soft': 'linear-gradient(135deg, #A78BFA 0%, #F472B6 100%)',
        'gradient-creative':
          'linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #F59E0B 100%)',
        'mesh-light':
          'radial-gradient(at 0% 0%, rgba(139, 92, 246, 0.1) 0, transparent 50%), radial-gradient(at 100% 100%, rgba(236, 72, 153, 0.1) 0, transparent 50%)',
        'dots': 'radial-gradient(circle, #8B5CF6 1px, transparent 1px)',
      },
      backgroundSize: {
        'dots-size': '20px 20px',
      },
      animation: {
        'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        'fade-in-up': {
          '0%': {
            transform: 'translateY(20px)',
            opacity: '0',
          },
          '100%': {
            transform: 'translateY(0)',
            opacity: '1',
          },
        },
        'slide-in-right': {
          '0%': {
            transform: 'translateX(100%)',
            opacity: '0',
          },
          '100%': {
            transform: 'translateX(0)',
            opacity: '1',
          },
        },
      },
    },
  },
  plugins: [],
};
