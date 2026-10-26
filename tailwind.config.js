/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#8B6FD8",
        primaryDark: "#7657C9",
        primarySoft: "#EEE8FF",
        primaryExtraSoft: "#F7F4FF",
        surface: "#FAFAFC",
        textPrimary: "#25232A",
        textSecondary: "#77737F",
        textMuted: "#A3A0A8",
        borderSoft: "#ECEAF0",
        success: "#72C69A",
        warning: "#F2B866",
        danger: "#E98282",
        info: "#70A8DE",
        accentBlue: "#DDEEFF",
        accentGreen: "#E3F5E9",
        accentPeach: "#FBE9D0",
        accentYellow: "#FFE9B3",
        accentPink: "#FFE4EF",
        accentLilac: "#E9E1FF",
      },
      borderRadius: {
        xl2: "1.125rem",
      },
      boxShadow: {
        soft: "0 4px 20px rgba(40, 30, 70, 0.06)",
        softHover: "0 8px 28px rgba(40, 30, 70, 0.10)",
      },
    },
  },
  plugins: [],
};
