/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
    "../shared/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#0f766e",
        accent: "#f59e0b",
        surface: "#0b172a",
      },
    },
  },
  plugins: [],
};
