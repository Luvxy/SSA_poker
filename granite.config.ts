import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "ssapoker",
  brand: {
    displayName: "싸칙 포커",
    primaryColor: "#3182F6",
    icon: "",
  },
  web: {
    host: "localhost",
    port: 5174,
    commands: {
      dev: "vite dev --host 0.0.0.0",
      build: "vite build",
    },
  },
  permissions: [],
  outdir: "dist",
});
