/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Source des couleurs du design system. Trois d'entre elles sont
      // dupliquées dans `DesignColors` (src/constants/theme.ts) pour les
      // composants natifs qui ne prennent pas de className (Switch) :
      // toute modification d'accent, border ou surface.elevated doit y être
      // reportée.
      colors: {
        background: '#0A0A0B',
        surface: { DEFAULT: '#141416', elevated: '#1C1C1F' },
        border: '#2A2A2E',
        text: { primary: '#FAFAFA', secondary: '#8A8A8F', tertiary: '#5A5A60' },
        accent: '#D4F227',
        warning: '#F59E0B',
      },
      borderRadius: { card: '12px', sheet: '20px', pill: '9999px' },
    },
  },
  plugins: [],
};
