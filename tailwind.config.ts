import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f14",
        panel: "#121821",
        "panel-2": "#182130",
        line: "#243140",
        ink: "#e9eef3",
        "ink-dim": "#8496a8",
        scan: "#52e3c2",
        in: "#33d17a",
        out: "#ff9142",
        danger: "#ff5c5c",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        card: "14px",
      },
      keyframes: {
        sweep: {
          "0%": { top: "14px" },
          "50%": { top: "calc(100% - 16px)" },
          "100%": { top: "14px" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        sweep: "sweep 2.6s ease-in-out infinite",
        spin: "spin 0.9s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
