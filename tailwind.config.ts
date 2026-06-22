import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        muted: "var(--muted)",
        line: "var(--line)",
        terra: "var(--terra)",
        "terra-deep": "var(--terra-deep)",
        "terra-wash": "var(--terra-wash)",
        sage: "var(--sage)",
        gold: "var(--gold)",
      },
      fontFamily: {
        serif: "var(--serif)",
        sans: "var(--sans)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(43,38,34,.04), 0 8px 24px -12px rgba(43,38,34,.12)",
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
