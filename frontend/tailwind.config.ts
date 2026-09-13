import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0E14",
        paper: "#F6F4EE",
        accent: "#3D5A80",
        gold: "#C9A24B",
      },
    },
  },
  plugins: [],
};
export default config;
