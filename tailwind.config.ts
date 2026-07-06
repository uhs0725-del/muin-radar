import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        sat: {
          green: "#16a34a",
          yellow: "#d97706",
          red: "#dc2626",
        },
      },
    },
  },
  plugins: [],
};
export default config;
