/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/_layout.tsx",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f9ff",
          100: "#e0edff",
          500: "#2563eb", // blue tone for buttons
          700: "#1e40af",
        },
      },
    },
  },
  plugins: [],
};
