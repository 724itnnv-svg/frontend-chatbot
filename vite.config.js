import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
//export default defineConfig({
//  plugins:[tailwindcss()], [react()]
//})


export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: '/',
  build: {
    outDir: 'dist',
    target: ['es2015', 'safari13'],
    cssTarget: ['safari12'],
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");
          if (!normalizedId.includes("/node_modules/")) return undefined;

          if (
            normalizedId.includes("/node_modules/react/") ||
            normalizedId.includes("/node_modules/react-dom/") ||
            normalizedId.includes("/node_modules/scheduler/")
          ) {
            return "react";
          }

          if (normalizedId.includes("/node_modules/xlsx/")) return "xlsx";
          if (normalizedId.includes("/node_modules/sweetalert2/")) return "sweetalert2";
          if (normalizedId.includes("/node_modules/react-calendar/")) return "calendar";
          if (
            normalizedId.includes("/node_modules/socket.io-client/") ||
            normalizedId.includes("/node_modules/engine.io-client/")
          ) {
            return "realtime";
          }

          return undefined;
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    allowedHosts: ["localhost", "pitchable-odell-spankingly.ngrok-free.dev", "https://chatbot-zhpy.onrender.com/"],
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        // nếu backend không dùng https, thường không cần secure
        // secure: false,
      },
      "/chatweb": {
        target: "http://localhost:5000",
        changeOrigin: true,
        // nếu backend không dùng https, thường không cần secure
        // secure: false,
      },
      "/user-avatars": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:5000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
