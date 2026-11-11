import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17231f",
        sage: "#dce8dc",
        moss: "#657f6d",
        canvas: "#f4f5f0",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(27, 42, 34, 0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
