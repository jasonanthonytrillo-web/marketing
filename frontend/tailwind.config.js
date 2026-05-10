/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 
          50: 'rgb(var(--primary-50))', 
          100: 'rgb(var(--primary-100))', 
          200: 'rgb(var(--primary-200))', 
          300: 'rgb(var(--primary-300))', 
          400: 'rgb(var(--primary-400))', 
          500: 'rgb(var(--primary-500))', 
          600: 'rgb(var(--primary-600))', 
          700: 'rgb(var(--primary-700))', 
          800: 'rgb(var(--primary-800))', 
          900: 'rgb(var(--primary-900))' 
        },
        surface: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617' },
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease forwards',
        'fade-in-up': 'fadeInUp 0.5s ease forwards',
        'slide-in': 'slideIn 0.3s ease forwards',
        'pulse-slow': 'pulse 3s infinite',
        'bounce-in': 'bounceIn 0.5s ease forwards',
        'glow': 'glow 2s infinite alternate',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        fadeInUp: { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideIn: { from: { opacity: 0, transform: 'translateX(-20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        bounceIn: { '0%': { transform: 'scale(0)', opacity: 0 }, '50%': { transform: 'scale(1.1)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
        glow: { 
          from: { boxShadow: '0 0 5px rgb(var(--primary-500) / 0.3)' }, 
          to: { boxShadow: '0 0 20px rgb(var(--primary-500) / 0.6)' } 
        },
      }
    },
  },
  plugins: [],
}
