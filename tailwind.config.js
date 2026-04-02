/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: { 50: '#fdfaf5', 100: '#f7f0e4', 200: '#edddc4' },
        coffee: { 100: '#c9a882', 200: '#b8935a', 300: '#9b7a45', 400: '#7d6035', 500: '#5c4a2a', 600: '#3d2f18', 700: '#2a1f0e', 800: '#1a1208', 900: '#0d0904' },
        espresso: '#1c1008',
        caramel: '#c8853a',
        latte: '#d4a96a',
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
      },
      animation: {
        'steam-rise': 'steamRise 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        steamRise: { '0%,100%': { opacity: 0.3, transform: 'translateY(0)' }, '50%': { opacity: 0.8, transform: 'translateY(-10px)' } },
        slideUp: { '0%': { transform: 'translateY(20px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        shimmer: { '0%,100%': { opacity: 0.8 }, '50%': { opacity: 1 } },
      },
    },
  },
  plugins: [],
}
