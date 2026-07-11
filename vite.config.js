import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Nécessaire pour GitHub Pages : le site est servi depuis
  // https://hayleang1212.github.io/Pole-expert/
  // (pas à la racine du domaine), donc tous les chemins générés par Vite
  // doivent être préfixés en conséquence.
  base: "/Pole-expert/",
});
