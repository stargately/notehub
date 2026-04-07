import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'monospace'],
      },
      colors: {
        accent: {
          50: '#fef2f2',
          100: '#fde3e3',
          200: '#fccbcb',
          300: '#f9a5a6',
          400: '#f07274',
          500: '#de4c4f',
          600: '#cc3538',
          700: '#ab282b',
          800: '#8e2528',
          900: '#772527',
        },
      },
    },
  },
  plugins: [typography],
} satisfies Config;
