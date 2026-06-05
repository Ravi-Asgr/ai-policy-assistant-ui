import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Important for GitHub Pages project site:
  // https://<username>.github.io/<repo-name>/
  base: "/ai-policy-assistant-ui/"
});