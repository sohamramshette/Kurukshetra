import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Pinned to match FRONTEND_URL in backend/.env
    port: 3000,
    strictPort: false,
  },
})
