import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  server: {
    proxy: {
      // Proxy F1 audio files to bypass CORS — livetiming.formula1.com blocks localhost
      '/f1-audio': {
        target: 'https://livetiming.formula1.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/f1-audio/, ''),
      },
    },
  },
})
