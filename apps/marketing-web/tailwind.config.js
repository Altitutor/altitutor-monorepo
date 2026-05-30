/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        marketing: {
          primary: "#0a2941",
          accent: "#92b9c6",
          cream: "#F2F0E9",
          charcoal: "#1A1A1A",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
