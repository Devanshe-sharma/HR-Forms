/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",  // ← Yeh line sabse important
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}