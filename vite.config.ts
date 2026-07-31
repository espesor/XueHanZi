import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      workbox: {
        // 字库 275 KB，超过默认 2 MB 上限不至于，但显式列出更清楚
        globPatterns: ["**/*.{js,css,html,json,png,svg}"],
      },
      manifest: {
        name: "识字 — 学汉字",
        short_name: "识字",
        description: "从认得一些字，到能顺畅读书报。3500 常用字，按频率从易到难。",
        lang: "zh-CN",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#F1F2EE",
        theme_color: "#17607A",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
