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
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("react") || id.includes("react-dom") || id.includes("scheduler")) {
            return "react";
          }

          if (id.includes("xlsx")) return "xlsx";
          if (id.includes("exceljs")) return "exceljs";
          if (id.includes("jszip")) return "jszip";
          if (id.includes("qrcode")) return "qrcode";
          if (id.includes("sweetalert2")) return "sweetalert2";
          if (id.includes("react-calendar")) return "calendar";
          if (id.includes("socket.io-client") || id.includes("engine.io-client")) return "realtime";

          return "vendor";
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
      "/socket.io": {
        target: "http://localhost:5000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
