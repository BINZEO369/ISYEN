import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14211d",
        moss: "#b6ef67",
        paper: "#f5f6f2",
      },
    },
  },
  plugins: [],
};

export default config;
