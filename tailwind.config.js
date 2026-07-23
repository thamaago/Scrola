/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#121A15',
        surface: '#1A251E',
        surfaceRaised: '#223026',
        amber: '#D6A756',
        coral: '#FF7A6B',
        paper: '#EFEDE0',
        muted: '#8FA394',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      backgroundImage: {
        grain: "radial-gradient(circle at 1px 1px, rgba(239,237,224,0.035) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};
