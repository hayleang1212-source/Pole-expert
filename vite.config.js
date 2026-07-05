import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
 plugins: [
    react(),
    basicSsl() // 2. Ajoutez-le à la liste des plugins
  ],
  server: {
    // Optionnel : vous pouvez forcer l'ouverture automatique du navigateur
    https: true 
  }
});
