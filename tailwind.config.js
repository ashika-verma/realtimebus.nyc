/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          brand: '#20B2AA',  // lightseagreen — matches realtimerail.nyc
          light: '#e0f7f6',
          dark: '#178f87',
        },
      },
    },
  },
  plugins: [],
}
