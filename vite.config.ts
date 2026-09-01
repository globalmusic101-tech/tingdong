import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures relative assets path for Electron
  build: {
    rollupOptions: {
      // 팝업도 같은 빌드로 낸다 — 그래야 src/lib/translate 한 벌을 같이 쓸 수 있다
      input: {
        main: resolve(__dirname, 'index.html'),
        popup: resolve(__dirname, 'popup.html'),
      },
    },
  },
})
