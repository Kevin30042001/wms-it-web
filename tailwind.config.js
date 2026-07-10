/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B1220',          // chrome / sidebar (navy casi negro)
        surface: '#F6F7F9',      // fondo de la app
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
          operativo: '#1E9E55',
          reparacion: '#E8710A',
          fuera: '#D93025',
          bodega: '#0070CE',
          falla: '#B45309',
          transferido: '#6B7280',
        },
      },
      fontFamily: {
        display: ['"Barlow Semi Condensed"', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"Courier New"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(11 18 32 / 0.05), 0 1px 3px rgb(11 18 32 / 0.06)',
        pop: '0 8px 30px rgb(11 18 32 / 0.16)',
      },
    },
  },
  plugins: [],
}
