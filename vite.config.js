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
  build: { outDir: 'dist' },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    allowedHosts: ["localhost", "pitchable-odell-spankingly.ngrok-free.dev"],
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
    },
  },
});
