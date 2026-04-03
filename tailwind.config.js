/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#fefcf8',
          100: '#faf5ec',
          200: '#f2e8d5',
          300: '#e8d8bc',
        },
        coffee: {
          100: '#d4b896',
          200: '#c4a47c',
          300: '#a88660',
          400: '#8c6a48',
          500: '#6e5038',
          600: '#52392a',
          700: '#38261c',
          800: '#241810',
          900: '#120c08',
        },
        caramel: '#c8853a',
        latte: '#e8d5b4',
        tan: '#f0e4cc',
        espresso: '#1c1008',
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
      },
      animation: {
        'steam-rise': 'steamRise 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        steamRise: { '0%,100%': { opacity: 0.3, transform: 'translateY(0)' }, '50%': { opacity: 0.8, transform: 'translateY(-10px)' } },
        slideUp: { '0%': { transform: 'translateY(20px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
      },
    },
  },
  plugins: [],
}


