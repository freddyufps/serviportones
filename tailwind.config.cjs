/**
 * Generates the same Tailwind v3 utilities that were previously generated
 * by the runtime CDN, from the app's HTML and JavaScript templates.
 */
module.exports = {
  content: ['./index.html', './assets/js/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          lime: '#71A832',
          limeHover: '#5d8c27',
          limeLight: '#f1f8eb',
          limeBorder: '#b3d88b',
          dark: '#111827',
          darkSurface: '#18202F',
          graphite: '#1f2937'
        }
      }
    }
  }
};
