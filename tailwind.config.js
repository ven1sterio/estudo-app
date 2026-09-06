/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#8B85F0",
        primaryDark: "#726BDE",
        primarySoft: "#EDEBFF",
        surface: "#F7F7FC",
        accentBlue: "#A8D8F0",
        accentGreen: "#B8E6D5",
        accentPeach: "#FFD9C7",
        accentYellow: "#FFE9B3",
        accentPink: "#F5C9E0",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        soft: "0 4px 20px rgba(120, 110, 200, 0.08)",
      },
    },
  },
  plugins: [],
};
