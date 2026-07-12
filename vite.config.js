import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Le site est servi depuis https://hayleang1212-source.github.io/Pole-expert-KAESER/
  base: "/Pole-expert-KAESER/",
});
