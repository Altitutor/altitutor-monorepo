/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/shared/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        /** Large shells: cards, panels, table trays (`globals.css` --ucat-radius-shell) */
        ucatShell: "var(--ucat-radius-shell)",
        /** Buttons, icon controls, compact chips (`--ucat-radius-control`) */
        ucatControl: "var(--ucat-radius-control)",
      },
      transitionDuration: {
        "motion-snappy": "var(--motion-duration-snappy)",
        "motion-subtle": "var(--motion-duration-subtle)",
        "motion-enter": "var(--motion-duration-enter)",
      },
      transitionTimingFunction: {
        "motion-standard": "var(--motion-ease-standard)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        "brand-dark-border": "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        sidebar: "hsl(var(--sidebar))",
        "sidebar-foreground": "hsl(var(--sidebar-foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // Sync hex values with @altitutor/shared `MARKETING_TOKENS.colors`
        marketing: {
          primary: "#0a2941",
          accent: "#92b9c6",
          cream: "#F2F0E9",
          charcoal: "#1A1A1A",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
