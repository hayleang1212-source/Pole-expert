import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Nécessaire pour GitHub Pages : le site est servi depuis
  // https://VOTRE-UTILISATEUR.github.io/kaeser-pole-expert/
  // (pas à la racine du domaine), donc tous les chemins générés par Vite
  // doivent être préfixés en conséquence.
  base: "/kaeser-pole-expert/",
});
