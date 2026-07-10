/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        wmblue: {
          DEFAULT: '#0070CE',
          dark: '#0D1B40',
          light: '#4FA9F0',
        },
        wmyellow: {
          DEFAULT: '#FFC220',
          dark: '#E8A800',
        },
        estado: {
          operativo: '#22A055',
          reparacion: '#E8710A',
          fuera: '#D93025',
          bodega: '#0070CE',
          falla: '#E8710A',
          transferido: '#6B7280',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
}
